import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';

// Plus besoin de mapping car les IDs sont maintenant cohérents dans Kuzzle

interface Alert {
  id?: string;
  station: string;
  stationId?: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  message: string;
  timestamp: number;
  status: 'active' | 'resolved';
  parameter?: string;
  value?: number;
  threshold?: number;
}

interface WaterQualityData {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    ph: number;
    dbo5_mg_l: number;
    nitrates_mg_l: number;
    coliformes_fecaux_cfu_100ml: number;
    [key: string]: any;
  };
}

interface ReadingData {
  _id?: string;
  body: {
    stationId?: string;
    temperature: number;
    humidity: number;
    timestamp?: string;
    [key: string]: any;
  };
}

interface Station {
  _id: string;
  _source?: { name: string; [key: string]: any; };
  body?: { name: string; [key: string]: any; };
}

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.css']
})
export class AlertsComponent implements OnInit, OnDestroy {
  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  isLoading = true;
  filterStatus: string = 'active';
  filterSeverity: string = 'all';


  // 👇 NOUVELLES PROPRIÉTÉS
  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;

  now: Date = new Date();
  private subscription: any;
  private stations: Map<string, string> = new Map();
  private sentEmailAlertIds = new Set<string>();

  constructor(
    private kuzzleService: KuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

 private async sendEmailAlert(alert: Alert): Promise<void> {
    try {
      // Vérifier si l'email a déjà été envoyé pour cette alerte
      if (!alert.id) {
        console.warn('⚠️ Alerte sans ID, impossible de tracker l\'email');
        return;
      }

      if (this.sentEmailAlertIds.has(alert.id)) {
        console.log('ℹ️ Email déjà envoyé pour cette alerte:', alert.id);
        return;
      }

      console.log('📧 Tentative envoi email pour:', alert.station);

      const response = await fetch('http://localhost:3000/send-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: {
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            parameter: alert.parameter,
            value: alert.value,
            threshold: alert.threshold
          },
          stationName: alert.station
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Email envoyé avec succès:', result.messageId || 'OK');

        // ✅ Marquer cette alerte comme envoyée
        this.sentEmailAlertIds.add(alert.id);
        this.saveSentAlertIds();
      } else {
        console.error('❌ Échec envoi email:', result.error);
      }

    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
    }
  }

  async ngOnInit() {
     this.loadSentAlertIds();
    // 👇 RÉCUPÉRER LE STATION ID DEPUIS L'URL
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    console.log('📍 Station ID depuis URL:', this.stationId);

    await this.loadStations();

    // 👇 Récupérer le nom de la station si on est en mode spécifique
    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
    }

    await this.loadAllData();
    this.subscribeToRealTimeAlerts();

    setInterval(() => { this.now = new Date(); }, 1000);
    setInterval(async () => { await this.loadAllData(); }, 30000);
  }
  private loadSentAlertIds(): void {
    try {
      const stored = localStorage.getItem('sentEmailAlertIds');
      if (stored) {
        const ids = JSON.parse(stored);
        this.sentEmailAlertIds = new Set(ids);
        console.log('📨 Alertes déjà envoyées par email:', this.sentEmailAlertIds.size);
      }
    } catch (error) {
      console.error('❌ Erreur chargement IDs emails envoyés:', error);
    }
  }

  // 👇 MÉTHODE POUR OBTENIR TOUS LES IDS ASSOCIÉS À UNE STATION
  private getStationIds(stationId: string): string[] {
    return [stationId];
  }
   // ✅ NOUVELLE MÉTHODE : Sauvegarder les IDs des emails envoyés
  private saveSentAlertIds(): void {
    try {
      const ids = Array.from(this.sentEmailAlertIds);
      localStorage.setItem('sentEmailAlertIds', JSON.stringify(ids));
    } catch (error) {
      console.error('❌ Erreur sauvegarde IDs emails envoyés:', error);
    }
  }


  // 👇 VÉRIFIER SI UNE DONNÉE APPARTIENT À LA STATION FILTRÉE
  private belongsToStation(dataStationId: string): boolean {
    if (!this.stationId) return true; // Pas de filtre = tout afficher

    const allowedIds = this.getStationIds(this.stationId);
    return allowedIds.includes(dataStationId);
  }

  // Propriétés calculées
  get activeAlertsCount(): number {
    return this.alerts.filter(a => a.status === 'active').length;
  }

  get resolvedAlertsCount(): number {
    return this.alerts.filter(a => a.status === 'resolved').length;
  }

  get totalAlertsCount(): number {
    return this.alerts.length;
  }

  get criticalAlertsCount(): number {
    return this.alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
  }

  get highAlertsCount(): number {
    return this.alerts.filter(a => a.severity === 'high' && a.status === 'active').length;
  }

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

  async loadAllData() {
    try {
      this.isLoading = true;
      this.alerts = [];

      await this.loadKuzzleAlerts();
      await this.detectWaterQualityAlerts();
      await this.detectSensorAlerts();

      this.applyFilter();
      console.log('✅ Total alertes chargées:', this.alerts.length);
    } catch (error) {
      console.error('❌ Erreur chargement alertes:', error);
    } finally {
      this.isLoading = false;
    }
  }

 private async loadKuzzleAlerts() {
    try {
      const results = await this.kuzzleService.getActiveAlerts();

      const kuzzleAlerts = results
        .filter((doc: any) => {
          const source = doc._source || doc.body || {};
          const alertStationId = source.stationId || source.id_station;
          return this.belongsToStation(alertStationId);
        })
        .map((doc: any) => {
          const source = doc._source || doc.body || {};
          const stationId = source.stationId;
          const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

          return {
            id: doc._id,
            station: stationName,
            stationId: stationId,
            type: source.type || 'Système',
            severity: this.mapSeverity(source.level || source.severity),
            message: source.message || 'Anomalie détectée',
            timestamp: source.timestamp ? new Date(source.timestamp).getTime() : Date.now(),
            status: (source.status === 'resolved' ? 'resolved' : 'active') as 'active' | 'resolved',
            parameter: source.parameter,
            value: source.value,
            threshold: source.threshold
          };
        });

      this.alerts.push(...kuzzleAlerts);
      console.log('📥 Alertes Kuzzle:', kuzzleAlerts.length);

      // ✅ Envoyer email pour les alertes critiques NON ENCORE ENVOYÉES
      for (const alert of kuzzleAlerts) {
        if (alert.severity === 'critical' && alert.status === 'active') {
          if (!this.sentEmailAlertIds.has(alert.id!)) {
            console.log('🚨 Alerte critique existante détectée, envoi email...');
            await this.sendEmailAlert(alert);
          } else {
            console.log('ℹ️ Email déjà envoyé pour:', alert.id);
          }
        }
      }

    } catch (error) {
      console.error('❌ Erreur chargement alertes Kuzzle:', error);
    }
  }

  private async detectWaterQualityAlerts() {
    try {
      const waterData = await this.kuzzleService.getWaterQualityData();
      console.log('💧 Analyse qualité eau:', waterData.length, 'échantillons');

      waterData.forEach((doc: any) => {
        const source = doc._source || doc.body || {};
        const stationId = source.id_station;

        // 👇 FILTRE PAR STATION
        if (!this.belongsToStation(stationId)) return;

        const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

        // pH anormal
        const ph = source.ph;
        if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 9.5)) {
          this.alerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - pH',
            severity: ph < 5 || ph > 10 ? 'critical' : 'high',
            message: `pH anormal : ${ph.toFixed(2)} (norme: 6.5-9.5)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'pH',
            value: ph,
            threshold: ph < 6.5 ? 6.5 : 9.5
          });
        }

        // Coliformes
        const coliformes = source.coliformes_fecaux_cfu_100ml;
        if (coliformes !== null && coliformes !== undefined && coliformes > 0) {
          this.alerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - Coliformes',
            severity: coliformes > 10 ? 'high' : 'medium',
            message: `Coliformes détectés : ${coliformes} CFU/100ml (norme: 0)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'Coliformes',
            value: coliformes,
            threshold: 0
          });
        }

        // Nitrates
        const nitrates = source.nitrates_mg_l;
        if (nitrates !== null && nitrates !== undefined) {
          if (nitrates > 50) {
            this.alerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Qualité eau - Nitrates',
              severity: 'high',
              message: `Nitrates élevés : ${nitrates.toFixed(1)} mg/L (seuil OMS: 50 mg/L)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Nitrates',
              value: nitrates,
              threshold: 50
            });
          } else if (nitrates > 25) {
            this.alerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Qualité eau - Nitrates',
              severity: 'medium',
              message: `Nitrates modérés : ${nitrates.toFixed(1)} mg/L (seuil alerte: 25 mg/L)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Nitrates',
              value: nitrates,
              threshold: 25
            });
          }
        }

        // DBO5
        const dbo5 = source.dbo5_mg_l;
        if (dbo5 !== null && dbo5 !== undefined && dbo5 > 5) {
          this.alerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - DBO5',
            severity: dbo5 > 20 ? 'high' : 'medium',
            message: `DBO5 élevée : ${dbo5.toFixed(1)} mg/L (norme UE: ≤ 5 mg/L)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'DBO5',
            value: dbo5,
            threshold: 5
          });
        }
      });
    } catch (error) {
      console.error('❌ Erreur détection alertes qualité eau:', error);
    }
  }

  private async detectSensorAlerts() {
    try {
      const readings = await this.kuzzleService.getReadingData();

      readings.forEach((doc: any) => {
        const source = doc._source || doc.body || {};
        const stationId = source.stationId;

        // 👇 FILTRE PAR STATION
        if (!this.belongsToStation(stationId)) return;

        const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

        const temp = source.temperature;
        if (temp !== null && temp !== undefined) {
          if (temp > 30) {
            this.alerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Capteur - Température',
              severity: temp > 35 ? 'high' : 'medium',
              message: `Température élevée : ${temp.toFixed(1)}°C (seuil: 30°C)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Température',
              value: temp,
              threshold: 30
            });
          } else if (temp < 5) {
            this.alerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Capteur - Température',
              severity: 'medium',
              message: `Température basse : ${temp.toFixed(1)}°C`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Température',
              value: temp,
              threshold: 5
            });
          }
        }

        const humidity = source.humidity;
        if (humidity !== null && humidity !== undefined && (humidity < 30 || humidity > 90)) {
          this.alerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Capteur - Humidité',
            severity: 'warning',
            message: `Humidité anormale : ${humidity.toFixed(1)}%`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'Humidité',
            value: humidity,
            threshold: humidity < 30 ? 30 : 90
          });
        }
      });
    } catch (error) {
      console.error('❌ Erreur détection alertes capteurs:', error);
    }
  }

  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info' {
    const severityMap: any = {
      'critical': 'critical', 'high': 'high', 'medium': 'medium',
      'low': 'low', 'warning': 'warning', 'info': 'info'
    };
    return severityMap[severity?.toLowerCase()] || 'medium';
  }

  subscribeToRealTimeAlerts() {
    this.subscription = this.kuzzleService.subscribeToAlerts(async (notification) => {
      if (notification && notification._source) {
        const source = notification._source;
        const alertStationId = source.stationId || source.id_station;

        if (!this.belongsToStation(alertStationId)) return;

        const stationName = this.stations.get(alertStationId) || alertStationId || 'Station Inconnue';

        const newAlert: Alert = {
          id: notification._id,
          station: stationName,
          stationId: alertStationId,
          type: source.type || 'Système',
          severity: this.mapSeverity(source.level || source.severity),
          message: source.message || 'Nouvelle alerte',
          timestamp: source.timestamp ? new Date(source.timestamp).getTime() : Date.now(),
          status: 'active',
          parameter: source.parameter,
          value: source.value,
          threshold: source.threshold
        };

        this.alerts.unshift(newAlert);
        this.applyFilter();

        // ✅ Envoyer email pour les nouvelles alertes critiques
        if (newAlert.severity === 'critical') {
          console.log('🚨 Nouvelle alerte critique, envoi email...');
          await this.sendEmailAlert(newAlert);
        }
      }
    });
  }
  async cleanupSentAlertIds() {
    const currentAlertIds = new Set(this.alerts.map(a => a.id).filter(Boolean));

    // Garder seulement les IDs des alertes qui existent encore
    const updatedSentIds = new Set(
      Array.from(this.sentEmailAlertIds).filter(id => currentAlertIds.has(id))
    );

    if (updatedSentIds.size !== this.sentEmailAlertIds.size) {
      this.sentEmailAlertIds = updatedSentIds;
      this.saveSentAlertIds();
      console.log('🧹 IDs emails nettoyés:', this.sentEmailAlertIds.size);
    }
  }


  // 👇 NAVIGATION RETOUR
  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/map']);
    }
  }

  setFilter(status: string) {
    this.filterStatus = status;
    this.applyFilter();
  }

  setSeverityFilter(severity: string) {
    this.filterSeverity = severity;
    this.applyFilter();
  }

  applyFilter() {
    let filtered = this.alerts;
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(alert => alert.status === this.filterStatus);
    }
    if (this.filterSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === this.filterSeverity);
    }
    this.filteredAlerts = filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  async resolveAlert(alert: Alert) {
    try {
      if (alert.id) {
        await this.kuzzleService.updateAlert(alert.id, { status: 'resolved', resolvedAt: Date.now() });
      }
      alert.status = 'resolved';
      this.applyFilter();
    } catch (error) {
      console.error('❌ Erreur résolution alerte:', error);
    }
  }

  getSeverityClass(severity: string): string {
    const classes: any = { critical: 'bg-danger', high: 'bg-warning text-dark', medium: 'bg-info', low: 'bg-secondary', warning: 'bg-warning text-dark', info: 'bg-primary' };
    return classes[severity] || 'bg-secondary';
  }

  getSeverityIcon(severity: string): string {
    const icons: any = { critical: 'bi-exclamation-triangle-fill', high: 'bi-exclamation-circle-fill', medium: 'bi-info-circle-fill', low: 'bi-check-circle', warning: 'bi-exclamation-diamond-fill', info: 'bi-info-circle' };
    return icons[severity] || 'bi-info-circle';
  }

  getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `À l'instant`;
  }

  ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
