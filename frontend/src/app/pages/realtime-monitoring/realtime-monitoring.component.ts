import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RealtimeSensorService } from '../../realtime-sensor.service';
import { SensorReading, ReadingStats } from '../../models/sensor-reading.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-realtime-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './realtime-monitoring.component.html',
  styleUrls: ['./realtime-monitoring.component.css']
})
export class RealtimeMonitoringComponent implements OnInit, OnDestroy {
  // Données
  readings: SensorReading[] = [];
  latestReading: SensorReading | null = null;
  stats: ReadingStats | null = null;

  // État
  isLoading: boolean = true;
  isConnected: boolean = false;
  selectedStation: string = 'all';

  // Souscriptions
  private realtimeSubscription?: Subscription;
  private connectionSubscription?: Subscription;

  constructor(private sensorService: RealtimeSensorService) {}

  async ngOnInit() {
    console.log('🚀 Initialisation du monitoring temps réel');

    // Surveiller l'état de connexion
    this.connectionSubscription = this.sensorService.getConnectionStatus()
      .subscribe(status => {
        this.isConnected = status;
        console.log('📡 État connexion:', status ? 'Connecté' : 'Déconnecté');
      });

    // Charger les données historiques
    await this.loadHistoricalData();

    // S'abonner aux mises à jour temps réel
    await this.subscribeToRealtime();

    this.isLoading = false;
  }

  /**
   * Charger les données historiques
   */
  async loadHistoricalData() {
    try {
      const stationId = this.selectedStation === 'all' ? undefined : this.selectedStation;
      this.readings = await this.sensorService.getLatestReadings(stationId, 50);

      if (this.readings.length > 0) {
        this.latestReading = this.readings[0];
        this.calculateStats();
      }

      console.log(`📊 ${this.readings.length} lectures chargées`);
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    }
  }

  /**
   * S'abonner aux mises à jour temps réel
   */
  async subscribeToRealtime() {
    try {
      const stationId = this.selectedStation === 'all' ? undefined : this.selectedStation;
      const observable = await this.sensorService.subscribeToRealtimeUpdates(stationId);

      this.realtimeSubscription = observable.subscribe({
        next: (reading) => {
          console.log('🔔 Nouvelle donnée reçue:', reading);

          // Ajouter au début du tableau
          this.readings.unshift(reading);
          this.latestReading = reading;

          // Limiter à 50 lectures
          if (this.readings.length > 50) {
            this.readings.pop();
          }

          // Recalculer les stats
          this.calculateStats();
        },
        error: (error) => {
          console.error('❌ Erreur temps réel:', error);
        }
      });

      console.log('✅ Abonnement temps réel actif');
    } catch (error) {
      console.error('❌ Erreur abonnement:', error);
    }
  }

  /**
   * Calculer les statistiques moyennes
   */
  calculateStats() {
    if (this.readings.length === 0) {
      this.stats = null;
      return;
    }

    const sum = this.readings.reduce((acc, r) => ({
      temperature: acc.temperature + r.temperature,
      humidity: acc.humidity + r.humidity,
      airQuality: acc.airQuality + r.airQuality,
      co2: acc.co2 + r.co2
    }), { temperature: 0, humidity: 0, airQuality: 0, co2: 0 });

    const count = this.readings.length;

    this.stats = {
      avgTemperature: Number((sum.temperature / count).toFixed(2)),
      avgHumidity: Number((sum.humidity / count).toFixed(2)),
      avgAirQuality: Number((sum.airQuality / count).toFixed(2)),
      avgCo2: Number((sum.co2 / count).toFixed(2)),
      count
    };
  }

  /**
   * Changer de station
   */
  async onStationChange(stationId: string) {
    this.selectedStation = stationId;
    this.isLoading = true;

    // Se désabonner
    await this.sensorService.unsubscribe();

    // Recharger
    await this.loadHistoricalData();
    await this.subscribeToRealtime();

    this.isLoading = false;
  }

  /**
   * Obtenir la classe CSS selon la qualité de l'air
   */
  getAirQualityClass(aqi: number): string {
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'unhealthy-sensitive';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'very-unhealthy';
    return 'hazardous';
  }

  /**
   * Obtenir le texte selon la qualité de l'air
   */
  getAirQualityText(aqi: number): string {
    if (aqi <= 50) return 'Bon';
    if (aqi <= 100) return 'Modéré';
    if (aqi <= 150) return 'Mauvais pour groupes sensibles';
    if (aqi <= 200) return 'Mauvais';
    if (aqi <= 300) return 'Très mauvais';
    return 'Dangereux';
  }

  /**
   * Formater la date
   */
  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR');
  }

  /**
   * Formater l'heure seulement
   */
  formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR');
  }

  /**
   * Nettoyage à la destruction
   */
  ngOnDestroy() {
    console.log('🧹 Nettoyage du monitoring');
    this.realtimeSubscription?.unsubscribe();
    this.connectionSubscription?.unsubscribe();
    this.sensorService.unsubscribe();
  }
}
