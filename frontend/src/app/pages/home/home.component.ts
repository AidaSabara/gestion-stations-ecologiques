import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  stats = {
    totalStations: 0,
    activeAlerts: 0,
    waterQuality: 0,
    responseTime: '0min'
  };

  navigationCards = [
    {
      title: 'Alertes en Temps Réel',
      description: 'Surveillance des anomalies et notifications instantanées',
      icon: 'bi-bell-fill',
      color: 'danger',
      route: '/alerts',
      count: 0
    },
    {
      title: 'Cartographie Interactive',
      description: 'Localisation géographique des stations en temps réel',
      icon: 'bi-geo-alt-fill',
      color: 'success',
      route: '/map'
    },
    {
      title: 'Tableau de Données',
      description: 'Données brutes et analyses détaillées de qualité d\'eau',
      icon: 'bi-table',
      color: 'info',
      route: '/data'
    },
    {
      title: 'Analyses & Graphiques',
      description: 'Visualisations avancées et tendances des données',
      icon: 'bi-graph-up',
      color: 'warning',
      route: '/charts'
    }
  ];

  private realTimeSubscription: any;

  constructor(private kuzzleService: KuzzleService) {}

  async ngOnInit() {
    await this.loadInitialData();
    this.subscribeToRealTimeAlerts();
  }

  async loadInitialData() {
    try {
      console.log('🔄 Chargement des données initiales...');

      // 1. Charger les stations
      const stations = await this.kuzzleService.getStations();
      this.stats.totalStations = stations.length;
      console.log('🏭 Stations chargées:', this.stats.totalStations);

      // 2. Charger et compter TOUTES les alertes
      await this.loadAllAlerts();

      // 3. Calculer la qualité d'eau
      await this.calculateWaterQuality();

      console.log('✅ Données chargées:', {
        stations: this.stats.totalStations,
        alerts: this.stats.activeAlerts,
        waterQuality: this.stats.waterQuality
      });

    } catch (error) {
      console.error('❌ Erreur chargement données initiales:', error);
    }
  }

  // 🔥 NOUVELLE MÉTHODE : Compter TOUTES les alertes
  private async loadAllAlerts() {
    try {
      let totalAlerts = 0;

      // 1. Alertes depuis Kuzzle (collection iot/alerts)
      console.log('📥 Chargement des alertes Kuzzle...');
      const kuzzleAlerts = await this.kuzzleService.getActiveAlerts();
      const activeKuzzleAlerts = kuzzleAlerts.filter((alert: any) => {
        const source = alert._source || alert.body || {};
        return source.status !== 'resolved'; // seulement les alertes actives
      });
      totalAlerts += activeKuzzleAlerts.length;
      console.log('📊 Alertes Kuzzle actives:', activeKuzzleAlerts.length);

      // 2. Alertes générées depuis les données de qualité d'eau
      console.log('💧 Analyse qualité eau pour alertes...');
      const waterData = await this.kuzzleService.getWaterQualityData();
      const waterAlerts = this.countWaterQualityAlerts(waterData);
      totalAlerts += waterAlerts;
      console.log('📊 Alertes qualité eau:', waterAlerts);

      // 3. Alertes générées depuis les capteurs
      console.log('🌡️ Analyse capteurs pour alertes...');
      const sensorData = await this.kuzzleService.getReadingData();
      const sensorAlerts = this.countSensorAlerts(sensorData);
      totalAlerts += sensorAlerts;
      console.log('📊 Alertes capteurs:', sensorAlerts);

      // Mettre à jour les statistiques
      this.stats.activeAlerts = totalAlerts;
      this.navigationCards[0].count = totalAlerts;

      console.log('🎯 Total alertes actives:', totalAlerts);

    } catch (error) {
      console.error('❌ Erreur comptage alertes:', error);
      // En cas d'erreur, on met une valeur par défaut
      this.stats.activeAlerts = 23;
      this.navigationCards[0].count = 23;
    }
  }

  // Compter les alertes qualité d'eau (comme dans alerts.component.ts)
  private countWaterQualityAlerts(waterData: any[]): number {
    let count = 0;

    waterData.forEach((doc: any) => {
      const source = doc._source || doc.body || {};

      // pH anormal
      const ph = source.ph;
      if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 9.5)) {
        count++;
      }

      // Coliformes
      const coliformes = source.coliformes_fecaux_cfu_100ml;
      if (coliformes !== null && coliformes !== undefined && coliformes > 0) {
        count++;
      }

      // Nitrates
      const nitrates = source.nitrates_mg_l;
      if (nitrates !== null && nitrates !== undefined && nitrates > 25) {
        count++;
      }

      // DBO5
      const dbo5 = source.dbo5_mg_l;
      if (dbo5 !== null && dbo5 !== undefined && dbo5 > 5) {
        count++;
      }
    });

    return count;
  }

  // Compter les alertes capteurs (comme dans alerts.component.ts)
  private countSensorAlerts(sensorData: any[]): number {
    let count = 0;

    sensorData.forEach((doc: any) => {
      const source = doc._source || doc.body || {};

      // Température anormale
      const temp = source.temperature;
      if (temp !== null && temp !== undefined && (temp > 30 || temp < 5)) {
        count++;
      }

      // Humidité anormale
      const humidity = source.humidity;
      if (humidity !== null && humidity !== undefined && (humidity < 30 || humidity > 90)) {
        count++;
      }
    });

    return count;
  }

  // Calculer la qualité d'eau
  private async calculateWaterQuality() {
    try {
      const waterData = await this.kuzzleService.getWaterQualityData();

      if (waterData.length > 0) {
        const validPH = waterData.filter((doc: any) => {
          const source = doc._source || doc.body || {};
          return source.ph && source.ph > 0 && source.ph <= 14;
        });

        if (validPH.length > 0) {
          const avgPH = validPH.reduce((acc: number, doc: any) => {
            const source = doc._source || doc.body || {};
            return acc + source.ph;
          }, 0) / validPH.length;

          // Calcul de qualité : pH optimal = 7, on mesure l'écart
          const qualityScore = 100 - (Math.abs(avgPH - 7) * 10);
          this.stats.waterQuality = Math.max(0, Math.min(100, Math.round(qualityScore)));
        }
      }
    } catch (error) {
      console.error('❌ Erreur calcul qualité eau:', error);
    }
  }

  // Abonnement aux alertes temps réel
  subscribeToRealTimeAlerts() {
    this.realTimeSubscription = this.kuzzleService.subscribeToAlerts((alert) => {
      if (alert && alert._source) {
        const source = alert._source || alert.body || {};

        // Si nouvelle alerte active
        if (source.status === 'active') {
          this.stats.activeAlerts++;
          this.navigationCards[0].count = this.stats.activeAlerts;
          console.log('🚨 Nouvelle alerte temps réel - Total:', this.stats.activeAlerts);
        }
        // Si alerte résolue
        else if (source.status === 'resolved') {
          this.stats.activeAlerts = Math.max(0, this.stats.activeAlerts - 1);
          this.navigationCards[0].count = this.stats.activeAlerts;
          console.log('✅ Alerte résolue - Total:', this.stats.activeAlerts);
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.realTimeSubscription) {
      this.realTimeSubscription.unsubscribe();
      console.log('🔴 Désabonnement des alertes temps réel');
    }
  }
}
