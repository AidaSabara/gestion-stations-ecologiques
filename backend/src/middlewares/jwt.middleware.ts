import { Request, Response, NextFunction } from 'express';
import { JwtUtil, JwtPayload } from '../utils/jwt.util';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const jwtMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtUtil.extractTokenFromHeader(authHeader);

    if (!token) {
      console.warn('⚠️ Token manquant dans la requête');
      res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    const payload = JwtUtil.verifyAccessToken(token);

    if (!payload) {
      console.warn('⚠️ Token invalide ou expiré');
      res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    req.user = payload;
    console.log(`✅ Authentification réussie pour: ${payload.email}`);

    next();

  } catch (error) {
    console.error('❌ Erreur dans jwtMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token',
      code: 'TOKEN_VERIFICATION_ERROR'
    });
  }
};

export const optionalJwtMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtUtil.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = JwtUtil.verifyAccessToken(token);
      if (payload) {
        req.user = payload;
        console.log(`✅ Token optionnel vérifié pour: ${payload.email}`);
      }
    }

    next();
  } catch (error) {
    console.error('❌ Erreur dans optionalJwtMiddleware:', error);
    next();
  }
};
