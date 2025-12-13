import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { PasswordUtil } from '../utils/password.util';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';

export interface LoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    stationId: string;
    stationName?: string;
    permissions: any;
  };
}

export class AuthService {
  private kuzzle: any;

  constructor() {
    this.kuzzle = new Kuzzle(
      new WebSocket(process.env.KUZZLE_HOST || 'localhost', {
        port: parseInt(process.env.KUZZLE_PORT || '7512')
      })
    );
  }

  async connect(): Promise<void> {
    if (!this.kuzzle.connected) {
      await this.kuzzle.connect();
      console.log('✅ Backend AuthService connecté à Kuzzle');
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      await this.connect();

      const result = await this.kuzzle.document.search(
        'iot',
        'users',
        { query: { term: { email: email.toLowerCase().trim() } } },
        { size: 1 }
      );

      if (result.hits.length === 0) {
        console.warn('⚠️ Utilisateur non trouvé:', email);
        return { success: false, message: 'Email ou mot de passe incorrect' };
      }

      const userDoc = result.hits[0];
      const userData = userDoc._source as any;

      if (!userData.active) {
        console.warn('⚠️ Compte désactivé:', email);
        return { success: false, message: 'Compte désactivé' };
      }

      const isPasswordValid = await PasswordUtil.verify(password, userData.password);
      if (!isPasswordValid) {
        console.warn('⚠️ Mot de passe incorrect pour:', email);
        return { success: false, message: 'Email ou mot de passe incorrect' };
      }

      const jwtPayload: JwtPayload = {
        userId: userDoc._id,
        email: userData.email,
        role: userData.role,
        stationId: userData.station_id,
        permissions: userData.permissions
      };

      const accessToken = JwtUtil.generateAccessToken(jwtPayload);
      const refreshToken = JwtUtil.generateRefreshToken(userDoc._id);

      await this.kuzzle.document.update('iot', 'users', userDoc._id, {
        lastLogin: new Date().toISOString()
      });

      console.log('✅ Connexion réussie:', email);

      return {
        success: true,
        message: `Bienvenue ${userData.name} !`,
        accessToken,
        refreshToken,
        user: {
          id: userDoc._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          stationId: userData.station_id,
          stationName: userData.station_name,
          permissions: userData.permissions
        }
      };
    } catch (error) {
      console.error('❌ Erreur authentification:', error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  async loginForStation(stationId: string, email: string, password: string): Promise<LoginResponse> {
    try {
      const loginResult = await this.login(email, password);

      if (!loginResult.success || !loginResult.user) {
        return loginResult;
      }

      const user = loginResult.user;
      
      if (user.role !== 'admin' && 
          user.stationId !== 'ALL' && 
          user.stationId !== stationId) {
        console.warn(`⚠️ Accès refusé à la station ${stationId} pour ${email}`);
        return {
          success: false,
          message: `Vous n'avez pas accès à cette station. Votre station : ${user.stationName || user.stationId}`
        };
      }

      console.log('✅ Accès station autorisé:', stationId);
      return loginResult;

    } catch (error) {
      console.error('❌ Erreur loginForStation:', error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      await this.connect();

      const decoded = JwtUtil.verifyRefreshToken(refreshToken);

      if (!decoded) {
        return { success: false, message: 'Refresh token invalide ou expiré' };
      }

      const userDoc = await this.kuzzle.document.get('iot', 'users', decoded.userId);
      const userData = userDoc._source as any;

      if (!userData.active) {
        return { success: false, message: 'Compte désactivé' };
      }

      const jwtPayload: JwtPayload = {
        userId: userDoc._id,
        email: userData.email,
        role: userData.role,
        stationId: userData.station_id,
        permissions: userData.permissions
      };

      const newAccessToken = JwtUtil.generateAccessToken(jwtPayload);

      console.log('✅ Token rafraîchi pour:', userData.email);

      return {
        success: true,
        message: 'Token rafraîchi',
        accessToken: newAccessToken,
        user: {
          id: userDoc._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          stationId: userData.station_id,
          stationName: userData.station_name,
          permissions: userData.permissions
        }
      };

    } catch (error) {
      console.error('❌ Erreur refresh token:', error);
      return { success: false, message: 'Erreur lors du rafraîchissement du token' };
    }
  }

  disconnect(): void {
    if (this.kuzzle.connected) {
      this.kuzzle.disconnect();
      console.log('🔌 Backend AuthService déconnecté');
    }
  }
}
