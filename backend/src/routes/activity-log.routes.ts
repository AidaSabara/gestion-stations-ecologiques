// backend/src/routes/activity-log.routes.ts
import express, { Request, Response } from 'express';
import { ActivityLogService } from '../services/activity-log.service';
import { jwtMiddleware } from '../middlewares/jwt.middleware';
import { requireRole } from '../middlewares/roles.middleware';

const router = express.Router();
const activityLogService = new ActivityLogService();

activityLogService.connect().catch((err: any) => {
  console.error('❌ Impossible de connecter ActivityLogService:', err);
});

/**
 * GET /api/activity-logs
 * Récupère l'historique des activités
 * Permissions: Agent (ses logs), Supervisor (sa station), Admin (tout)
 */
router.get(
  '/',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const filters = {
        userId: req.query.userId as string,
        action: req.query.action as any,
        status: req.query.status as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        stationId: req.query.stationId as string,
        search: req.query.search as string
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const currentUser = {
        userId: req.user!.userId,
        role: req.user!.role,
        stationId: req.user!.stationId || (req.user as any).station_id || 'ALL'
      };

      const result = await activityLogService.getActivityLogs(
        filters,
        pagination,
        currentUser
      );

      res.status(200).json({
        success: true,
        data: result.logs,
        total: result.total,
        page: pagination.page,
        limit: pagination.limit
      });

    } catch (error: any) {
      console.error('❌ Erreur GET /activity-logs:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  }
);

/**
 * GET /api/activity-logs/stats
 * Récupère les statistiques des activités
 * Permissions: Tous (selon leur rôle)
 */
router.get(
  '/stats',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const currentUser = {
        userId: req.user!.userId,
        role: req.user!.role
      };

      const stats = await activityLogService.getActivityStats(currentUser);

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('❌ Erreur GET /activity-logs/stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  }
);

/**
 * GET /api/activity-logs/user/:userId
 * Récupère les logs d'un utilisateur spécifique
 * Permissions: Admin, Supervisor, ou l'utilisateur lui-même
 */
router.get(
  '/user/:userId',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const isAdminOrSupervisor = ['admin', 'supervisor'].includes(req.user!.role);
      const isSelf = req.user!.userId === userId;

      if (!isAdminOrSupervisor && !isSelf) {
        res.status(403).json({
          success: false,
          message: 'Accès refusé'
        });
        return;
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50
      };

      const result = await activityLogService.getUserActivityLogs(userId, pagination);

      res.status(200).json({
        success: true,
        data: result.logs,
        total: result.total
      });

    } catch (error: any) {
      console.error('❌ Erreur GET /activity-logs/user/:userId:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  }
);

/**
 * POST /api/activity-logs
 * Enregistre manuellement une activité
 * Permissions: Tous (pour leurs propres actions)
 */
router.post(
  '/',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const logData = {
        userId: req.user!.userId,
        userName: req.body.userName || req.user!.email,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: req.body.action,
        status: req.body.status || 'success',
        description: req.body.description,
        metadata: req.body.metadata
      };

      const log = await activityLogService.logActivity(logData);

      res.status(201).json({
        success: true,
        data: log
      });

    } catch (error: any) {
      console.error('❌ Erreur POST /activity-logs:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  }
);

/**
 * DELETE /api/activity-logs/cleanup
 * Supprime les anciens logs
 * Permissions: Admin uniquement
 */
router.delete(
  '/cleanup',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const daysToKeep = req.query.days ? parseInt(req.query.days as string) : 90;

      const deletedCount = await activityLogService.cleanOldLogs(daysToKeep);

      res.status(200).json({
        success: true,
        message: `${deletedCount} logs supprimés`,
        deletedCount
      });

    } catch (error: any) {
      console.error('❌ Erreur DELETE /activity-logs/cleanup:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur'
      });
    }
  }
);

export default router;