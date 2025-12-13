import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { KuzzleService } from './kuzzle.service';
import { User, CreateUserDto, UpdateUserDto } from './models/user.model';






@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private kuzzleService: KuzzleService) {
    this.waitForKuzzleConnection();
  }
  private async waitForKuzzleConnection(): Promise<void> {
    console.log('⏳ UserService: Attente connexion Kuzzle...');

    // Attendre jusqu'à 10 secondes max
    const maxAttempts = 50;
    let attempts = 0;

    const checkConnection = async (): Promise<boolean> => {
      if (this.kuzzleService.isConnected()) {
        console.log('✅ UserService: Kuzzle connecté, chargement users...');
        this.loadUsers();
        return true;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        console.error('❌ UserService: Timeout connexion Kuzzle');
        return false;
      }

      // Attendre 200ms et réessayer
      await new Promise(resolve => setTimeout(resolve, 200));
      return checkConnection();
    };

    await checkConnection();
  }

  /**
   * Charge tous les utilisateurs depuis Kuzzle
   */
private loadUsers(retryCount = 0): void {
    const maxRetries = 3;

    // Vérifier la connexion avant de charger
    if (!this.kuzzleService.isConnected()) {
      console.warn('⚠️ Kuzzle non connecté, nouvelle tentative dans 1s...');

      if (retryCount < maxRetries) {
        setTimeout(() => this.loadUsers(retryCount + 1), 1000);
      } else {
        console.error('❌ Impossible de charger les users: Kuzzle non connecté');
      }
      return;
    }

    this.getAllUsers().subscribe({
      next: (users) => {
        this.usersSubject.next(users);
        console.log('✅ Utilisateurs chargés:', users.length);
      },
      error: (error) => {
        console.error('❌ Erreur chargement users:', error);

        // Retry si erreur de connexion
        if (error.message?.includes('not connected') && retryCount < maxRetries) {
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries}...`);
          setTimeout(() => this.loadUsers(retryCount + 1), 2000);
        }
      }
    });
  }

  /**
   * Récupère tous les utilisateurs depuis Kuzzle
   */
    getAllUsers(): Observable<User[]> {
    return from(
      // Assurer la connexion avant de faire la requête
      this.kuzzleService.ensureConnection().then(() =>
        this.kuzzleService['kuzzle'].document.search(
          'iot',
          'users',
          {
            query: { match_all: {} }
          },
          {
            size: 1000,
            sort: [{ createdAt: 'desc' }]
          }
        )
      )
    ).pipe(
      map((response: any) => {
        return response.hits.map((hit: any) => ({
          _id: hit._id,
          ...hit._source
        }));
      }),
      catchError((error) => {
        console.error('❌ Erreur getAllUsers:', error);
        return of([]); // Retourner tableau vide au lieu de throw
      })
    );
  }


  /**
   * Récupère un utilisateur par son ID
   */
  getUserById(id: string): Observable<User | null> {
    return from(
      this.kuzzleService['kuzzle'].document.get('iot', 'users', id)
    ).pipe(
      map((response: any) => this.mapKuzzleUserToUser(response)),
      catchError(error => {
        console.error(`❌ Erreur getUserById ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Crée un nouvel utilisateur dans Kuzzle
   */
  createUser(userData: CreateUserDto): Observable<User> {
    const userDocument = {
      ...userData,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      active: userData.active !== undefined ? userData.active : true
    };

    return from(
      this.kuzzleService['kuzzle'].document.create(
        'iot',
        'users',
        userDocument,
        undefined,
        { refresh: 'wait_for' }
      )
    ).pipe(
      map((response: any) => {
        console.log('✅ Utilisateur créé:', response._id);
        return this.mapKuzzleUserToUser(response);
      }),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error('❌ Erreur createUser:', error);
        throw error;
      })
    );
  }

  /**
   * Met à jour un utilisateur existant
   */
  updateUser(id: string, userData: Partial<UpdateUserDto>): Observable<User> {
    // Retirer _id et _kuzzle_info des updates
    const { _id, _kuzzle_info, ...updateData } = userData as any;

    return from(
      this.kuzzleService['kuzzle'].document.update(
        'iot',
        'users',
        id,
        updateData,
        { refresh: 'wait_for' }
      )
    ).pipe(
      map((response: any) => {
        console.log('✅ Utilisateur mis à jour:', response._id);
        return this.mapKuzzleUserToUser(response);
      }),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error(`❌ Erreur updateUser ${id}:`, error);
        throw error;
      })
    );
  }

  /**
   * Supprime un utilisateur
   */
  deleteUser(id: string): Observable<void> {
    return from(
      this.kuzzleService['kuzzle'].document.delete(
        'iot',
        'users',
        id,
        { refresh: 'wait_for' }
      )
    ).pipe(
      map(() => {
        console.log('✅ Utilisateur supprimé:', id);
      }),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error(`❌ Erreur deleteUser ${id}:`, error);
        throw error;
      })
    );
  }

  /**
   * Active ou désactive un utilisateur
   */
  toggleUserStatus(id: string): Observable<User> {
    return this.getUserById(id).pipe(
      map(user => {
        if (!user) throw new Error('Utilisateur non trouvé');
        return user;
      }),
      map(user => ({ ...user, active: !user.active })),
      map(updatedUser => this.updateUser(id, updatedUser)),
      map(obs => obs as any)
    );
  }

  /**
   * Recherche des utilisateurs par terme
   */
  searchUsers(term: string): Observable<User[]> {
    const lowerTerm = term.toLowerCase();
    return this.users$.pipe(
      map(users => users.filter(user =>
        user.name.toLowerCase().includes(lowerTerm) ||
        user.email.toLowerCase().includes(lowerTerm) ||
        user.department.toLowerCase().includes(lowerTerm) ||
        user.position.toLowerCase().includes(lowerTerm)
      ))
    );
  }

  /**
   * Filtre les utilisateurs par rôle
   */
  filterUsersByRole(role: string): Observable<User[]> {
    if (role === 'all') {
      return this.users$;
    }
    return this.users$.pipe(
      map(users => users.filter(user => user.role === role))
    );
  }

  /**
   * Filtre les utilisateurs par statut
   */
  filterUsersByStatus(active: boolean): Observable<User[]> {
    return this.users$.pipe(
      map(users => users.filter(user => user.active === active))
    );
  }

  /**
   * Filtre les utilisateurs par station
   */
  filterUsersByStation(stationId: string): Observable<User[]> {
    if (stationId === 'ALL') {
      return this.users$;
    }
    return this.users$.pipe(
      map(users => users.filter(user => user.station_id === stationId))
    );
  }

  /**
   * Vérifie si un email existe déjà
   */
  checkEmailExists(email: string, excludeUserId?: string): Observable<boolean> {
    return this.users$.pipe(
      map(users => users.some(user =>
        user.email.toLowerCase() === email.toLowerCase() &&
        user._id !== excludeUserId
      ))
    );
  }

  /**
   * Obtient les statistiques des utilisateurs
   */
  getUserStats(): Observable<{
    total: number;
    active: number;
    inactive: number;
    byRole: { [key: string]: number };
    byStation: { [key: string]: number };
  }> {
    return this.users$.pipe(
      map(users => {
        const stats = {
          total: users.length,
          active: users.filter(u => u.active).length,
          inactive: users.filter(u => !u.active).length,
          byRole: {} as { [key: string]: number },
          byStation: {} as { [key: string]: number }
        };

        // Comptage par rôle
        users.forEach(user => {
          stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
        });

        // Comptage par station
        users.forEach(user => {
          const stationName = user.station_name || 'Non assigné';
          stats.byStation[stationName] = (stats.byStation[stationName] || 0) + 1;
        });

        return stats;
      })
    );
  }

  /**
   * Exporte les utilisateurs au format JSON
   */
  exportUsersToJson(): void {
    this.users$.subscribe(users => {
      const dataStr = JSON.stringify(users, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Exporte les utilisateurs au format CSV
   */
  exportUsersToCsv(): void {
    this.users$.subscribe(users => {
      const headers = ['ID', 'Nom', 'Email', 'Rôle', 'Station', 'Téléphone', 'Département', 'Poste', 'Actif', 'Date de création'];
      const csvData = [
        headers.join(','),
        ...users.map(u => [
          u._id,
          u.name,
          u.email,
          u.role,
          u.station_name,
          u.phone,
          u.department,
          u.position,
          u.active ? 'Oui' : 'Non',
          u.createdAt
        ].join(','))
      ].join('\n');

      const dataBlob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur
   */
  resetPassword(userId: string, newPassword: string): Observable<void> {
    return from(
      this.kuzzleService['kuzzle'].document.update(
        'iot',
        'users',
        userId,
        { password: newPassword },
        { refresh: 'wait_for' }
      )
    ).pipe(
      map(() => {
        console.log('✅ Mot de passe réinitialisé pour:', userId);
      }),
      catchError(error => {
        console.error('❌ Erreur resetPassword:', error);
        throw error;
      })
    );
  }

  /**
   * Met à jour la dernière connexion d'un utilisateur
   */
  updateLastLogin(userId: string): Observable<void> {
    return from(this.kuzzleService.updateUserLastLogin(userId)).pipe(
      catchError(error => {
        console.error('❌ Erreur updateLastLogin:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Recherche un utilisateur par email (utilisé pour l'authentification)
   */
  getUserByEmail(email: string): Observable<User | null> {
    return from(this.kuzzleService.getUserByEmail(email)).pipe(
      map((results: any[]) => {
        if (results.length === 0) return null;
        return this.mapKuzzleUserToUser(results[0]);
      }),
      catchError(error => {
        console.error('❌ Erreur getUserByEmail:', error);
        return of(null);
      })
    );
  }

  /**
   * Mappe un document Kuzzle vers l'interface User
   */
  private mapKuzzleUserToUser(hit: any): User {
    const source = hit._source || hit;

    return {
      _id: hit._id,
      _kuzzle_info: hit._kuzzle_info,
      name: source.name || '',
      email: source.email || '',
      password: source.password,
      role: source.role || 'operator',
      station_id: source.station_id || '',
      station_name: source.station_name || '',
      permissions: source.permissions || {
        canAccessAlerts: false,
        canAccessGraphs: false,
        canAccessFilters: false,
        canAccessData: false,
        canManageUsers: false
      },
      phone: source.phone || '',
      active: source.active !== undefined ? source.active : true,
      department: source.department || '',
      position: source.position || '',
      createdAt: source.createdAt || new Date().toISOString(),
      lastLogin: source.lastLogin || null,
      avatar: source.avatar
    };
  }

  /**
   * Récupère les utilisateurs d'une station spécifique
   */
  getUsersByStation(stationId: string): Observable<User[]> {
    return from(
      this.kuzzleService['kuzzle'].document.search(
        'iot',
        'users',
        {
          query: {
            term: {
              station_id: stationId
            }
          }
        },
        {
          size: 1000
        }
      )
    ).pipe(
      map((response: any) => {
        return response.hits.map((hit: any) => this.mapKuzzleUserToUser(hit));
      }),
      catchError(error => {
        console.error('❌ Erreur getUsersByStation:', error);
        return of([]);
      })
    );
  }

  /**
   * Compte le nombre total d'utilisateurs
   */
  countUsers(): Observable<number> {
    return from(
      this.kuzzleService['kuzzle'].document.count(
        'iot',
        'users',
        { query: { match_all: {} } }
      )
    ).pipe(
      catchError(error => {
        console.error('❌ Erreur countUsers:', error);
        return of(0);
      })
    );
  }

  /**
   * Récupère les utilisateurs actifs
   */
  getActiveUsers(): Observable<User[]> {
    return from(
      this.kuzzleService['kuzzle'].document.search(
        'iot',
        'users',
        {
          query: {
            term: {
              active: true
            }
          }
        },
        {
          size: 1000
        }
      )
    ).pipe(
      map((response: any) => {
        return response.hits.map((hit: any) => this.mapKuzzleUserToUser(hit));
      }),
      catchError(error => {
        console.error('❌ Erreur getActiveUsers:', error);
        return of([]);
      })
    );
  }
}
