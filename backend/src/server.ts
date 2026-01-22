// backend/src/server.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import reportsRoutes from './routes/reports.routes';
import activityLogRoutes from './routes/activity-log.routes';
import sensorRoutes from './routes/sensor.routes';
import waterQualityRoutes from './routes/water-quality.routes'; 
import { SchedulerService } from './services/scheduler.service';
import { EmailService } from './services/email.service';
import { activityLoggerMiddleware } from './middlewares/activity-logger.middleware';


dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;
const schedulerService = new SchedulerService();
const emailService = new EmailService();

// ============================================
// MIDDLEWARES GLOBAUX
// ============================================

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ✅ MIDDLEWARE D'AUTO-LOGGING DES ACTIVITÉS (AVANT les routes)
app.use(activityLoggerMiddleware);

if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API Eco-Stations opérationnelle',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/water-quality', waterQualityRoutes); 


// Route 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path
  });
});

// ============================================
// GESTION DES ERREURS GLOBALE
// ============================================
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('❌ Erreur serveur:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

async function initializeReporting() {
  try {
    console.log('🔄 Initialisation du système de reporting...');
    const emailValid = await emailService.testConnection();
    if (!emailValid) {
      console.warn('⚠️ Configuration email invalide.');
    }
    await schedulerService.initialize();
    console.log('✅ Système de reporting initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation reporting:', error);
  }
}

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
app.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Reports API: http://localhost:${PORT}/api/reports`);
  console.log(`📋 Activity Logs API: http://localhost:${PORT}/api/activity-logs`);
  console.log(`📡 Sensors API: http://localhost:${PORT}/api/sensors`);
  console.log(`💧 Water Quality API: http://localhost:${PORT}/api/water-quality`); // ✅ NOUVEAU
  
  await initializeReporting();
});

process.on('SIGTERM', () => {
  schedulerService.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  schedulerService.stopAll();
  process.exit(0);
});

export default app;