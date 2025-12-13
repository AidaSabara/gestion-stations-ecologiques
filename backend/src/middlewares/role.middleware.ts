// src/middlewares/role.middleware.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Interface pour l'utilisateur authentifié
 */
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  station_id?: string;
}

/**
 * Étend l'interface Request d'Express
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware de contrôle d'accès basé sur les rôles
 * @param allowedRoles - Liste des rôles autorisés
 */
export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Vérifier que l'utilisateur est authentifié
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise'
        });
      }

      const userRole = req.user.role;

      // Vérifier si le rôle de l'utilisateur est autorisé
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Permissions insuffisantes.',
          requiredRoles: allowedRoles,
          userRole: userRole
        });
      }

      // L'utilisateur a les permissions nécessaires
      next();
    } catch (error) {
      console.error('❌ Erreur middleware role:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur de vérification des permissions'
      });
    }
  };
};

/**
 * Middleware spécifique: Admin uniquement
 */
export const adminOnly = roleMiddleware(['admin']);

/**
 * Middleware spécifique: Admin ou Superviseur
 */
export const supervisorOrAbove = roleMiddleware(['admin', 'superviseur']);

/**
 * Middleware: Vérifie si l'utilisateur a accès à une station spécifique
 * Les admins et superviseurs ont accès à toutes les stations
 * Les agents n'ont accès qu'à leur station
 */
export const stationAccessMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stationId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Admin et superviseur ont accès à tout
    if (user.role === 'admin' || user.role === 'superviseur') {
      return next();
    }

    // Agent: vérifier que c'est sa station
    if (user.role === 'agent') {
      if (user.station_id !== stationId) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous ne pouvez accéder qu\'aux données de votre station.'
        });
      }
      return next();
    }

    // Rôle non reconnu
    return res.status(403).json({
      success: false,
      message: 'Rôle non autorisé'
    });
  } catch (error) {
    console.error('❌ Erreur middleware station access:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur de vérification d\'accès'
    });
  }
};

/**
 * Middleware: Log des accès par rôle (pour audit)
 */
export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user) {
    console.log(`🔐 [AUDIT] ${req.user.role} - ${req.user.email} - ${req.method} ${req.path}`);
  }
  next();
};