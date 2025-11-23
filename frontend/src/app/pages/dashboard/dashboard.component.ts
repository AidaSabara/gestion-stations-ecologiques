import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { MapComponent } from './map/map.component';
import { CommonModule } from '@angular/common';
import { ResumeComponent } from './resume/resume.component';
import { RouterLink } from '@angular/router';
import { KpisComponent } from './kpis/kpis.component';
import { TemperatureChartComponent } from "./temperature-chart/temperature-chart.component";
import { Chart, registerables } from 'chart.js';
import { KuzzleService } from '../../kuzzle.service';

// Angular Material
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ViewChild } from '@angular/core';

Chart.register(...registerables);

interface WaterQualityData {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre: string;
    id_filtre: string;
    ph: number;
    potentiel_redox_mv: number;
    dbo5_mg_l: number;
    dco_mg_l: number;
    mes_mg_l: number;
    nitrates_mg_l: number;
    ammonium_mg_l: number;
    azote_total_mg_l: number;
    phosphates_mg_l: number;
    coliformes_fecaux_cfu_100ml: number;
    nom_feuille: string;
    contient_valeurs_estimees: boolean;
  };
}

// Interface pour les données de lecture
interface ReadingData {
  _id?: string;
  body: {
    stationId?: string;
    timestamp?: string;
    temperature: number;
    humidity: number;
    createdAt?: string;
    [key: string]: any;
  };
}

interface Alert {
  station: string;
  message: string;
  time: string;
  severity?: 'low' | 'medium' | 'high' | 'critical'| 'warning'| 'info';
  count?: number;
  type?: string;
  details?: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    MapComponent,
    CommonModule,
    ResumeComponent,
    RouterLink,
    KpisComponent,
    TemperatureChartComponent,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy{
  autoRefreshInterval: any;
  refreshRate = 30000;
  alerts: Alert[] = [];
  private alertsSubscription: any;
  currentTimeRange = '24h';
  paginatedData: any;
  currentPage = 1;
  pageSize = 10;
  stations: any[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Données Kuzzle
  waterData: WaterQualityData[] = [];
  allWaterData: WaterQualityData[] = [];
  readingData: ReadingData[] = [];
  dataSource = new MatTableDataSource<WaterQualityData>();

  displayedColumns: string[] = [
    'id_filtre',
    'phase',
    'ph',
    'dbo5_mg_l',
    'dco_mg_l',
    'mes_mg_l',
    'nitrates_mg_l',
    'ammonium_mg_l',
    'azote_total_mg_l',
    'phosphates_mg_l',
    'coliformes_fecaux_cfu_100ml'
  ];

  // Loading state
  isLoading = true;
  errorMessage = '';

  // Variables pour les filtres
  selectedPhase = 'all';
  selectedFilter = 'all';

  // Stats et événements
  stats = [
    { label: 'Stations actives', value: '12', icon: 'bi-map', detail: 'Données collectées en temps réel' },
    { label: 'Température moyenne', value: '28.7 °C', icon: 'bi-thermometer-half', detail: 'Calculée sur 24h' },
    { label: 'Humidité moyenne', value: '61%', icon: 'bi-droplet', detail: 'Sur l\'ensemble du pays' },
    { label: 'Alertes', value: '3', icon: 'bi-exclamation-triangle', detail: 'Zones critiques' }
  ];

  events = [
    { time: 'il y a 15 minutes', title: 'Station #3 dépasse 35°C', detail: 'Température anormale détectée' },
    { time: 'il y a 1 heure', title: 'Nouvelle station ajoutée', detail: 'Station : Ziguinchor' },
    { time: 'hier', title: 'Humidité basse détectée', detail: 'Station : Matam' }
  ];

  // Instances des graphiques
  private phChartInstance: Chart | null = null;
  private tempChartInstance: Chart | null = null;
  private humidityChartInstance: Chart | null = null;

  constructor(private kuzzleService: KuzzleService) {}

  async ngOnInit() {
    console.log('🔄 Initialisation du Dashboard...');
    await this.loadData();

    // Surveillance temps réel
    this.setupRealTimeMonitoring();

    // Actualisation automatique
    this.autoRefreshInterval = setInterval(async () => {
      console.log('🔄 Actualisation automatique des données...');
      await this.loadData();
    }, this.refreshRate);
  }

  // Méthode pour la surveillance temps réel
  private setupRealTimeMonitoring() {
    this.kuzzleService.subscribeToAlerts((alert) => {
      console.log('🚨 NOUVELLE ALERTE TEMPS RÉEL:', alert);

      const source = alert._source || alert.body || {};
      this.alerts.unshift({
        station: source.stationId || 'Station inconnue',
        message: source.message || 'Alerte sans message',
        time: new Date().toLocaleTimeString('fr-FR'),
        severity: source.level || 'warning',
        type: source.type
      });

      // Limiter à 10 alertes maximum
      if (this.alerts.length > 10) {
        this.alerts = this.alerts.slice(0, 20);
      }

      this.showAlertNotification(alert);
    });
  }

  private showAlertNotification(alert: any) {
    const source = alert._source || alert.body || {};
    if (source.level === 'critical') {
      console.error('🔴 ALERTE CRITIQUE:', source.message);
    } else {
      console.warn('🟡 Alerte:', source.message);
    }
  }

  // Changer de période
  async onTimeRangeChange(range: string) {
    this.currentTimeRange = range;
    await this.loadData();
  }

  // Pagination
  async onPageChange(event: any) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    await this.loadPaginatedData();
  }

  // Chargement paginé
  private async loadPaginatedData() {
    try {
      this.paginatedData = await this.kuzzleService.getPaginatedWaterData(
        this.currentPage,
        this.pageSize
      );
      this.dataSource.data = this.paginatedData.data;
    } catch (error) {
      console.error('❌ Erreur pagination:', error);
    }
  }

  // Résoudre une alerte
  async resolveAlert(alert: any) {
    try {
      this.alerts = this.alerts.filter(a => a !== alert);
      console.log('✅ Alerte résolue:', alert);
    } catch (error) {
      console.error('❌ Erreur résolution alerte:', error);
    }
  }

  // Nettoyage
  ngOnDestroy() {
    if (this.alertsSubscription) {
      this.alertsSubscription.unsubscribe();
    }

    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }

  // MÉTHODE CENTRALE CORRIGÉE
  private async loadData() {
    try {
      this.isLoading = true;
      this.errorMessage = '';

      console.log('🔄 Début chargement des données...');

      // 1. Charger les stations
      await this.loadStations();

      // 2. Charger TOUTES les données de qualité d'eau
      console.log('💧 Chargement données water_quality...');
      this.allWaterData = await this.kuzzleService.getWaterQualityData();

      // CORRECTION : Formater les données water_quality
      this.allWaterData = this.allWaterData.map((hit: any) => {
        const source = hit._source || hit.body || {};
        return {
          _id: hit._id,
          body: {
            id_station: source.id_station,
            phase: source.phase,
            type_filtre: source.type_filtre,
            id_filtre: source.id_filtre,
            ph: source.ph,
            potentiel_redox_mv: source.potentiel_redox_mv,
            dbo5_mg_l: source.dbo5_mg_l,
            dco_mg_l: source.dco_mg_l,
            mes_mg_l: source.mes_mg_l,
            nitrates_mg_l: source.nitrates_mg_l,
            ammonium_mg_l: source.ammonium_mg_l,
            azote_total_mg_l: source.azote_total_mg_l,
            phosphates_mg_l: source.phosphates_mg_l,
            coliformes_fecaux_cfu_100ml: source.coliformes_fecaux_cfu_100ml,
            nom_feuille: source.nom_feuille,
            contient_valeurs_estimees: source.contient_valeurs_estimees
          }
        };
      });

      this.waterData = [...this.allWaterData];
      this.dataSource.data = this.waterData;
      console.log(`💧 Données water_quality chargées: ${this.waterData.length}`);

      // 3. Données température/humidité
      console.log('🌡️ Chargement données readings...');
      this.readingData = await this.kuzzleService.getReadingData();
      console.log(`🌡️ Données readings chargées: ${this.readingData.length}`);

      // 4. Mise à jour des stats et graphiques
      this.updateStatsFromData();
      this.updateTemperatureAndHumidityStats();

      // 5. Initialiser les graphiques
      setTimeout(() => {
        this.initializeCharts();
      }, 500);

      // 6. Détection des alertes
      this.detectAlerts();

      // 7. Chargement des alertes actives
      console.log('🚨 Chargement alertes actives...');
      const activeAlerts = await this.kuzzleService.getActiveAlerts();
      if (activeAlerts.length > 0) {
        this.alerts = activeAlerts.map(alert => {
          const source = alert._source || alert.body || {};
          return {
            station: source.stationId || 'Station inconnue',
            message: source.message || 'Pas de message',
            time: new Date(source.timestamp || Date.now()).toLocaleTimeString('fr-FR'),
            severity: source.level || 'info',
            type: source.type || 'unknown'
          };
        });
      }
      console.log(`🚨 Alertes chargées: ${this.alerts.length}`);

      // 8. Chargement paginé
      await this.loadPaginatedData();

      console.log('✅ Chargement terminé avec succès');

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      this.errorMessage = `Erreur lors du chargement des données: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadStations() {
    try {
      this.stations = await this.kuzzleService.getStations();
      console.log('🏭 Stations chargées depuis Kuzzle:', this.stations.length);

      // Formater les stations
      this.stations = this.stations.map(station => {
        const source = station._source || station.body || {};
        return {
          _id: station._id,
          body: {
            name: source.name,
            location: source.location,
            status: source.status,
            type: source.type,
            installedAt: source.installedAt
          }
        };
      });

    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
      this.stations = [];
    }
  }


  private detectAlerts() {
    this.alerts = [];

    // 1. Détection sur les données water_quality
    if (this.waterData && this.waterData.length > 0) {
      this.waterData.forEach(d => {
        if (!d || !d.body) return;

        const ph = d.body.ph;
        if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 9.5)) { // OMS: 6.5-9.5
                this.alerts.push({
                  station: d.body.id_station || 'Station inconnue',
                  message: `pH anormal : ${ph} (hors norme OMS 6.5-9.5)`,
                  time: new Date().toLocaleTimeString('fr-FR'),
                  severity: 'medium', // Pas critique sauf extrêmes
                        // type: 'water_quality'
          });
        }

        const coliformes = d.body.coliformes_fecaux_cfu_100ml;
        if (coliformes !== null && coliformes !== undefined)
        {
          if (coliformes > 0)
            { // UE: 0 CFU/100ml pour eau potable
            this.alerts.push({
              station: d.body.id_station || 'Station inconnue',
              message: `Coliformes détectés : ${coliformes} CFU/100ml (norme: 0)`,
              time: new Date().toLocaleTimeString('fr-FR'),
              severity: coliformes > 10 ? 'high' : 'medium',
            });
          }
        }


        const dbo5 = d.body.dbo5_mg_l;
            if (dbo5 !== null && dbo5 !== undefined)

            {
              if (dbo5 > 5)
                 { // UE: ≤ 5 mg/L pour eaux de surface
                this.alerts.push
                  ({
                      station: d.body.id_station || 'Station inconnue',
                      message: `DBO5 élevée : ${dbo5} mg/L (norme UE: ≤ 5 mg/L)`,
                      time: new Date().toLocaleTimeString('fr-FR'),
                      severity: dbo5 > 20 ? 'high' : 'medium',
                    });
              }
            }


        const nitrates = d.body.nitrates_mg_l;
                if (nitrates !== null && nitrates !== undefined) {
                  if (nitrates > 50) { // OMS/UE: 50 mg/L max eau potable
                    this.alerts.push({
                      station: d.body.id_station || 'Station inconnue',
                      message: `Nitrates élevés : ${nitrates} mg/L (seuil OMS: 50 mg/L)`,
                      time: new Date().toLocaleTimeString('fr-FR'),
                      severity: 'high',
                    });
                  } else if (nitrates > 25) { // Alerte préventive
                    this.alerts.push({
                      station: d.body.id_station || 'Station inconnue',
                      message: `Nitrates modérés : ${nitrates} mg/L (seuil alerte: 25 mg/L)`,
                      time: new Date().toLocaleTimeString('fr-FR'),
                      severity: 'medium',
                    });
                  }
                }
      });
    }

    // 2. Détection sur les données de capteurs
    if (this.readingData && this.readingData.length > 0) {
      this.readingData.forEach(r => {
        if (!r || !r.body) return;

              const temp = r.body.temperature;
              if (temp !== null && temp !== undefined) {
                if (temp > 30) { // UE: ≤ 25°C pour rejets, ≤ 30°C pour milieu naturel
                  this.alerts.push({
                    station: r.body.stationId || 'Inconnue',
                    message: `Température élevée : ${temp}°C (seuil: 30°C)`,
                    time: new Date().toLocaleTimeString('fr-FR'),
                    severity: temp > 35 ? 'high' : 'medium',
                  });
                } else if (temp < 5) { // Impact écologique en dessous de 5°C
                  this.alerts.push({
                    station: r.body.stationId || 'Inconnue',
                    message: `Température basse : ${temp}°C (risque écologique)`,
                    time: new Date().toLocaleTimeString('fr-FR'),
                    severity: 'medium',
                  });
                }
              }

        const humidity = r.body.humidity;
        if (humidity !== null && humidity !== undefined && (humidity < 30 || humidity > 90)) {
          this.alerts.push({
            station: r.body.stationId || 'Inconnue',
            message: `Humidité anormale : ${humidity}% (hors norme 30-90%)`,
            time: new Date().toLocaleTimeString('fr-FR'),
            severity: 'warning',
            //type: 'sensor'
          });
        }
      });
    }

    console.log('🚨 Alertes détectées:', this.alerts.length);
  }

  ngAfterViewInit(): void {
    // Configuration du tableau Material
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }

    if (this.sort) {
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (item, property) => {
        if (!item || !item.body) return '';
        const value = item.body[property as keyof typeof item.body];
        if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        }
        if (value === null || value === undefined) {
          return '';
        }
        return value as string | number;
      };
    }

    this.dataSource.filterPredicate = (data: WaterQualityData, filter: string) => {
      if (!data || !data.body) return false;
      const searchStr = `
        ${data.body.id_filtre || ''}
        ${data.body.phase || ''}
        ${data.body.ph || ''}
        ${data.body.id_station || ''}
        ${data.body.type_filtre || ''}
      `.toLowerCase();
      return searchStr.indexOf(filter) !== -1;
    };

    // Initialisation des graphiques après un délai
    setTimeout(() => {
      this.initializeCharts();
    }, 1000);
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    console.log('🔍 Filtrage par texte:', filterValue);
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  filterByPhase(phase: string) {
    console.log('📊 Filtrage par phase:', phase);
    this.selectedPhase = phase;
    this.applyFilters();
    setTimeout(() => this.createWaterQualityChart(), 100);
  }

  filterByFilter(filterId: string) {
    console.log('🔧 Filtrage par filtre:', filterId);
    this.selectedFilter = filterId;
    this.applyFilters();
    setTimeout(() => this.createWaterQualityChart(), 100);
  }

  private applyFilters() {
    let filteredData = [...this.allWaterData];

    if (this.selectedPhase !== 'all') {
      filteredData = filteredData.filter(d => d && d.body && d.body.phase === this.selectedPhase);
    }

    if (this.selectedFilter !== 'all') {
      filteredData = filteredData.filter(d => d && d.body && d.body.id_filtre === this.selectedFilter);
    }

    this.waterData = filteredData;
    this.dataSource.data = this.waterData;
    console.log('🔍 Données filtrées:', this.waterData.length, 'éléments');
  }

  // CORRECTION : updateStatsFromData avec vérifications
  private updateStatsFromData() {
    if (!this.allWaterData || this.allWaterData.length === 0) {
      console.log('⚠️ Aucune donnée water_quality pour les stats');
      return;
    }

    const validData = this.allWaterData.filter(d => d && d.body);
    const totalSamples = validData.length;

    const uniqueFilters = new Set(validData.map(d => d.body.id_filtre)).size;

    const validPHValues = validData
      .map(d => d.body.ph)
      .filter(ph => ph !== null && ph !== undefined && !isNaN(ph));

    const avgPH = validPHValues.length > 0
      ? validPHValues.reduce((sum, ph) => sum + ph, 0) / validPHValues.length
      : 0;

    const abnormalPH = validPHValues.filter(ph => ph < 6.5 || ph > 8.5).length;

    this.stats[0] = {
      label: 'Échantillons analysés',
      value: totalSamples.toString(),
      icon: 'bi-droplet-fill',
      detail: 'Données de qualité d\'eau'
    };

    this.stats[3] = {
      label: 'Valeurs anormales',
      value: abnormalPH.toString(),
      icon: 'bi-exclamation-triangle',
      detail: 'pH hors norme'
    };

    console.log('📊 Stats qualité d\'eau mises à jour');
  }

  // CORRECTION : updateTemperatureAndHumidityStats avec vérifications
  private updateTemperatureAndHumidityStats() {
    if (!this.readingData || this.readingData.length === 0) {
      console.log('⚠️ Aucune donnée de température/humidité disponible');
      return;
    }

    const validReadings = this.readingData.filter(r => r && r.body);

    const validTemps = validReadings
      .map(d => d.body.temperature)
      .filter(temp => temp != null && !isNaN(temp) && temp > -50 && temp < 70);

    const validHumidities = validReadings
      .map(d => d.body.humidity)
      .filter(hum => hum != null && !isNaN(hum) && hum >= 0 && hum <= 100);

    console.log('🌡️ Températures valides:', validTemps.length, 'sur', validReadings.length);
    console.log('💧 Humidités valides:', validHumidities.length, 'sur', validReadings.length);

    const avgTemp = validTemps.length > 0
      ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1)
      : 'N/A';

    const avgHum = validHumidities.length > 0
      ? (validHumidities.reduce((a, b) => a + b, 0) / validHumidities.length).toFixed(1)
      : 'N/A';

    this.stats[1] = {
      label: 'Température moyenne',
      value: avgTemp !== 'N/A' ? `${avgTemp} °C` : 'N/A',
      icon: 'bi-thermometer-half',
      detail: `Basé sur ${validTemps.length} mesures`
    };

    this.stats[2] = {
      label: 'Humidité moyenne',
      value: avgHum !== 'N/A' ? `${avgHum}%` : 'N/A',
      icon: 'bi-droplet',
      detail: `Basé sur ${validHumidities.length} mesures`
    };

    console.log('🌡️ Stats température/humidité mises à jour:', { avgTemp, avgHum });
  }

  // CORRECTION : getWaterQualityStats avec vérifications
  getWaterQualityStats() {
    if (!this.allWaterData || this.allWaterData.length === 0) return null;

    const validData = this.allWaterData.filter(d => d && d.body);

    const stats = {
      totalSamples: validData.length,
      uniqueFilters: new Set(validData.map(d => d.body.id_filtre)).size,
      avgPH: this.calculateAverage('ph'),
      abnormalPH: validData.filter(d =>
        d.body.ph !== null && (d.body.ph < 6.5 || d.body.ph > 8.5)
      ).length,
      highColiformes: validData.filter(d =>
        d.body.coliformes_fecaux_cfu_100ml !== null &&
        d.body.coliformes_fecaux_cfu_100ml > 200
      ).length
    };

    return stats;
  }

  // CORRECTION : calculateAverage avec vérifications
  private calculateAverage(field: keyof WaterQualityData['body']): number {
    const validData = this.allWaterData.filter(d => d && d.body);
    const validValues = validData
      .map(d => d.body[field] as number)
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

  getUniqueFilters(): string[] {
    if (!this.allWaterData) return [];
    const validData = this.allWaterData.filter(d => d && d.body);
    return [...new Set(validData.map(d => d.body.id_filtre))];
  }

  getUniquePhases(): string[] {
    if (!this.allWaterData) return [];
    const validData = this.allWaterData.filter(d => d && d.body);
    return [...new Set(validData.map(d => d.body.phase))];
  }

  private initializeCharts() {
    console.log('📊 Initialisation des graphiques...');
    setTimeout(() => {
      this.createTemperatureChart();
      this.createHumidityChart();
      this.createWaterQualityChart();
    }, 500);
  }

  private createTemperatureChart() {
    const tempCanvas = document.getElementById('temperatureChart') as HTMLCanvasElement;
    if (!tempCanvas) {
      console.warn('⚠️ Canvas temperatureChart introuvable');
      return;
    }

    // Détruire l'ancienne instance
    if (this.tempChartInstance) {
      this.tempChartInstance.destroy();
    }

    let tempData: number[] = [];
    let tempLabels: string[] = [];

    if (this.readingData && this.readingData.length > 0) {
      // Filtrer et trier les données par timestamp
      const validReadings = this.readingData
        .filter(d => d && d.body && d.body.temperature != null && !isNaN(d.body.temperature))
        .sort((a, b) => {
          // Tri par timestamp si disponible, sinon par ordre d'insertion
          const timeA = a.body.timestamp || a.body.createdAt || a._id || '0';
          const timeB = b.body.timestamp || b.body.createdAt || b._id || '0';
          return timeA.localeCompare(timeB);
        })
        .slice(-10); // Prendre les 10 dernières mesures

      tempData = validReadings.map(d => d.body.temperature);

      // Générer des labels basés sur les timestamps ou des indices
      tempLabels = validReadings.map((d, index) => {
        if (d.body.timestamp) {
          const date = new Date(d.body.timestamp);
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } else if (d.body.createdAt) {
          const date = new Date(d.body.createdAt);
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit'
          });
        } else {
          return `Mesure ${index + 1}`;
        }
      });

      console.log('🌡️ Données de température préparées:', {
        count: tempData.length,
        min: Math.min(...tempData),
        max: Math.max(...tempData),
        avg: (tempData.reduce((a, b) => a + b, 0) / tempData.length).toFixed(1)
      });
    } else {
      // Données de démonstration si pas de vraies données
      console.warn('⚠️ Pas de données de température, utilisation de données de démo');
      tempData = [28.5, 29.2, 30.1, 29.8, 31.2, 30.5, 29.9];
      tempLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    }

    this.tempChartInstance = new Chart(tempCanvas, {
      type: 'line',
      data: {
        labels: tempLabels,
        datasets: [{
          label: 'Température (°C)',
          data: tempData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: Math.min(...tempData) - 2,
            suggestedMax: Math.max(...tempData) + 2,
            title: {
              display: true,
              text: 'Température (°C)',
              font: { size: 12, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Période',
              font: { size: 12, weight: 'bold' }
            },
            ticks: {
              maxRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: `Évolution de la Température (${tempData.length} mesures)`,
            font: { size: 14, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Température: ${context.parsed.y.toFixed(1)}°C`;
              }
            }
          }
        }
      }
    });

    console.log('🌡️ Graphique de température créé avec', tempData.length, 'points de données');
  }

  private createHumidityChart() {
    const humidityCanvas = document.getElementById('humidityChart') as HTMLCanvasElement;
    if (!humidityCanvas) {
      console.warn('⚠️ Canvas humidityChart introuvable');
      return;
    }

    // Détruire l'ancienne instance
    if (this.humidityChartInstance) {
      this.humidityChartInstance.destroy();
    }

    let chartData: number[] = [];
    let chartLabels: string[] = [];

    if (this.readingData && this.readingData.length > 0) {
      // Regrouper par station et calculer la moyenne d'humidité
      const stationData = this.readingData.reduce((acc: any, reading) => {
        if (!reading || !reading.body) return acc;

        const stationId = reading.body.stationId || 'Station Inconnue';
        if (!acc[stationId]) {
          acc[stationId] = { values: [], count: 0 };
        }

        if (reading.body.humidity != null && !isNaN(reading.body.humidity) &&
            reading.body.humidity >= 0 && reading.body.humidity <= 100) {
          acc[stationId].values.push(reading.body.humidity);
          acc[stationId].count++;
        }
        return acc;
      }, {});

      // Calculer les moyennes par station
      const stationAverages = Object.entries(stationData)
        .filter(([station, data]: [string, any]) => data.values.length > 0)
        .map(([station, data]: [string, any]) => ({
          station,
          average: data.values.reduce((sum: number, val: number) => sum + val, 0) / data.values.length,
          count: data.count
        }))
        .sort((a, b) => b.average - a.average) // Trier par humidité décroissante
        .slice(0, 6); // Prendre les 6 premières stations

      if (stationAverages.length > 0) {
        chartLabels = stationAverages.map(item => `${item.station} (${item.count})`);
        chartData = stationAverages.map(item => Math.round(item.average * 10) / 10); // Arrondir à 1 décimale

        console.log('💧 Données d\'humidité préparées:', {
          stations: stationAverages.length,
          moyennes: chartData,
          min: Math.min(...chartData),
          max: Math.max(...chartData)
        });
      } else {
        // Si pas de stations identifiées, regrouper par plages d'humidité
        const validHumidities = this.readingData
          .map(d => d && d.body ? d.body.humidity : null)
          .filter((h): h is number => h != null && !isNaN(h) && h >= 0 && h <= 100);
        if (validHumidities.length > 0) {
          const ranges = [
            { label: 'Très sec (0-30%)', min: 0, max: 30 },
            { label: 'Sec (30-50%)', min: 30, max: 50 },
            { label: 'Modéré (50-70%)', min: 50, max: 70 },
            { label: 'Humide (70-85%)', min: 70, max: 85 },
            { label: 'Très humide (85-100%)', min: 85, max: 100 }
          ];

          chartLabels = ranges.map(r => r.label);
          chartData = ranges.map(range =>
            validHumidities.filter(h => h >= range.min && h < range.max).length
          );

          console.log('💧 Répartition par plages d\'humidité:', { chartLabels, chartData });
        }
      }
    }

    // Données de démonstration si pas de vraies données
    if (chartData.length === 0) {
      console.warn('⚠️ Pas de données d\'humidité, utilisation de données de démo');
      chartLabels = ['Station A', 'Station B', 'Station C', 'Station D'];
      chartData = [65, 72, 58, 81];
    }

    const backgroundColors = [
      'rgba(54, 162, 235, 0.6)',   // Bleu
      'rgba(255, 99, 132, 0.6)',   // Rouge
      'rgba(255, 205, 86, 0.6)',   // Jaune
      'rgba(75, 192, 192, 0.6)',   // Teal
      'rgba(153, 102, 255, 0.6)',  // Violet
      'rgba(255, 159, 64, 0.6)'    // Orange
    ];

    const borderColors = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 205, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)'
    ];

    this.humidityChartInstance = new Chart(humidityCanvas, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'Humidité (%)',
          data: chartData,
          backgroundColor: backgroundColors.slice(0, chartData.length),
          borderColor: borderColors.slice(0, chartData.length),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: { size: 11 }
            }
          },
          title: {
            display: true,
            text: this.readingData && this.readingData.length > 0
              ? `Répartition de l'Humidité (${this.readingData.length} mesures)`
              : 'Répartition de l\'Humidité',
            font: { size: 14, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);

                if (label.includes('Station')) {
                  return `${label}: ${value}% d'humidité`;
                } else {
                  return `${label}: ${value} mesures (${percentage}%)`;
                }
              }
            }
          }
        },
        cutout: '60%'
      }
    });

    console.log('💧 Graphique d\'humidité créé avec', chartData.length, 'segments');
  }

  // AJOUT: Graphique pH amélioré du deuxième fichier
  private createWaterQualityChart() {
    if (!this.waterData || this.waterData.length === 0) {
      console.warn('⚠️ Aucune donnée de qualité d\'eau pour le graphique pH');
      return;
    }

    const phCanvas = document.getElementById('phChart') as HTMLCanvasElement;
    if (!phCanvas) {
      console.warn('⚠️ Canvas phChart introuvable');
      return;
    }

    // Détruire l'ancienne instance
    if (this.phChartInstance) {
      this.phChartInstance.destroy();
    }

    // Regrouper les données pH par filtre et calculer les moyennes
    const phDataByFilter: { [filtre: string]: number[] } = this.waterData.reduce((acc, item) => {
      if (!item || !item.body) return acc;

      const filtre = item.body.id_filtre || 'Inconnu';
      if (!acc[filtre]) acc[filtre] = [];

      if (item.body.ph !== null && item.body.ph !== undefined &&
          !isNaN(item.body.ph) && item.body.ph > 0 && item.body.ph < 14) {
        acc[filtre].push(item.body.ph);
      }
      return acc;
    }, {} as { [key: string]: number[] });

    // Calculer les moyennes et statistiques
    const chartData = Object.entries(phDataByFilter)
      .filter(([filtre, values]) => values.length > 0)
      .map(([filtre, values]) => ({
        filtre,
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      }))
      .sort((a, b) => a.average - b.average); // Trier par pH croissant

    if (chartData.length === 0) {
      console.warn('⚠️ Aucune donnée pH valide trouvée');
      return;
    }

    const labels = chartData.map(item => `${item.filtre} (${item.count})`);
    const averages = chartData.map(item => Math.round(item.average * 100) / 100);
    const minValues = chartData.map(item => Math.round(item.min * 100) / 100);
    const maxValues = chartData.map(item => Math.round(item.max * 100) / 100);

    // Colorer selon les seuils de pH (6.5-8.5 = normal)
    const backgroundColors = averages.map(value => {
      if (value >= 6.5 && value <= 8.5) {
        return 'rgba(75, 192, 192, 0.6)'; // Vert pour normal
      } else if (value < 6.5) {
        return 'rgba(255, 206, 86, 0.6)'; // Jaune pour acide
      } else {
        return 'rgba(255, 99, 132, 0.6)'; // Rouge pour basique
      }
    });

    const borderColors = averages.map(value => {
      if (value >= 6.5 && value <= 8.5) {
        return 'rgba(75, 192, 192, 1)';
      } else if (value < 6.5) {
        return 'rgba(255, 206, 86, 1)';
      } else {
        return 'rgba(255, 99, 132, 1)';
      }
    });

    this.phChartInstance = new Chart(phCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'pH Moyen',
            data: averages,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2
          },
          {
            label: 'pH Min',
            data: minValues,
            backgroundColor: 'rgba(201, 203, 207, 0.3)',
            borderColor: 'rgba(201, 203, 207, 1)',
            borderWidth: 1,
            type: 'line' as const,
            pointRadius: 3,
            fill: false
          },
          {
            label: 'pH Max',
            data: maxValues,
            backgroundColor: 'rgba(255, 159, 64, 0.3)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1,
            type: 'line' as const,
            pointRadius: 3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            min: Math.max(0, Math.min(...minValues) - 0.5),
            max: Math.min(14, Math.max(...maxValues) + 0.5),
            title: {
              display: true,
              text: 'Valeur pH',
              font: { size: 12, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            ticks: {
              callback: function(value) {
                const num = Number(value); // convertir en nombre
                return isNaN(num) ? value : num.toFixed(1);
              }
            }
          },
          x: {
            title: {
              display: true,
              text: 'Filtres (nombre de mesures)',
              font: { size: 12, weight: 'bold' }
            },
            ticks: {
              maxRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Analyse du pH par Filtre (${this.waterData.length} mesures)`,
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const datasetLabel = context.dataset.label || '';
                const value = context.parsed.y.toFixed(2);
                return `${datasetLabel}: ${value}`;
              },
              afterBody: function(tooltipItems) {
                const index = tooltipItems[0].dataIndex;
                const data = chartData[index];
                return [
                  `Nombre de mesures: ${data.count}`,
                  `Écart: ${(data.max - data.min).toFixed(2)}`,
                  `Status: ${data.average >= 6.5 && data.average <= 8.5 ? 'Normal' : 'Hors norme'}`
                ];
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    console.log('📊 Graphique pH créé avec', chartData.length, 'filtres:', {
      pHRange: `${Math.min(...averages).toFixed(2)} - ${Math.max(...averages).toFixed(2)}`,
      normalCount: averages.filter(ph => ph >= 6.5 && ph <= 8.5).length,
      totalMeasures: chartData.reduce((sum, item) => sum + item.count, 0)
    });
  }

  // AJOUT: Méthodes de détection d'anomalies du deuxième fichier
  getTemperatureAlerts(): string[] {
    if (!this.readingData || this.readingData.length === 0) return [];

    const alerts: string[] = [];
    const validTemps = this.readingData
      .filter(d => d && d.body && d.body.temperature != null && !isNaN(d.body.temperature))
      .map(d => ({ temp: d.body.temperature, station: d.body.stationId || 'Station inconnue' }));

    validTemps.forEach(reading => {
      if (reading.temp > 35) {
        alerts.push(`${reading.station}: Température élevée (${reading.temp.toFixed(1)}°C)`);
      } else if (reading.temp < 15) {
        alerts.push(`${reading.station}: Température basse (${reading.temp.toFixed(1)}°C)`);
      }
    });

    return alerts.slice(0, 5); // Limiter à 5 alertes
  }

  getHumidityAlerts(): string[] {
    if (!this.readingData || this.readingData.length === 0) return [];

    const alerts: string[] = [];
    const validHumidities = this.readingData
      .filter(d => d && d.body && d.body.humidity != null && !isNaN(d.body.humidity))
      .map(d => ({ hum: d.body.humidity, station: d.body.stationId || 'Station inconnue' }));

    validHumidities.forEach(reading => {
      if (reading.hum > 90) {
        alerts.push(`${reading.station}: Humidité très élevée (${reading.hum.toFixed(1)}%)`);
      } else if (reading.hum < 30) {
        alerts.push(`${reading.station}: Humidité très basse (${reading.hum.toFixed(1)}%)`);
      }
    });

    return alerts.slice(0, 5); // Limiter à 5 alertes
  }

  // AJOUT: Statistiques détaillées du deuxième fichier
  getDetailedStats() {
    const tempAlerts = this.getTemperatureAlerts();
    const humAlerts = this.getHumidityAlerts();
    const totalAlerts = tempAlerts.length + humAlerts.length;

    // Mettre à jour le compteur d'alertes
    if (totalAlerts > 0) {
      this.stats[3] = {
        label: 'Alertes détectées',
        value: totalAlerts.toString(),
        icon: 'bi-exclamation-triangle',
        detail: `${tempAlerts.length} temp, ${humAlerts.length} hum`
      };
    }

    return {
      temperatureAlerts: tempAlerts,
      humidityAlerts: humAlerts,
      totalReadings: this.readingData ? this.readingData.length : 0,
      totalWaterSamples: this.allWaterData ? this.allWaterData.length : 0
    };
  }

  // Les autres méthodes utilitaires restent inchangées...
  getValueClass(column: string, value: number): string {
    if (value === null || value === undefined) return '';

    const thresholds: { [key: string]: { low: number; high: number } } = {
      'ph': { low: 6.5, high: 8.5 },
      'dbo5_mg_l': { low: 5, high: 25 },
      'dco_mg_l': { low: 30, high: 125 },
      'mes_mg_l': { low: 5, high: 35 },
      'nitrates_mg_l': { low: 5, high: 25 },
      'ammonium_mg_l': { low: 0.5, high: 2 },
      'azote_total_mg_l': { low: 5, high: 15 },
      'phosphates_mg_l': { low: 1, high: 3 },
      'coliformes_fecaux_cfu_100ml': { low: 0, high: 100 }
    };

    const threshold = thresholds[column];
    if (!threshold) return '';

    if (column === 'ph') {
      return (value >= threshold.low && value <= threshold.high) ? 'normal-value' : 'high-value';
    } else {
      if (value <= threshold.low) return 'normal-value';
      if (value <= threshold.high) return 'medium-value';
      return 'high-value';
    }
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') return value.toFixed(1);
    return value.toString();
  }

  getPhaseClass(phase: string): string {
    return phase === 'Entrée' ? 'badge bg-warning' : 'badge bg-success';
  }

  getValueColor(column: string, value: number): string {
    const className = this.getValueClass(column, value);
    switch (className) {
      case 'normal-value': return 'text-success';
      case 'medium-value': return 'text-warning';
      case 'high-value': return 'text-danger';
      default: return '';
    }
  }

  exportData() {
    const validData = this.waterData.filter(item => item && item.body);
    const dataToExport = validData.map(item => ({
      Filtre: item.body.id_filtre,
      Phase: item.body.phase,
      Station: item.body.id_station,
      pH: item.body.ph,
      'DBO5 (mg/L)': item.body.dbo5_mg_l,
      'DCO (mg/L)': item.body.dco_mg_l,
      'MES (mg/L)': item.body.mes_mg_l,
      'Nitrates (mg/L)': item.body.nitrates_mg_l,
      'Ammonium (mg/L)': item.body.ammonium_mg_l,
      'Azote total (mg/L)': item.body.azote_total_mg_l,
      'Phosphates (mg/L)': item.body.phosphates_mg_l,
      'Coliformes (CFU/100ml)': item.body.coliformes_fecaux_cfu_100ml
    }));

    if (dataToExport.length === 0) {
      console.warn('⚠️ Aucune donnée à exporter');
      return;
    }

    const csv = this.convertToCSV(dataToExport);
    this.downloadCSV(csv, 'qualite_eau_export.csv');
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return header + '\n' + rows.join('\n');
  }

  private downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async refreshData() {
    console.log('🔄 Actualisation des données...');
    await this.loadData();
  }
}
