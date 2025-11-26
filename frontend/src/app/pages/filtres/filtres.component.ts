import { Component, OnInit, AfterViewInit, OnDestroy,HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService,MaintenanceIntervention, CycleVieFiltre  } from '../../kuzzle.service';
import { CycleVieWidgetComponent } from '../cycle-vie-widget/cycle-vie-widget.component';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { FormsModule } from '@angular/forms';

// Import Leaflet
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Configuration des icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

Chart.register(...registerables);

// Interfaces
interface WaterQualityData {
  _id: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre: string;
    id_filtre: string;
    date: string;
    temperature_c: number | null;
    ph: number | null;
    conductivite_us_cm: number | null;
    potentiel_redox_mv: number | null;
    dbo5_mg_l: number | null;
    dco_mg_l: number | null;
    mes_mg_l: number | null;
    mvs_pct: number | null;
    nitrates_mg_l: number | null;
    ammonium_mg_l: number | null;
    azote_total_mg_l: number | null;
    phosphates_mg_l: number | null;
    coliformes_fecaux_cfu_100ml: number | null;
    oeufs_helminthes: string | null;
    huiles_graisses: string | null;
    nom_feuille: string;
    contient_valeurs_estimees: boolean;
  };
}

interface FilterPerformance {
  id_filtre: string;
  type_filtre: string;
  station: string;
  donnees_entree: number;
  donnees_sortie: number;
  efficacite_dbo5: number;
  efficacite_dco: number;
  efficacite_mes: number;
  efficacite_nitrates: number;
  efficacite_coliformes: number;
  dernier_mesure: string;
  statut: 'Optimal' | 'Bon' | 'Moyen' | 'Critique';
  scorePerformance: number;
  detailsScore: {
    pointsDBO5: number;
    pointsMES: number;
    pointsNitrates: number;
    pointsColiformes: number;
    pointsPH: number;
    pointsDonnees: number;
    stabilityPH: number;
    tauxValeursManquantes: number;
  };
  latitude: number;
  longitude: number;
}

interface FilterChainAnalysis {
  general: FilterPerformance | null;
  vertical: FilterPerformance | null;
  horizontal: FilterPerformance | null;
  overallEfficiency: number;
  chainSteps: {
    generalToVertical: number;
    verticalToHorizontal: number;
    generalToHorizontal: number;
  };
}

// Interface pour les datasets des graphiques
interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  fill?: boolean;
  tension?: number;
}

@Component({
  selector: 'app-filtres',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CycleVieWidgetComponent],
  templateUrl: './filtres.component.html',
  styleUrls: ['./filtres.component.css']
})
export class FiltresComponent implements OnInit, AfterViewInit, OnDestroy {

  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;
  private stations: Map<string, string> = new Map();
  waterQualityData: WaterQualityData[] = [];
  filterPerformances: FilterPerformance[] = [];
   maintenanceInterventions: MaintenanceIntervention[] = [];
  selectedFilterInterventions: MaintenanceIntervention[] = [];
  cyclesVie: Map<string, CycleVieFiltre> = new Map();
  filterChain: FilterChainAnalysis = {
    general: null,
    vertical: null,
    horizontal: null,
    overallEfficiency: 0,
    chainSteps: {
      generalToVertical: 0,
      verticalToHorizontal: 0,
      generalToHorizontal: 0
    }
  };
  selectedFilter: FilterPerformance | null = null;
  performanceChart: Chart | null = null;
  removalChart: Chart | null = null;
  timelineChart: Chart | null = null;
  kpiChart: Chart | null = null;
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  searchTerm: string = '';
  selectedStation: string = 'all';
  selectedType: string = 'all';
  loading: boolean = true;
  error: string | null = null;
  chartsReady: boolean = false;
  selectedFilterId: string = 'all';
  activeView: 'list' | 'map' = 'list';

  /**
   * Fermer le panneau de détails avec la touche Échap
   */
 /**
   * Gérer les raccourcis clavier
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Échap : Fermer le modal
    if ((event.key === 'Escape' || event.key === 'Esc') && this.selectedFilter) {
      this.closeModal();
      event.preventDefault();
    }

    // Ctrl + R : Rafraîchir les données
    if (event.ctrlKey && event.key === 'r') {
      event.preventDefault();
      this.refreshData();
    }

    // Flèche droite/gauche : Naviguer entre les filtres dans le modal
    if (this.selectedFilter && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      const currentIndex = this.filteredPerformances.findIndex(
        f => f.id_filtre === this.selectedFilter!.id_filtre
      );

      if (event.key === 'ArrowRight' && currentIndex < this.filteredPerformances.length - 1) {
        this.selectFilter(this.filteredPerformances[currentIndex + 1]);
      } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
        this.selectFilter(this.filteredPerformances[currentIndex - 1]);
      }
    }
  }
  // ================================
  // GESTION DU MODAL
  // ================================

  /**
   * Fermer le modal et débloquer le scroll
   */
  closeModal() {
    this.selectedFilter = null;
    this.selectedFilterInterventions = [];
    // Débloquer le scroll du body
    document.body.style.overflow = '';
  }

  /**
   * Fermer le modal en cliquant sur l'overlay (fond noir)
   */
  closeModalOnOverlay(event: MouseEvent) {
    // Fermer uniquement si on clique sur l'overlay, pas sur le contenu
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }
  constructor(private kuzzleService: KuzzleService,
    private route: ActivatedRoute,

    private router: Router
  ) {}

async ngOnInit() {
    // 👇 RÉCUPÉRER LE STATION ID DEPUIS L'URL
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    console.log('📍 Station ID depuis URL (filtres):', this.stationId);

    await this.loadStations();

    // 👇 Récupérer le nom de la station si on est en mode spécifique
    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
    }

    await this.loadData();
  }
  private async loadStations() {
    try {
      const stationsData = await this.kuzzleService.getStations();
      stationsData.forEach((station: any) => {
        const source = station._source || station.body || {};
        this.stations.set(station._id, source.name || station._id);
      });
      console.log('✅ Stations chargées (filtres):', this.stations.size);
    } catch (error) {
      console.error('❌ Erreur chargement stations (filtres):', error);
    }
  }
private belongsToStation(dataStationId: string): boolean {
    if (!this.stationId) return true; // Pas de filtre = tout afficher
    return dataStationId === this.stationId;
  }
  ngAfterViewInit() {
    if (!this.loading && !this.error) {
      setTimeout(() => {
        this.createCharts();
        if (this.activeView === 'map') {
          setTimeout(() => this.initializeMap(), 100);
        }
      }, 100);
    }
  }

async loadData() {
  try {
    this.loading = true;
    this.error = null;

    console.log('🔄 Chargement des données water_quality depuis Kuzzle...');
    const allWaterData = await this.kuzzleService.getWaterQualityData();

    // 👇 FILTRER LES DONNÉES WATER QUALITY PAR STATION
    this.waterQualityData = allWaterData.filter((data: WaterQualityData) => {
      if (!this.stationId) return true; // Mode toutes stations
      const dataStationId = data.body.id_station;
      return dataStationId === this.stationId; // Mode station spécifique
    });

    console.log(`✅ Données water_quality après filtrage: ${this.waterQualityData.length}/${allWaterData.length}`);

    // ✅ CHARGER LES INTERVENTIONS DE MAINTENANCE
    console.log('🔄 Chargement des interventions de maintenance...');
    const allInterventions = await this.kuzzleService.getMaintenanceInterventions();

    // 👇 FILTRER LES INTERVENTIONS BASÉ SUR LES FILTRES DE LA STATION
    if (this.stationId) {
      // En mode station spécifique : obtenir tous les filterIds de cette station
      const stationFilterIds = new Set(
        this.waterQualityData.map(data => {
          // Utiliser directement data.body
          return data.body.id_filtre;
        })
      );

      // Filtrer les interventions pour ces filtres
      this.maintenanceInterventions = allInterventions.filter((intervention: MaintenanceIntervention) => {
        return stationFilterIds.has(intervention.id_filtre);
      });

      console.log(`✅ ${this.maintenanceInterventions.length} interventions chargées pour ${stationFilterIds.size} filtres de la station`);
    } else {
      // Mode toutes stations : garder toutes les interventions
      this.maintenanceInterventions = allInterventions;
      console.log(`✅ ${this.maintenanceInterventions.length} interventions chargées (toutes stations)`);
    }
      // ✅ CHARGER LES CYCLES DE VIE (après les interventions)
    console.log('🔄 Génération des cycles de vie depuis water_quality...');
    this.cyclesVie.clear();

    // Grouper les données water_quality par filtre
    const filtresMap = new Map<string, WaterQualityData[]>();
    this.waterQualityData.forEach(data => {
      const filtreId = data.body.id_filtre;
      if (!filtresMap.has(filtreId)) {
        filtresMap.set(filtreId, []);
      }
      filtresMap.get(filtreId)!.push(data);
    });

    // Générer le cycle de vie pour chaque filtre (General, FV1, FV2, FH)
    for (const [filtreId, donnees] of filtresMap.entries()) {
      const stationId = this.stationId || donnees[0]?.body.id_station || '';

      // Appeler getCycleVieFiltre avec les données water_quality
      const cycle = await this.kuzzleService.getCycleVieFiltre(
        filtreId,
        stationId,
        donnees
      );

      if (cycle) {
        this.cyclesVie.set(filtreId, cycle);
        console.log(`✅ Cycle de vie généré pour ${filtreId}: ${cycle.pourcentage_usure}% d'usure, ${cycle.heures_utilisation}h`);
      }
    }

    console.log(`✅ ${this.cyclesVie.size} cycles de vie disponibles`);
    // Corriger les types de filtres
    this.waterQualityData = this.waterQualityData.map(data => {
      const filterId = data.body.id_filtre;
      let correctType = data.body.type_filtre;

      if (!correctType || correctType === 'Non applicable' || correctType === 'N/A') {
        const typeMap: { [key: string]: string } = {
          'General': 'Filtre général',
          'FV1': 'Filtre vertical',
          'FV2': 'Filtre vertical',
          'FH': 'Filtre horizontal'
        };
        correctType = typeMap[filterId] || 'Type inconnu';
      }

      return {
        ...data,
        body: {
          ...data.body,
          type_filtre: correctType
        }
      };
    });

    console.log(`✅ ${this.waterQualityData.length} mesures chargées et corrigées`);

    this.calculateFilterPerformances();
    this.analyzeFilterChain();

    setTimeout(() => {
      this.createCharts();
      this.chartsReady = true;
    }, 500);

    this.loading = false;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des données:', error);
    this.error = 'Impossible de charger les données. Vérifiez votre connexion à Kuzzle.';
    this.loading = false;
  }
}


  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/map']);
    }
  }

  calculateFilterPerformances() {
  const performances: any[] = [];
  const filterMap = new Map<string, WaterQualityData[]>();

  // Grouper les données par filtre
  this.waterQualityData.forEach(data => {
    const filterId = data.body.id_filtre;
    if (!filterMap.has(filterId)) {
      filterMap.set(filterId, []);
    }
    filterMap.get(filterId)!.push(data);
  });

  const basePosition = { lat: 14.7167, lng: -17.4677 };
  const positionOffsets: { [key: string]: { lat: number, lng: number } } = {
    'General': { lat: 0.001, lng: 0.001 },
    'FV1': { lat: -0.001, lng: 0.001 },
    'FV2': { lat: 0.001, lng: -0.001 },
    'FH': { lat: -0.001, lng: -0.001 }
  };

  filterMap.forEach((dataArray, filterId) => {
    const entreeData = dataArray.filter(d => d.body.phase === 'Entree');
    const sortieData = dataArray.filter(d => d.body.phase === 'Sortie');

    if (entreeData.length > 0 && sortieData.length > 0) {
      const performance = this.calculatePerformance(filterId, entreeData, sortieData);
      const offset = positionOffsets[filterId] || { lat: 0, lng: 0 };
      performance.latitude = basePosition.lat + offset.lat;
      performance.longitude = basePosition.lng + offset.lng;

      // 👇 ASSIGNER LA STATION CORRECTE
      if (this.stationId) {
        performance.station = this.stationName || this.stationId;
      } else {
        // En mode toutes stations, utiliser la station des données
        const source = entreeData[0]?.body || sortieData[0]?.body || {};
        performance.station = source.id_station || 'Station Inconnue';
      }

      performances.push(performance);
    } else {
      if (entreeData.length > 0 || sortieData.length > 0) {
        const performance = this.createBasicPerformance(filterId, dataArray);
        const offset = positionOffsets[filterId] || { lat: 0, lng: 0 };
        performance.latitude = basePosition.lat + offset.lat;
        performance.longitude = basePosition.lng + offset.lng;

        // 👇 ASSIGNER LA STATION CORRECTE
        if (this.stationId) {
          performance.station = this.stationName || this.stationId;
        } else {
          const source = dataArray[0]?.body || {};
          performance.station = source.id_station || 'Station Inconnue';
        }

        performances.push(performance);
      }
    }
  });

  this.filterPerformances = performances;
  console.log(`📊 ${performances.length} performances de filtres calculées`);
}

  private calculatePerformance(
    filterId: string,
    entreeData: WaterQualityData[],
    sortieData: WaterQualityData[]
  ): FilterPerformance {
    const avgEntree = this.calculateAverageValues(entreeData);
    const avgSortie = this.calculateAverageValues(sortieData);
    const stationId = this.stationId || entreeData[0]?.body.id_station || sortieData[0]?.body.id_station || 'Sanar_Station';
    const stationName = this.stations.get(stationId) || stationId;

    const efficacite_dbo5 = this.calculateEfficiency(avgEntree.dbo5, avgSortie.dbo5);
    const efficacite_dco = this.calculateEfficiency(avgEntree.dco, avgSortie.dco);
    const efficacite_mes = this.calculateEfficiency(avgEntree.mes, avgSortie.mes);
    const efficacite_nitrates = this.calculateEfficiency(avgEntree.nitrates, avgSortie.nitrates);
    const efficacite_coliformes = this.calculateEfficiency(avgEntree.coliformes, avgSortie.coliformes);

    const stabilityPH = this.calculatePHStability(sortieData);
    const tauxValeursManquantes = this.calculateMissingValuesRate([...entreeData, ...sortieData]);

    const scoreDetails = this.calculateKPIScore(
      efficacite_dbo5,
      efficacite_mes,
      efficacite_nitrates,
      efficacite_coliformes,
      stabilityPH,
      tauxValeursManquantes
    );

    const statut = this.determineStatusFromScore(scoreDetails.totalScore);

    const toutesDonnees = [...entreeData, ...sortieData];
    const dernierMesure = toutesDonnees
      .sort((a, b) => new Date(b.body.date).getTime() - new Date(a.body.date).getTime())[0]
      ?.body.date || 'N/A';

   const type_filtre = entreeData[0]?.body.type_filtre || sortieData[0]?.body.type_filtre || this.determineFilterType(filterId);

    return {
      id_filtre: filterId,
      type_filtre: type_filtre,
       station: stationName,

      donnees_entree: entreeData.length,
      donnees_sortie: sortieData.length,
      efficacite_dbo5,
      efficacite_dco,
      efficacite_mes,
      efficacite_nitrates,
      efficacite_coliformes,
      dernier_mesure: dernierMesure,
      statut,
      scorePerformance: scoreDetails.totalScore,
      detailsScore: {
        pointsDBO5: scoreDetails.pointsDBO5,
        pointsMES: scoreDetails.pointsMES,
        pointsNitrates: scoreDetails.pointsNitrates,
        pointsColiformes: scoreDetails.pointsColiformes,
        pointsPH: scoreDetails.pointsPH,
        pointsDonnees: scoreDetails.pointsDonnees,
        stabilityPH: stabilityPH,
        tauxValeursManquantes: tauxValeursManquantes
      },
      latitude: 0,
      longitude: 0
    };
  }

  private calculateKPIScore(
    efficaciteDBO5: number,
    efficaciteMES: number,
    efficaciteNitrates: number,
    efficaciteColiformes: number,
    stabilityPH: number,
    tauxValeursManquantes: number
  ): {
    totalScore: number;
    pointsDBO5: number;
    pointsMES: number;
    pointsNitrates: number;
    pointsColiformes: number;
    pointsPH: number;
    pointsDonnees: number;
  } {
    const pointsDBO5 = Math.min(efficaciteDBO5 * 0.2, 20);
    const pointsMES = Math.min(efficaciteMES * 0.2, 20);
    const pointsNitrates = Math.min(efficaciteNitrates * 0.2, 20);
    const pointsColiformes = Math.min(efficaciteColiformes * 0.2, 20);

    let pointsPH = 0;
    if (stabilityPH < 0.3) pointsPH = 10;
    else if (stabilityPH < 0.6) pointsPH = 7;
    else if (stabilityPH < 1.0) pointsPH = 4;

    let pointsDonnees = 0;
    if (tauxValeursManquantes < 0.1) pointsDonnees = 10;
    else if (tauxValeursManquantes < 0.2) pointsDonnees = 7;
    else if (tauxValeursManquantes < 0.3) pointsDonnees = 4;

    const totalScore = pointsDBO5 + pointsMES + pointsNitrates + pointsColiformes + pointsPH + pointsDonnees;

    return {
      totalScore: Math.round(totalScore),
      pointsDBO5: Math.round(pointsDBO5),
      pointsMES: Math.round(pointsMES),
      pointsNitrates: Math.round(pointsNitrates),
      pointsColiformes: Math.round(pointsColiformes),
      pointsPH: Math.round(pointsPH),
      pointsDonnees: Math.round(pointsDonnees)
    };
  }

  private calculatePHStability(sortieData: WaterQualityData[]): number {
    const pHValues = sortieData
      .map(d => d.body.ph)
      .filter(ph => ph !== null && !isNaN(ph)) as number[];

    if (pHValues.length < 2) return 1.0;

    const mean = pHValues.reduce((a, b) => a + b) / pHValues.length;
    const squareDiffs = pHValues.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b) / pHValues.length;
    return Math.sqrt(variance);
  }

  private calculateMissingValuesRate(data: WaterQualityData[]): number {
    if (data.length === 0) return 1.0;

    const totalMesures = data.length * 5;
    let mesuresManquantes = 0;

    data.forEach(d => {
      if (d.body.dbo5_mg_l === null || isNaN(d.body.dbo5_mg_l)) mesuresManquantes++;
      if (d.body.mes_mg_l === null || isNaN(d.body.mes_mg_l)) mesuresManquantes++;
      if (d.body.nitrates_mg_l === null || isNaN(d.body.nitrates_mg_l)) mesuresManquantes++;
      if (d.body.coliformes_fecaux_cfu_100ml === null || isNaN(d.body.coliformes_fecaux_cfu_100ml)) mesuresManquantes++;
      if (d.body.ph === null || isNaN(d.body.ph)) mesuresManquantes++;
    });

    return mesuresManquantes / totalMesures;
  }
getCycleVie(filtreId: string): CycleVieFiltre | null {
  return this.cyclesVie.get(filtreId) || null;
}
  private determineFilterType(filterId: string): string {
    const typeMap: { [key: string]: string } = {
      'General': 'Filtre général',
      'FV1': 'Filtre vertical',
      'FV2': 'Filtre vertical',
      'FH': 'Filtre horizontal'
    };
    return typeMap[filterId] || 'Type inconnu';
  }

  private createBasicPerformance(filterId: string, dataArray: WaterQualityData[]): FilterPerformance {
    const efficacite_estimee = 50;
    const stabilityPH = 0.8;
    const tauxValeursManquantes = 0.4;

    const scoreDetails = this.calculateKPIScore(
      efficacite_estimee,
      efficacite_estimee,
      efficacite_estimee,
      efficacite_estimee,
      stabilityPH,
      tauxValeursManquantes
    );

    const type_filtre = dataArray[0]?.body.type_filtre || this.determineFilterType(filterId);

    return {
      id_filtre: filterId,
      type_filtre: type_filtre,
      station: dataArray[0]?.body.id_station || 'Sanar_Station',
      donnees_entree: dataArray.filter(d => d.body.phase === 'Entree').length,
      donnees_sortie: dataArray.filter(d => d.body.phase === 'Sortie').length,
      efficacite_dbo5: efficacite_estimee,
      efficacite_dco: efficacite_estimee,
      efficacite_mes: efficacite_estimee,
      efficacite_nitrates: efficacite_estimee,
      efficacite_coliformes: efficacite_estimee,
      dernier_mesure: dataArray[0]?.body.date || 'N/A',
      statut: this.determineStatusFromScore(scoreDetails.totalScore),
      scorePerformance: scoreDetails.totalScore,
      detailsScore: {
        pointsDBO5: scoreDetails.pointsDBO5,
        pointsMES: scoreDetails.pointsMES,
        pointsNitrates: scoreDetails.pointsNitrates,
        pointsColiformes: scoreDetails.pointsColiformes,
        pointsPH: scoreDetails.pointsPH,
        pointsDonnees: scoreDetails.pointsDonnees,
        stabilityPH: stabilityPH,
        tauxValeursManquantes: tauxValeursManquantes
      },
      latitude: 0,
      longitude: 0
    };
  }

  private calculateAverageValues(data: WaterQualityData[]): {
    dbo5: number;
    dco: number;
    mes: number;
    nitrates: number;
    coliformes: number;
  } {
    const validData = data.filter(d =>
      d.body.dbo5_mg_l !== null && !isNaN(d.body.dbo5_mg_l)
    );

    const avg = (field: keyof WaterQualityData['body']): number => {
      const values = validData
        .map(d => d.body[field] as number)
        .filter(v => v !== null && !isNaN(v));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };

    return {
      dbo5: avg('dbo5_mg_l'),
      dco: avg('dco_mg_l'),
      mes: avg('mes_mg_l'),
      nitrates: avg('nitrates_mg_l'),
      coliformes: avg('coliformes_fecaux_cfu_100ml')
    };
  }

  private calculateEfficiency(entree: number, sortie: number): number {
    if (entree <= 0) return 0;
    const efficacite = ((entree - sortie) / entree) * 100;
    return Math.max(0, Math.min(100, efficacite));
  }

  private determineStatusFromScore(score: number): 'Optimal' | 'Bon' | 'Moyen' | 'Critique' {
    if (score >= 80) return 'Optimal';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    return 'Critique';
  }

  analyzeFilterChain() {
    const general = this.filterPerformances.find(f => f.id_filtre === 'General');
    const vertical = this.filterPerformances.find(f => f.id_filtre === 'FV1' || f.id_filtre === 'FV2');
    const horizontal = this.filterPerformances.find(f => f.id_filtre === 'FH');

    this.filterChain.general = general || null;
    this.filterChain.vertical = vertical || null;
    this.filterChain.horizontal = horizontal || null;

    if (this.filterChain.general && this.filterChain.vertical) {
      this.filterChain.chainSteps.generalToVertical = this.calculateChainEfficiency(this.filterChain.general, this.filterChain.vertical);
    }

    if (this.filterChain.vertical && this.filterChain.horizontal) {
      this.filterChain.chainSteps.verticalToHorizontal = this.calculateChainEfficiency(this.filterChain.vertical, this.filterChain.horizontal);
    }

    if (this.filterChain.general && this.filterChain.horizontal) {
      this.filterChain.chainSteps.generalToHorizontal = this.calculateChainEfficiency(this.filterChain.general, this.filterChain.horizontal);
    }

    this.filterChain.overallEfficiency = this.filterChain.chainSteps.generalToHorizontal || 0;
  }

  private calculateChainEfficiency(filtreAvant: FilterPerformance, filtreApres: FilterPerformance): number {
    return Math.max(filtreAvant.efficacite_dbo5, filtreApres.efficacite_dbo5);
  }

  createCharts() {
    if (this.filterPerformances.length === 0) {
      console.warn('⚠️ Aucune donnée pour créer les graphiques');
      return;
    }

    try {
      this.createPerformanceChart();
      this.createRemovalChart();
      this.createTimelineChart();
      this.createKPIChart();
      console.log('✅ Graphiques créés avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la création des graphiques:', error);
    }
  }

  createKPIChart() {
    const ctx = document.getElementById('kpiChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.kpiChart) {
      this.kpiChart.destroy();
    }

    const categories = ['DBO5', 'MES', 'Nitrates', 'Coliformes', 'pH Stable', 'Données'];
    const datasets = this.filterPerformances.map(filter => {
      return {
        label: filter.id_filtre,
        data: [
          filter.detailsScore.pointsDBO5,
          filter.detailsScore.pointsMES,
          filter.detailsScore.pointsNitrates,
          filter.detailsScore.pointsColiformes,
          filter.detailsScore.pointsPH,
          filter.detailsScore.pointsDonnees
        ],
        backgroundColor: this.getColorForFilter(filter.id_filtre) + '80',
        borderColor: this.getColorForFilter(filter.id_filtre),
        borderWidth: 2,
        pointBackgroundColor: this.getColorForFilter(filter.id_filtre),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: this.getColorForFilter(filter.id_filtre)
      };
    });

    this.kpiChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: categories,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Score de Performance KPI par Filtre'
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.raw}/20 points`;
              }
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 20,
            ticks: {
              stepSize: 5
            }
          }
        }
      }
    });
  }

  createPerformanceChart() {
    const ctx = document.getElementById('performanceChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.performanceChart) {
      this.performanceChart.destroy();
    }

    const datasets: ChartDataset[] = [
      {
        label: 'Efficacité DBO5 (%)',
        data: this.filterPerformances.map(f => f.efficacite_dbo5),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Efficacité Coliformes (%)',
        data: this.filterPerformances.map(f => f.efficacite_coliformes),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ];

    this.performanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.filterPerformances.map(f => f.id_filtre),
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Performance des Filtres par Paramètre'
          },
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Efficacité (%)'
            }
          }
        }
      }
    });
  }

  createRemovalChart() {
    const ctx = document.getElementById('removalChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.removalChart) {
      this.removalChart.destroy();
    }

    const datasets: ChartDataset[] = [];
    const parameters = ['dbo5', 'dco', 'mes', 'nitrates', 'coliformes'];

    parameters.forEach(param => {
      const data = this.filterPerformances.map(f => {
        const key = `efficacite_${param}` as keyof FilterPerformance;
        const value = f[key];
        return typeof value === 'number' ? value : 0;
      });

      datasets.push({
        label: `Efficacité ${param.toUpperCase()}`,
        data: data,
        backgroundColor: this.getColorForParameter(param),
        borderColor: this.getColorForParameter(param),
        borderWidth: 1
      });
    });

    this.removalChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: this.filterPerformances.map(f => f.id_filtre),
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Profil d\'Efficacité des Filtres'
          },
          legend: {
            position: 'top',
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20
            }
          }
        }
      }
    });
  }

  createTimelineChart() {
    const ctx = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    const dates = [...new Set(this.waterQualityData
      .map(d => d.body.date)
      .filter(d => d !== null && d !== undefined)
    )].sort();

    const filters = [...new Set(this.waterQualityData.map(d => d.body.id_filtre))];

    const datasets: ChartDataset[] = filters.map(filterId => {
      const data = dates.map(date => {
        const filterData = this.waterQualityData.filter(d =>
          d.body.id_filtre === filterId &&
          d.body.date === date &&
          d.body.dbo5_mg_l !== null
        );
        return filterData.length > 0 ?
          filterData.reduce((sum, d) => sum + (d.body.dbo5_mg_l || 0), 0) / filterData.length : 0;
      });

      return {
        label: `Filtre ${filterId}`,
        data: data,
        borderColor: this.getColorForFilter(filterId),
        backgroundColor: this.getColorForFilter(filterId) + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.4
      };
    });

    this.timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Évolution de la DBO5 dans le Temps'
          },
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'DBO5 (mg/L)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }

  private getColorForParameter(param: string): string {
    const colors: { [key: string]: string } = {
      dbo5: 'rgba(54, 162, 235, 0.8)',
      dco: 'rgba(255, 99, 132, 0.8)',
      mes: 'rgba(255, 206, 86, 0.8)',
      nitrates: 'rgba(75, 192, 192, 0.8)',
      coliformes: 'rgba(153, 102, 255, 0.8)'
    };
    return colors[param] || 'rgba(201, 203, 207, 0.8)';
  }

  private getColorForFilter(filterId: string): string {
    const colors: { [key: string]: string } = {
      'General': 'rgba(255, 99, 132, 1)',
      'FV1': 'rgba(54, 162, 235, 1)',
      'FV2': 'rgba(255, 206, 86, 1)',
      'FH': 'rgba(75, 192, 192, 1)'
    };
    return colors[filterId] || 'rgba(201, 203, 207, 1)';
  }

  private initializeMap() {
    const mapContainer = document.getElementById('filterMap');
    if (!mapContainer) {
      console.error('❌ Conteneur de carte non trouvé');
      return;
    }

    if (this.map) {
      this.map.remove();
      this.markers = [];
    }

    this.map = L.map('filterMap').setView([14.7167, -17.4677], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.addFilterMarkers();
  }

  private addFilterMarkers() {
    if (!this.map) return;

    this.filterPerformances.forEach(filter => {
      const markerColor = this.getStatusColor(filter.statut);

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background-color: ${markerColor};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          ">${filter.id_filtre.charAt(filter.id_filtre.length - 1)}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([filter.latitude, filter.longitude], { icon: customIcon })
        .addTo(this.map!)
        .bindPopup(this.createPopupContent(filter));

      marker.on('click', () => {
        this.selectFilter(filter);
      });

      this.markers.push(marker);
    });

    if (this.markers.length > 0) {
      const group = new L.FeatureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private createPopupContent(filter: FilterPerformance): string {
    return `
      <div class="map-popup">
        <h4>Filtre ${filter.id_filtre}</h4>
        <div class="popup-content">
          <div class="popup-row">
            <span class="label">Type:</span>
            <span class="value">${filter.type_filtre}</span>
          </div>
          <div class="popup-row">
            <span class="label">Score:</span>
            <span class="value" style="color: ${this.getScoreColor(filter.scorePerformance)}; font-weight: bold;">
              ${filter.scorePerformance}/100
            </span>
          </div>
          <div class="popup-row">
            <span class="label">Statut:</span>
            <span class="value" style="color: ${this.getStatusColor(filter.statut)}; font-weight: bold;">
              ${filter.statut}
            </span>
          </div>
          <div class="popup-efficiencies">
            <div class="eff-item">DBO5: ${this.formatNumber(filter.efficacite_dbo5)}%</div>
            <div class="eff-item">MES: ${this.formatNumber(filter.efficacite_mes)}%</div>
            <div class="eff-item">Colif.: ${this.formatNumber(filter.efficacite_coliformes)}%</div>
          </div>
          <button onclick="angular.component(this).selectFilterFromMap('${filter.id_filtre}')"
                  class="popup-btn">
            📋 Voir détails
          </button>
        </div>
      </div>
    `;
  }

  selectFilterFromMap(filterId: string) {
    const filter = this.filterPerformances.find(f => f.id_filtre === filterId);
    if (filter) {
      this.selectFilter(filter);
      this.activeView = 'list';
    }
  }

  switchView(view: 'list' | 'map') {
    this.activeView = view;

    if (view === 'map' && !this.map) {
      setTimeout(() => this.initializeMap(), 50);
    }
  }

 selectFilter(filter: FilterPerformance) {
  this.selectedFilter = filter;

  // ✅ Charger les interventions du filtre sélectionné
  this.selectedFilterInterventions = this.getInterventionsForFilter(filter.id_filtre);
  console.log(`📋 ${this.selectedFilterInterventions.length} interventions pour ${filter.id_filtre}`);

  // ✅ Bloquer le scroll du body quand le modal est ouvert
  document.body.style.overflow = 'hidden';

  // Centrer la carte sur le filtre sélectionné si on est en vue carte
  if (this.activeView === 'map' && this.map) {
    const marker = this.markers.find(m => {
      const popup = m.getPopup();
      if (!popup) return false;

      const content = popup.getContent();
      if (typeof content === 'string') {
        return content.includes(filter.id_filtre);
      } else if (content instanceof HTMLElement) {
        return content.innerHTML.includes(filter.id_filtre);
      }

      return false;
    });

    if (marker) {
      this.map.setView(marker.getLatLng(), 16);
      marker.openPopup();
    }
  }
}

get filteredPerformances(): FilterPerformance[] {
  return this.filterPerformances.filter(filter => {
    const matchSearch = this.searchTerm === '' ||
      filter.id_filtre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      filter.type_filtre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      filter.station.toLowerCase().includes(this.searchTerm.toLowerCase());

    const matchStation = this.selectedStation === 'all' ||
      filter.station === this.selectedStation;

    const matchType = this.selectedType === 'all' ||
      filter.type_filtre === this.selectedType;

    // 👇 FILTRE PAR ID DE FILTRE (utilise selectedFilterId au lieu de selectedFilter)
    const matchFilterId = this.selectedFilterId === 'all' ||
      filter.id_filtre === this.selectedFilterId;

    return matchSearch && matchStation && matchType && matchFilterId;
  });
}
get uniqueFilters(): string[] {
  return [...new Set(
    this.filterPerformances.map(f => f.id_filtre)
  )].sort();
}
get uniqueFilterIds(): string[] {
  if (!this.filterPerformances || this.filterPerformances.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(this.filterPerformances.map(f => f.id_filtre))];
  console.log('🔍 Filtres disponibles:', uniqueIds);
  return uniqueIds.sort();
}


get uniqueTypes(): string[] {
  // Mapper les id_filtre vers des types lisibles
  const typeMap: { [key: string]: string } = {
    'General': 'Filtre général',
    'FV1': 'Filtre vertical 1',
    'FV2': 'Filtre vertical 2',
    'FH': 'Filtre horizontal'
  };

  return [...new Set(
    this.filterPerformances.map(f => typeMap[f.id_filtre] || f.type_filtre)
  )].filter(type => type && type !== 'Non applicable' && type !== 'Type inconnu')
    .sort();
}


  get uniqueStations(): string[] {
    return [...new Set(this.filterPerformances.map(f => f.station))];
  }

  getStatusColor(statut: string): string {
    const colors: { [key: string]: string } = {
      'Optimal': '#10b981',
      'Bon': '#f59e0b',
      'Moyen': '#f97316',
      'Critique': '#ef4444'
    };
    return colors[statut] || '#6b7280';
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  formatNumber(value: number): string {
    return value !== undefined && value !== null ? value.toFixed(1) : 'N/A';
  }

  refreshData() {
    this.loadData();
  }
  // ================================
  // MÉTHODES POUR LES INTERVENTIONS
  // ================================

  /**
   * Récupérer les interventions pour un filtre spécifique
   */
  getInterventionsForFilter(filterId: string): MaintenanceIntervention[] {
    return this.maintenanceInterventions
      .filter(intervention => intervention.id_filtre === filterId)
      .sort((a, b) =>
        new Date(b.date_intervention).getTime() - new Date(a.date_intervention).getTime()
      );
  }

  /**
   * Obtenir l'icône selon le type d'intervention
   */
  getInterventionIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Changement de substrat': '🪨',
      'Nettoyage': '🧹',
      'Problème capteur': '⚠️',
      'Action corrective': '🔧',
      'Ajout de plantes': '🌱',
      'Débit ajusté': '💧',
      'Maintenance préventive': '🛠️',
      'Réparation': '🔨',
      'Inspection': '🔍'
    };
    return icons[type] || '📋';
  }

  /**
   * Analyser l'impact des interventions sur les performances
   */
  analyzeInterventionImpact(filterId: string): {
    derniere_intervention: string;
    jours_depuis_intervention: number;
    tendance_performance: 'Amélioration' | 'Stable' | 'Dégradation';
  } | null {
    const interventions = this.getInterventionsForFilter(filterId);
    if (interventions.length === 0) return null;

    const lastIntervention = interventions[0];
    const daysSince = Math.floor(
      (new Date().getTime() - new Date(lastIntervention.date_intervention).getTime())
      / (1000 * 60 * 60 * 24)
    );

    // Déterminer la tendance basée sur le score de performance
    let tendance: 'Amélioration' | 'Stable' | 'Dégradation' = 'Stable';

    const filter = this.filterPerformances.find(f => f.id_filtre === filterId);
    if (filter) {
      if (filter.scorePerformance >= 80) tendance = 'Amélioration';
      else if (filter.scorePerformance < 60) tendance = 'Dégradation';
    }

    return {
      derniere_intervention: lastIntervention.type_intervention,
      jours_depuis_intervention: daysSince,
      tendance_performance: tendance
    };
  }

  /**
   * Formater une date pour l'affichage
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtenir la couleur pour la tendance de performance
   */
  getTendanceColor(tendance: 'Amélioration' | 'Stable' | 'Dégradation'): string {
    const colors = {
      'Amélioration': '#10b981',
      'Stable': '#f59e0b',
      'Dégradation': '#ef4444'
    };
    return colors[tendance];
  }


  ngOnDestroy() {
    this.performanceChart?.destroy();
    this.removalChart?.destroy();
    this.timelineChart?.destroy();
    this.kpiChart?.destroy();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.markers = [];
    document.body.style.overflow = '';
  }
getFilterLabel(filterId: string): string {
  const labels: { [key: string]: string } = {
    'General': '🌊 Filtre général',
    'FV1': '⬇️ Filtre vertical 1',
    'FV2': '⬇️ Filtre vertical 2',
    'FH': '↔️ Filtre horizontal'
  };
  return labels[filterId] || filterId;
}

}
