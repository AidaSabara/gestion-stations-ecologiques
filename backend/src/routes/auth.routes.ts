import express, { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { jwtMiddleware } from '../middlewares/jwt.middleware';
import { requireRole } from '../middlewares/roles.middleware';

const router = express.Router();
const authService = new AuthService();

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
      res.status(401).json(result);
      return;
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
      res.status(401).json(result);
      return;
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
router.post('/logout', jwtMiddleware, (req: Request, res: Response) => {
  try {
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
