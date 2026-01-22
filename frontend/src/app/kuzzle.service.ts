import { Injectable } from '@angular/core';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';

export interface MaintenanceIntervention {
  _id?: string;
  _kuzzle_info?: {
    author: string;
    createdAt: string;
    updatedAt: string | null;
    updater: string | null;
  };
  id_filtre: string;
  date_intervention: string;
  type_intervention: string;
  description: string;
  operateur?: string;
  duree_minutes?: number;
  cout_estimatif?: number;
  impact_attendu?: string;
  notes?: string;
  statut?: string;
  pieces_changees?: string[];
}


export interface TypePlante {
  nom: 'Vetiver' | 'Typha' | 'Mélange' | 'Autre' | 'Non_Applicable';
  description?: string;
}

export type TypeIntervention =
  | 'Changement de substrat'
  | 'Nettoyage'
  | 'Problème capteur'
  | 'Action corrective'
  | 'Ajout de plantes'
  | 'Débit ajusté'
  | 'Maintenance préventive'
  | 'Réparation'
  | 'Inspection';



export interface EtatCycleVie {
  etat: 'neuf' | 'bon' | 'moyen' | 'degrade' | 'critique' | 'hors_service';
  date:string;
  raison:string;
  date_debut: string;
  date_fin: string | null;
  duree_jours: number;
  volume_traite: number;
  heures_utilisation: number;
}

export interface MetriquesCycleVie {
  taux_usure_moyen: number;
  volume_moyen_par_jour: number;
  heures_moyennes_par_jour: number;
  efficacite_moyenne: number;
}

export interface JalonsCycleVie {
  mise_en_service: string;
  prochaine_maintenance: string;
  fin_vie_estimee: string;
  remplacement_prevu: string | null;
}

export interface CycleVieFiltre {
  _id: string;
  id_filtre: string;
  id_station: string;
  etat_actuel: 'neuf' | 'bon' | 'moyen' | 'degrade' | 'critique' | 'hors_service';
  date_changement_etat: string;
  pourcentage_usure: number;
  heures_utilisation: number;
  volume_traite_m3: number;
  historique_etats: EtatCycleVie[];
  metriques: MetriquesCycleVie;
  jalons: JalonsCycleVie;
}

@Injectable({
  providedIn: 'root'
})

export class KuzzleService {
  private kuzzle: Kuzzle;
  private connectionPromise: Promise<void> | null = null;
  private isConnecting = false;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private reconnectDelay = 2000;
  private reconnectTimer: any = null;
  private shouldReconnect = true;
  private subscriptions: any[] = [];

  constructor() {
    this.kuzzle = new Kuzzle(
      new WebSocket('localhost', { port: 7512, })
    );

    this.kuzzle.on('connected', () => {
      console.log('✅ Connecté à Kuzzle!');
    });

    this.kuzzle.on('disconnected', () => {
      console.warn('⚠️ Déconnecté de Kuzzle!');
    });

    this.kuzzle.on('networkError', (error: any) => {
      console.error('❌ Erreur réseau Kuzzle:', error);
    });

    this.ensureConnection();
  }

  async ensureConnection(): Promise<void> {
    if (this.kuzzle.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.kuzzle.connect()
      .then(() => {
        console.log('✅ Kuzzle connecté avec succès');
        this.connectionPromise = null;
      })
      .catch((error) => {
        console.error('❌ Échec connexion Kuzzle:', error);
        this.connectionPromise = null;
        throw error;
      });

    return this.connectionPromise;
  }

  async connectToKuzzle(): Promise<boolean> {
  try {
    await this.kuzzle.connect();
    console.log('✅ Kuzzle connecté avec succès');
    this.reconnectAttempts = 0;
    return true;
  } catch (error) {
    console.error('❌ Échec connexion Kuzzle:', error);
    return false;
  }
}

private async handleConnectionError(error: any) {
  console.error('❌ Erreur réseau Kuzzle:', error);

  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    await this.connectToKuzzle();
  } else {
    console.error('🚨 Nombre maximum de tentatives de reconnexion atteint');
  }
}


  async getStations(): Promise<any[]> {
    try {
      await this.ensureConnection();

      // 🔥 CORRECTION : Syntaxe correcte avec query et options séparées
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

      console.log('✅ Stations récupérées:', response.hits.length);
      console.log('📊 Total disponible:', response.total);

      if (response.total > response.hits.length) {
        console.warn(`⚠️ Attention: ${response.total} stations au total, ${response.hits.length} récupérées`);
      }

      return response.hits;
    } catch (error: unknown) {
      console.error('❌ Erreur getStations:', this.getErrorMessage(error));
      return [];
    }
  }

async getWaterQualityData(stationId?: string): Promise<any[]> {
  try {
    await this.ensureConnection();

    let allHits: any[] = [];
    const pageSize = 100;

    console.log('🔍 Recherche TOUTES les données water_quality...');

    // 🔥 CONSTRUIRE LA REQUÊTE
    const searchBody: any = {
      query: stationId ? {
        bool: {
          should: [
            { term: { 'id_station': stationId } },
            { term: { 'stationId': stationId } }
          ],
          minimum_should_match: 1
        }
      } : { match_all: {} }
    };

    console.log('🔍 Requête avec stationId:', stationId);

    // 🔥 UTILISER searchAll QUI GÈRE AUTOMATIQUEMENT LA PAGINATION
    try {
      // Récupérer tous les documents avec searchAll (gère le scroll automatiquement)
      let from = 0;
      let totalFetched = 0;
      let totalDocuments = 0;

      // Première requête pour connaître le total
      const firstResponse = await this.kuzzle.document.search(
        'iot',
        'water_quality',
        searchBody,
        { size: pageSize, from: 0 }
      );

      totalDocuments = firstResponse.total;
      allHits = [...firstResponse.hits];
      totalFetched = firstResponse.hits.length;

      console.log(`📄 Premier batch: ${totalFetched}/${totalDocuments} documents`);

      // Continuer à récupérer par batch de 100
      while (totalFetched < totalDocuments) {
        from += pageSize;

        const response = await this.kuzzle.document.search(
          'iot',
          'water_quality',
          searchBody,
          { size: pageSize, from: from }
        );

        if (response.hits.length === 0) break;

        allHits = [...allHits, ...response.hits];
        totalFetched += response.hits.length;

        console.log(`📄 Progression: ${totalFetched}/${totalDocuments}`);

        // Sécurité : éviter boucle infinie
        if (from > 10000) {
          console.warn('⚠️ Limite de 10000 documents atteinte');
          break;
        }
      }

      console.log(`✅ TOTAL récupéré: ${allHits.length}/${totalDocuments} documents`);

    } catch (scrollError) {
      console.error('❌ Erreur lors de la récupération avec pagination:', scrollError);
      // Fallback : récupérer au moins les premiers résultats
      const fallbackResponse = await this.kuzzle.document.search(
        'iot',
        'water_quality',
        searchBody,
        { size: 10000 }
      );
      allHits = fallbackResponse.hits;
      console.log(`⚠️ Fallback: ${allHits.length} documents récupérés`);
    }

    // 🔥 DÉDUPLIQUER PAR _id
    const uniqueHits = Array.from(
      new Map(allHits.map(hit => [hit._id, hit])).values()
    );

    if (uniqueHits.length !== allHits.length) {
      console.warn(`⚠️ ${allHits.length - uniqueHits.length} doublons supprimés`);
    }

    allHits = uniqueHits;
    console.log(`✅ Données uniques: ${allHits.length} documents`);

    // 🔥 FONCTION POUR NORMALISER LES DATES (timestamp OU string)
    const normalizeDate = (rawDate: any): string | null => {
      if (!rawDate) return null;

      // Si c'est un timestamp Unix (nombre > 1000000000000 = après 2001)
      if (typeof rawDate === 'number' && rawDate > 1000000000000) {
        const date = new Date(rawDate);
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
      }

      // Si c'est déjà une string au format YYYY-MM-DD
      if (typeof rawDate === 'string') {
        if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
          return rawDate.substring(0, 10);
        }
      }

      console.warn('⚠️ Format de date non reconnu:', rawDate);
      return null;
    };

    // 🔥 FONCTION POUR PARSER LES VALEURS NUMÉRIQUES
    const parseValue = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;

      if (typeof value === 'number') {
        return isNaN(value) ? null : value;
      }

      if (typeof value === 'string') {
        const cleaned = value.trim().replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }

      return null;
    };

    // 🔥 FORMATAGE DES DONNÉES
    const formattedData = allHits.map((hit: any) => {
      const source = hit._source || hit;

      // ✅ Normaliser la date (timestamp ou string)
      const date = normalizeDate(source.date);

      return {
        _id: hit._id,
        body: {
          // Informations de base
          id_station: source.id_station || 'unknown',
          phase: source.phase || 'entrée',
          type_filtre: source.type_filtre || 'Non_Applicable',
          id_filtre: source.id_filtre || 'unknow',
          date: date, // ✅ Date normalisée
          mois: source.mois,

          // Paramètres physico-chimiques
          temperature_c: parseValue(source.temperature_c),
          ph: parseValue(source.ph),
          conductivite_us_cm: parseValue(source.conductivite_us_cm),
          potentiel_redox_mv: parseValue(source.potentiel_redox_mv),

          // Pollution organique
          dbo5_mg_l: parseValue(source.dbo5_mg_l),
          dco_mg_l: parseValue(source.dco_mg_l),
          mes_mg_l: parseValue(source.mes_mg_l),
          mvs_pct: parseValue(source.mvs_pct),

          // Nutriments
          nitrates_mg_l: parseValue(source.nitrates_mg_l),
          ammonium_mg_l: parseValue(source.ammonium_mg_l),
          azote_total_mg_l: parseValue(source.azote_total_mg_l),
          phosphates_mg_l: parseValue(source.phosphates_mg_l),

          // Microbiologie
          coliformes_fecaux_cfu_100ml: parseValue(source.coliformes_fecaux_cfu_100ml),
          oeufs_helminthes: source.oeufs_helminthes,
          huiles_graisses: parseValue(source.huiles_graisses),

          // Métadonnées
          nom_feuille: source.nom_feuille,
          contient_valeurs_estimees: source.contient_valeurs_estimees || false,
          timestamp: date
        }
      };
    });

    // 📊 DEBUG ET STATISTIQUES
    console.log('✅ DONNÉES FORMATÉES (10 premières):');
    formattedData.slice(0, 10).forEach((item, index) => {
      console.log(`   ${index + 1}. Date: ${item.body.date} | Phase: ${item.body.phase} | ` +
                  `Filtre: ${item.body.id_filtre} | Type: ${item.body.type_filtre} | ` +
                  `DBO5: ${item.body.dbo5_mg_l}`);
    });

    // Extraire les dates et filtres uniques
    const uniqueDates = [...new Set(formattedData
      .map(d => d.body.date)
      .filter(d => d != null))].sort();

    const uniqueFilters = [...new Set(formattedData
      .map(d => d.body.id_filtre)
      .filter(f => f && f !== 'unknown'))].sort();

    console.log(`📅 DATES UNIQUES (${uniqueDates.length}):`, uniqueDates);
    console.log(`🔧 FILTRES UNIQUES (${uniqueFilters.length}):`, uniqueFilters);

    // 📊 DEBUG : Afficher toutes les dates brutes
    const toutesLesDates = formattedData
      .map(d => d.body.date)
      .filter(d => d != null);
    console.log(`📅 TOUTES LES DATES (${toutesLesDates.length} entrées):`, toutesLesDates);

    // Compter par filtre et par date
    const filterCounts = formattedData.reduce((acc: any, item) => {
      const filter = item.body.id_filtre;
      acc[filter] = (acc[filter] || 0) + 1;
      return acc;
    }, {});

    const dateCounts = formattedData.reduce((acc: any, item) => {
      const date = item.body.date;
      if (date) {  // ✅ Vérifier que la date n'est pas null
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});

    console.log('📊 RÉPARTITION PAR FILTRE:', filterCounts);
    console.log('📊 RÉPARTITION PAR DATE:', dateCounts);

    // Vérifier s'il y a des données sans date
    const withoutDate = formattedData.filter(d => !d.body.date).length;
    if (withoutDate > 0) {
      console.warn(`⚠️ ATTENTION: ${withoutDate} documents sans date!`);
    }

    return formattedData;
  } catch (error: unknown) {
    console.error('❌ Erreur getWaterQualityData:', this.getErrorMessage(error));
    return [];
  }
}

  /*async getWaterQualityData(stationId?: string): Promise<any[]> {
  try {
    await this.ensureConnection();

    let allHits: any[] = [];
    const pageSize = 100;
    let from = 0;
    let totalDocuments = 0;

    console.log('🔍 Recherche données water_quality...');

    // PREMIÈRE REQUÊTE
    const searchBody: any = {
      size: pageSize,
      from: 0,
      sort: [{ '_kuzzle_info.createdAt': { order: 'desc' } }]
    };

    // 🔥 CORRECTION : Rechercher par id_station OU stationId
    if (stationId) {
      searchBody.query = {
        bool: {
          should: [
            { term: { 'id_station': stationId } },
            { term: { 'stationId': stationId } }
          ],
          minimum_should_match: 1
        }
      };
    }

    const firstResponse = await this.kuzzle.document.search('iot', 'water_quality', searchBody);
    totalDocuments = firstResponse.total;
    allHits = [...firstResponse.hits];

    console.log(`📄 Page 1: ${firstResponse.hits.length}/${totalDocuments} documents`);

    // PAGINATION
    from = pageSize;
    while (allHits.length < totalDocuments) {
      const nextSearchBody: any = {
        size: pageSize,
        from: from,
        sort: [{ '_kuzzle_info.createdAt': { order: 'desc' } }]
      };

      if (stationId) {
        nextSearchBody.query = {
          bool: {
            should: [
              { term: { 'id_station': stationId } },
              { term: { 'stationId': stationId } }
            ],
            minimum_should_match: 1
          }
        };
      }

      const response = await this.kuzzle.document.search('iot', 'water_quality', nextSearchBody);
      if (response.hits.length === 0) break;

      allHits = [...allHits, ...response.hits];
      from += pageSize;
      console.log(`📄 Progression: ${allHits.length}/${totalDocuments}`);
    }

    console.log(`✅ TOTAL récupéré: ${allHits.length}/${totalDocuments} documents`);

    // 🔍 DEBUG : Analyser la structure des documents
    console.log('🔬 ANALYSE DES STRUCTURES:');
    const structureTypes = new Set();

    allHits.slice(0, 5).forEach((hit, index) => {
      const source = hit._source || hit.body || hit;
      const hasMesures = source.mesures && typeof source.mesures === 'object';
      const hasFlatFields = source.dbo5_mg_l !== undefined || source.dbo5 !== undefined;

      const type = hasMesures ? 'API_FORMAT' : hasFlatFields ? 'SEED_FORMAT' : 'UNKNOWN';
      structureTypes.add(type);

      console.log(`   Doc ${index + 1} (${type}):`, {
        id: hit._id.substring(0, 8) + '...',
        phase: source.phase,
        hasTypeFiltre: source.type_filtre !== undefined,
        hasIdFiltre: source.id_filtre !== undefined,
        hasMesures: hasMesures,
        stationId: source.id_station || source.stationId,
        date: source.date || source.timestamp
      });
    });

    // 🔥 NORMALISATION DES DONNÉES
    const formattedData = allHits.map((hit: any) => {
      const source = hit._source || hit.body || hit;
      const kuzzleInfo = hit._kuzzle_info || {};

      // 🔥 DÉTECTION DU FORMAT
      const hasMesures = source.mesures && typeof source.mesures === 'object';
      const hasFlatFields = source.dbo5_mg_l !== undefined || source.dbo5 !== undefined;

      // 🔥 EXTRACTION DE LA DATE
      const extractDate = () => {
        // Priorité 1 : champ 'date'
        if (source.date) {
          return this.normalizeDate(source.date);
        }
        // Priorité 2 : champ 'timestamp'
        if (source.timestamp) {
          return this.normalizeDate(source.timestamp);
        }
        // Priorité 3 : champ 'Timestamp' (API)
        if (source.Timestamp) {
          return this.normalizeDate(source.Timestamp);
        }
        // Priorité 4 : createdAt de Kuzzle
        if (kuzzleInfo.createdAt) {
          return this.normalizeDate(kuzzleInfo.createdAt);
        }
        return null;
      };

      const formattedDate = extractDate();

      // 🔥 EXTRACTION DE LA PHASE
      const extractPhase = () => {
        if (!source.phase) return 'Unknown';

        const phaseLower = source.phase.toLowerCase().trim();
        if (phaseLower.includes('entree') || phaseLower.includes('entrée') || phaseLower.includes('entree')) {
          return 'Entree';
        } else if (phaseLower.includes('sortie')) {
          return 'Sortie';
        }
        return 'Unknown';
      };

      const phase = extractPhase();

      // 🔥 EXTRACTION DU TYPE DE FILTRE
      const extractFilterType = () => {
        // Si le document a déjà un type_filtre (seed)
        if (source.type_filtre) {
          return source.type_filtre;
        }

        // Pour l'API, déterminer en fonction de la phase
        if (phase === 'Entree') {
          return 'Non_Applicable';
        } else if (phase === 'Sortie') {
          // Essayer de déduire du id_filtre
          if (source.id_filtre) {
            if (source.id_filtre.includes('FV') || source.id_filtre.includes('Vertical')) {
              return 'Filtre_Vertical';
            } else if (source.id_filtre.includes('FH') || source.id_filtre.includes('Horizontal')) {
              return 'Filtre_Horizontal';
            }
          }
          // Par défaut pour les sorties sans info
          return 'Filtre_Horizontal';
        }

        return 'Non_Applicable';
      };

      const type_filtre = extractFilterType();
      const extractFilterId = () => {
  // 1. Si déjà présent et valide
  if (source.id_filtre && source.id_filtre !== 'unknown' && source.id_filtre !== '') {
    return source.id_filtre;
  }

  // 2. Pour les données API (avec mesures), déduire depuis type_filtre et phase
  if (hasMesures) {
    // Si c'est une entrée, c'est toujours le filtre General
    if (phase === 'Entree') {
      return 'General';
    }

    // Si c'est une sortie, regarder le type_filtre
    if (source.type_filtre) {
      const typeStr = source.type_filtre.toLowerCase();
      if (typeStr.includes('vertical')) {
        // Alterner entre FV1 et FV2 (ou choisir selon d'autres critères)
        return 'FV1'; // Vous pouvez ajuster cette logique
      }
      if (typeStr.includes('horizontal')) {
        return 'FH';
      }
    }
  }

  // 3. Fallback: essayer depuis le nom de feuille (pour données SEED)
  if (source.nom_feuille) {
    const nomStr = source.nom_feuille.toLowerCase();
    if (nomStr.includes('general') || nomStr.includes('gene') || nomStr === 'e') {
      return 'General';
    }
    if (nomStr.includes('sfv1') || nomStr === 'sfv1a' || nomStr === 'sfv1b') {
      return 'FV1';
    }
    if (nomStr.includes('sfv2') || nomStr === 'sfv2a' || nomStr === 'sfv2b') {
      return 'FV2';
    }
    if (nomStr.includes('sfh') || nomStr === 'sfha' || nomStr === 'sfhb') {
      return 'FH';
    }
  }

  // 4. Dernier recours basé sur la phase et type_filtre
  if (phase === 'Entree') {
    return 'General';
  }

  if (phase === 'Sortie') {
    // Essayer de déduire du type_filtre
    if (type_filtre.toLowerCase().includes('vertical')) {
      return 'FV1';
    }
    if (type_filtre.toLowerCase().includes('horizontal')) {
      return 'FH';
    }
    // Par défaut pour les sorties
    return 'FH';
  }

  console.warn('⚠️ Impossible de déterminer id_filtre pour:', {
    nom_feuille: source.nom_feuille,
    phase: source.phase,
    type_filtre: source.type_filtre
  });

  return 'unknown';
};

const id_filtre = extractFilterId();

      // 🔥 EXTRACTION DES VALEURS NUMÉRIQUES
      const parseValue = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null;

        if (typeof value === 'number') {
          return isNaN(value) ? null : value;
        }

        if (typeof value === 'string') {
          const cleaned = value.trim().replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }

        return null;
      };

      // 🔥 STRUCTURE UNIFIÉE
      const normalizedItem = {
        _id: hit._id,
        body: {
          // Informations de base
          id_station: source.id_station || source.stationId || 'unknown',
          phase: phase,
          type_filtre: type_filtre,
          id_filtre: id_filtre,
          date: formattedDate,
          mois: source.mois || this.extractMonth(formattedDate),

          // Paramètres physico-chimiques (API + SEED)
          temperature_c: hasMesures
            ? parseValue(source.mesures?.temperature)
            : parseValue(source.temperature_c),

          ph: hasMesures
            ? parseValue(source.mesures?.ph || source.mesures?.pH)
            : parseValue(source.ph),

          conductivite_us_cm: hasMesures
            ? parseValue(source.mesures?.conductivite)
            : parseValue(source.conductivite_us_cm),

          potentiel_redox_mv: parseValue(source.potentiel_redox_mv),

          // Pollution organique (API + SEED)
          dbo5_mg_l: hasMesures
            ? parseValue(source.mesures?.dbo5 || source.mesures?.DBO5)
            : parseValue(source.dbo5_mg_l || source.dbo5),

          dco_mg_l: hasMesures
            ? parseValue(source.mesures?.dco || source.mesures?.DCO)
            : parseValue(source.dco_mg_l || source.dco),

          mes_mg_l: hasMesures
            ? parseValue(source.mesures?.mes)
            : parseValue(source.mes_mg_l || source.mes),

          mvs_pct: parseValue(source.mvs_pct),

          // Nutriments (API + SEED)
          nitrates_mg_l: hasMesures
            ? parseValue(source.mesures?.nitrates)
            : parseValue(source.nitrates_mg_l || source.nitrates),

          ammonium_mg_l: hasMesures
            ? parseValue(source.mesures?.ammonium)
            : parseValue(source.ammonium_mg_l || source.ammonium),

          azote_total_mg_l: parseValue(source.azote_total_mg_l),

          phosphates_mg_l: hasMesures
            ? parseValue(source.mesures?.phosphates)
            : parseValue(source.phosphates_mg_l || source.phosphates),

          // Microbiologie (API + SEED)
          coliformes_fecaux_cfu_100ml: hasMesures
            ? parseValue(source.mesures?.coliformes)
            : parseValue(source.coliformes_fecaux_cfu_100ml || source.coliformes),

          oeufs_helminthes: parseValue(source.oeufs_helminthes),
          huiles_graisses: parseValue(source.huiles_graisses),

          // Métadonnées
          nom_feuille: source.nom_feuille || (hasMesures ? 'API_Import' : 'Seed_Data'),
          contient_valeurs_estimees: source.contient_valeurs_estimees || false,
          timestamp: formattedDate,

          // Pour débogage
          _source_format: hasMesures ? 'API' : 'SEED',
          _raw_phase: source.phase,
          _has_type_filtre: source.type_filtre !== undefined,
          _original_date: source.date || source.timestamp || source.Timestamp
        }
      };

      return normalizedItem;
    });

    // 🔍 DEBUG : Afficher des échantillons
    console.log('✅ DONNÉES NORMALISÉES (5 premières):');
    formattedData.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.body.date} | ${item.body.phase} | ${item.body.type_filtre} | ` +
                  `DBO5: ${item.body.dbo5_mg_l} | Format: ${item.body._source_format}`);
    });

    // 📊 STATISTIQUES
    const stats = {
      total: formattedData.length,
      withDate: formattedData.filter(d => d.body.date).length,
      byFormat: formattedData.reduce((acc: any, item) => {
        const format = item.body._source_format;
        acc[format] = (acc[format] || 0) + 1;
        return acc;
      }, {}),
      byPhase: formattedData.reduce((acc: any, item) => {
        const phase = item.body.phase;
        acc[phase] = (acc[phase] || 0) + 1;
        return acc;
      }, {}),
      byFilterType: formattedData.reduce((acc: any, item) => {
        const filter = item.body.type_filtre;
        acc[filter] = (acc[filter] || 0) + 1;
        return acc;
      }, {})
    };

    console.log('📊 STATISTIQUES FINALES:');
    console.log('   Total:', stats.total);
    console.log('   Avec date:', stats.withDate);
    console.log('   Par format:', stats.byFormat);
    console.log('   Par phase:', stats.byPhase);
    console.log('   Par type filtre:', stats.byFilterType);

    return formattedData;
  } catch (error: unknown) {
    console.error('❌ Erreur getWaterQualityData:', this.getErrorMessage(error));
    return [];
  }
}
 */

// 🔥 AJOUTER CES MÉTHODES UTILITAIRES

/**
 * Normalise une date au format YYYY-MM-DD
 */
private normalizeDate(dateStr: any): string | null {
  if (!dateStr) return null;

  try {
    // Si c'est un timestamp numérique
    if (typeof dateStr === 'number') {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    }

    // Si c'est une chaîne
    if (typeof dateStr === 'string') {
      // Format "2019-04-09"
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }

      // Format "09/04/2019, 00:00:00"
      if (dateStr.includes('/')) {
        const [datePart] = dateStr.split(',');
        const [day, month, year] = datePart.trim().split('/');

        if (day && month && year) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Format ISO
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    console.warn('❌ Erreur normalisation date:', dateStr, error);
    return null;
  }
}

/**
 * Extrait le mois d'une date
 */
private extractMonth(dateStr: string | null): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    return months[date.getMonth()];
  } catch {
    return null;
  }
}


// 🔧 ALTERNATIVE : Si scroll ne fonctionne pas, utiliser from/size
async getWaterQualityDataAlternative(): Promise<any[]> {
  try {
    console.log('🔍 Recherche avec pagination from/size...');

    const allDocuments: any[] = [];
    const size = 1000;
    let from = 0;
    let total = 0;

    // Première requête pour obtenir le total
    const firstResult = await this.kuzzle.document.search(
      'iot',
      'water_quality',
      {},
      { size: size, from: 0 }
    );

    total = firstResult.total;
    allDocuments.push(...firstResult.hits);
    console.log(`📄 Page 1: ${firstResult.hits.length}/${total}`);

    // Récupérer le reste
    from = size;
    while (from < total) {
      const result = await this.kuzzle.document.search(
        'iot',
        'water_quality',
        {},
        { size: size, from: from }
      );

      allDocuments.push(...result.hits);
      console.log(`📄 Récupérés: ${allDocuments.length}/${total}`);

      from += size;

      // Sécurité : limiter à 1000 documents max
      if (from > 1000) {
        console.warn('⚠️ Limite de 1000 documents atteinte');
        break;
      }
    }

    console.log(`✅ TOTAL récupéré: ${allDocuments.length}/${total}`);
    return allDocuments;

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données:', error);
    throw error;
  }
}

// 🔧 MÉTHODE SIMPLIFIÉE : Récupérer tout d'un coup (si moins de 10000 docs)
async getWaterQualityDataSimple(): Promise<any[]> {
  try {
    console.log('🔍 Recherche TOUTES les données...');

    const result = await this.kuzzle.document.search(
      'iot',
      'water_quality',
      {},
      {
        size: 10000, // Maximum Elasticsearch par défaut
        from: 0
      }
    );

    console.log(`✅ Récupérés: ${result.hits.length}/${result.total} documents`);

    // Vérifier si tous les documents ont été récupérés
    if (result.hits.length < result.total) {
      console.warn(`⚠️ Seulement ${result.hits.length}/${result.total} récupérés. Utilisez la pagination.`);
    }

    return result.hits;

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données:', error);
    throw error;
  }
}

  async getReadingData(): Promise<any[]> {
    try {
      await this.ensureConnection();

      const response = await this.kuzzle.document.search('iot', 'readings', {
        sort: { 'timestamp': 'desc' },
        size: 1000
      });

      console.log('🌡️ Données de lecture brutes:', response.hits.length);

      const formattedData = response.hits.map((hit: any) => {
        const source = hit._source || hit.body || {};
        return {
          ...hit,
          body: {
            ...source,
            stationId: source.stationId || 'Station Inconnue',
            temperature: source.temperature || 0,
            humidity: source.humidity || 0,
            timestamp: source.timestamp || new Date().toISOString()
          }
        };
      });

      console.log('🌡️ Données de lecture formatées:', formattedData.length);
      return formattedData;
    } catch (error: unknown) {
      console.error('❌ Erreur getReadingData:', this.getErrorMessage(error));
      return [];
    }
  }

async getActiveAlerts(): Promise<any[]> {
  try {
    await this.ensureConnection();

    // 🔥 CORRECTION : Rechercher TOUTES les alertes, pas seulement "active"
    const response = await this.kuzzle.document.search(
      'iot',
      'alerts',
      {
        query: {
          match_all: {} // 👈 Récupérer TOUTES les alertes d'abord
        },
        sort: { 'timestamp': 'desc' }
      },
      {
        size: 1000, // 👈 Augmenter la limite
        from: 0
      }
    );

    console.log(`📨 TOTAL alertes dans Kuzzle: ${response.total}`);
    console.log(`📨 Alertes récupérées: ${response.hits.length}`);

    if (response.hits.length > 0) {
      console.log('📄 Exemple alerte brute:', response.hits[0]);
    }

    // ✅ NORMALISER LES DONNÉES avec meilleure gestion
    return response.hits.map((hit: any) => {
      // 🔍 Chercher les données dans _source OU directement dans hit
      const source = hit._source || hit;

      console.log(`🔍 Alerte ${hit._id}:`, {
        stationId: source.stationId,
        type: source.type,
        status: source.status,
        severity: source.severity || source.level
      });

      return {
        _id: hit._id,
        _source: {
          stationId: source.stationId || 'unknown',
          type: source.type || 'unknown',
          severity: source.severity || source.level || 'info',
          level: source.severity || source.level || 'info',
          message: source.message || 'Pas de message',
          timestamp: this.normalizeTimestamp(source.timestamp),
          status: source.status || 'active',
          parameter: source.parameter,
          value: source.value,
          threshold: source.threshold
        }
      };
    });
  } catch (error: unknown) {
    console.error('❌ Erreur getActiveAlerts:', this.getErrorMessage(error));
    return [];
  }
}
normalizeTimestamp(timestamp: any): number {
  // Si c'est déjà un nombre, retourner tel quel
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  // Si c'est une chaîne
  if (typeof timestamp === 'string') {
    // Format "14/11/2023, 22:13:20" ou "08/12/2025, 18:03:42"
    if (timestamp.includes('/') && timestamp.includes(',')) {
      try {
        const [datePart, timePart] = timestamp.split(', ');
        const [day, month, year] = datePart.split('/');
        const [hours, minutes, seconds] = timePart.split(':');

        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds)
        );

        return date.getTime();
      } catch (error) {
        console.warn('⚠️ Erreur parsing date:', timestamp);
        return Date.now();
      }
    }

    // Format ISO ou autre format reconnu par Date
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Par défaut, retourner la date actuelle
  console.warn('⚠️ Timestamp invalide, utilisation de Date.now():', timestamp);
  return Date.now();
}
async createAlert(alert: any): Promise<any> {
  try {
    await this.ensureConnection();

    // Vérifier si une alerte active similaire existe déjà
    const existingAlerts = await this.kuzzle.document.search(
      'iot',
      'alerts',
      {
        query: {
          bool: {
            must: [
              { term: { stationId: alert.stationId } },
              { term: { type: alert.type } },
              { term: { parameter: alert.parameter } },
              { term: { status: 'active' } }
            ]
          }
        }
      },
      { size: 1 }
    );

    if (existingAlerts.hits.length > 0) {
      console.log('⚠️ Alerte active similaire existe déjà, pas de création');
      return existingAlerts.hits[0];
    }

    // ✅ CORRECTION : Créer l'alerte avec les bons noms de champs
    const document = {
      stationId: alert.stationId,
      type: alert.type,
      severity: alert.severity,           // 🔴 Utiliser "severity" au lieu de "level"
      level: alert.severity,              // 🔴 Garder "level" pour compatibilité
      message: alert.message,
      timestamp: Date.now(),              // 🔴 Toujours un nombre
      status: alert.status || 'active',
      parameter: alert.parameter,
      value: alert.value,
      threshold: alert.threshold
    };

    const response = await this.kuzzle.document.create(
      'iot',
      'alerts',
      document,
      undefined,
      { refresh: 'wait_for' }
    );

    console.log('✅ Alerte créée:', response._id);
    return response;
  } catch (error: unknown) {
    console.error('❌ Erreur createAlert:', this.getErrorMessage(error));
    throw error;
  }
}


  async getPaginatedWaterData(page: number, size: number): Promise<any> {
    try {
      await this.ensureConnection();

      const from = (page - 1) * size;

      const response = await this.kuzzle.document.search('iot', 'water_quality', {
        from,
        size,
        sort: { 'timestamp': 'desc' }
      });

      return {
        data: response.hits,
        total: response.total
      };
    } catch (error: unknown) {
      console.error('❌ Erreur getPaginatedWaterData:', this.getErrorMessage(error));
      throw error;
    }
  }

  subscribeToAlerts(callback: (alert: any) => void): any {
    this.ensureConnection().then(() => {
      try {
        return this.kuzzle.realtime.subscribe(
          'iot',
          'alerts',
          {},
          (notification) => {
            if (notification.type === 'document') {
              callback(notification.result);
            }
          }
        );
      } catch (error: unknown) {
        console.error('❌ Erreur subscribeToAlerts:', this.getErrorMessage(error));
        return null;
      }
    }).catch((error) => {
      console.error('❌ Impossible de s\'abonner aux alertes:', error);
    });
  }

  subscribeToWaterQuality(callback: (data: any) => void): any {
    this.ensureConnection().then(() => {
      return this.kuzzle.realtime.subscribe(
        'iot',
        'water_quality',
        {},
        (notification) => {
          if (notification.type === 'document') {
            callback(notification.result);
          }
        }
      );
    });
  }


  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else {
      return 'Erreur inconnue';
    }
  }

  isConnected(): boolean {
    return this.kuzzle?.connected || false;
  }

  disconnect(): void {
    if (this.kuzzle) {
      this.kuzzle.disconnect();
    }
  }

  async updateAlert(alertId: string, updates: any): Promise<void> {
  try {
    await this.ensureConnection();

    // ✅ S'assurer que le timestamp est un nombre
    if (updates.timestamp && typeof updates.timestamp !== 'number') {
      updates.timestamp = this.normalizeTimestamp(updates.timestamp);
    }

    // ✅ S'assurer que resolvedAt est un nombre
    if (updates.resolvedAt && typeof updates.resolvedAt !== 'number') {
      updates.resolvedAt = Date.now();
    }

    await this.kuzzle.document.update('iot', 'alerts', alertId, updates, {
      refresh: 'wait_for'
    });

    console.log('✅ Alerte mise à jour:', alertId);
  } catch (error) {
    console.error('❌ Erreur mise à jour alerte:', error);
    throw error;
  }
}

  /**
   * Crée une nouvelle station dans Kuzzle
   */
  async createStation(station: any): Promise<any> {
    try {
      console.log('📡 [KuzzleService] Début createStation', station);

      await this.ensureConnection();
      console.log('✅ [KuzzleService] Connexion vérifiée');

      // ⚡ MODIFICATION : Ajout de { refresh: 'wait_for' }
      const response = await this.kuzzle.document.create(
        'iot',
        'stations',
        station.body,
        station._id,
        { refresh: 'wait_for' }
      );

      console.log('✅ [KuzzleService] Réponse Kuzzle:', response);
      return response;
    } catch (error: any) {
      console.error('❌ [KuzzleService] Erreur createStation:', error);
      throw error;
    }
  }

  /**
   * Supprime une station de Kuzzle
   */
  async deleteStation(stationId: string): Promise<void> {
    try {
      await this.ensureConnection();

      // ⚡ MODIFICATION : Ajout de { refresh: 'wait_for' }
      await this.kuzzle.document.delete('iot', 'stations', stationId, {
        refresh: 'wait_for'
      });

      console.log('✅ Station supprimée:', stationId);
    } catch (error: unknown) {
      console.error('❌ Erreur deleteStation:', this.getErrorMessage(error));
      throw error;
    }
  }
  // kuzzle.service.ts - AJOUTEZ CETTE LIGNE
get kuzzleInstance(): any {
  return this.kuzzle;
}

  /**
   * Met à jour une station existante
   */
  async updateStation(stationId: string, updates: any): Promise<any> {
    try {
      await this.ensureConnection();

      // ⚡ MODIFICATION : Ajout de { refresh: 'wait_for' }
      const response = await this.kuzzle.document.update(
        'iot',
        'stations',
        stationId,
        updates,
        { refresh: 'wait_for' }
      );

      console.log('✅ Station mise à jour:', response._id);
      return response;
    } catch (error: unknown) {
      console.error('❌ Erreur updateStation:', this.getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Récupère une station spécifique par son ID
   */
  async getStationById(stationId: string): Promise<any> {
    try {
      await this.ensureConnection();

      const response = await this.kuzzle.document.get('iot', 'stations', stationId);
      console.log('✅ Station récupérée:', response._id);
      return response;
    } catch (error: unknown) {
      console.error('❌ Erreur getStationById:', this.getErrorMessage(error));
      throw error;
    }
  }

  /**
   * ⚡ NOUVELLE MÉTHODE : Compte le nombre total de stations
   */
  async countStations(): Promise<number> {
    try {
      await this.ensureConnection();

      const result = await this.kuzzle.document.count(
        'iot',
        'stations',
        { query: { match_all: {} } }
      );

      console.log('📊 Nombre total de stations:', result);
      return result;
    } catch (error: unknown) {
      console.error('❌ Erreur countStations:', this.getErrorMessage(error));
      return 0;
    }
  }
  async initializeMaintenanceCollection(): Promise<void> {
  try {
    const exists = await this.kuzzle.collection.exists(
      'iot',
      'maintenance_interventions'
    );

    if (!exists) {
      await this.kuzzle.collection.create(
        'iot',
        'maintenance_interventions',
        {
          mappings: {
            properties: {
              id_filtre: { type: 'keyword' },
              date_intervention: {
                type: 'date',
                format: 'strict_date_optional_time||epoch_millis'
              },
              type_intervention: { type: 'keyword' },
              description: { type: 'text' },
              operateur: { type: 'keyword' },
              duree_minutes: { type: 'integer' },
              cout_estimatif: { type: 'float' },
              impact_attendu: { type: 'text' },
              notes: { type: 'text' },
              statut: { type: 'keyword' },
              pieces_changees: { type: 'keyword' }
            }
          }
        }
      );
      console.log('✅ Collection maintenance_interventions créée');
    }
  } catch (error) {
    console.error('❌ Erreur création collection:', error);
  }
}
  /**
 * Récupérer les interventions de maintenance
 */
async getMaintenanceInterventions(): Promise<MaintenanceIntervention[]> {
  try {
    await this.ensureConnection();

    const result = await this.kuzzle.document.search(
      'iot',
      'maintenance_interventions',
      {
        query: {
          match_all: {}
        }
      },
      {
        size: 10000,
        sort: [{ date_intervention: 'desc' }]
      }
    );

    console.log(`✅ ${result.hits.length} interventions de maintenance récupérées`);

    // ✅ CORRECTION : Mapping correct des données Kuzzle
    return result.hits.map(hit => {
      const source = hit._source as any;
      return {
        _id: hit._id,
        _kuzzle_info: source._kuzzle_info,
        id_filtre: source.id_filtre || '',
        date_intervention: source.date_intervention || '',
        type_intervention: source.type_intervention || '',
        description: source.description || '',
        operateur: source.operateur,
        duree_minutes: source.duree_minutes,
        cout_estimatif: source.cout_estimatif,
        impact_attendu: source.impact_attendu,
        notes: source.notes,
        statut: source.statut,
        pieces_changees: source.pieces_changees || []
      } as MaintenanceIntervention;
    });

  } catch (error) {
    console.error('❌ Erreur récupération interventions:', error);
    return [];
  }
}
  /**
 * Récupérer un utilisateur par email
 */
async getUserByEmail(email: string): Promise<any[]> {
  try {
    await this.ensureConnection();

    const result = await this.kuzzle.document.search(
      'iot',
      'users',
      {
        query: {
          term: { // ✅ Utiliser 'term' pour une recherche exacte
            email: email.toLowerCase().trim() // ✅ Normaliser l'email
          }
        }
      },
      { size: 1 }
    );

    console.log(`🔍 Recherche utilisateur "${email}": ${result.hits.length} résultat(s)`);

    return result.hits.map(hit => ({
      _id: hit._id,
      _source: hit._source
    }));

  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    return [];
  }
}

/**
 * Mettre à jour la dernière connexion d'un utilisateur
 */
async updateUserLastLogin(userId: string): Promise<void> {
  try {
    await this.ensureConnection();

    await this.kuzzle.document.update(
      'iot',
      'users',
      userId,
      {
        lastLogin: new Date().toISOString()
      }
    );

    console.log('✅ Dernière connexion mise à jour pour:', userId);

  } catch (error) {
    console.error('❌ Erreur mise à jour lastLogin pour', userId, ':', error);
    // Ne pas throw pour ne pas bloquer le processus de login
  }
}
// ============================================
// AJOUTER CES MÉTHODES DANS kuzzle.service.ts
// ============================================

/**
 * Récupère tous les filtres
 */
async getFiltres(): Promise<any[]> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.search(
      'iot',  // ou 'iot' selon votre index
      'filtres',
      {
        query: {
          match_all: {}
        }
      },
      {
        size: 1000
      }
    );

    console.log('🔧 Filtres récupérés:', response.hits.length);
    return response.hits;
  } catch (error: unknown) {
    console.error('❌ Erreur getFiltres:', this.getErrorMessage(error));
    return [];
  }
}
async getAllFiltres(): Promise<any[]> {
  try {
    await this.ensureConnection();
    const response = await this.kuzzle.document.search('iot', 'filtres', {
      size: 1000
    });
    return response.hits;
  } catch (error: unknown) {
    console.error('❌ Erreur getAllFiltres:', this.getErrorMessage(error));
    return [];
  }
}
// Méthode pour récupérer les alertes actives d'une station spécifique
async getActiveAlertsByStation(stationId: string, limit: number = 50): Promise<any[]> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.search('iot', 'alerts', {
      query: {
        bool: {
          must: [
            { match: { 'status': 'active' } },
            { match: { 'stationId': stationId } }
          ]
        }
      },
      sort: { 'timestamp': 'desc' },
      size: limit
    });

    console.log(`📨 Alertes récupérées pour station ${stationId}: ${response.hits.length}`);
    return response.hits;
  } catch (error: unknown) {
    console.error('❌ Erreur getActiveAlertsByStation:', this.getErrorMessage(error));
    return [];
  }
}
// Méthode pour compter les alertes actives d'une station spécifique
async getActiveAlertsCountByStation(stationId: string): Promise<number> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.search('iot', 'alerts', {
      query: {
        bool: {
          must: [
            {
              match: {
                'status': 'active'
              }
            },
            {
              match: {
                'stationId': stationId
              }
            }
          ]
        }
      },
      size: 0 // Important: seulement le count, pas les documents
    });

    console.log(`🔢 Count alertes pour station ${stationId}: ${response.total}`);
    return response.total;
  } catch (error: unknown) {
    console.error('❌ Erreur getActiveAlertsCountByStation:', this.getErrorMessage(error));
    return 0;
  }
}


// Méthode pour récupérer toutes les alertes (actives et inactives) d'une station
async getAllAlertsByStation(stationId: string): Promise<any[]> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.search('iot', 'alerts', {
      query: {
        match: { 'stationId': stationId }
      },
      sort: { 'timestamp': 'desc' },
      size: 1000
    });

    return response.hits;
  } catch (error: unknown) {
    console.error('❌ Erreur getAllAlertsByStation:', this.getErrorMessage(error));
    return [];
  }
}

/**
 * Récupère les filtres d'une station spécifique
 */
async getFiltresByStation(stationId: string): Promise<any[]> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.search(
      'iot',
      'filtres',
      {
        query: {
          term: {
            idStation: stationId
          }
        }
      },
      {
        size: 100
      }
    );

    console.log(`🔧 Filtres pour station ${stationId}:`, response.hits.length);
    return response.hits;
  } catch (error: unknown) {
    console.error('❌ Erreur getFiltresByStation:', this.getErrorMessage(error));
    return [];
  }
}

/**
 * Crée un nouveau filtre
 */
async createFiltre(filtre: any): Promise<any> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.create(
      'iot',
      'filtres',
      filtre,
      undefined,
      { refresh: 'wait_for' }
    );

    console.log('✅ Filtre créé:', response._id);
    return response;
  } catch (error: unknown) {
    console.error('❌ Erreur createFiltre:', this.getErrorMessage(error));
    throw error;
  }
}

/**
 * Met à jour un filtre
 */
async updateFiltre(filtreId: string, updates: any): Promise<any> {
  try {
    await this.ensureConnection();

    const response = await this.kuzzle.document.update(
      'iot',
      'filtres',
      filtreId,
      updates,
      { refresh: 'wait_for' }
    );

    console.log('✅ Filtre mis à jour:', response._id);
    return response;
  } catch (error: unknown) {
    console.error('❌ Erreur updateFiltre:', this.getErrorMessage(error));
    throw error;
  }
}

/**
 * Supprime un filtre
 */
async deleteFiltre(filtreId: string): Promise<void> {
  try {
    await this.ensureConnection();

    await this.kuzzle.document.delete(
      'iot',
      'filtres',
      filtreId,
      { refresh: 'wait_for' }
    );

    console.log('✅ Filtre supprimé:', filtreId);
  } catch (error: unknown) {
    console.error('❌ Erreur deleteFiltre:', this.getErrorMessage(error));
    throw error;
  }
}

/**
 * Récupérer les cycles de vie des filtres
 */
async getCyclesVieFiltre(): Promise<CycleVieFiltre[]> {
  try {
    const result = await this.kuzzle.document.search(
      'iot',
      'cycle-vie',
      { query: { match_all: {} } },
      { size: 1000 }
    );

    return result.hits.map((hit: any) => ({
      _id: hit._id,
      ...(hit._source || {})
    }));
  } catch (error) {
    console.error('❌ Erreur récupération cycles de vie:', error);
    return [];
  }
}

/**
 * Récupérer le cycle de vie d'un filtre spécifique
 */
/**
 * Récupérer le cycle de vie d'un filtre water_quality
 */
async getCycleVieFiltre(
  filtreId: string,
  stationId?: string,
  donneesWaterQuality?: any[]
): Promise<CycleVieFiltre | null> {
  try {
    // 1. Chercher dans cycle-vie existant
    const result = await this.kuzzle.document.search(
      'iot',
      'cycle-vie',
      {
        query: {
          match: { id_filtre: filtreId }
        }
      }
    );

    if (result.hits.length > 0) {
      const hit = result.hits[0];
      const source = hit._source || {}; // Supprimé hit.body

      return {
        _id: hit._id,
        id_filtre: source['id_filtre'] || filtreId,
        id_station: source['id_station'] || stationId || '',
        etat_actuel: source['etat_actuel'] || 'bon',
        date_changement_etat: source['date_changement_etat'] || new Date().toISOString(),
        pourcentage_usure: source['pourcentage_usure'] || 0,
        heures_utilisation: source['heures_utilisation'] || 0,
        volume_traite_m3: source['volume_traite_m3'] || 0,
        historique_etats: source['historique_etats'] || [],
        metriques: source['metriques'] || {
          taux_usure_moyen: 0,
          volume_moyen_par_jour: 0,
          heures_moyennes_par_jour: 0,
          efficacite_moyenne: 0
        },
        jalons: source['jalons'] || {
          mise_en_service: new Date().toISOString(),
          prochaine_maintenance: new Date().toISOString(),
          fin_vie_estimee: new Date().toISOString(),
          remplacement_prevu: null
        }
      } as CycleVieFiltre;
    }

    // 2. Si pas trouvé ET qu'on a les données water_quality, générer
    if (donneesWaterQuality && donneesWaterQuality.length > 0 && stationId) {
      console.log(`⚠️ Génération automatique du cycle de vie pour ${filtreId}`);
      return this.genererCycleVieDepuisWaterQuality(filtreId, stationId, donneesWaterQuality);
    }

    return null;
  } catch (error) {
    console.error(`❌ Erreur récupération cycle de vie ${filtreId}:`, error);
    return null;
  }
}
/**
 * Mettre à jour le cycle de vie d'un filtre
 */
async updateCycleVieFiltre(
  filtreId: string,
  updates: Partial<CycleVieFiltre>
): Promise<boolean> {
  try {
    const existing = await this.getCycleVieFiltre(filtreId);

    if (existing) {
      await this.kuzzle.document.update(
        'iot',
        'cycle-vie',
        existing._id,
        updates
      );
    } else {
      await this.kuzzle.document.create(
        'iot',
        'cycle-vie',
        { id_filtre: filtreId, ...updates }
      );
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur mise à jour cycle de vie:', error);
    return false;
  }
}

/**
 * Calculer automatiquement l'état du cycle de vie
 */
calculerEtatCycleVie(pourcentageUsure: number): 'neuf' | 'bon' | 'moyen' | 'degrade' | 'critique' | 'hors_service' {
  if (pourcentageUsure < 10) return 'neuf';
  if (pourcentageUsure < 40) return 'bon';
  if (pourcentageUsure < 70) return 'moyen';
  if (pourcentageUsure < 90) return 'degrade';
  if (pourcentageUsure < 100) return 'critique';
  return 'hors_service';
}
  /**
 * Générer un cycle de vie depuis les données water_quality
 */
/**
 * Générer un cycle de vie depuis les données water_quality (VERSION AMÉLIORÉE)
 */
genererCycleVieDepuisWaterQuality(
  filtreId: string,
  stationId: string,
  donneesFiltre: any[]
): CycleVieFiltre {

  console.log(`🔍 Génération cycle vie pour ${filtreId} avec ${donneesFiltre.length} mesures`);

  // PARAMÈTRES SPÉCIFIQUES PAR TYPE DE FILTRE
  const parametresFiltres: { [key: string]: { heuresParMesure: number; debitM3ParHeure: number; dureeVieMaxHeures: number } } = {
    'General': { heuresParMesure: 8,  debitM3ParHeure: 20, dureeVieMaxHeures: 20000 },
    'FV1':     { heuresParMesure: 6,  debitM3ParHeure: 12, dureeVieMaxHeures: 15000 },
    'FV2':     { heuresParMesure: 6,  debitM3ParHeure: 12, dureeVieMaxHeures: 15000 },
    'FH':      { heuresParMesure: 4,  debitM3ParHeure: 8,  dureeVieMaxHeures: 12000 }
  };

  const params = parametresFiltres[filtreId] || { heuresParMesure: 6, debitM3ParHeure: 10, dureeVieMaxHeures: 15000 };

  // CALCULS BASÉS SUR LE VOLUME DE DONNÉES
  const nombreMesures = donneesFiltre.length;
  let heuresUtilisation = nombreMesures * params.heuresParMesure;

  // AUGMENTER si beaucoup de données
  if (nombreMesures > 20) {
    heuresUtilisation *= 1.5;
  }

  // GARANTIR UN MINIMUM RÉALISTE
  heuresUtilisation = Math.max(48, heuresUtilisation);

  const volumeEstimeM3 = heuresUtilisation * params.debitM3ParHeure;
  const pourcentageUsure = Math.min(100, (heuresUtilisation / params.dureeVieMaxHeures) * 100);

  const etatActuel = this.calculerEtatCycleVie(pourcentageUsure);

  // CALCUL DES DATES
  const maintenant = new Date();
  const heuresRestantes = Math.max(0, params.dureeVieMaxHeures - heuresUtilisation);
  const joursRestants = Math.floor(heuresRestantes / 24);

  const finVieEstimee = new Date(maintenant);
  finVieEstimee.setDate(finVieEstimee.getDate() + joursRestants);

  const prochaineMaintenance = new Date(maintenant);
  prochaineMaintenance.setDate(prochaineMaintenance.getDate() + 90);

  const miseEnService = new Date(maintenant);
  miseEnService.setDate(miseEnService.getDate() - Math.floor(heuresUtilisation / 24));

  const cycleVie: CycleVieFiltre = {
    _id: `cycle-${filtreId}-${Date.now()}`,
    id_filtre: filtreId,
    id_station: stationId,
    etat_actuel: etatActuel,
    date_changement_etat: maintenant.toISOString(),
    pourcentage_usure: Math.round(pourcentageUsure * 10) / 10,
    heures_utilisation: Math.round(heuresUtilisation),
    volume_traite_m3: Math.round(volumeEstimeM3),
    historique_etats: [
      {
        etat: etatActuel,
        date: maintenant.toISOString(),
        raison: `Génération automatique depuis ${nombreMesures} mesures water_quality`,
        // Propriétés requises par l'interface EtatCycleVie
        date_debut: maintenant.toISOString(),
        date_fin: null,
        duree_jours: 0,
        volume_traite: volumeEstimeM3,
        heures_utilisation: heuresUtilisation
      }
    ],
    metriques: {
      taux_usure_moyen: pourcentageUsure / 100,
      volume_moyen_par_jour: Math.round(volumeEstimeM3 / 90),
      heures_moyennes_par_jour: Math.round(heuresUtilisation / 90),
      efficacite_moyenne: 75
    },
    jalons: {
      mise_en_service: miseEnService.toISOString(),
      prochaine_maintenance: prochaineMaintenance.toISOString(),
      fin_vie_estimee: finVieEstimee.toISOString(),
      remplacement_prevu: pourcentageUsure > 80 ? finVieEstimee.toISOString() : null
    }
  };

  console.log(`✅ Cycle de vie généré pour ${filtreId}:`, {
    mesures: nombreMesures,
    heures: heuresUtilisation,
    volume: volumeEstimeM3,
    usure: pourcentageUsure + '%',
    etat: etatActuel
  });

  return cycleVie;
}
//PARTIE USERS

}
