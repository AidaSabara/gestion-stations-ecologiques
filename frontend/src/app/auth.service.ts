import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { KuzzleService } from './kuzzle.service';

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'agent' | 'admin' | 'supervisor';
  station_id: string;
  station_name?: string;
  permissions: {
    canAccessAlerts: boolean;
    canAccessGraphs: boolean;
    canAccessFilters: boolean;
    canAccessData: boolean;
    canManageUsers: boolean;
  };
  phone?: string;
  active: boolean;
  createdAt?: string;
  lastLogin?: string;
  _kuzzle_info?: {
    author: string;
    createdAt: string;
    updatedAt: string | null;
    updater: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor(private kuzzleService: KuzzleService) {
    // Récupérer l'utilisateur depuis localStorage au démarrage
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  /**
   * ✅ CORRECTION : Ajouter cette méthode manquante
   * Obtenir l'utilisateur actuel (méthode synchrone)
   */
// auth.service.ts
getCurrentUser(): User | null {
  // Vérifier d'abord le localStorage
  const userData = localStorage.getItem('currentUser');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('❌ Erreur parsing user data:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  // Vérifier la sessionStorage
  const sessionUserData = sessionStorage.getItem('currentUser');
  if (sessionUserData) {
    try {
      return JSON.parse(sessionUserData);
    } catch (error) {
      console.error('❌ Erreur parsing session user data:', error);
      sessionStorage.removeItem('currentUser');
      return null;
    }
  }

  return null;
}

isAuthenticated(): boolean {
  const user = this.getCurrentUser();
  return !!user;
}
  /**
   * Obtenir l'utilisateur actuellement connecté
   */
  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }


  /**
   * Vérifier si l'utilisateur a accès à une station
   */
  hasAccessToStation(stationId: string): boolean {
    const user = this.currentUserValue;
    if (!user) return false;

    // Admin a accès à tout
    if (user.role === 'admin' || user.station_id === 'ALL') return true;

    // Vérifier si c'est la station de l'agent
    return user.station_id === stationId;
  }

  /**
   * Authentifier un agent pour une station spécifique
   */
  async authenticateForStation(stationId: string, email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      console.log('🔐 Tentative d\'authentification:', { stationId, email });

      // Rechercher l'utilisateur par email
      const users = await this.kuzzleService.getUserByEmail(email);

      if (!users || users.length === 0) {
        return {
          success: false,
          message: 'Email non trouvé. Veuillez vérifier vos identifiants.'
        };
      }

      const user = users[0];
      const userData = user._source || user;

      // Vérifier le mot de passe (en production, utiliser bcrypt)
      if (userData.password !== password) {
        return {
          success: false,
          message: 'Mot de passe incorrect.'
        };
      }

      // Vérifier si le compte est actif
      if (!userData.active) {
        return {
          success: false,
          message: 'Votre compte est désactivé. Contactez l\'administrateur.'
        };
      }

      // Vérifier l'accès à la station
      if (userData.role !== 'admin' && userData.station_id !== 'ALL' && userData.station_id !== stationId) {
        return {
          success: false,
          message: `Vous n'avez pas accès à cette station. Votre station assignée : ${userData.station_name || userData.station_id}`
        };
      }

      // Créer l'objet utilisateur (sans le mot de passe pour la sécurité)
      const authenticatedUser: User = {
        _id: user._id,
        name: userData.name,
        email: userData.email,
        // ⚠️ NE PAS INCLURE LE MOT DE PASSE dans l'objet stocké
        role: userData.role,
        station_id: userData.station_id,
        station_name: userData.station_name,
        permissions: userData.permissions,
        phone: userData.phone,
        active: userData.active,
        createdAt: userData.createdAt,
        lastLogin: new Date().toISOString(),
        _kuzzle_info: userData._kuzzle_info
      };

      // Mettre à jour la dernière connexion dans Kuzzle
      await this.kuzzleService.updateUserLastLogin(user._id);

      // Sauvegarder dans localStorage (sans le mot de passe)
      localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      localStorage.setItem('currentStationId', stationId);

      // Émettre le nouvel utilisateur
      this.currentUserSubject.next(authenticatedUser);

      console.log('✅ Authentification réussie:', authenticatedUser.name);

      return {
        success: true,
        message: `Bienvenue ${authenticatedUser.name} !`,
        user: authenticatedUser
      };

    } catch (error) {
      console.error('❌ Erreur authentification:', error);
      return {
        success: false,
        message: 'Erreur de connexion. Veuillez réessayer.'
      };
    }
  }

  /**
   * Authentification générale (pour les admins)
   */
  async login(email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      console.log('🔐 Tentative de connexion admin:', email);

      // Rechercher l'utilisateur par email
      const users = await this.kuzzleService.getUserByEmail(email);

      if (!users || users.length === 0) {
        return {
          success: false,
          message: 'Email non trouvé. Veuillez vérifier vos identifiants.'
        };
      }

      const user = users[0];
      const userData = user._source || user;

      // Vérifier le mot de passe
      if (userData.password !== password) {
        return {
          success: false,
          message: 'Mot de passe incorrect.'
        };
      }

      // Vérifier si le compte est actif
      if (!userData.active) {
        return {
          success: false,
          message: 'Votre compte est désactivé. Contactez l\'administrateur.'
        };
      }

      // Créer l'objet utilisateur (sans le mot de passe)
      const authenticatedUser: User = {
        _id: user._id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        station_id: userData.station_id,
        station_name: userData.station_name,
        permissions: userData.permissions,
        phone: userData.phone,
        active: userData.active,
        createdAt: userData.createdAt,
        lastLogin: new Date().toISOString(),
        _kuzzle_info: userData._kuzzle_info
      };

      // Mettre à jour la dernière connexion dans Kuzzle
      await this.kuzzleService.updateUserLastLogin(user._id);

      // Sauvegarder dans localStorage (sans le mot de passe)
      localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      // Note: on ne définit pas de station spécifique pour l'admin ici

      // Émettre le nouvel utilisateur
      this.currentUserSubject.next(authenticatedUser);

      console.log('✅ Connexion admin réussie:', authenticatedUser.name);

      return {
        success: true,
        message: `Bienvenue ${authenticatedUser.name} !`,
        user: authenticatedUser
      };

    } catch (error) {
      console.error('❌ Erreur connexion admin:', error);
      return {
        success: false,
        message: 'Erreur de connexion. Veuillez réessayer.'
      };
    }
  }

  /**
   * Vérifier les permissions utilisateur
   */
  hasPermission(permission: keyof User['permissions']): boolean {
    const user = this.currentUserValue;
    return user?.permissions?.[permission] ?? false;
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.currentUserValue?.role === 'admin';
  }

  /**
   * Vérifier si l'utilisateur peut gérer les utilisateurs
   */
  canManageUsers(): boolean {
    return this.hasPermission('canManageUsers') || this.isAdmin();
  }

  /**
   * Déconnexion
   */
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentStationId');
    this.currentUserSubject.next(null);
    console.log('👋 Déconnexion réussie');
  }

  /**
   * Obtenir la station actuelle
   */
  getCurrentStationId(): string | null {
    return localStorage.getItem('currentStationId');
  }

  /**
   * Obtenir le nom de l'utilisateur
   */
  getUserName(): string {
    return this.currentUserValue?.name || 'Utilisateur';
  }
}
