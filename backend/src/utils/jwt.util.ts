import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'agent' | 'admin' | 'supervisor';
  stationId: string;
  permissions: {
    canAccessAlerts: boolean;
    canAccessGraphs: boolean;
    canAccessFilters: boolean;
    canAccessData: boolean;
    canManageUsers: boolean;
  };
}

export class JwtUtil {
  // Récupérer les secrets avec vérification
  private static getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET non configuré dans .env');
    }
    return secret;
  }

  private static getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET non configuré dans .env');
    }
    return secret;
  }

  // Méthode utilitaire pour créer les options
  private static createSignOptions(expiresIn: string | number, additionalOptions?: any): any {
    return {
      expiresIn,
      issuer: 'eco-stations-api',
      audience: 'eco-stations-app',
      algorithm: 'HS256',
      ...additionalOptions
    };
  }

  static generateAccessToken(payload: JwtPayload): string {
    const expiresIn = process.env.JWT_EXPIRATION || '24h';
    const options = this.createSignOptions(expiresIn);
    
    return jwt.sign(payload, this.getSecret(), options);
  }

  static generateRefreshToken(userId: string): string {
  const expiresIn = process.env.JWT_REFRESH_EXPIRATION || '7d';

  // On ne passe pas audience pour le refresh token
  const options = this.createSignOptions(expiresIn);

  return jwt.sign({ userId, type: 'refresh' }, this.getRefreshSecret(), options);
}


  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.getSecret(), {
        issuer: 'eco-stations-api',
        audience: 'eco-stations-app'
      }) as JwtPayload;
    } catch (error: any) {
      console.error('❌ Erreur vérification token:', error.message);
      return null;
    }
  }

  static verifyRefreshToken(token: string): { userId: string; type: string } | null {
    try {
      const decoded = jwt.verify(token, this.getRefreshSecret(), {
        issuer: 'eco-stations-api'
      }) as any;
      
      return decoded.type === 'refresh' 
        ? { userId: decoded.userId, type: decoded.type }
        : null;
    } catch (error: any) {
      console.error('❌ Erreur vérification refresh token:', error.message);
      return null;
    }
  }

  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const [bearer, token] = authHeader.split(' ');
    return bearer === 'Bearer' ? token : null;
  }
}