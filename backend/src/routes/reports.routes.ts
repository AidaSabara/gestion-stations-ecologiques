// src/routes/reports.routes.ts
import { Router, Request, Response } from 'express';
import { KuzzleService } from '../services/kuzzle.service';
import ReportService from '../services/report.service';
import { EmailService } from '../services/email.service'; // ✅ Utiliser votre EmailService existant
import { jwtMiddleware } from '../middlewares/jwt.middleware';
import { requireRole } from '../middlewares/roles.middleware';
import path from 'path';
import fs from 'fs';

const router = Router();

// ✅ Instances des services
const kuzzleService = new KuzzleService();
const reportService = new ReportService();
const emailService = new EmailService();

// ✅ Connexion initiale à Kuzzle
let isKuzzleConnected = false;

async function ensureKuzzleConnection() {
  if (!isKuzzleConnected) {
    try {
      await kuzzleService.connect();
      isKuzzleConnected = true;
      console.log('✅ Kuzzle connecté pour les rapports');
    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
      throw error;
    }
  }
}

/**
 * @route   POST /api/reports/generate/:stationId
 * @desc    Génère un rapport pour une station
 * @access  Admin, Superviseur
 */
router.post(
  '/generate/:stationId',
  jwtMiddleware,
  requireRole(['admin', 'supervisor']),
  async (req: Request, res: Response) => {
    try {
     const stationId = (req.query.stationId || req.params.stationId) as string;
      const { frequency = 'weekly', sendEmail = false, recipients = [] } = req.body;

      if (!['weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: 'Fréquence invalide. Utilisez "weekly" ou "monthly"'
        });
      }

      console.log(`📊 Génération rapport ${frequency} pour station: ${stationId}`);

      // ✅ Connexion à Kuzzle
      await ensureKuzzleConnection();

      // 1. Récupérer la station
      const stationRaw = await kuzzleService.getStation(stationId);
      
      if (!stationRaw) {
        return res.status(404).json({
          success: false,
          message: 'Station non trouvée'
        });
      }

      // ✅ Normaliser les données de la station
      // Kuzzle retourne les données directement à la racine du document
      const stationData = stationRaw.body || stationRaw._source || stationRaw;
      const station = {
        _id: stationRaw._id,
        body: {
          name: stationData.name,
          location: stationData.location,
          status: stationData.status,
          type: stationData.type,
          region: stationData.region,
          installedAt: stationData.installedAt
        }
      };

      // 2. Calculer la période
      const endDate = new Date();
      const startDate = new Date();
      
      if (frequency === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const period = {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      };

      console.log(`📅 Période: ${period.start} → ${period.end}`);

      // 3. Récupérer les données
      const [waterQuality, alerts, maintenances] = await Promise.all([
        kuzzleService.getWaterQualityData(stationId),
        kuzzleService.getAlerts(stationId, period.start, period.end),
        kuzzleService.getMaintenances(period.start, period.end)
      ]);

      // Filtrer par période
      const waterQualityFiltered = waterQuality.filter(wq => {
        const date = new Date(wq.body.date);
        return date >= startDate && date <= endDate;
      });

      console.log(`📊 Données récupérées:`);
      console.log(`   - Water quality: ${waterQualityFiltered.length}`);
      console.log(`   - Alerts: ${alerts.length}`);
      console.log(`   - Maintenances: ${maintenances.length}`);

      // 4. Générer le PDF
      const reportData = {
        station,
        waterQuality: waterQualityFiltered,
        alerts,
        maintenances,
        period
      };

      const pdfPath = await reportService.generateWeeklyReport(reportData);
      console.log(`✅ PDF généré: ${pdfPath}`);

      // 5. Envoyer par email si demandé
      if (sendEmail && recipients.length > 0) {
        await emailService.sendReportEmail(
          recipients,
          stationData.name,
          frequency as 'weekly' | 'monthly',
          period,
          pdfPath
        );
        console.log(`📧 Email envoyé à: ${recipients.join(', ')}`);
      }

      res.json({
        success: true,
        message: 'Rapport généré avec succès',
        data: {
          pdfPath,
          stationName: stationData.name,
          period,
          stats: {
            waterQualityRecords: waterQualityFiltered.length,
            alerts: alerts.length,
            maintenances: maintenances.length
          },
          downloadUrl: `/api/reports/download/${encodeURIComponent(path.basename(pdfPath))}`
        }
      });

    } catch (error: any) {
      console.error('❌ Erreur génération rapport:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du rapport',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/reports/download/:filename
 * @desc    Télécharge un rapport PDF
 * @access  Authentifié
 */
router.get(
  '/download/:filename',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename as string;
      const reportsDir = path.join(__dirname, '../../reports');
      const filePath = path.join(reportsDir, filename);

      // Sécurité: vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Fichier non trouvé'
        });
      }

      // Vérifier que c'est bien un PDF
      if (!filename.endsWith('.pdf')) {
        return res.status(403).json({
          success: false,
          message: 'Type de fichier non autorisé'
        });
      }

      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('❌ Erreur téléchargement:', err);
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement'
          });
        }
      });
    } catch (error: any) {
      console.error('❌ Erreur téléchargement rapport:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du téléchargement',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/reports/stations
 * @desc    Liste toutes les stations disponibles
 * @access  Authentifié
 */
router.get(
  '/stations',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      await ensureKuzzleConnection();
      
      const stations = await kuzzleService.getStations();
      
      res.json({
        success: true,
        data: stations.map(s => ({
          id: s._id,
          name: s.body?.name || s._source?.name,
          location: s.body?.location || s._source?.location
        }))
      });
    } catch (error: any) {
      console.error('❌ Erreur récupération stations:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des stations',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/reports/test-connection
 * @desc    Teste la connexion à Kuzzle
 * @access  Authentifié
 */
router.get(
  '/test-connection',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      await ensureKuzzleConnection();
      
      const stations = await kuzzleService.getStations();
      
      res.json({
        success: true,
        message: 'Connexion Kuzzle OK',
        data: {
          connected: true,
          stationsCount: stations.length,
          stations: stations.map(s => ({
            id: s._id,
            name: s.body?.name || s._source?.name
          }))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur connexion Kuzzle',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/reports/history
 * @desc    Récupère l'historique des rapports générés
 * @access  Authentifié
 */
router.get(
  '/history',
  jwtMiddleware,
  async (req: Request, res: Response) => {
    try {
      const reportsDir = path.join(__dirname, '../../reports');

      if (!fs.existsSync(reportsDir)) {
        return res.json({
          success: true,
          data: []
        });
      }

      const files = fs.readdirSync(reportsDir);
      const reports = files
        .filter((file: string) => file.endsWith('.pdf'))
        .map((file: string) => {
          const stats = fs.statSync(path.join(reportsDir, file));
          return {
            filename: file,
            createdAt: stats.birthtime,
            size: stats.size,
            downloadUrl: `/api/reports/download/${encodeURIComponent(file)}`
          };
        })
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({
        success: true,
        data: reports
      });
    } catch (error: any) {
      console.error('❌ Erreur historique rapports:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'historique',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/reports/test-email
 * @desc    Teste la configuration email
 * @access  Admin
 */
router.post(
  '/test-email',
  jwtMiddleware,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const isValid = await emailService.testConnection();
      
      res.json({
        success: isValid,
        message: isValid ? 'Configuration email valide' : 'Configuration email invalide'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors du test email',
        error: error.message
      });
    }
  }
);

export default router;