// src/middlewares/activity-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activity-log.service';
import { ActivityAction, ActivityStatus } from '../types/activity-log.types';

const activityLogService = new ActivityLogService();
activityLogService.connect().catch((err: any) => {
  console.error('❌ ActivityLogger middleware: impossible de se connecter', err);
});

/**
 * Middleware pour logger automatiquement certaines actions
 */
export const activityLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalSend = res.send;

  res.send = function(data: any): Response {
    const shouldLog = shouldLogRequest(req, res);

    if (shouldLog && req.user) {
      const logData = buildLogData(req, res, data);
      if (logData) {
        activityLogService.logActivity(logData).catch((err: any) => {
          console.error('❌ Erreur lors du logging d\'activité:', err);
        });
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Détermine si la requête doit être loggée
 */
function shouldLogRequest(req: Request, res: Response): boolean {
  if (!req.user) return false;

  const { method, path } = req;

  const loggedPaths = [
    '/api/users',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/data/export',
    '/api/alerts',
    '/api/stations'
  ];

  const isLoggedPath = loggedPaths.some(p => path.startsWith(p));
  const isSuccessful = res.statusCode >= 200 && res.statusCode < 400;

  return isLoggedPath && isSuccessful;
}

/**
 * Construit les données de log selon la requête
 */
function buildLogData(req: Request, res: Response, responseData: any): any {
  const { method, path, body } = req;
  const user = req.user!;

  let action: ActivityAction | null = null;
  let description = '';
  let metadata: any = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  };
  let status: ActivityStatus = 'success';

  // Login
  if (path === '/api/auth/login' && method === 'POST') {
    action = 'user.login';
    description = `${user.email} s'est connecté`;
  }

  // Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    action = 'user.logout';
    description = `${user.email} s'est déconnecté`;
  }

  // Création d'utilisateur
  if (path === '/api/users' && method === 'POST') {
    action = 'user.create';
    description = `${user.email} a créé l'utilisateur ${body.name}`;
    metadata.targetUserName = body.name;
    metadata.targetUserEmail = body.email;
  }

  // Mise à jour d'utilisateur
  if (path.startsWith('/api/users/') && method === 'PUT') {
    const userId = path.split('/')[3];
    action = 'user.update';
    description = `${user.email} a modifié un utilisateur`;
    metadata.targetUserId = userId;
    metadata.changes = body;
  }

  // Suppression d'utilisateur
  if (path.startsWith('/api/users/') && method === 'DELETE') {
    const userId = path.split('/')[3];
    action = 'user.delete';
    description = `${user.email} a supprimé un utilisateur`;
    metadata.targetUserId = userId;
  }

  // Toggle status
  if (path.includes('/toggle-status') && method === 'PATCH') {
    action = 'user.toggle_status';
    description = `${user.email} a modifié le statut d'un utilisateur`;
  }

  // Reset password
  if (path.includes('/reset-password') && method === 'POST') {
    action = 'user.reset_password';
    description = `${user.email} a réinitialisé le mot de passe d'un utilisateur`;
  }

  // Export de données
  if (path.includes('/export') && method === 'GET') {
    action = 'data.export';
    description = `${user.email} a exporté des données`;
    metadata.exportType = path.split('/').pop();
  }

  // Accès à une station
  if (path.startsWith('/api/stations/') && method === 'GET') {
    action = 'station.access';
    const stationId = path.split('/')[3];
    description = `${user.email} a consulté une station`;
    metadata.stationId = stationId;
  }

  if (!action) return null;

  return {
    userId: user.userId,
    userName: user.email.split('@')[0],
    userEmail: user.email,
    userRole: user.role,
    action,
    status,
    description,
    metadata
  };
}

/**
 * Helper pour logger manuellement une action
 */
export async function logCustomActivity(
  userId: string,
  userName: string,
  userEmail: string,
  userRole: string,
  action: ActivityAction,
  description: string,
  metadata?: any,
  status: ActivityStatus = 'success'
): Promise<void> {
  try {
    await activityLogService.logActivity({
      userId,
      userName,
      userEmail,
      userRole,
      action,
      status,
      description,
      metadata
    });
  } catch (error) {
    console.error('❌ Erreur logCustomActivity:', error);
  }
}