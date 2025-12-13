// auth.service.ts - Version corrigée
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { User } from './models/user.model';


export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
  };
  user?: User;
  token?: string;
  accessToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  /**
   * 🔐 Connexion
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        console.log('🔍 Réponse brute du serveur:', response);
      }),
      // auth.service.ts (méthode login)

// ... (code inchangé jusqu'au début du map)
      map(response => {
 console.log('🔄 Normalisation de la réponse...');

        // Format 1 : Avec data.tokens (Inchangé)
        if (response.success && response.data?.user) {
          const user = this.normalizeUser(response.data.user);
          const token = response.data.tokens?.accessToken;

          console.log('✅ Format data.tokens détecté');
          this.storeUserAndToken(user, token);

          return {
            success: true,
            message: response.message,
            data: {
              user,
              tokens: response.data.tokens
            }
          };
        }

        // Format 2 : Direct avec user et token/accessToken
        // MODIFICATION CLÉ : Utiliser response.token OU response.accessToken
        if (response.user && (response.token || response.accessToken)) { // 👈 CORRECTION
          const user = this.normalizeUser(response.user);
          // Stocker le token présent (token ou accessToken)
          const tokenToStore = response.token || response.accessToken; // 👈 CORRECTION

          console.log('✅ Format direct détecté (avec token ou accessToken)');
          this.storeUserAndToken(user, tokenToStore);

          return {
            success: true,
 message: 'Connexion réussie',
user
 };
 }

 // Aucun format reconnu (Ce bloc sera maintenant évité)
       console.error('❌ Format de réponse non reconnu:', response);
return response;
}),

      catchError(this.handleError)
    );
  }

  /**
   * 🔐 Authentification pour station
   */
// Dans auth.service.ts, corriger authenticateForStation()
authenticateForStation(stationId: string, email: string, password: string): Observable<LoginResponse> {
  return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login-station`, {
    email,
    password,
    stationId
  }).pipe(
    tap(response => {
      console.log('🔍 Réponse login-station brute:', response);
    }),
    map(response => {
      // CORRECTION : Gérer tous les formats de réponse
      let normalizedResponse: LoginResponse;

      // Format direct avec accessToken
      if (response.success && (response as any).accessToken && (response as any).user) {
        const token = (response as any).accessToken;
        const user = this.normalizeUser((response as any).user);

        console.log('✅ Authentification station réussie (format direct)');
        this.storeUserAndToken(user, token);

        normalizedResponse = {
          success: true,
          message: response.message || 'Authentification réussie',
          user: user,
          token: token
        };
      }
      // Format avec data
      else if (response.success && response.data?.user) {
        const user = this.normalizeUser(response.data.user);
        const token = response.data.tokens?.accessToken;

        console.log('✅ Authentification station réussie (format data)');
        this.storeUserAndToken(user, token);

        normalizedResponse = {
          success: true,
          message: response.message,
          data: {
            user,
            tokens: response.data.tokens
          }
        };
      }
      // Format simple user/token
      else if (response.user && response.token) {
        const user = this.normalizeUser(response.user);

        console.log('✅ Authentification station réussie (format simple)');
        this.storeUserAndToken(user, response.token);

        normalizedResponse = {
          success: true,
          message: 'Authentification réussie',
          user
        };
      }
      // Échec
      else {
        console.log('❌ Échec authentification station');
        normalizedResponse = {
          success: false,
          message: response.message || 'Erreur d\'authentification'
        };
      }

      return normalizedResponse;
    }),
    catchError(this.handleError)
  );
}
 /**
   * 🔧 Normaliser l'utilisateur pour compatibilité
   */
  private normalizeUser(user: any): User {
  const normalized: User = {
    _id: user._id || user.id || '',
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'operator',
    station_id: user.station_id || user.stationId || '',
    station_name: user.station_name || user.stationName || '',
    permissions: user.permissions || {
      canAccessAlerts: false,
      canAccessGraphs: false,
      canAccessFilters: false,
      canAccessData: false,
      canManageUsers: false
    },
    phone: user.phone || '',
    active: user.active !== false,
    department: user.department || '',      // ✅ AJOUTÉ
    position: user.position || '',          // ✅ AJOUTÉ
    createdAt: user.createdAt || new Date().toISOString(),
    lastLogin: user.lastLogin || null
  };

  console.log('🔧 Utilisateur normalisé:', normalized);
  return normalized;
}

  /**
   * 💾 Stocker utilisateur et token
   */
  private storeUserAndToken(user: User, token?: string): void {
    console.log('💾 Stockage des données...');
    console.log('👤 User à stocker:', user);
    console.log('🔑 Token à stocker:', token ? 'OUI' : 'NON');

    // Stocker l'utilisateur
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
    console.log('✅ currentUser stocké dans localStorage');

    // Stocker le token
    if (token) {
      localStorage.setItem('accessToken', token);
      console.log('✅ accessToken stocké dans localStorage');
    } else {
      console.warn('⚠️ Aucun token à stocker !');
    }

    // Vérification immédiate
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('accessToken');
    console.log('🔍 Vérification stockage:');
    console.log('  - currentUser:', storedUser ? 'OK' : 'MANQUANT');
    console.log('  - accessToken:', storedToken ? 'OK' : 'MANQUANT');
  }

  /**
   * ✅ Vérifier l'authentification
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();

    const isAuth = !!(token && user);

    console.log('🔍 isAuthenticated() appelé:');
    console.log('  - Token présent:', !!token);
    console.log('  - User présent:', !!user);
    console.log('  - Résultat:', isAuth);

    return isAuth;
  }

  /**
   * 🔑 Gestion des tokens
   */
  getToken(): string | null {
    const token = localStorage.getItem('accessToken');
    console.log('🔑 getToken():', token ? 'Présent' : 'Absent');
    return token;
  }

  storeToken(token: string): void {
    localStorage.setItem('accessToken', token);
    console.log('✅ Token stocké');
  }

  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentStationId');
    console.log('🗑️ Tokens et user supprimés');
  }

  /**
   * 👤 Obtenir l'utilisateur actuel
   */
  getCurrentUser(): User | null {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('👤 getCurrentUser():', user.email);
        return user;
      } catch {
        console.error('❌ Erreur parsing currentUser');
        return null;
      }
    }
    console.log('👤 getCurrentUser(): Aucun user');
    return null;
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * 🛡️ Vérifier les permissions
   */
  hasPermission(permission: keyof User['permissions']): boolean {
    const user = this.currentUserValue;
    const hasPerm = user?.permissions?.[permission] ?? false;
    console.log(`🛡️ hasPermission(${permission}):`, hasPerm);
    return hasPerm;
  }

  isAdmin(): boolean {
    return this.currentUserValue?.role === 'admin';
  }

  canManageUsers(): boolean {
    return this.hasPermission('canManageUsers') || this.isAdmin();
  }

  /**
   * 🚪 Déconnexion
   */
  logout(): void {
    this.clearTokens();
    this.currentUserSubject.next(null);
    console.log('👋 Déconnexion réussie');
  }

  /**
   * ❌ Gestion des erreurs
   */
  private handleError(error: any): Observable<never> {
    console.error('❌ Erreur AuthService:', error);

    let errorMessage = 'Une erreur est survenue';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => ({
      success: false,
      message: errorMessage
    }));
  }
}
