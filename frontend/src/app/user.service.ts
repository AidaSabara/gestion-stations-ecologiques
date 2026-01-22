import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { User, CreateUserDto, UpdateUserDto } from './models/user.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUsers();
  }

  /**
   * Créer les headers avec le token d'authentification
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Charge tous les utilisateurs depuis le backend
   */
  private loadUsers(): void {
    this.getAllUsers().subscribe({
      next: (users) => {
        this.usersSubject.next(users);
        console.log('✅ Utilisateurs chargés:', users.length);
      },
      error: (error) => {
        console.error('❌ Erreur chargement users:', error);
      }
    });
  }

  /**
   * Récupère tous les utilisateurs via l'API backend
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(this.apiUrl, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError((error) => {
        console.error('❌ Erreur getAllUsers:', error);
        return of([]);
      })
    );
  }

  /**
   * Récupère un utilisateur par son ID
   */
  getUserById(id: string): Observable<User | null> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(error => {
        console.error(`❌ Erreur getUserById ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Crée un nouvel utilisateur via l'API backend
   */
  createUser(userData: CreateUserDto): Observable<User> {
    return this.http.post<ApiResponse<User>>(this.apiUrl, userData, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        console.log('✅ Utilisateur créé:', response.data._id);
        return response.data;
      }),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error('❌ Erreur createUser:', error);
        throw error;
      })
    );
  }

  /**
   * Met à jour un utilisateur existant via l'API backend
   */
  updateUser(id: string, userData: Partial<UpdateUserDto>): Observable<User> {
    // Retirer _id et _kuzzle_info des updates
    const { _id, _kuzzle_info, ...updateData } = userData as any;

    return this.http.put<ApiResponse<User>>(`${this.apiUrl}/${id}`, updateData, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        console.log('✅ Utilisateur mis à jour:', response.data._id);
        return response.data;
      }),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error(`❌ Erreur updateUser ${id}:`, error);
        throw error;
      })
    );
  }

  /**
   * Supprime un utilisateur via l'API backend
   */
  deleteUser(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    }).pipe(
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
   * Active ou désactive un utilisateur via l'API backend
   */
  toggleUserStatus(id: string): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.apiUrl}/${id}/toggle-status`, {}, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      tap(() => this.loadUsers()),
      catchError(error => {
        console.error(`❌ Erreur toggleUserStatus ${id}:`, error);
        throw error;
      })
    );
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur via l'API backend
   */
  resetPassword(userId: string, newPassword: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${userId}/reset-password`,
      { newPassword },
      { headers: this.getHeaders() }
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
   * Récupère les statistiques des utilisateurs via l'API backend
   */
  getUserStats(): Observable<{
    total: number;
    active: number;
    inactive: number;
    byRole: { [key: string]: number };
    byStation: { [key: string]: number };
  }> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('❌ Erreur getUserStats:', error);
        // Fallback sur calcul local si l'API échoue
        return this.users$.pipe(
          map(users => this.calculateStatsLocally(users))
        );
      })
    );
  }

  /**
   * Calcule les statistiques localement (fallback)
   */
  private calculateStatsLocally(users: User[]): any {
    const stats = {
      total: users.length,
      active: users.filter(u => u.active).length,
      inactive: users.filter(u => !u.active).length,
      byRole: {} as { [key: string]: number },
      byStation: {} as { [key: string]: number }
    };

    users.forEach(user => {
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
      const stationName = user.station_name || 'Non assigné';
      stats.byStation[stationName] = (stats.byStation[stationName] || 0) + 1;
    });

    return stats;
  }

  /**
   * Recherche des utilisateurs par terme (côté client)
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
   * Vérifie si un email existe déjà (côté client)
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
   * Récupère les utilisateurs d'une station spécifique
   */
  getUsersByStation(stationId: string): Observable<User[]> {
    return this.users$.pipe(
      map(users => users.filter(u => u.station_id === stationId))
    );
  }

  /**
   * Compte le nombre total d'utilisateurs
   */
  countUsers(): Observable<number> {
    return this.users$.pipe(
      map(users => users.length)
    );
  }

  /**
   * Récupère les utilisateurs actifs
   */
  getActiveUsers(): Observable<User[]> {
    return this.users$.pipe(
      map(users => users.filter(u => u.active))
    );
  }
}
