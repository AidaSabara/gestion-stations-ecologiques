import { Request, Response, NextFunction } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string; // Changez de 'UserRole' à 'string' pour plus de flexibilité
  stationId?: string;
}

type UserRole = 'agent' | 'admin' | 'supervisor';

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        console.warn('⚠️ Utilisateur non authentifié dans requireRole');
        res.status(401).json({
          success: false,
          message: 'Non authentifié',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        console.warn(`⚠️ Accès refusé: ${req.user.email} (${req.user.role}) n'a pas les droits`);
        res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas les permissions nécessaires',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
        return;
      }

      console.log(`✅ Accès autorisé: ${req.user.email} (${req.user.role})`);
      next();

    } catch (error) {
      console.error('❌ Erreur dans requireRole:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
        code: 'ROLE_CHECK_ERROR'
      });
    }
  };
};

export const requireStationAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const requestedStationId = req.params.stationId || req.body.stationId || req.query.stationId;

    if (req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.stationId === 'ALL') {
      console.log(`✅ Accès station autorisé (admin): ${req.user.email}`);
      next();
      return;
    }

    if (req.user.stationId !== requestedStationId) {
      console.warn(`⚠️ Accès station refusé: ${req.user.email} demande ${requestedStationId} mais a ${req.user.stationId}`);
      res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à cette station',
        code: 'STATION_ACCESS_DENIED',
        userStation: req.user.stationId,
        requestedStation: requestedStationId
      });
      return;
    }

    console.log(`✅ Accès station autorisé: ${req.user.email} → ${requestedStationId}`);
    next();

  } catch (error) {
    console.error('❌ Erreur dans requireStationAccess:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'accès à la station'
    });
  }
};
