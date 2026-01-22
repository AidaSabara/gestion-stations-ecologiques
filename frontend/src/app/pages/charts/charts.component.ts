import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

interface WaterQualityData {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre?: string;
    id_filtre?: string;
    date?: string;
    mois?: string;
    temperature_c?: number;
    ph?: number;
    conductivite_us_cm?: number;
    potentiel_redox_mv?: number;
    dbo5_mg_l?: number;
    dco_mg_l?: number;
    mes_mg_l?: number;
    nitrates_mg_l?: number;
    ammonium_mg_l?: number;
    coliformes_fecaux_cfu_100ml?: number;
    [key: string]: any;
  };
}

interface Station {
  _id: string;
  _source?: { name: string; [key: string]: any; };
  body?: { name: string; [key: string]: any; };
}

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.css']
})
export class ChartsComponent implements OnInit, AfterViewInit, OnDestroy {
  isLoading = true;
  waterData: WaterQualityData[] = [];

  // 👇 NOUVELLES PROPRIÉTÉS POUR LA GESTION DE LA STATION
  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;
  private stations: Map<string, string> = new Map();

  // KPIs
  kpis = {
    efficaciteGlobale: 0,
    reductionDBO5: 0,
    qualiteEauSortie: 'Bonne',
    alertesActives: 0
  };

  // Charts
  private comparisonChart: Chart | null = null;
  private evolutionChart: Chart | null = null;
  private efficiencyChart: Chart | null = null;
  private radarChart: Chart | null = null;
  private filterChart: Chart | null = null;

  constructor(
    private kuzzleService: KuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    // 👇 RÉCUPÉRATION DE L'ID DE LA STATION DEPUIS L'URL
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    console.log('📍 Station ID depuis URL:', this.stationId);

    // Charger les stations pour obtenir le nom
    await this.loadStations();

    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
      console.log('📍 Nom de la station:', this.stationName);
    }

    await this.loadChartData();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  // 👇 NOUVELLE MÉTHODE POUR CHARGER LES STATIONS
  private async loadStations() {
    try {
      const stationsData = await this.kuzzleService.getStations();
      stationsData.forEach((station: Station) => {
        const source: { name?: string } = station._source || station.body || {};
        this.stations.set(station._id, source.name || station._id);
      });
      console.log('✅ Stations chargées:', this.stations.size);
    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
    }
  }

  // 👇 NOUVELLE MÉTHODE POUR VÉRIFIER SI UNE DONNÉE APPARTIENT À LA STATION
  private belongsToStation(dataStationId: string): boolean {
    if (!this.stationId) return true; // Si pas de station spécifiée, afficher toutes
    return dataStationId === this.stationId;
  }

  // 👇 BOUTON RETOUR
  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/map']);
    }
  }

  private destroyAllCharts() {
    if (this.comparisonChart) this.comparisonChart.destroy();
    if (this.evolutionChart) this.evolutionChart.destroy();
    if (this.efficiencyChart) this.efficiencyChart.destroy();
    if (this.radarChart) this.radarChart.destroy();
    if (this.filterChart) this.filterChart.destroy();
  }

  async loadChartData() {
    try {
      this.isLoading = true;
      console.log('📊 Chargement des données...');

      const waterResults = await this.kuzzleService.getWaterQualityData();

      // 👇 FILTRAGE PAR STATION
      const filteredResults = waterResults.filter((hit: any) => {
        const source = hit._source || hit.body || {};
        const dataStationId = source.id_station;
        return this.belongsToStation(dataStationId);
      });

      console.log(`📊 Données après filtrage station: ${filteredResults.length}/${waterResults.length}`);

      this.waterData = filteredResults.map((hit: any) => {
        const source = hit._source || hit.body || hit;
        return {
          _id: hit._id,
          body: {
            id_station: source.id_station,
            phase: source.phase,
            type_filtre: source.type_filtre,
            id_filtre: source.id_filtre,
            date: source.date,
            mois: source.mois,
            temperature_c: source.temperature_c,
            ph: source.ph,
            conductivite_us_cm: source.conductivite_us_cm,
            potentiel_redox_mv: source.potentiel_redox_mv,
            dbo5_mg_l: source.dbo5_mg_l,
            dco_mg_l: source.dco_mg_l,
            mes_mg_l: source.mes_mg_l,
            nitrates_mg_l: source.nitrates_mg_l,
            ammonium_mg_l: source.ammonium_mg_l,
            coliformes_fecaux_cfu_100ml: source.coliformes_fecaux_cfu_100ml
          }
        };
      });

      console.log('✅ Données chargées pour la station:', this.waterData.length);

      this.calculateKPIs();

      setTimeout(() => {
        this.initializeCharts();
      }, 500);

    } catch (error) {
      console.error('❌ Erreur chargement:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private calculateKPIs() {
    const entreeData = this.waterData.filter(d => d.body.phase === 'Entree');
    const sortieData = this.waterData.filter(d => d.body.phase === 'Sortie');

    if (entreeData.length > 0 && sortieData.length > 0) {
      const avgEntreeDBO5 = this.getAverage(entreeData, 'dbo5_mg_l');
      const avgSortieDBO5 = this.getAverage(sortieData, 'dbo5_mg_l');

      if (avgEntreeDBO5 > 0) {
        this.kpis.reductionDBO5 = ((avgEntreeDBO5 - avgSortieDBO5) / avgEntreeDBO5) * 100;
        this.kpis.efficaciteGlobale = this.kpis.reductionDBO5;
      }
    }

    const recentData = this.waterData.slice(-10);
    this.kpis.alertesActives = recentData.filter(d =>
      (d.body.ph && (d.body.ph < 6.5 || d.body.ph > 8.5)) ||
      (d.body.dbo5_mg_l && d.body.dbo5_mg_l > 25)
    ).length;

    this.kpis.qualiteEauSortie = this.kpis.reductionDBO5 > 80 ? 'Excellente' :
                                  this.kpis.reductionDBO5 > 60 ? 'Bonne' : 'Moyenne';
  }

  private getAverage(data: WaterQualityData[], param: string): number {
    const values = data
      .map(d => d.body[param])
      .filter(v => v != null && !isNaN(v)) as number[];

    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private initializeCharts() {
    console.log('📊 Initialisation des graphiques...');
    this.createComparisonChart();
    this.createEvolutionChart();
    this.createEfficiencyChart();
    this.createRadarChart();
    this.createFilterPerformanceChart();
  }

  // 1. 📊 Comparaison Entrée vs Sortie

private createComparisonChart() {
  const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
  if (!canvas) return;

  if (this.comparisonChart) this.comparisonChart.destroy();

  // ✅ Gérer les variations de casse
  const entreeData = this.waterData.filter(d =>
    d.body.phase?.toUpperCase() === 'ENTREE'
  );
  const sortieData = this.waterData.filter(d =>
    d.body.phase?.toUpperCase() === 'SORTIE'
  );

  console.log(`📊 Comparaison: ${entreeData.length} entrées, ${sortieData.length} sorties`);

  const params = ['ph', 'temperature_c', 'conductivite_us_cm', 'dbo5_mg_l', 'dco_mg_l'];
  const labels = ['pH', 'Température (°C)', 'Conductivité (µS/cm)', 'DBO5 (mg/L)', 'DCO (mg/L)'];

  const entreeAvg = params.map(p => this.getAverage(entreeData, p));
  const sortieAvg = params.map(p => this.getAverage(sortieData, p));

  console.log('📊 Moyennes Entrée:', entreeAvg);
  console.log('📊 Moyennes Sortie:', sortieAvg);

  const datasets = [
    {
      label: '📥 Entrée (Eaux brutes)',
      data: entreeAvg,
      backgroundColor: 'rgba(255, 99, 132, 0.7)',
      borderColor: 'rgb(255, 99, 132)',
      borderWidth: 2
    }
  ];

  if (sortieData.length > 0) {
    datasets.push({
      label: '✅ Sortie (Eaux traitées)',
      data: sortieAvg,
      backgroundColor: 'rgba(75, 192, 192, 0.7)',
      borderColor: 'rgb(75, 192, 192)',
      borderWidth: 2
    });
  }

  this.comparisonChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: sortieData.length > 0
            ? `📊 ${this.stationName} - Comparaison Entrée vs Sortie`
            : `📊 ${this.stationName} - Paramètres Entrée`,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (value === 0) return `${label}: Pas de données`;
              return `${label}: ${value.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          type: 'logarithmic',
          title: {
            display: true,
            text: 'Valeur (échelle logarithmique)',
            font: { weight: 'bold' }
          },
          ticks: {
            callback: function(value: number | string) {
              const numValue = typeof value === 'number' ? value : parseFloat(value);
              if (numValue === 1 || numValue === 10 || numValue === 100 ||
                  numValue === 1000 || numValue === 10000) {
                return numValue;
              }
              return '';
            }
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 }
          }
        }
      }
    }
  });

  console.log('✅ Graphique comparaison créé');
}

  // 2. 📈 Évolution Temporelle

private createEvolutionChart() {
  const canvas = document.getElementById('evolutionChart') as HTMLCanvasElement;
  if (!canvas) return;

  if (this.evolutionChart) this.evolutionChart.destroy();

  console.log(`🔍 Station filtrée: ${this.stationName} (ID: ${this.stationId})`);
  console.log(`📊 Données reçues: ${this.waterData.length} mesures`);

  // ✅ ÉTAPE 1: Extraire et valider les données
  const allDataPoints: Array<{
    date: Date;
    dateKey: string;
    ph: number;
    temperature: number;
    dbo5: number;
  }> = [];

  this.waterData.forEach((d, index) => {
    // Récupérer la date
    const dateStr = d.body.date || (d.body as any).timestamp;

    if (!dateStr) {
      console.warn(`⚠️ Index ${index} ignoré (pas de date): Filtre=${d.body.id_filtre}, Phase=${d.body.phase}`);
      return;
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Date invalide index ${index}:`, dateStr);
        return;
      }

      // Récupérer les valeurs
      const ph = d.body.ph ?? (d.body as any).mesures?.ph;
      const temperature = d.body.temperature_c ?? (d.body as any).mesures?.temperature;
      const dbo5 = d.body.dbo5_mg_l ?? (d.body as any).mesures?.dbo5;

      // Ne garder que les valeurs valides (> 0)
      if (ph != null && ph > 0 && temperature != null && temperature > 0) {
        allDataPoints.push({
          date: date,
          dateKey: date.toISOString().split('T')[0],
          ph: ph,
          temperature: temperature,
          dbo5: (dbo5 != null && dbo5 > 0) ? dbo5 : 0
        });
      }
    } catch (error) {
      console.error(`❌ Erreur index ${index}:`, error);
    }
  });

  console.log(`✅ Points valides extraits: ${allDataPoints.length}/${this.waterData.length}`);

  if (allDataPoints.length === 0) {
    console.error('❌ Aucune donnée valide à afficher!');
    return;
  }

  // ✅ ÉTAPE 2: Grouper par date et calculer les moyennes
  const dateGroups = new Map<string, {
    date: Date;
    phSum: number;
    tempSum: number;
    dbo5Sum: number;
    count: number;
  }>();

  allDataPoints.forEach(point => {
    if (!dateGroups.has(point.dateKey)) {
      dateGroups.set(point.dateKey, {
        date: point.date,
        phSum: 0,
        tempSum: 0,
        dbo5Sum: 0,
        count: 0
      });
    }

    const group = dateGroups.get(point.dateKey)!;
    group.phSum += point.ph;
    group.tempSum += point.temperature;
    group.dbo5Sum += point.dbo5;
    group.count++;
  });

  console.log(`📅 ${dateGroups.size} dates uniques`);

  // ✅ ÉTAPE 3: Calculer moyennes et trier
  const aggregatedData = Array.from(dateGroups.entries())
    .map(([dateKey, group]) => ({
      date: group.date,
      dateKey: dateKey,
      ph: group.phSum / group.count,
      temperature: group.tempSum / group.count,
      dbo5: group.dbo5Sum / group.count,
      count: group.count
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log('📊 Données agrégées par date:');
  aggregatedData.forEach(d => {
    console.log(`   ${d.dateKey}: pH=${d.ph.toFixed(2)}, Temp=${d.temperature.toFixed(1)}°C, DBO5=${d.dbo5.toFixed(1)} (${d.count} mesures)`);
  });

  // ✅ ÉTAPE 4: Préparer données Chart.js
  const labels = aggregatedData.map(d =>
    d.date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    })
  );

  const phData = aggregatedData.map(d => d.ph);
  const tempData = aggregatedData.map(d => d.temperature);
  const dbo5Data = aggregatedData.map(d => d.dbo5 > 0 ? d.dbo5 : null);

  // Échelles dynamiques
  const minTemp = Math.floor(Math.min(...tempData)) - 1;
  const maxTemp = Math.ceil(Math.max(...tempData)) + 1;
  const minPH = Math.floor(Math.min(...phData) * 10) / 10 - 0.2;
  const maxPH = Math.ceil(Math.max(...phData) * 10) / 10 + 0.2;

  const validDBO5 = dbo5Data.filter(d => d !== null) as number[];
  const maxDBO5 = validDBO5.length > 0 ? Math.ceil(Math.max(...validDBO5) * 1.2) : 50;

  console.log(`📊 Échelles: pH[${minPH.toFixed(1)}-${maxPH.toFixed(1)}], Temp[${minTemp}-${maxTemp}°C], DBO5[0-${maxDBO5}]`);

  // ✅ ÉTAPE 5: Créer graphique
  this.evolutionChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'pH (moyenne)',
          data: phData,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          yAxisID: 'y-ph',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true
        },
        {
          label: 'Température (°C)',
          data: tempData,
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.1)',
          yAxisID: 'y-temp',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true
        },
        {
          label: 'DBO5 (mg/L)',
          data: dbo5Data,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          yAxisID: 'y-dbo5',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          hidden: validDBO5.length === 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: `📈 ${this.stationName} - Évolution (${aggregatedData.length} dates, ${allDataPoints.length} mesures)`,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { size: 13, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 15,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const data = aggregatedData[index];
              return `${data.date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })} (${data.count} mesures)`;
            },
            label: function(context) {
              const value = context.parsed.y;
              if (value === null) return `${context.dataset.label}: Pas de données`;
              return `${context.dataset.label}: ${value.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        'y-ph': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'pH (moyenne)',
            font: { weight: 'bold', size: 14 },
            color: 'rgb(75, 192, 192)'
          },
          min: minPH,
          max: maxPH,
          grid: {
            color: 'rgba(75, 192, 192, 0.15)',
            lineWidth: 1
          },
          ticks: {
            color: 'rgb(75, 192, 192)',
            font: { size: 12, weight: 'bold' },
            callback: function(value: number | string) {
              return typeof value === 'number' ? value.toFixed(1) : value;
            }
          }
        },
        'y-temp': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Température (°C)',
            font: { weight: 'bold', size: 14 },
            color: 'rgb(255, 159, 64)'
          },
          min: minTemp,
          max: maxTemp,
          grid: { drawOnChartArea: false },
          ticks: {
            color: 'rgb(255, 159, 64)',
            font: { size: 12, weight: 'bold' }
          }
        },
        'y-dbo5': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'DBO5 (mg/L)',
            font: { weight: 'bold', size: 14 },
            color: 'rgb(255, 99, 132)'
          },
          min: 0,
          max: maxDBO5,
          grid: { drawOnChartArea: false },
          display: validDBO5.length > 0,
          ticks: {
            color: 'rgb(255, 99, 132)',
            font: { size: 12, weight: 'bold' }
          }
        },
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 }
          }
        }
      }
    }
  });

  console.log(`✅ Graphique créé avec succès!`);
}
  // 3. 🎯 Efficacité de Traitement
  private createEfficiencyChart() {
    const canvas = document.getElementById('efficiencyChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.efficiencyChart) this.efficiencyChart.destroy();

    const entreeData = this.waterData.filter(d => d.body.phase === 'Entree');
    const sortieData = this.waterData.filter(d => d.body.phase === 'Sortie');

    const params = ['dbo5_mg_l', 'dco_mg_l', 'mes_mg_l', 'nitrates_mg_l'];
    const labels = ['DBO5', 'DCO', 'MES', 'Nitrates'];

    const efficiencies = params.map(param => {
      const entreeAvg = this.getAverage(entreeData, param);
      const sortieAvg = this.getAverage(sortieData, param);
      return entreeAvg > 0 ? ((entreeAvg - sortieAvg) / entreeAvg) * 100 : 0;
    });

    this.efficiencyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Taux d\'Abattement (%)',
          data: efficiencies,
          backgroundColor: efficiencies.map(e =>
            e > 80 ? 'rgba(75, 192, 192, 0.7)' :
            e > 60 ? 'rgba(255, 206, 86, 0.7)' :
            'rgba(255, 99, 132, 0.7)'
          ),
          borderColor: efficiencies.map(e =>
            e > 80 ? 'rgb(75, 192, 192)' :
            e > 60 ? 'rgb(255, 206, 86)' :
            'rgb(255, 99, 132)'
          ),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `🎯 ${this.stationName} - Efficacité de Traitement`,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: 'Efficacité (%)' },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });

    console.log('✅ Graphique efficacité créé');
  }

  // 4. 🕸️ Radar Chart
  private createRadarChart() {
    const canvas = document.getElementById('radarChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.radarChart) this.radarChart.destroy();

    const entreeData = this.waterData.filter(d => d.body.phase === 'Entree');
    const sortieData = this.waterData.filter(d => d.body.phase === 'Sortie');

    const normalize = (value: number, max: number) => Math.min((value / max) * 100, 100);

    const entreeNormalized = [
      100 - normalize(this.getAverage(entreeData, 'dbo5_mg_l'), 100),
      100 - normalize(this.getAverage(entreeData, 'dco_mg_l'), 200),
      normalize(this.getAverage(entreeData, 'ph'), 14) * 7.14,
      100 - normalize(this.getAverage(entreeData, 'mes_mg_l'), 100),
      100 - normalize(this.getAverage(entreeData, 'nitrates_mg_l'), 50)
    ];

    const sortieNormalized = [
      100 - normalize(this.getAverage(sortieData, 'dbo5_mg_l'), 100),
      100 - normalize(this.getAverage(sortieData, 'dco_mg_l'), 200),
      normalize(this.getAverage(sortieData, 'ph'), 14) * 7.14,
      100 - normalize(this.getAverage(sortieData, 'mes_mg_l'), 100),
      100 - normalize(this.getAverage(sortieData, 'nitrates_mg_l'), 50)
    ];

    this.radarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['DBO5', 'DCO', 'pH', 'MES', 'Nitrates'],
        datasets: [
          {
            label: 'Entrée',
            data: entreeNormalized,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 2
          },
          {
            label: 'Sortie',
            data: sortieNormalized,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `🕸️ ${this.stationName} - Qualité Globale`,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top',
            labels: { padding: 15 }
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

    console.log('✅ Graphique radar créé');
  }

  // 5. 🔧 Performance par Filtre
  private createFilterPerformanceChart() {
    const canvas = document.getElementById('filterChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.filterChart) this.filterChart.destroy();

    const fv1Data = this.waterData.filter(d => d.body.id_filtre === 'FV1' && d.body.phase === 'Sortie');
    const fv2Data = this.waterData.filter(d => d.body.id_filtre === 'FV2' && d.body.phase === 'Sortie');
    const fhData = this.waterData.filter(d => d.body.id_filtre === 'FH' && d.body.phase === 'Sortie');

    console.log('🔧 Données filtres pour', this.stationName, ':');
    console.log('  FV1:', fv1Data.length, 'mesures');
    console.log('  FV2:', fv2Data.length, 'mesures');
    console.log('  FH:', fhData.length, 'mesures');

    const avgDBO5 = [
      this.getAverage(fv1Data, 'dbo5_mg_l'),
      this.getAverage(fv2Data, 'dbo5_mg_l'),
      this.getAverage(fhData, 'dbo5_mg_l')
    ];

    const avgPH = [
      this.getAverage(fv1Data, 'ph'),
      this.getAverage(fv2Data, 'ph'),
      this.getAverage(fhData, 'ph')
    ];

    const allPH = [...fv1Data, ...fv2Data, ...fhData]
      .map(d => d.body.ph)
      .filter(v => v != null && !isNaN(v)) as number[];

    const minPH = allPH.length > 0 ? Math.floor(Math.min(...allPH)) : 5;
    const maxPH = allPH.length > 0 ? Math.ceil(Math.max(...allPH)) : 9;

    this.filterChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Filtre Vertical 1', 'Filtre Vertical 2', 'Filtre Horizontal'],
        datasets: [
          {
            label: 'DBO5 Sortie (mg/L)',
            data: avgDBO5,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'pH Sortie',
            data: avgPH,
            backgroundColor: 'rgba(255, 206, 86, 0.7)',
            borderColor: 'rgb(255, 206, 86)',
            borderWidth: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `🔧 ${this.stationName} - Performance par Filtre`,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top',
            labels: { padding: 15 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (value === 0 || value === null) {
                  return `${label}: Pas de données`;
                }
                return `${label}: ${value.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'DBO5 (mg/L)' },
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'pH' },
            min: minPH - 0.5,
            max: maxPH + 0.5,
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    console.log('✅ Graphique filtres créé pour', this.stationName);
  }

  async refreshData() {
    await this.loadChartData();
  }

  getLastUpdateTime(): string {
    return new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
