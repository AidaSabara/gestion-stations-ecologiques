// backend/src/services/ai.service.ts

import { WaterQualityPredictorService } from './ml/water-quality-predictor.service';
import { MLTrainingService } from './ml/ml-training.service';
import { FeatureEngineeringService } from './ml/feature-engineering.service';
import { ModelEvaluationService } from './ml/model-evaluation.service';
import { KuzzleService } from './kuzzle.service';
import { 
  WaterQualityInput, 
  WaterQualityPrediction, 
  MLServiceResponse,
  FilterEfficiencyAnalysis,
  AnomalyDetection
} from '../types/ml.types';

export class AIService {
  private predictor: WaterQualityPredictorService;
  private training: MLTrainingService;
  private featureEngineering: FeatureEngineeringService;
  private evaluation: ModelEvaluationService;
  private kuzzle: KuzzleService;
  private modelLoaded: boolean = false;

  constructor() {
    this.predictor = new WaterQualityPredictorService();
    this.training = new MLTrainingService();
    this.featureEngineering = new FeatureEngineeringService();
    this.evaluation = new ModelEvaluationService();
    this.kuzzle = new KuzzleService();
  }

  /**
   * Initialise le service IA (charge le modèle ou lance l'entraînement)
   */
  async initialize(): Promise<MLServiceResponse<{ modelLoaded: boolean; needsTraining: boolean }>> {
    try {
      console.log('🤖 Initialisation du service IA...');

      // Vérifier si un modèle existe
      const modelExists = this.training.modelExists();

      if (modelExists) {
        console.log('📦 Chargement du modèle existant...');
        const loaded = await this.predictor.loadModel();
        
        if (loaded) {
          this.modelLoaded = true;
          console.log('✅ Modèle chargé avec succès');
          
          return {
            success: true,
            data: {
              modelLoaded: true,
              needsTraining: false
            },
            timestamp: new Date()
          };
        }
      }

      console.log('⚠️ Aucun modèle trouvé - Entraînement nécessaire');
      
      return {
        success: true,
        data: {
          modelLoaded: false,
          needsTraining: true
        },
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  /**
   * Entraîne un nouveau modèle
   */
  async trainModel(options?: {
    minSamples?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<MLServiceResponse> {
    try {
      console.log('🎓 Démarrage de l\'entraînement...');

      const result = await this.training.trainWaterQualityModel(options);

      if (result.success) {
        // Recharger le modèle
        await this.predictor.loadModel();
        this.modelLoaded = true;

        return {
          success: true,
          data: {
            metrics: result.metrics,
            samples: result.trainingData?.metadata.totalSamples
          },
          timestamp: new Date()
        };
      }

      return {
        success: false,
        error: result.message,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'entraînement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  /**
   * Fait une prédiction sur la qualité de l'eau en sortie
   */
  async predictWaterQuality(input: WaterQualityInput): Promise<MLServiceResponse<WaterQualityPrediction>> {
    try {
      if (!this.modelLoaded) {
        // Essayer de charger le modèle
        const loaded = await this.predictor.loadModel();
        if (!loaded) {
          return {
            success: false,
            error: 'Modèle non disponible. Veuillez d\'abord entraîner un modèle.',
            timestamp: new Date()
          };
        }
        this.modelLoaded = true;
      }

      const prediction = await this.predictor.predict(input);

      return {
        success: true,
        data: prediction,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Erreur lors de la prédiction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  /**
   * Analyse l'efficacité des filtres
   */
  async analyzeFilterEfficiency(
    typeFiltre?: string,
    startDate?: string,
    endDate?: string
  ): Promise<MLServiceResponse<FilterEfficiencyAnalysis[]>> {
    try {
      await this.kuzzle.connect();

      // Construire la requête
      const query: any = {
        bool: {
          must: [
            { exists: { field: 'phase' } },
            { exists: { field: 'dbo5' } }
          ]
        }
      };

      if (typeFiltre) {
        query.bool.must.push({
          term: { type_filtre: typeFiltre }
        });
      }

      if (startDate || endDate) {
        query.bool.filter = [{
          range: {
            date: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate })
            }
          }
        }];
      }

      const searchResult = await this.kuzzle.kuzzle.document.search(
        'iot',
        'water_quality',
        { query, size: 10000 }
      );

      // Grouper par type de filtre
      const groupedByFilter = new Map<string, any[]>();

      searchResult.hits.forEach((doc: any) => {
        const source = doc._source;
        const type = source.type_filtre || source.id_filtre;
        
        if (!groupedByFilter.has(type)) {
          groupedByFilter.set(type, []);
        }
        groupedByFilter.get(type)!.push(source);
      });

      // Calculer les statistiques par filtre
      const analyses: FilterEfficiencyAnalysis[] = [];

      groupedByFilter.forEach((docs, type) => {
        const pairs = this.createEfficiencyPairs(docs);

        if (pairs.length > 0) {
          const stats = this.calculateEfficiencyStats(pairs);
          const trend = this.determineTrend(pairs);

          analyses.push({
            type_filtre: type,
            efficiency_stats: stats,
            performance_trend: trend,
            recommendation: this.generateRecommendation(stats, trend)
          });
        }
      });

      return {
        success: true,
        data: analyses,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  /**
   * Détecte les anomalies dans les données récentes
   */
  async detectAnomalies(
    stationId?: string,
    lastDays: number = 7
  ): Promise<MLServiceResponse<AnomalyDetection[]>> {
    try {
      await this.kuzzle.connect();

      // Date de début
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lastDays);

      const query: any = {
        bool: {
          must: [
            {
              range: {
                date: { gte: startDate.toISOString() }
              }
            }
          ]
        }
      };

      if (stationId) {
        query.bool.must.push({
          term: { id_station: stationId }
        });
      }

      const searchResult = await this.kuzzle.kuzzle.document.search(
        'iot',
        'water_quality',
        { query, size: 1000 }
      );

      const anomalies: AnomalyDetection[] = [];

      // Paramètres à surveiller
      const parameters = ['ph', 'dbo5', 'dco', 'mes', 'coliformes'];

      parameters.forEach((param: string) => {
        const values = searchResult.hits
          .map((doc: any) => this.extractValue(doc._source, param))
          .filter((v: any) => v !== null) as number[];

        if (values.length > 5) {
          const stats = {
            mean: values.reduce((sum, v) => sum + v, 0) / values.length,
            std: 0
          };

          // Calculer l'écart-type
          stats.std = Math.sqrt(
            values.reduce((sum, v) => sum + Math.pow(v - stats.mean, 2), 0) / values.length
          );

          // Détecter les anomalies (>3 écarts-types)
          searchResult.hits.forEach((doc: any) => {
            const value = this.extractValue(doc._source, param);
            if (value !== null) {
              const zScore = Math.abs((value - stats.mean) / stats.std);
              
              if (zScore > 3) {
                anomalies.push({
                  timestamp: new Date(doc._source.date),
                  parameter: param,
                  value,
                  expected_range: {
                    min: stats.mean - 3 * stats.std,
                    max: stats.mean + 3 * stats.std
                  },
                  anomaly_score: Math.min(1, zScore / 5),
                  is_anomaly: true,
                  possible_causes: this.identifyCauses(param, value, stats.mean)
                });
              }
            }
          });
        }
      });

      return {
        success: true,
        data: anomalies.sort((a, b) => b.anomaly_score - a.anomaly_score),
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Erreur lors de la détection d\'anomalies:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  /**
   * Obtient les informations sur le modèle
   */
  async getModelInfo(): Promise<MLServiceResponse> {
    try {
      const info = await this.training.getModelInfo();
      const history = await this.training.getTrainingHistory();

      return {
        success: true,
        data: {
          ...info,
          trainingHistory: history.slice(-5) // 5 derniers entraînements
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date()
      };
    }
  }

  // ========== Méthodes privées ==========

  private createEfficiencyPairs(docs: any[]): Array<{ input: any; output: any }> {
    const grouped = new Map<string, any[]>();

    docs.forEach(doc => {
      const key = `${doc.id_station || doc.stationId}_${doc.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(doc);
    });

    const pairs: Array<{ input: any; output: any }> = [];

    grouped.forEach(group => {
      const entree = group.find(d => d.phase?.toLowerCase().includes('entr'));
      const sortie = group.find(d => d.phase?.toLowerCase() === 'sortie');

      if (entree && sortie) {
        pairs.push({ input: entree, output: sortie });
      }
    });

    return pairs;
  }

  private calculateEfficiencyStats(pairs: Array<{ input: any; output: any }>) {
    const reductions = {
      dbo5: [] as number[],
      dco: [] as number[],
      mes: [] as number[],
      pathogens: [] as number[]
    };

    pairs.forEach(pair => {
      const inputMesures = pair.input.mesures || pair.input;
      const outputMesures = pair.output.mesures || pair.output;

      if (inputMesures.dbo5 && outputMesures.dbo5) {
        reductions.dbo5.push(((inputMesures.dbo5 - outputMesures.dbo5) / inputMesures.dbo5) * 100);
      }
      if (inputMesures.dco && outputMesures.dco) {
        reductions.dco.push(((inputMesures.dco - outputMesures.dco) / inputMesures.dco) * 100);
      }
      if (inputMesures.mes && outputMesures.mes) {
        reductions.mes.push(((inputMesures.mes - outputMesures.mes) / inputMesures.mes) * 100);
      }
      
      const inputCol = inputMesures.coliformes || inputMesures.coliformes_fecaux_cfu_100ml || 0;
      const outputCol = outputMesures.coliformes || outputMesures.coliformes_fecaux_cfu_100ml || 0;
      if (inputCol && outputCol) {
        reductions.pathogens.push(((inputCol - outputCol) / inputCol) * 100);
      }
    });

    return {
      avg_dbo5_reduction: this.average(reductions.dbo5),
      avg_dco_reduction: this.average(reductions.dco),
      avg_mes_reduction: this.average(reductions.mes),
      avg_pathogen_reduction: this.average(reductions.pathogens),
      sample_count: pairs.length
    };
  }

  private determineTrend(pairs: Array<{ input: any; output: any }>): 'improving' | 'stable' | 'degrading' {
    if (pairs.length < 3) return 'stable';

    // Calculer l'efficacité dans le temps
    const efficiencies = pairs.map(pair => {
      const inputMesures = pair.input.mesures || pair.input;
      const outputMesures = pair.output.mesures || pair.output;
      
      return ((inputMesures.dbo5 - outputMesures.dbo5) / inputMesures.dbo5) * 100;
    });

    // Régression linéaire simple
    const n = efficiencies.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = efficiencies.reduce((sum, val) => sum + val, 0);
    const sumXY = efficiencies.reduce((sum, val, idx) => sum + val * (idx + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 0.5) return 'improving';
    if (slope < -0.5) return 'degrading';
    return 'stable';
  }

  private generateRecommendation(stats: any, trend: string): string | undefined {
    if (trend === 'degrading') {
      return 'Performance en baisse détectée. Maintenance recommandée.';
    }
    if (stats.avg_dbo5_reduction < 70) {
      return 'Efficacité sous-optimale. Vérifier le dimensionnement et l\'entretien.';
    }
    if (stats.avg_pathogen_reduction < 90) {
      return 'Élimination des pathogènes insuffisante. Contrôle microbiologique conseillé.';
    }
    return undefined;
  }

  private extractValue(source: any, param: string): number | null {
    const mesures = source.mesures || source;
    const value = mesures[param] || mesures[`${param}_mg_l`] || mesures[`${param}_c`];
    return value !== undefined && value !== null ? Number(value) : null;
  }

  private identifyCauses(param: string, value: number, mean: number): string[] {
    const causes: string[] = [];

    if (value > mean) {
      causes.push('Surcharge possible de la station');
      if (param === 'coliformes') {
        causes.push('Contamination microbiologique');
      }
      if (param === 'dbo5' || param === 'dco') {
        causes.push('Charge organique élevée en entrée');
      }
    } else {
      causes.push('Dilution inhabituelle');
      causes.push('Erreur de mesure possible');
    }

    return causes;
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
}