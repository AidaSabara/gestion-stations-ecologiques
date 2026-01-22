// backend/src/middlewares/upload.middleware.ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// Types de fichiers acceptés
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'text/plain' // .csv alternative
];

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// Taille maximale: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Configuration du stockage en mémoire
 */
const storage = multer.memoryStorage();

/**
 * Filtre pour valider les fichiers
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Vérifier l'extension
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Type de fichier non autorisé: ${ext}. Utilisez .xlsx, .xls ou .csv`
      )
    );
  }

  // Vérifier le MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `MIME type non autorisé: ${file.mimetype}. Utilisez Excel ou CSV`
      )
    );
  }

  cb(null, true);
};

/**
 * Middleware Multer pour upload de fichiers water_quality
 */
export const uploadWaterQuality = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Un seul fichier à la fois
  }
}).single('file'); // Le champ du formulaire doit s'appeler "file"

/**
 * Middleware de gestion d'erreurs Multer
 */
export const handleMulterError = (err: any, req: Request, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024} MB`
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Un seul fichier autorisé à la fois'
      });
    }

    return res.status(400).json({
      success: false,
      error: `Erreur d'upload: ${err.message}`
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
};