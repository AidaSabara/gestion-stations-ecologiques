// backend/src/services/water-quality-ingestion.service.ts
import { KuzzleService } from './kuzzle.service';
import { WaterQualityDocument, IngestionResult } from '../types/water-quality.types';

export class WaterQualityIngestionService {
  private kuzzleService: KuzzleService;
  private readonly INDEX = 'iot';
  private readonly COLLECTION = 'water_quality';
  private readonly BATCH_SIZE = 50; // Insérer par lots de 50

  constructor(kuzzleService: KuzzleService) {
    this.kuzzleService = kuzzleService;
  }

  /**
   * Ingère des documents water_quality dans Kuzzle
   */
  async ingest(documents: WaterQualityDocument[]): Promise<IngestionResult> {
    const startTime = Date.now();
    const result: IngestionResult = {
      success: false,
      inserted: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    if (documents.length === 0) {
      result.errors.push({ row: 0, error: 'Aucun document à insérer' });
      result.duration = Date.now() - startTime;
      return result;
    }

    try {
      await this.kuzzleService.ensureConnection();

      console.log(`📥 Début d'ingestion de ${documents.length} documents...`);

      // Insérer par lots
      for (let i = 0; i < documents.length; i += this.BATCH_SIZE) {
        const batch = documents.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(documents.length / this.BATCH_SIZE);

        console.log(`📦 Traitement du lot ${batchNumber}/${totalBatches} (${batch.length} documents)...`);

        try {
          await this.insertBatch(batch, i, result);
        } catch (error: any) {
          console.error(`❌ Erreur sur le lot ${batchNumber}:`, error.message);
          
          // En cas d'erreur de lot, essayer document par document
          await this.insertOneByOne(batch, i, result);
        }
      }

      result.success = result.inserted > 0;
      result.duration = Date.now() - startTime;

      console.log(`✅ Ingestion terminée: ${result.inserted} insérés, ${result.failed} échoués en ${result.duration}ms`);

      return result;
    } catch (error: any) {
      console.error('❌ Erreur globale d\'ingestion:', error);
      result.errors.push({ row: 0, error: `Erreur globale: ${error.message}` });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Insère un document unique
   */
  async insertOne(document: WaterQualityDocument): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      await this.kuzzleService.ensureConnection();

      const response = await this.kuzzleService.kuzzle.document.create(
        this.INDEX,
        this.COLLECTION,
        document,
        undefined, // ID auto-généré
        { refresh: 'wait_for' }
      );

      console.log(`✅ Document inséré avec ID: ${response._id}`);

      return { success: true, id: response._id };
    } catch (error: any) {
      console.error('❌ Erreur insertion document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Insère un lot de documents avec mCreate
   */
  private async insertBatch(
  documents: WaterQualityDocument[],
  startIndex: number,
  result: IngestionResult
): Promise<void> {
  try {
    // 🔍 AFFICHER LE PREMIER DOCUMENT
    console.log('\n📄 PREMIER DOCUMENT À INSÉRER:');
    console.log(JSON.stringify(documents[0], null, 2));
    
    // 🔍 VÉRIFIER LES TYPES
    console.log('\n🔍 VÉRIFICATION DES TYPES:');
    const doc = documents[0];
    console.log('  - id_station:', typeof doc.id_station, doc.id_station);
    console.log('  - phase:', typeof doc.phase, doc.phase);
    console.log('  - type_filtre:', typeof doc.type_filtre, doc.type_filtre);
    console.log('  - date:', typeof doc.date, doc.date);
    console.log('  - temperature_c:', typeof doc.temperature_c, doc.temperature_c);
    console.log('  - ph:', typeof doc.ph, doc.ph);

    const response = await this.kuzzleService.kuzzle.document.mCreate(
      this.INDEX,
      this.COLLECTION,
      documents.map(doc => ({ body: doc })),
      { refresh: 'wait_for' }
    );

    console.log(`\n📊 Résultat mCreate:`);
    console.log(`   - Succès: ${response.successes.length}`);
    console.log(`   - Erreurs: ${response.errors.length}`);

    // Analyser les succès
    response.successes.forEach((success: any) => {
      result.inserted++;
    });

    // Analyser les erreurs EN DÉTAIL
    response.errors.forEach((error: any, idx: number) => {
      result.failed++;
      
      console.error(`\n❌ ==========================================`);
      console.error(`❌ ERREUR DOCUMENT ${idx + 1}:`);
      console.error(`❌ ==========================================`);
      console.error('Erreur complète:', JSON.stringify(error, null, 2));
      console.error(`❌ ==========================================\n`);
      
      // Extraire le message d'erreur
      let errorMessage = 'Erreur inconnue';
      
      if (error._source?.error) {
        errorMessage = JSON.stringify(error._source.error);
      } else if (error.error) {
        errorMessage = JSON.stringify(error.error);
      } else if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      result.errors.push({
        row: startIndex + idx + 1,
        error: errorMessage
      });
    });
  } catch (error: any) {
    console.error('\n❌ ==========================================');
    console.error('❌ ERREUR MCREATE GLOBALE:');
    console.error('❌ ==========================================');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Erreur complète:', JSON.stringify(error, null, 2));
    console.error('❌ ==========================================\n');
    throw error;
  }
}

  /**
   * Insère les documents un par un (fallback en cas d'erreur de lot)
   */
  private async insertOneByOne(
    documents: WaterQualityDocument[],
    startIndex: number,
    result: IngestionResult
  ): Promise<void> {
    console.log('⚠️ Passage en mode insertion individuelle...');

    for (let i = 0; i < documents.length; i++) {
      const rowNumber = startIndex + i + 1;
      
      try {
        await this.kuzzleService.kuzzle.document.create(
          this.INDEX,
          this.COLLECTION,
          documents[i],
          undefined,
          { refresh: 'false' } // Pas de refresh pour aller plus vite
        );
        result.inserted++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: error.message
        });
      }
    }
  }

  /**
   * Vérifie si une station existe
   */
  async stationExists(stationId: string): Promise<boolean> {
    try {
      await this.kuzzleService.ensureConnection();
      
      const response = await this.kuzzleService.kuzzle.document.search(
        this.INDEX,
        'stations',
        {
          query: {
            ids: {
              values: [stationId]
            }
          }
        },
        { size: 1 }
      );

      return response.total > 0;
    } catch (error) {
      console.error('❌ Erreur vérification station:', error);
      return false;
    }
  }

  /**
   * Compte le nombre de documents pour une station
   */
  async countDocuments(stationId?: string): Promise<number> {
    try {
      await this.kuzzleService.ensureConnection();

      const query = stationId
        ? { term: { id_station: stationId } }
        : { match_all: {} };

      const response = await this.kuzzleService.kuzzle.document.count(
        this.INDEX,
        this.COLLECTION,
        { query }
      );

      return response;
    } catch (error) {
      console.error('❌ Erreur comptage documents:', error);
      return 0;
    }
  }

  /**
   * Récupère les dernières mesures d'une station
   */
  async getLatestMeasurements(stationId: string, limit: number = 10): Promise<any[]> {
    try {
      await this.kuzzleService.ensureConnection();

      const response = await this.kuzzleService.kuzzle.document.search(
        this.INDEX,
        this.COLLECTION,
        {
          query: {
            term: { id_station: stationId }
          },
          sort: [
            { date: { order: 'desc' } }
          ]
        },
        { size: limit }
      );

      return response.hits;
    } catch (error) {
      console.error('❌ Erreur récupération mesures:', error);
      return [];
    }
  }
}