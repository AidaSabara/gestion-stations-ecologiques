// backend/src/services/kuzzle.service.ts
import { Kuzzle, WebSocket } from 'kuzzle-sdk';

export class KuzzleService {
  public kuzzle: Kuzzle;
  private connected: boolean = false;

  constructor() {
    const host = process.env.KUZZLE_HOST || 'localhost';
    const port = parseInt(process.env.KUZZLE_PORT || '7512');

    this.kuzzle = new Kuzzle(
      new WebSocket(host, { port })
    );

    console.log(`🔌 Connexion à Kuzzle: ${host}:${port}`);
  }

  /**
   * Connexion à Kuzzle
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log('✅ Déjà connecté à Kuzzle');
      return;
    }

    try {
      await this.kuzzle.connect();
      this.connected = true;
      console.log('✅ Connecté à Kuzzle');
    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
      throw error;
    }
  }

  /**
   * S'assure que la connexion est active
   */
  async ensureConnection(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Déconnexion
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      this.kuzzle.disconnect();
      this.connected = false;
      console.log('🔌 Déconnecté de Kuzzle');
    }
  }

  /**
   * Récupère toutes les stations
   */
  async getStations(): Promise<any[]> {
    try {
      await this.ensureConnection();

      const response = await this.kuzzle.document.search(
        'iot',
        'stations',
        {
          query: {
            match_all: {}
          }
        },
        {
          size: 1000,
          from: 0
        }
      );

      console.log(`✅ ${response.hits.length} stations récupérées`);
      return response.hits;
    } catch (error: unknown) {
      console.error('❌ Erreur getStations:', this.getErrorMessage(error));
      return [];
    }
  }

  /**
   * Récupère une station par ID
   */
  async getStation(stationId: string): Promise<any> {
    try {
      await this.ensureConnection();
      return await this.kuzzle.document.get('iot', 'stations', stationId);
    } catch (error) {
      console.error('❌ Erreur getStation:', error);
      throw error;
    }
  }

  /**
   * Récupère les données de qualité d'eau
   */
  async getWaterQualityData(stationId?: string): Promise<any[]> {
    try {
      await this.ensureConnection();

      let allHits: any[] = [];
      const pageSize = 100;
      let from = 0;

      const searchBody: any = {
        size: pageSize,
        from: 0
      };

      if (stationId) {
        searchBody.query = {
          term: {
            'id_station': stationId
          }
        };
      }

      // Première requête
      const firstResponse = await this.kuzzle.document.search('iot', 'water_quality', searchBody);
      const totalDocuments = firstResponse.total;
      allHits = [...firstResponse.hits];

      console.log(`📄 Page 1: ${firstResponse.hits.length}/${totalDocuments} documents`);

      // Pagination
      from = pageSize;
      while (allHits.length < totalDocuments) {
        const nextSearchBody: any = {
          size: pageSize,
          from: from
        };

        if (stationId) {
          nextSearchBody.query = {
            term: {
              'id_station': stationId
            }
          };
        }

        const response = await this.kuzzle.document.search('iot', 'water_quality', nextSearchBody);
        if (response.hits.length === 0) break;

        allHits = [...allHits, ...response.hits];
        from += pageSize;
      }

      console.log(`✅ Total récupéré: ${allHits.length}/${totalDocuments} water_quality`);

      // Formater les données
      return this.formatWaterQualityData(allHits);
    } catch (error: unknown) {
      console.error('❌ Erreur getWaterQualityData:', this.getErrorMessage(error));
      return [];
    }
  }

  /**
   * Récupère les alertes
   */
  async getAlerts(stationId?: string, startDate?: string, endDate?: string): Promise<any[]> {
    try {
      await this.ensureConnection();

      const query: any = { bool: { must: [] } };

      if (stationId) {
        query.bool.must.push({ term: { 'stationId': stationId } });
      }

      if (startDate && endDate) {
        query.bool.must.push({
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          }
        });
      }

      const response = await this.kuzzle.document.search(
        'iot',
        'alerts',
        { query: query.bool.must.length > 0 ? query : { match_all: {} } },
        { size: 1000 }
      );

      console.log(`✅ ${response.hits.length} alertes récupérées`);
      return response.hits;
    } catch (error) {
      console.error('❌ Erreur getAlerts:', error);
      return [];
    }
  }

  /**
   * Récupère les maintenances
   */
  async getMaintenances(startDate?: string, endDate?: string): Promise<any[]> {
    try {
      await this.ensureConnection();

      const query: any = {};

      if (startDate && endDate) {
        query.range = {
          date_intervention: {
            gte: startDate,
            lte: endDate
          }
        };
      }

      const response = await this.kuzzle.document.search(
        'iot',
        'maintenance_intervention',
        { query: Object.keys(query).length > 0 ? query : { match_all: {} } },
        { size: 1000 }
      );

      console.log(`✅ ${response.hits.length} maintenances récupérées`);
      return response.hits;
    } catch (error) {
      console.error('❌ Erreur getMaintenances:', error);
      return [];
    }
  }

  /**
   * Récupère les utilisateurs
   */
  async getUsers(role?: string): Promise<any[]> {
    try {
      await this.ensureConnection();

      const query = role 
        ? { term: { 'role': role } }
        : { match_all: {} };

      const response = await this.kuzzle.document.search(
        'iot',
        'users',
        { query },
        { size: 1000 }
      );

      console.log(`✅ ${response.hits.length} utilisateurs récupérés`);
      return response.hits;
    } catch (error) {
      console.error('❌ Erreur getUsers:', error);
      return [];
    }
  }

  /**
   * Formate les données de qualité d'eau
   */
  private formatWaterQualityData(hits: any[]): any[] {
    return hits.map((hit: any) => {
      const source = hit._source || hit.body || hit;

      // Formater la date
      let formattedDate = source.Date || source.date;
      if (formattedDate) {
        try {
          if (formattedDate.includes('/') && formattedDate.includes(',')) {
            const [datePart] = formattedDate.split(',');
            const [day, month, year] = datePart.split('/');
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (formattedDate.includes('/') && !formattedDate.includes(',')) {
            const [day, month, year] = formattedDate.split('/');
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } catch (error) {
          console.warn(`❌ Erreur conversion date: ${formattedDate}`);
        }
      }

      // Formater les valeurs numériques
      const formatNumericValue = (value: any) => {
        if (value == null || value === '') return null;
        if (typeof value === 'string' && value.includes(',')) {
          return parseFloat(value.replace(',', '.'));
        }
        if (typeof value === 'number') return value;
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
          return parseFloat(value);
        }
        return null;
      };

      return {
        _id: hit._id,
        body: {
          id_station: source.id_station,
          phase: source.phase,
          type_filtre: source.type_filtre,
          id_filtre: source.id_filtre,
          date: formattedDate,
          mois: source.mois,
          temperature_c: formatNumericValue(source.temperature_c),
          ph: formatNumericValue(source.ph),
          conductivite_us_cm: formatNumericValue(source.conductivite_us_cm),
          potentiel_redox_mv: formatNumericValue(source.potentiel_redox_mv),
          dbo5_mg_l: formatNumericValue(source.dbo5_mg_l),
          dco_mg_l: formatNumericValue(source.dco_mg_l),
          mes_mg_l: formatNumericValue(source.mes_mg_l),
          mvs_pct: formatNumericValue(source.mvs_pct),
          nitrates_mg_l: formatNumericValue(source.nitrates_mg_l),
          ammonium_mg_l: formatNumericValue(source.ammonium_mg_l),
          azote_total_mg_l: formatNumericValue(source.azote_total_mg_l),
          phosphates_mg_l: formatNumericValue(source.phosphates_mg_l),
          coliformes_fecaux_cfu_100ml: formatNumericValue(source.coliformes_fecaux_cfu_100ml),
          oeufs_helminthes: source.oeufs_helminthes,
          huiles_graisses: source.huiles_graisses,
          nom_feuille: source.nom_feuille,
          contient_valeurs_estimees: source.contient_valeurs_estimees,
          timestamp: formattedDate
        }
      };
    });
  }

  /**
   * Extrait le message d'erreur
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}