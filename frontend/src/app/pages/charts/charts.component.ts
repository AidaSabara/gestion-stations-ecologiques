import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

interface WaterQualityData {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    ph: number;
    dbo5_mg_l: number;
    dco_mg_l: number;
    nitrates_mg_l: number;
    coliformes_fecaux_cfu_100ml: number;
    nom_feuille?: string;
    timestamp?: string | null;
    date?: string;
    type_filtre?: string;
    id_filtre?: string;
    temperature_c?: number;
    conductivite_us_cm?: number;
    potentiel_redox_mv?: number;
    mes_mg_l?: number;
    mvs_pct?: number;
    ammonium_mg_l?: number;
    azote_total_mg_l?: number;
    phosphates_mg_l?: number;
    oeufs_helminthes?: number;
    huiles_graisses?: number;
    contient_valeurs_estimees?: boolean;
    [key: string]: any;
  };
}

interface TreatmentFlowData {
  date: string;
  entree: any;
  sortieFiltresVerticaux: any;
  sortieFiltresHorizontaux: any;
  efficacite: {
    filtresVerticaux: number;
    filtresHorizontaux: number;
    totale: number;
  };
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
  treatmentStats: any = null;

  private tempChartInstance: Chart | null = null;
  private coliformesChartInstance: Chart | null = null;
  private multiParamChartInstance: Chart | null = null;
  private treatmentFlowChartInstance: Chart | null = null;
  private dbo5FlowChartInstance: Chart | null = null;
  private dcoFlowChartInstance: Chart | null = null;

  constructor(private kuzzleService: KuzzleService) {}

  async ngOnInit() {
    await this.loadChartData();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  private destroyAllCharts() {
    if (this.tempChartInstance) this.tempChartInstance.destroy();
    if (this.coliformesChartInstance) this.coliformesChartInstance.destroy();
    if (this.multiParamChartInstance) this.multiParamChartInstance.destroy();
    if (this.treatmentFlowChartInstance) this.treatmentFlowChartInstance.destroy();
    if (this.dbo5FlowChartInstance) this.dbo5FlowChartInstance.destroy();
    if (this.dcoFlowChartInstance) this.dcoFlowChartInstance.destroy();
  }

  async loadChartData() {
    try {
      this.isLoading = true;
      console.log('📊 Chargement des données pour les graphiques...');

      const waterResults = await this.kuzzleService.getWaterQualityData();

      // 🔥 LOG DES DONNÉES BRUTES POUR DÉBOGAGE
      console.log('📦 Données brutes reçues:', waterResults.length);

      // Analyse des types de données disponibles
      const stats = {
        total: waterResults.length,
        avecDates: waterResults.filter(d => d.body.date).length,
        entree: waterResults.filter(d => d.body.phase === "Entree" && d.body.type_filtre === "Non_Applicable").length,
        sortieFV: waterResults.filter(d => d.body.phase === "Sortie" && d.body.type_filtre === "Filtre_Vertical").length,
        sortieFH: waterResults.filter(d => d.body.phase === "Sortie" && d.body.type_filtre === "Filtre_Horizontal").length,
        avecDBO5: waterResults.filter(d => d.body.dbo5_mg_l != null).length,
        avecDCO: waterResults.filter(d => d.body.dco_mg_l != null).length
      };

      console.log('📊 Statistiques données:', stats);

      // Afficher un échantillon des données
      const echantillon = waterResults.slice(0, 5).map(d => ({
        date: d.body.date,
        phase: d.body.phase,
        type_filtre: d.body.type_filtre,
        id_filtre: d.body.id_filtre,
        dbo5: d.body.dbo5_mg_l,
        dco: d.body.dco_mg_l
      }));

      console.log('🔍 Échantillon données:', echantillon);

      this.waterData = waterResults.map((hit: any) => {
        const source = hit._source || hit.body || hit;
        const dateValue = source.date || source._kuzzle_info?.createdAt;

        return {
          _id: hit._id,
          body: {
            id_station: source.id_station,
            phase: source.phase,
            type_filtre: source.type_filtre,
            id_filtre: source.id_filtre,
            date: dateValue,
            mois: source.mois,
            temperature_c: source.temperature_c,
            ph: source.ph,
            conductivite_us_cm: source.conductivite_us_cm,
            potentiel_redox_mv: source.potentiel_redox_mv,
            dbo5_mg_l: source.dbo5_mg_l,
            dco_mg_l: source.dco_mg_l,
            mes_mg_l: source.mes_mg_l,
            mvs_pct: source.mvs_pct,
            nitrates_mg_l: source.nitrates_mg_l,
            ammonium_mg_l: source.ammonium_mg_l,
            azote_total_mg_l: source.azote_total_mg_l,
            phosphates_mg_l: source.phosphates_mg_l,
            coliformes_fecaux_cfu_100ml: source.coliformes_fecaux_cfu_100ml,
            oeufs_helminthes: source.oeufs_helminthes,
            huiles_graisses: source.huiles_graisses,
            nom_feuille: source.nom_feuille,
            contient_valeurs_estimees: source.contient_valeurs_estimees,
            timestamp: dateValue
          }
        };
      });

      console.log('✅ Données chargées:', {
        total: this.waterData.length,
        avecDates: this.waterData.filter(d => d.body.date).length,
        avecTemp: this.waterData.filter(d => d.body.temperature_c != null).length,
        avecColiformes: this.waterData.filter(d => d.body.coliformes_fecaux_cfu_100ml != null).length,
        sampleDates: this.waterData.slice(0, 3).map(d => d.body.date)
      });

      // Calculer les statistiques de traitement
      this.treatmentStats = this.getTreatmentStats();
      console.log('📈 Statistiques traitement:', this.treatmentStats);

      setTimeout(() => {
        this.initializeCharts();
      }, 500);

    } catch (error) {
      console.error('❌ Erreur chargement données graphiques:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private parseDateString(dateStr: string | null | undefined): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    const trimmed = dateStr.trim();
    if (trimmed === '') {
      return null;
    }

    try {
      // Format: "09/04/2019, 00:00:00"
      if (trimmed.includes('/')) {
        const [datePart, timePart] = trimmed.split(', ');
        const [day, month, year] = datePart.split('/');

        if (!day || !month || !year) return null;

        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10) - 1;
        const yearNum = parseInt(year, 10);

        if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
          console.warn('❌ Composants de date invalides:', { day, month, year });
          return null;
        }

        let hours = 0, minutes = 0, seconds = 0;
        if (timePart) {
          const [h, m, s] = timePart.split(':');
          hours = parseInt(h || '0', 10);
          minutes = parseInt(m || '0', 10);
          seconds = parseInt(s || '0', 10);
        }

        const date = new Date(yearNum, monthNum, dayNum, hours, minutes, seconds);

        if (isNaN(date.getTime())) {
          console.warn('❌ Date invalide après création:', dateStr);
          return null;
        }

        return date;
      } else {
        // Format ISO: "2019-04-09"
        const date = new Date(trimmed);
        return isNaN(date.getTime()) ? null : date;
      }
    } catch (error) {
      console.error('💥 Erreur parsing date:', error, 'Date string:', dateStr);
      return null;
    }
  }

  private generateTimeLabels(data: WaterQualityData[]): string[] {
    return data.map(item => {
      const dateStr = item.body.date;
      if (!dateStr) return 'Date inconnue';

      const parsedDate = this.parseDateString(dateStr);
      return parsedDate
        ? parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Date inconnue';
    });
  }

  private sortDataByDate(data: WaterQualityData[]): WaterQualityData[] {
    return data.sort((a, b) => {
      const dateA = this.parseDateString(a.body.date);
      const dateB = this.parseDateString(b.body.date);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime();
    });
  }

  private initializeCharts() {
    console.log('📊 Initialisation des graphiques...');
    this.createTemperatureChart();
    this.createColiformesTimeChart();
    this.createMultiParameterChart();
    this.createTreatmentFlowChart();
    this.createDBO5FlowChart();
    this.createDCOFlowChart();
  }

  // 1. Graphique Température
  private createTemperatureChart() {
    const canvas = document.getElementById('temperatureChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas temperatureChart non trouvé');
      return;
    }

    if (this.tempChartInstance) this.tempChartInstance.destroy();

    const validData = this.waterData
      .filter(d => d.body.temperature_c != null && d.body.date)
      .slice(-10);

    if (validData.length === 0) {
      console.warn('❌ Aucune donnée température valide');
      return;
    }

    const labels = validData.map(d => {
      const dateStr = d.body.date;
      return dateStr ? dateStr.split('T')[0] : 'Date inconnue';
    });

    const temperatures = validData.map(d => d.body.temperature_c!);

    this.tempChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Température (°C)',
          data: temperatures,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Date' },
            ticks: { maxRotation: 45, minRotation: 45 }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Température (°C)' }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 14 } }
          },
          title: {
            display: true,
            text: `🌡️ Température - ${validData.length} mesures`,
            font: { size: 16, weight: 'bold' }
          }
        }
      }
    });

    console.log('✅ Graphique température créé');
  }

  // 2. Graphique Coliformes
  private createColiformesTimeChart() {
    const canvas = document.getElementById('coliformesChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas coliformesChart non trouvé');
      return;
    }

    if (this.coliformesChartInstance) this.coliformesChartInstance.destroy();

    const validData = this.waterData
      .filter(d => d.body.coliformes_fecaux_cfu_100ml != null && d.body.date)
      .slice();

    const sortedData = this.sortDataByDate(validData).slice(-20);
    if (sortedData.length === 0) {
      console.warn('❌ Aucune donnée coliformes valide');
      return;
    }

    const coliformesData = sortedData.map(d => d.body.coliformes_fecaux_cfu_100ml ?? null);
    const labels = this.generateTimeLabels(sortedData);

    this.coliformesChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Coliformes Fécaux (CFU/100ml)',
          data: coliformesData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Concentration (CFU/100ml)' }
          },
          x: {
            title: { display: true, text: 'Date de Prélèvement' },
            ticks: { maxRotation: 45, minRotation: 45 }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Évolution des Coliformes Fécaux (${sortedData.length} mesures)`,
            font: { size: 14, weight: 'bold' }
          }
        }
      }
    });

    console.log('✅ Graphique coliformes créé');
  }

  // 3. Graphique Multi-paramètres
 private createMultiParameterChart() {
    const canvas = document.getElementById('multiParamChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas multiParamChart non trouvé');
      return;
    }

    if (this.multiParamChartInstance) this.multiParamChartInstance.destroy();

    const validData = this.waterData
      .filter(d => d.body.date && (d.body.ph != null || d.body.dbo5_mg_l != null || d.body.dco_mg_l != null || d.body.nitrates_mg_l != null))
      .slice();

    const sortedData = this.sortDataByDate(validData).slice(-20);
    if (sortedData.length === 0) {
      console.warn('❌ Aucune donnée multi-paramètres valide');
      return;
    }

    const labels = this.generateTimeLabels(sortedData);

    // CORRECTION 1: Utiliser 'undefined' au lieu de 'null' pour connecter la ligne sur les données manquantes.
    const phData = sortedData.map(d => d.body.ph ?? undefined);
    const dbo5Data = sortedData.map(d => d.body.dbo5_mg_l ?? undefined);
    const dcoData = sortedData.map(d => d.body.dco_mg_l ?? undefined);
    const nitratesData = sortedData.map(d => d.body.nitrates_mg_l ?? undefined);

    this.multiParamChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'pH',
            data: phData,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'y-ph',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2, // CORRECTION 2: Réduction de la taille du point (était 4)
            spanGaps: true,
            pointHitRadius: 8 // Ajout pour faciliter l'interaction
          },
          {
            label: 'DBO5 (mg/L)',
            data: dbo5Data,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y-concentration',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2, // CORRECTION 2: Réduction de la taille du point
            spanGaps: true,
            pointHitRadius: 8
          },
          {
            label: 'DCO (mg/L)',
            data: dcoData,
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            yAxisID: 'y-concentration',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2, // CORRECTION 2: Réduction de la taille du point
            spanGaps: true,
            pointHitRadius: 8
          },
          {
            label: 'Nitrates (mg/L)',
            data: nitratesData,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            yAxisID: 'y-concentration',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2, // CORRECTION 2: Réduction de la taille du point
            pointHitRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          'y-ph': {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'pH' }
          },
          'y-concentration': {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Concentration (mg/L)' },
            grid: { drawOnChartArea: false }
          },
          x: {
            title: { display: true, text: 'Date de Mesure' },
            ticks: { maxRotation: 45, minRotation: 45 }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Évolution Multi-Paramètres (${sortedData.length} mesures)`,
            font: { size: 14, weight: 'bold' }
          }
        }
      }
    });

    console.log('✅ Graphique multi-paramètres créé');
}
  // 4. 🆕 Analyse du flux de traitement
  private analyzeTreatmentFlow(): TreatmentFlowData[] {
    const dataByDate: { [date: string]: any } = {};

    console.log('🔍 Analyse du flux de traitement...');
    console.log('📊 Données disponibles:', this.waterData.length);

    this.waterData.forEach(item => {
      const date = item.body.date;
      if (!date) return;

      if (!dataByDate[date]) {
        dataByDate[date] = {
          entree: null,
          sortieFV: [],
          sortieFH: [],
          date: date
        };
      }

      const record = item.body;

      // Classification des données
      if (record.phase === "Entree" && record.type_filtre === "Non_Applicable") {
        dataByDate[date].entree = record;
      } else if (record.phase === "Sortie" && record.type_filtre === "Filtre_Vertical") {
        dataByDate[date].sortieFV.push(record);
      } else if (record.phase === "Sortie" && record.type_filtre === "Filtre_Horizontal") {
        dataByDate[date].sortieFH.push(record);
      }
    });

    const analysisResults: TreatmentFlowData[] = [];

    for (const [date, dayData] of Object.entries(dataByDate)) {
      console.log(`📅 Analyse date ${date}:`, {
        entree: !!dayData.entree,
        sortieFV: dayData.sortieFV.length,
        sortieFH: dayData.sortieFH.length
      });

      if (dayData.entree && dayData.sortieFV.length > 0 && dayData.sortieFH.length > 0) {
        const sortieFVMoyenne = this.calculateAverage(dayData.sortieFV);
        const sortieFHMoyenne = this.calculateAverage(dayData.sortieFH);

        console.log('📈 Moyennes calculées:', {
          entreeDBO: dayData.entree.dbo5_mg_l,
          sortieFVDBO: sortieFVMoyenne.dbo5_mg_l,
          sortieFHDBO: sortieFHMoyenne.dbo5_mg_l
        });

        const efficaciteFV = this.calculateEfficiency(dayData.entree, sortieFVMoyenne);
        const efficaciteFH = this.calculateEfficiency(sortieFVMoyenne, sortieFHMoyenne);
        const efficaciteTotale = this.calculateEfficiency(dayData.entree, sortieFHMoyenne);

        analysisResults.push({
          date,
          entree: dayData.entree,
          sortieFiltresVerticaux: sortieFVMoyenne,
          sortieFiltresHorizontaux: sortieFHMoyenne,
          efficacite: {
            filtresVerticaux: efficaciteFV,
            filtresHorizontaux: efficaciteFH,
            totale: efficaciteTotale
          }
        });
      }
    }

    // 🔥 CORRECTION : Trier par date réelle
    const sortedResults = analysisResults.sort((a, b) => {
      const dateA = this.parseDateString(a.date);
      const dateB = this.parseDateString(b.date);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    console.log('✅ Résultats analyse flux:', sortedResults.length);
    sortedResults.forEach(result => {
      console.log(`📊 ${result.date}: Entrée=${result.entree.dbo5_mg_l}, FV=${result.sortieFiltresVerticaux.dbo5_mg_l}, FH=${result.sortieFiltresHorizontaux.dbo5_mg_l}`);
    });

    return sortedResults;
  }

  private calculateAverage(records: any[]): any {
    const average: any = {};
    const params = ['ph', 'dbo5_mg_l', 'dco_mg_l', 'mes_mg_l', 'nitrates_mg_l', 'ammonium_mg_l', 'azote_total_mg_l', 'phosphates_mg_l', 'coliformes_fecaux_cfu_100ml'];

    params.forEach(param => {
      const values = records.map(r => r[param]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        average[param] = values.reduce((a, b) => a + b, 0) / values.length;
      } else {
        average[param] = null;
      }
    });

    return average;
  }

  private calculateEfficiency(entree: any, sortie: any): number {
    const params = ['dbo5_mg_l', 'dco_mg_l', 'mes_mg_l'];
    let totalEfficiency = 0;
    let count = 0;

    params.forEach(param => {
      if (entree[param] && sortie[param] && entree[param] > 0) {
        const efficiency = ((entree[param] - sortie[param]) / entree[param]) * 100;
        totalEfficiency += Math.max(0, efficiency);
        count++;
      }
    });

    return count > 0 ? totalEfficiency / count : 0;
  }

  // 5. 🆕 Graphique Flux de Traitement DBO5
  private createTreatmentFlowChart() {
    const canvas = document.getElementById('treatmentFlowChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas treatmentFlowChart non trouvé');
      return;
    }

    if (this.treatmentFlowChartInstance) {
      this.treatmentFlowChartInstance.destroy();
    }

    const treatmentData = this.analyzeTreatmentFlow();

    if (treatmentData.length === 0) {
      console.warn('❌ Aucune donnée de traitement complète disponible');

      // Afficher un message d'erreur dans le canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune donnée de traitement complète disponible', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    console.log('📊 Données pour graphique flux:', treatmentData);

    const labels = treatmentData.map(d => {
      const parsedDate = this.parseDateString(d.date);
      return parsedDate ?
        parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : d.date;
    });

    // 🔥 CORRECTION : Vérifiez que les données existent
    const entreeDBO = treatmentData.map(d => d.entree?.dbo5_mg_l || null);
    const sortieFVDBO = treatmentData.map(d => d.sortieFiltresVerticaux?.dbo5_mg_l || null);
    const sortieFHDBO = treatmentData.map(d => d.sortieFiltresHorizontaux?.dbo5_mg_l || null);

    console.log('📈 Données DBO5:', {
      labels: labels,
      entree: entreeDBO,
      sortieFV: sortieFVDBO,
      sortieFH: sortieFHDBO
    });

    this.treatmentFlowChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '📥 Entrée (Eaux brutes)',
            data: entreeDBO,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          },
          {
            label: '⬇️ Sortie Filtres Verticaux',
            data: sortieFVDBO,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          },
          {
            label: '✅ Sortie Filtres Horizontaux',
            data: sortieFHDBO,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'DBO5 (mg/L)'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `🔄 Flux de Traitement - DBO5 (${treatmentData.length} dates complètes)`,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value?.toFixed(1)} mg/L`;
              }
            }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          }
        }
      }
    });

    console.log('✅ Graphique flux traitement créé');
  }

  // 6. 🆕 Graphique DBO5 Détail avec Efficacité
  private createDBO5FlowChart() {
    const canvas = document.getElementById('dbo5FlowChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas dbo5FlowChart non trouvé');
      return;
    }

    if (this.dbo5FlowChartInstance) {
      this.dbo5FlowChartInstance.destroy();
    }

    const treatmentData = this.analyzeTreatmentFlow();
    if (treatmentData.length === 0) {
      console.warn('❌ Aucune donnée pour le graphique DBO5');
      return;
    }

    const labels = treatmentData.map(d => {
      const parsedDate = this.parseDateString(d.date);
      return parsedDate ?
        parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : d.date;
    });

    const entreeDBO = treatmentData.map(d => d.entree?.dbo5_mg_l || null);
    const sortieFVDBO = treatmentData.map(d => d.sortieFiltresVerticaux?.dbo5_mg_l || null);
    const sortieFHDBO = treatmentData.map(d => d.sortieFiltresHorizontaux?.dbo5_mg_l || null);
    const efficaciteFV = treatmentData.map(d => d.efficacite.filtresVerticaux);
    const efficaciteFH = treatmentData.map(d => d.efficacite.filtresHorizontaux);

    this.dbo5FlowChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '📥 Entrée DBO5',
            data: entreeDBO,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            borderWidth: 4,
            yAxisID: 'y',
            tension: 0.4,
            pointRadius: 5
          },
          {
            label: '🔄 Après Filtres Verticaux',
            data: sortieFVDBO,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            borderWidth: 4,
            yAxisID: 'y',
            tension: 0.4,
            pointRadius: 5
          },
          {
            label: '✅ Après Filtres Horizontaux',
            data: sortieFHDBO,
            borderColor: '#27ae60',
            backgroundColor: 'rgba(39, 174, 96, 0.1)',
            borderWidth: 4,
            yAxisID: 'y',
            tension: 0.4,
            pointRadius: 5
          },
          {
            label: '📈 Efficacité FV (%)',
            data: efficaciteFV,
            borderColor: '#9b59b6',
            borderDash: [5, 5],
            borderWidth: 2,
            yAxisID: 'y1',
            pointRadius: 3,
            tension: 0.3
          },
          {
            label: '📈 Efficacité FH (%)',
            data: efficaciteFH,
            borderColor: '#f39c12',
            borderDash: [5, 5],
            borderWidth: 2,
            yAxisID: 'y1',
            pointRadius: 3,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'DBO5 (mg/L)' },
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Efficacité (%)' },
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: '🔍 Détail DBO5 - Flux de Traitement avec Efficacité'
          }
        }
      }
    });

    console.log('✅ Graphique DBO5 détail créé');
  }

  // 7. 🆕 Graphique DCO Flux
  private createDCOFlowChart() {
    const canvas = document.getElementById('dcoFlowChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('❌ Canvas dcoFlowChart non trouvé');
      return;
    }

    if (this.dcoFlowChartInstance) {
      this.dcoFlowChartInstance.destroy();
    }

    const treatmentData = this.analyzeTreatmentFlow();
    if (treatmentData.length === 0) {
      console.warn('❌ Aucune donnée pour le graphique DCO');
      return;
    }

    const labels = treatmentData.map(d => {
      const parsedDate = this.parseDateString(d.date);
      return parsedDate ?
        parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : d.date;
    });

    const entreeDCO = treatmentData.map(d => d.entree?.dco_mg_l || null);
    const sortieFVDCO = treatmentData.map(d => d.sortieFiltresVerticaux?.dco_mg_l || null);
    const sortieFHDCO = treatmentData.map(d => d.sortieFiltresHorizontaux?.dco_mg_l || null);

    this.dcoFlowChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '📥 Entrée DCO',
            data: entreeDCO,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          },
          {
            label: '⬇️ Sortie Filtres Verticaux',
            data: sortieFVDCO,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          },
          {
            label: '✅ Sortie Filtres Horizontaux',
            data: sortieFHDCO,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'DCO (mg/L)' },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            title: { display: true, text: 'Date' },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `🔄 Flux de Traitement - DCO (${treatmentData.length} dates)`,
            font: { size: 16, weight: 'bold' }
          }
        }
      }
    });

    console.log('✅ Graphique DCO flux créé');
  }

  // 🆕 Méthodes utilitaires
  getTreatmentStats() {
    const treatmentData = this.analyzeTreatmentFlow();
    if (treatmentData.length === 0) {
      return {
        totalDates: 0,
        derniereDate: 'N/A',
        efficaciteTotale: '0',
        reductionDBO: '0',
        reductionDCO: '0',
        entreeDBO: '0',
        sortieDBO: '0'
      };
    }

    const lastData = treatmentData[treatmentData.length - 1];
    const reductionDBO = ((lastData.entree.dbo5_mg_l - lastData.sortieFiltresHorizontaux.dbo5_mg_l) / lastData.entree.dbo5_mg_l * 100);
    const reductionDCO = ((lastData.entree.dco_mg_l - lastData.sortieFiltresHorizontaux.dco_mg_l) / lastData.entree.dco_mg_l * 100);

    return {
      totalDates: treatmentData.length,
      derniereDate: lastData.date,
      efficaciteTotale: lastData.efficacite.totale.toFixed(1),
      reductionDBO: reductionDBO.toFixed(1),
      reductionDCO: reductionDCO.toFixed(1),
      entreeDBO: lastData.entree.dbo5_mg_l.toFixed(1),
      sortieDBO: lastData.sortieFiltresHorizontaux.dbo5_mg_l.toFixed(1)
    };
  }

  getActiveChartsCount(): number {
    let count = 0;
    if (this.tempChartInstance) count++;
    if (this.coliformesChartInstance) count++;
    if (this.multiParamChartInstance) count++;
    if (this.treatmentFlowChartInstance) count++;
    if (this.dbo5FlowChartInstance) count++;
    if (this.dcoFlowChartInstance) count++;
    return count;
  }

  getLastUpdateTime(): string {
    return new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTemperatureSamplesCount(): number {
    return this.waterData.filter(d =>
      d.body.temperature_c != null &&
      !isNaN(d.body.temperature_c) &&
      d.body.date
    ).length;
  }

  // 🆕 Recharger les données
  async refreshData() {
    await this.loadChartData();
  }
}
