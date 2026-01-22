// backend/src/routes/water-quality.routes.ts
import { Router, Request, Response } from 'express';
import path from 'path';
import { KuzzleService } from '../services/kuzzle.service';
import { FileParserService } from '../services/file-parser.service';
import { WaterQualityIngestionService } from '../services/water-quality-ingestion.service';
import { uploadWaterQuality, handleMulterError } from '../middlewares/upload.middleware';
import { WaterQualityDocument } from '../types/water-quality.types';

const router = Router();

// Initialiser les services
const kuzzleService = new KuzzleService();
const fileParserService = new FileParserService();
const ingestionService = new WaterQualityIngestionService(kuzzleService);

/**
 * POST /api/water-quality/upload
 * Upload et ingestion de fichier Excel/CSV
 */
router.post('/upload', uploadWaterQuality, handleMulterError, async (req: Request, res: Response) => {
  try {
    // Vérifier qu'un fichier a été uploadé
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
    }

    const { buffer, originalname, mimetype } = req.file;
    console.log(`📁 Fichier reçu: ${originalname} (${mimetype})`);

    // Options de parsing depuis le body
    const options = {
      strictValidation: req.body.strictValidation === 'true',
      skipEmptyRows: req.body.skipEmptyRows !== 'false',
      defaultStation: req.body.defaultStation,
      defaultPhase: req.body.defaultPhase
    };

    // Parser le fichier selon son type
    let parseResult;
    
    if (mimetype.includes('spreadsheet') || originalname.endsWith('.xlsx') || originalname.endsWith('.xls')) {
      console.log('📊 Parsing Excel...');
      parseResult = fileParserService.parseExcel(buffer, options);
    } else {
      console.log('📄 Parsing CSV...');
      const content = buffer.toString('utf-8');
      parseResult = fileParserService.parseCSV(content, options);
    }

    // Vérifier le résultat du parsing
    if (!parseResult.success || parseResult.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Échec du parsing du fichier',
        details: {
          errors: parseResult.errors,
          warnings: parseResult.warnings,
          stats: parseResult.stats
        }
      });
    }

    console.log(`✅ Parsing réussi: ${parseResult.data.length} lignes valides`);

    // Ingérer dans Kuzzle
    console.log('💾 Début de l\'ingestion dans Kuzzle...');
    const ingestionResult = await ingestionService.ingest(parseResult.data);

    // Réponse
    return res.status(ingestionResult.success ? 200 : 207).json({
      success: ingestionResult.success,
      message: `${ingestionResult.inserted} documents insérés, ${ingestionResult.failed} échoués`,
      data: {
        parsing: {
          totalRows: parseResult.stats.totalRows,
          validRows: parseResult.stats.validRows,
          invalidRows: parseResult.stats.invalidRows,
          sheets: parseResult.stats.sheets,
          warnings: parseResult.warnings
        },
        ingestion: {
          inserted: ingestionResult.inserted,
          failed: ingestionResult.failed,
          duration: ingestionResult.duration,
          errors: ingestionResult.errors.slice(0, 10) // Limiter à 10 erreurs max
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Erreur route /upload:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du traitement du fichier',
      details: error.message
    });
  }
});

/**
 * POST /api/water-quality/create
 * Insertion manuelle d'une mesure
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const document: WaterQualityDocument = req.body;

    // Validation basique
    if (!document.id_station || !document.phase || !document.date) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants: id_station, phase, date'
      });
    }

    // Vérifier que la station existe
    const stationExists = await ingestionService.stationExists(document.id_station);
    if (!stationExists) {
      return res.status(404).json({
        success: false,
        error: `Station non trouvée: ${document.id_station}`
      });
    }

    // Insérer
    const result = await ingestionService.insertOne(document);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: 'Document inséré avec succès',
        data: { id: result.id }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('❌ Erreur route /create:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'insertion',
      details: error.message
    });
  }
});

/**
 * GET /api/water-quality/stats/:stationId
 * Statistiques d'une station
 */
router.get('/stats/:stationId', async (req: Request, res: Response) => {
  try {
    const stationId = req.params.stationId as string;

    const count = await ingestionService.countDocuments(stationId);
    const latest = await ingestionService.getLatestMeasurements(stationId, 5);

    return res.json({
      success: true,
      data: {
        stationId,
        totalMeasurements: count,
        latestMeasurements: latest
      }
    });

  } catch (error: any) {
    console.error('❌ Erreur route /stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/data/:stationId', async (req: Request, res: Response) => {
  try {
    const stationId = req.params.stationId as string;
    
    console.log(`🔍 Récupération des données pour station: ${stationId}`);
    
    const data = await kuzzleService.getWaterQualityData(stationId);
    
    return res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error: any) {
    console.error('❌ Erreur route /data:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.get('/data', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Récupération de TOUTES les données water_quality');
    
    const data = await kuzzleService.getWaterQualityData();
    
    return res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error: any) {
    console.error('❌ Erreur route /data:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/water-quality/download-template
 * Télécharger le template Excel
 */
router.get('/download-template', (req: Request, res: Response) => {
  const templatePath = path.join(__dirname, '../../templates/template_water_quality.xlsx');
  
  res.download(templatePath, 'template_water_quality.xlsx', (err) => {
    if (err) {
      console.error('❌ Erreur téléchargement template:', err);
      res.status(404).json({
        success: false,
        error: 'Template non trouvé'
      });
    }
  });
});
export default router;