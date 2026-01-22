// src/routes/user.routes.ts
import express, { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ActivityLogService } from '../services/activity-log.service';
import { jwtMiddleware } from '../middlewares/jwt.middleware';
import { requireRole } from '../middlewares/roles.middleware';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';

const router = express.Router();
const userService = new UserService();
const activityLogService = new ActivityLogService();

// Connexion initiale à Kuzzle
userService.connect().catch(err => {
  console.error('❌ Impossible de connecter UserService à Kuzzle:', err);
});

activityLogService.connect().catch(err => {
  console.error('❌ Impossible de connecter ActivityLogService à Kuzzle:', err);
});

/**
 * GET /api/users
 * Récupère tous les utilisateurs (avec filtres et pagination)
 * Accessible: Admin, Supervisor
 */
router.get(
  '/',
  jwtMiddleware,
  requireRole(['admin', 'supervisor']),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        role: req.query.role as any,
        station_id: req.query.station_id as string,
        active: req.query.active ? req.query.active === 'true' : undefined,
        search: req.query.search as string
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await userService.getAllUsers(filters, pagination);

      // Retirer les mots de passe
      const usersWithoutPasswords = result.users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.status(200).json({
        success: true,
        data: usersWithoutPasswords,
        total: result.total,
        page: pagination.page,
        limit: pagination.limit
      });

    } catch (error: any) {
      console.error('❌ Erreur route GET /users:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/stats
 * Récupère les statistiques des utilisateurs
 * Accessible: Admin, Supervisor
 */
router.get(
  '/stats',
  jwtMiddleware,
  requireRole(['admin', 'supervisor']),
  async (req: Request, res: Response) => {
    try {
      const stats = await userService.getUserStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('❌ Erreur route GET /users/stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/:id
 * Récupère un utilisateur par ID
 * Accessible: Admin, Supervisor, ou l'utilisateur lui-même
 */
router.get(
  '/:id',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Vérifier les permissions
      const isAdminOrSupervisor = ['admin', 'supervisor'].includes(req.user!.role);
      const isSelf = req.user!.userId === id;

      if (!isAdminOrSupervisor && !isSelf) {
        res.status(403).json({
          success: false,
          message: 'Accès refusé',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      const user = await userService.getUserById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Retirer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        data: userWithoutPassword
      });

    } catch (error: any) {
      console.error('❌ Erreur route GET /users/:id:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * POST /api/users
 * Crée un nouvel utilisateur
 * Accessible: Admin uniquement
 */
router.post(
  '/',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const userData: CreateUserDto = req.body;

      // Validation basique
      if (!userData.name || !userData.email || !userData.password) {
        res.status(400).json({
          success: false,
          message: 'Nom, email et mot de passe requis',
          code: 'MISSING_FIELDS'
        });
        return;
      }

      const user = await userService.createUser(userData);

      // 🔥 LOGGER L'ACTIVITÉ
      console.log('🔍 DEBUT LOGGING - Création utilisateur');
      console.log('🔍 req.user:', req.user);
      console.log('🔍 user créé:', user);
      
      try {
        await activityLogService.logActivity({
        userId: req.user!.userId,
        userName: req.user!.email.split('@')[0],
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'user.create',
        status: 'success',
        description: `${req.user!.email} a créé l'utilisateur ${user.name}`,
        metadata: {
          targetUserId: user._id,
          targetUserName: user.name,
          targetUserEmail: user.email,
          targetUserRole: user.role,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
      console.log('✅ FIN LOGGING - Activité enregistrée');
    } catch (logError) {
      console.error('❌ ERREUR LOGGING:', logError);
    }

      // Retirer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        data: userWithoutPassword
      });

    } catch (error: any) {
      console.error('❌ Erreur route POST /users:', error);

      if (error.message === 'EMAIL_EXISTS') {
        res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé',
          code: 'EMAIL_EXISTS'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur
 * Accessible: Admin, ou l'utilisateur lui-même (avec restrictions)
 */
router.put(
  '/:id',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userData: UpdateUserDto = req.body;

      // Vérifier les permissions
      const isAdmin = req.user!.role === 'admin';
      const isSelf = req.user!.userId === id;

      if (!isAdmin && !isSelf) {
        res.status(403).json({
          success: false,
          message: 'Accès refusé',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // Si l'utilisateur n'est pas admin, il ne peut modifier que certains champs
      if (!isAdmin) {
        const allowedFields = ['name', 'phone', 'password', 'avatar'];
        const requestedFields = Object.keys(userData);
        const unauthorizedFields = requestedFields.filter(
          field => !allowedFields.includes(field)
        );

        if (unauthorizedFields.length > 0) {
          res.status(403).json({
            success: false,
            message: `Champs non autorisés: ${unauthorizedFields.join(', ')}`,
            code: 'UNAUTHORIZED_FIELDS'
          });
          return;
        }
      }

      // Récupérer l'utilisateur avant modification pour la description
      const oldUser = await userService.getUserById(id);

      const user = await userService.updateUser(id, userData);

      // 🔥 LOGGER L'ACTIVITÉ
      console.log('🔍 DEBUT LOGGING - Modification utilisateur');
      console.log('🔍 req.user:', req.user);
      
      try {
        const changedFields = Object.keys(userData).filter(key => key !== 'password');
        await activityLogService.logActivity({
        userId: req.user!.userId,
        userName: req.user!.email.split('@')[0],
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'user.update',
        status: 'success',
        description: `${req.user!.email} a modifié l'utilisateur ${oldUser?.name || user.name}`,
        metadata: {
          targetUserId: user._id,
          targetUserName: user.name,
          targetUserEmail: user.email,
          changedFields: changedFields,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
      console.log('✅ FIN LOGGING - Activité update enregistrée');
    } catch (logError) {
      console.error('❌ ERREUR LOGGING UPDATE:', logError);
    }

      // Retirer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: userWithoutPassword
      });

    } catch (error: any) {
      console.error('❌ Erreur route PUT /users/:id:', error);

      if (error.message === 'EMAIL_EXISTS') {
        res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé',
          code: 'EMAIL_EXISTS'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Supprime un utilisateur
 * Accessible: Admin uniquement
 */
router.delete(
  '/:id',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Empêcher la suppression de soi-même
      if (id === req.user?.userId) {
        res.status(400).json({
          success: false,
          message: 'Vous ne pouvez pas supprimer votre propre compte',
          code: 'CANNOT_DELETE_SELF'
        });
        return;
      }

      // Récupérer l'utilisateur avant suppression
      const userToDelete = await userService.getUserById(id);

      await userService.deleteUser(id);

      // 🔥 LOGGER L'ACTIVITÉ
      await activityLogService.logActivity({
        userId: req.user!.userId,
        userName: req.user!.email.split('@')[0],
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'user.delete',
        status: 'success',
        description: `${req.user!.email} a supprimé l'utilisateur ${userToDelete?.name || id}`,
        metadata: {
          targetUserId: id,
          targetUserName: userToDelete?.name,
          targetUserEmail: userToDelete?.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(200).json({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      });

    } catch (error: any) {
      console.error('❌ Erreur route DELETE /users/:id:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * PATCH /api/users/:id/toggle-status
 * Active/désactive un utilisateur
 * Accessible: Admin uniquement
 */
router.patch(
  '/:id/toggle-status',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Empêcher de se désactiver soi-même
      if (id === req.user?.userId) {
        res.status(400).json({
          success: false,
          message: 'Vous ne pouvez pas modifier votre propre statut',
          code: 'CANNOT_TOGGLE_SELF'
        });
        return;
      }

      const user = await userService.toggleUserStatus(id);

      // 🔥 LOGGER L'ACTIVITÉ
      await activityLogService.logActivity({
        userId: req.user!.userId,
        userName: req.user!.email.split('@')[0],
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'user.toggle_status',
        status: 'success',
        description: `${req.user!.email} a ${user.active ? 'activé' : 'désactivé'} l'utilisateur ${user.name}`,
        metadata: {
          targetUserId: user._id,
          targetUserName: user.name,
          targetUserEmail: user.email,
          newStatus: user.active,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      // Retirer le mot de passe
      const { password, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        message: `Utilisateur ${user.active ? 'activé' : 'désactivé'} avec succès`,
        data: userWithoutPassword
      });

    } catch (error: any) {
      console.error('❌ Erreur route PATCH /users/:id/toggle-status:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

/**
 * POST /api/users/:id/reset-password
 * Réinitialise le mot de passe d'un utilisateur
 * Accessible: Admin uniquement
 */
router.post(
  '/:id/reset-password',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { newPassword } = req.body;

      if (!newPassword) {
        res.status(400).json({
          success: false,
          message: 'Nouveau mot de passe requis',
          code: 'MISSING_PASSWORD'
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 6 caractères',
          code: 'PASSWORD_TOO_SHORT'
        });
        return;
      }

      // Récupérer l'utilisateur avant modification
      const userToUpdate = await userService.getUserById(id);

      await userService.resetPassword(id, newPassword);

      // 🔥 LOGGER L'ACTIVITÉ
      await activityLogService.logActivity({
        userId: req.user!.userId,
        userName: req.user!.email.split('@')[0],
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: 'user.reset_password',
        status: 'success',
        description: `${req.user!.email} a réinitialisé le mot de passe de ${userToUpdate?.name || id}`,
        metadata: {
          targetUserId: id,
          targetUserName: userToUpdate?.name,
          targetUserEmail: userToUpdate?.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(200).json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });

    } catch (error: any) {
      console.error('❌ Erreur route POST /users/:id/reset-password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        code: 'SERVER_ERROR'
      });
    }
  }
);

export default router;