import express, { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ActivityLogService } from '../services/activity-log.service';
import { jwtMiddleware } from '../middlewares/jwt.middleware';
import { requireRole } from '../middlewares/roles.middleware';

const router = express.Router();
const authService = new AuthService();
const activityLogService = new ActivityLogService();

// Initialiser la connexion au service d'activité
activityLogService.connect().catch(err => {
  console.error('❌ Erreur connexion ActivityLogService:', err);
});

/**
 * POST /api/auth/login
 * Authentification générale
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
      return;
    }

    const result = await authService.login(email, password);

    if (!result.success) {
      // ❌ Logger l'échec de connexion
      try {
        await activityLogService.logActivity({
          userId: 'unknown',
          userName: email.split('@')[0],
          userEmail: email,
          userRole: 'unknown',
          action: 'user.login',
          status: 'error',
          description: `Tentative de connexion échouée pour ${email}`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            reason: result.message
          }
        });
      } catch (logError) {
        console.error('❌ Erreur log activité:', logError);
      }

      res.status(401).json(result);
      return;
    }

    // ✅ Logger la connexion réussie
    try {
      // 🔥 CORRECTION: Utiliser id (tel que défini dans le type)
      const userId = result.user!.id;
      
      console.log('🔍 DEBUG Login - User object:', JSON.stringify(result.user, null, 2));
      console.log('🔍 DEBUG Login - userId extrait:', userId);

      await activityLogService.logActivity({
        userId: userId,
        userName: result.user!.name || email.split('@')[0],
        userEmail: result.user!.email,
        userRole: result.user!.role,
        action: 'user.login',
        status: 'success',
        description: `${result.user!.email} s'est connecté avec succès`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          stationId: (result.user as any).stationId || (result.user as any).station_id
        }
      });
      console.log('✅ Activité de connexion enregistrée pour:', result.user!.email);
    } catch (logError) {
      console.error('❌ Erreur log activité:', logError);
    }

    // Définir le refresh token dans un cookie HttpOnly
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      });
    }

    res.status(200).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      user: result.user
    });

  } catch (error) {
    console.error('❌ Erreur route /login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/login-station
 * Authentification pour une station spécifique
 */
router.post('/login-station', async (req: Request, res: Response) => {
  try {
    const { stationId, email, password } = req.body;

    if (!stationId || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'stationId, email et password requis'
      });
      return;
    }

    const result = await authService.loginForStation(stationId, email, password);

    if (!result.success) {
      // ❌ Logger l'échec
      try {
        await activityLogService.logActivity({
          userId: 'unknown',
          userName: email.split('@')[0],
          userEmail: email,
          userRole: 'unknown',
          action: 'station.access',
          status: 'error',
          description: `Échec d'accès à la station ${stationId} pour ${email}`,
          metadata: {
            stationId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            reason: result.message
          }
        });
      } catch (logError) {
        console.error('❌ Erreur log activité:', logError);
      }

      res.status(401).json(result);
      return;
    }

    // ✅ Logger l'accès réussi à la station
    try {
      // 🔥 CORRECTION: Utiliser id (tel que défini dans le type)
      const userId = result.user!.id;
      
      console.log('🔍 DEBUG Login-Station - User object:', JSON.stringify(result.user, null, 2));
      console.log('🔍 DEBUG Login-Station - userId extrait:', userId);

      await activityLogService.logActivity({
        userId: userId,
        userName: result.user!.name || email.split('@')[0],
        userEmail: result.user!.email,
        userRole: result.user!.role,
        action: 'station.access',
        status: 'success',
        description: `${result.user!.email} a accédé à la station ${stationId}`,
        metadata: {
          stationId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
      console.log('✅ Activité d\'accès station enregistrée pour:', result.user!.email);
    } catch (logError) {
      console.error('❌ Erreur log activité:', logError);
    }

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    res.status(200).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      user: result.user
    });

  } catch (error) {
    console.error('❌ Erreur route /login-station:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Rafraîchir le token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'Refresh token manquant'
      });
      return;
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      res.status(401).json(result);
      return;
    }

    res.status(200).json({
      success: result.success,
      message: result.message,
      accessToken: result.accessToken,
      user: result.user
    });

  } catch (error) {
    console.error('❌ Erreur route /refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion
 */
router.post('/logout', jwtMiddleware, async (req: Request, res: Response) => {
  try {
    // ✅ Logger la déconnexion AVANT de vider les données
    if (req.user) {
      try {
        console.log('🔍 DEBUG Logout - req.user:', JSON.stringify(req.user, null, 2));
        
        await activityLogService.logActivity({
          userId: req.user.userId,
          userName: req.user.email.split('@')[0],
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'user.logout',
          status: 'success',
          description: `${req.user.email} s'est déconnecté`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          }
        });
        console.log('✅ Activité de déconnexion enregistrée pour:', req.user.email);
      } catch (logError) {
        console.error('❌ Erreur log activité logout:', logError);
      }
    }

    res.clearCookie('refreshToken');

    console.log(`✅ Déconnexion: ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('❌ Erreur route /logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/auth/me
 * Obtenir les informations de l'utilisateur connecté
 */
router.get('/me', jwtMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        stationId: req.user.stationId,
        permissions: req.user.permissions
      }
    });

  } catch (error) {
    console.error('❌ Erreur route /me:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/auth/verify
 * Vérifier la validité du token
 */
router.get('/verify', jwtMiddleware, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    valid: true,
    message: 'Token valide'
  });
});

export default router;