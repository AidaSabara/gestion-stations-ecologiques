import { Router, Request, Response } from 'express';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configuration de Kuzzle
const kuzzle = new Kuzzle(new WebSocket('localhost'));

// Connexion à Kuzzle
async function connectKuzzle() {
  if (!kuzzle.connected) {
    try {
      await kuzzle.connect();
      console.log('✅ Connecté à Kuzzle');
    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
    }
  }
}
const robustDateParse = (input: any): string => {
  if (!input) return new Date().toISOString();
  
  // Si c'est déjà un objet Date
  if (input instanceof Date) return input.toISOString();
  
  // Si c'est le nombre série d'Excel (ex: 43564)
  if (typeof input === 'number' && input > 30000) {
    return new Date((input - 25569) * 86400 * 1000).toISOString();
  }
  
  // Si c'est une chaîne de caractères
  const d = new Date(input);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const formatExcelDate = (dateInput: any): string => {
  if (!dateInput) return new Date().toISOString();
  
  const d = new Date(dateInput);
  // Si la date est invalide (cas du nombre Excel non converti), on essaie de la corriger
  if (isNaN(d.getTime())) {
    // Si c'est un nombre (ex: 45736), conversion manuelle
    if (typeof dateInput === 'number') {
      return new Date((dateInput - 25569) * 86400 * 1000).toISOString();
    }
    return new Date().toISOString();
  }
  return d.toISOString();
};

/**
 * Nettoyage des données numériques (virgules, textes parasites)
 */
const formatNumeric = (val: any): number => {
  if (val === null || val === undefined || val === '' || val === 'pas de donnée') return 0;
  if (typeof val === 'number') return val;
  
  const cleaned = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    await connectKuzzle();
    const s = req.body;
    
    const result = await kuzzle.document.create('iot', 'readings', {
      stationId: s.stationId || 'TEST',
      temperature: formatNumeric(s.temperature),
      ph: formatNumeric(s.ph),
      // ... ajoutez les autres champs si nécessaire
      timestamp: new Date().toISOString()
    });

    res.status(200).json({ success: true, id: result._id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
/**
 * ROUTE : Importation Batch vers WATER_QUALITY et READINGS
 */
router.post('/ingest/batch', async (req: Request, res: Response) => {
  try {
    await connectKuzzle();
    const { sensors } = req.body;

    if (!Array.isArray(sensors)) {
      return res.status(400).json({ success: false, message: 'Un tableau est requis.' });
    }

    // --- 1. PREPARATION POUR "WATER_QUALITY" ---
    const waterQualityDocs = sensors.map((s: any) => ({
  _id: uuidv4(),
  body: {
    id_station: s.stationId || 'STATION_INCONNUE',
    timestamp: robustDateParse(s.date || s.Data),
    phase: s.phase || 'ENTREE',
    // On regroupe toutes les mesures possibles
    typeFiltre: s.typeFiltre || null,
    idFiltre: s.idFiltre || null,
    mesures: {
      temperature: formatNumeric(s.temperature),
      ph: formatNumeric(s.ph),
      conductivite: formatNumeric(s.conductivite),
      turbidite: formatNumeric(s.turbidite),
      oxygene_dissous: formatNumeric(s.dissolvedOxygen),
      dbo5: formatNumeric(s.dbo5),
      dco: formatNumeric(s.dco),
      mes: formatNumeric(s.mes),
      nitrates: formatNumeric(s.nitrates),
      phosphates: formatNumeric(s.phosphates),
      ammonium: formatNumeric(s.ammonium),
      coliformes: formatNumeric(s.coliformes_fecaux)
    }
  }
}));

    // --- 2. PREPARATION POUR "READINGS" ---
const readingDocs = sensors.map((s: any) => ({
  _id: uuidv4(),
  body: {
    stationId: s.stationId || 'STATION_INCONNUE',
    timestamp: formatExcelDate(s.date),
    temperature: formatNumeric(s.temperature),
    ph: formatNumeric(s.ph),
    turbidity: formatNumeric(s.turbidite),
    // Les capteurs IoT n'envoient souvent que ça
  }
}));
    // --- 3. ENVOI DES DEUX BATCHS ---
    // On lance les deux en même temps pour plus de rapidité
    const [resWater, resReadings] = await Promise.all([
      kuzzle.document.mCreate('iot', 'water_quality', waterQualityDocs, { refresh: 'wait_for' }),
      kuzzle.document.mCreate('iot', 'readings', readingDocs, { refresh: 'wait_for' })
    ]);

   // Remplace resWater.hits.length par resWater.successes.length
console.log(`✅ Import réussi: ${resWater.successes.length} qualite_eau, ${resReadings.successes.length} readings.`);

res.status(200).json({
  message: 'Données importées avec succès',
  waterQualityImported: resWater.successes.length,
  readingsImported: resReadings.successes.length,
  errors: [...resWater.errors, ...resReadings.errors] // Optionnel: pour voir s'il y a eu des échecs
});

  } catch (error: any) {
    console.error('❌ Erreur Import Global:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;