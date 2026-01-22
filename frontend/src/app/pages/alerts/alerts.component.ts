import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';

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
  isPredictive?: boolean; // 🆕 Indicateur d'alerte préventive
}

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.css']
})
export class AlertsComponent implements OnInit, OnDestroy {
  // 🆕 DEUX LISTES SÉPARÉES
  realAlerts: Alert[] = [];           // Alertes réelles (mesures)
  predictiveAlerts: Alert[] = [];     // Alertes préventives (ML)

  // Listes filtrées
  filteredRealAlerts: Alert[] = [];
  filteredPredictiveAlerts: Alert[] = [];

  isLoading = true;
  filterStatus: string = 'active';
  filterSeverity: string = 'all';

  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;

  now: Date = new Date();
  private subscription: any;
  private stations: Map<string, string> = new Map();
  private sentEmailAlertIds = new Set<string>();

  // 🆕 Onglet actif (réelles ou préventives)
  activeTab: 'real' | 'predictive' = 'real';

  constructor(
    private kuzzleService: KuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // 🆕 Propriétés calculées pour alertes RÉELLES
  get realActiveAlertsCount(): number {
    return this.realAlerts.filter(a => a.status === 'active').length;
  }

  get realResolvedAlertsCount(): number {
    return this.realAlerts.filter(a => a.status === 'resolved').length;
  }

  get realCriticalAlertsCount(): number {
    return this.realAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
  }

  get realHighAlertsCount(): number {
    return this.realAlerts.filter(a => a.severity === 'high' && a.status === 'active').length;
  }

  // 🆕 Propriétés calculées pour alertes PRÉVENTIVES
  get predictiveActiveAlertsCount(): number {
    return this.predictiveAlerts.filter(a => a.status === 'active').length;
  }

  get predictiveResolvedAlertsCount(): number {
    return this.predictiveAlerts.filter(a => a.status === 'resolved').length;
  }

  get predictiveCriticalAlertsCount(): number {
    return this.predictiveAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
  }

  get predictiveHighAlertsCount(): number {
    return this.predictiveAlerts.filter(a => a.severity === 'high' && a.status === 'active').length;
  }

  // Totaux
  get totalActiveAlertsCount(): number {
    return this.realActiveAlertsCount + this.predictiveActiveAlertsCount;
  }

  async ngOnInit() {
    this.loadSentAlertIds();
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    await this.loadStations();

    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
    }

    await this.loadAllData();
    this.notifyCriticalAlertsToMap();
    this.subscribeToRealTimeAlerts();

    setInterval(() => {
      this.now = new Date();
    }, 1000);

    setInterval(async () => {
      await this.loadAllData();
      this.notifyCriticalAlertsToMap();
    }, 30000);
  }

  private loadSentAlertIds(): void {
    try {
      const stored = localStorage.getItem('sentEmailAlertIds');
      if (stored) {
        const ids = JSON.parse(stored);
        this.sentEmailAlertIds = new Set(ids);
      }
    } catch (error) {
      console.error('❌ Erreur chargement IDs emails envoyés:', error);
    }
  }

  private saveSentAlertIds(): void {
    try {
      const ids = Array.from(this.sentEmailAlertIds);
      localStorage.setItem('sentEmailAlertIds', JSON.stringify(ids));
    } catch (error) {
      console.error('❌ Erreur sauvegarde IDs emails envoyés:', error);
    }
  }

  private getStationIds(stationId: string): string[] {
    return [stationId];
  }

  private belongsToStation(dataStationId: string): boolean {
    if (!this.stationId) return true;
    const allowedIds = this.getStationIds(this.stationId);
    return allowedIds.includes(dataStationId);
  }

  private async loadStations() {
    try {
      const stationsData = await this.kuzzleService.getStations();
      stationsData.forEach((station: any) => {
        const source: { name?: string } = station._source || station.body || {};
        this.stations.set(station._id, source.name || station._id);
      });
    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
    }
  }

  async loadAllData() {
    try {
      this.isLoading = true;
      this.realAlerts = [];
      this.predictiveAlerts = [];

      // Charger TOUTES les alertes depuis Kuzzle
      await this.loadKuzzleAlerts();

      // Détecter les alertes réelles depuis water_quality et readings
      await this.detectWaterQualityAlerts();
      await this.detectSensorAlerts();

      this.applyFilter();
      console.log('✅ Alertes réelles:', this.realAlerts.length);
      console.log('✅ Alertes préventives:', this.predictiveAlerts.length);
    } catch (error) {
      console.error('❌ Erreur chargement alertes:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private async loadKuzzleAlerts() {
    try {
      const results = await this.kuzzleService.getActiveAlerts();

      results
        .filter((doc: any) => {
          const source = doc._source || doc.body || {};
          const alertStationId = source.stationId || source.id_station;
          return this.belongsToStation(alertStationId);
        })
        .forEach((doc: any) => {
          const source = doc._source || doc.body || {};
          const stationId = source.stationId;
          const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

          const alert: Alert = {
            id: doc._id,
            station: stationName,
            stationId: stationId,
            type: source.type || 'Système',
            severity: this.mapSeverity(source.severity || source.level),
            message: source.message || 'Anomalie détectée',
            timestamp: this.kuzzleService.normalizeTimestamp(source.timestamp),
            status: (source.status === 'resolved' ? 'resolved' : 'active') as 'active' | 'resolved',
            parameter: source.parameter,
            value: source.value,
            threshold: source.threshold,
            isPredictive: this.isAlertPredictive(source) // 🆕 Déterminer si préventive
          };

          // 🆕 SÉPARER les alertes selon leur type
          if (alert.isPredictive) {
            this.predictiveAlerts.push(alert);
          } else {
            this.realAlerts.push(alert);
          }

          // Envoyer emails pour alertes critiques réelles uniquement
          if (!alert.isPredictive && alert.severity === 'critical' && alert.status === 'active') {
            const alertKey = alert.id || `${alert.stationId}-${alert.type}-${alert.parameter}-${alert.timestamp}`;
            if (!this.sentEmailAlertIds.has(alertKey)) {
              this.sendEmailAlert(alert);
            }
          }
        });

      this.notifyCriticalAlertsToMap();

    } catch (error) {
      console.error('❌ Erreur chargement alertes Kuzzle:', error);
    }
  }

  // 🆕 Déterminer si une alerte est préventive (ML)
  private isAlertPredictive(source: any): boolean {
  // Debug: afficher les données reçues
  console.log('🔍 Vérification alerte préventive:', {
    type: source.type,
    message: source.message,
    metadata: source.metadata
  });

  // Vérifier plusieurs indicateurs avec plus de tolérance
  const isPredictive = (
    source.type === 'Alerte Préventive ML' ||
    source.type === 'prédiction_dépassement' ||
    source.type?.toLowerCase().includes('préventive') ||
    source.type?.toLowerCase().includes('predictive') ||
    source.metadata?.predictive === true ||
    source.metadata?.source === 'ML_Prevention' ||
    source.message?.includes('Prédiction') ||
    source.message?.includes('🔮') ||
    source.message?.toLowerCase().includes('risque de dépassement')
  );

  console.log('✅ Résultat isPredictive:', isPredictive);
  return isPredictive;
}

  private async detectWaterQualityAlerts() {
    try {
      const waterData = await this.kuzzleService.getWaterQualityData();

      waterData.forEach((doc: any) => {
        const source = doc._source || doc.body || {};
        const stationId = source.id_station;

        if (!this.belongsToStation(stationId)) return;

        const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

        // pH anormal
        const ph = source.ph;
        if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 8.5)) {
          this.realAlerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - pH',
            severity: ph < 5 || ph > 10 ? 'critical' : 'high',
            message: `pH anormal : ${ph.toFixed(2)} (norme: 6.5-9.5)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'pH',
            value: ph,
            threshold: ph < 6.5 ? 6.5 : 9.5,
            isPredictive: false // 🆕 Alerte réelle
          });
        }

        // Coliformes
        const coliformes = source.coliformes_fecaux_cfu_100ml;
        if (coliformes !== null && coliformes !== undefined && coliformes > 0) {
          this.realAlerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - Coliformes',
            severity: coliformes > 10 ? 'high' : 'medium',
            message: `Coliformes détectés : ${coliformes} CFU/100ml (norme: 0)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'Coliformes',
            value: coliformes,
            threshold: 0,
            isPredictive: false
          });
        }

        // Nitrates
        const nitrates = source.nitrates_mg_l;
        if (nitrates !== null && nitrates !== undefined) {
          if (nitrates > 50) {
            this.realAlerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Qualité eau - Nitrates',
              severity: 'high',
              message: `Nitrates élevés : ${nitrates.toFixed(1)} mg/L (seuil OMS: 50 mg/L)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Nitrates',
              value: nitrates,
              threshold: 50,
              isPredictive: false
            });
          } else if (nitrates > 25) {
            this.realAlerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Qualité eau - Nitrates',
              severity: 'medium',
              message: `Nitrates modérés : ${nitrates.toFixed(1)} mg/L (seuil alerte: 25 mg/L)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Nitrates',
              value: nitrates,
              threshold: 25,
              isPredictive: false
            });
          }
        }

        // DBO5
        const dbo5 = source.dbo5_mg_l;
        if (dbo5 !== null && dbo5 !== undefined && dbo5 > 40) {
          this.realAlerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Qualité eau - DBO5',
            severity: dbo5 > 20 ? 'high' : 'medium',
            message: `DBO5 élevée : ${dbo5.toFixed(1)} mg/L (norme UE: ≤ 5 mg/L)`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'DBO5',
            value: dbo5,
            threshold: 5,
            isPredictive: false
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

        if (!this.belongsToStation(stationId)) return;

        const stationName = this.stations.get(stationId) || stationId || 'Station Inconnue';

        const temp = source.temperature;
        if (temp !== null && temp !== undefined) {
          if (temp > 30) {
            this.realAlerts.push({
              station: stationName,
              stationId: stationId,
              type: 'Capteur - Température',
              severity: temp > 35 ? 'high' : 'medium',
              message: `Température élevée : ${temp.toFixed(1)}°C (seuil: 30°C)`,
              timestamp: Date.now(),
              status: 'active',
              parameter: 'Température',
              value: temp,
              threshold: 30,
              isPredictive: false
            });
          }
        }

        const humidity = source.humidity;
        if (humidity !== null && humidity !== undefined && (humidity < 30 || humidity > 90)) {
          this.realAlerts.push({
            station: stationName,
            stationId: stationId,
            type: 'Capteur - Humidité',
            severity: 'warning',
            message: `Humidité anormale : ${humidity.toFixed(1)}%`,
            timestamp: Date.now(),
            status: 'active',
            parameter: 'Humidité',
            value: humidity,
            threshold: humidity < 30 ? 30 : 90,
            isPredictive: false
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
          severity: this.mapSeverity(source.severity || source.level),
          message: source.message || 'Nouvelle alerte',
          timestamp: this.kuzzleService.normalizeTimestamp(source.timestamp),
          status: 'active',
          parameter: source.parameter,
          value: source.value,
          threshold: source.threshold,
          isPredictive: this.isAlertPredictive(source)
        };

        // 🆕 Ajouter à la bonne liste
        if (newAlert.isPredictive) {
          this.predictiveAlerts.unshift(newAlert);
        } else {
          this.realAlerts.unshift(newAlert);
        }

        this.applyFilter();

        if (newAlert.severity === 'critical' && !newAlert.isPredictive) {
          await this.sendEmailAlert(newAlert);
          this.notifyCriticalAlertsToMap();
        }
      }
    });
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    try {
      const alertFingerprint = `${alert.stationId}-${alert.type}-${alert.parameter}-${alert.severity}`;

      if (this.sentEmailAlertIds.has(alertFingerprint)) {
        return;
      }

      const response = await fetch('http://localhost:3000/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        this.sentEmailAlertIds.add(alertFingerprint);
        this.saveSentAlertIds();
      }
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
    }
  }

  private notifyCriticalAlertsToMap(): void {
    const criticalAlertsByStation = new Map<string, number>();

    // Compter uniquement les alertes RÉELLES critiques
    this.realAlerts
      .filter(a => a.severity === 'critical' && a.status === 'active')
      .forEach(alert => {
        if (alert.stationId) {
          const count = criticalAlertsByStation.get(alert.stationId) || 0;
          criticalAlertsByStation.set(alert.stationId, count + 1);
        }
      });

    const criticalAlertsData: any = {};
    criticalAlertsByStation.forEach((count, stationId) => {
      criticalAlertsData[stationId] = count;
    });

    localStorage.setItem('criticalAlertsByStation', JSON.stringify(criticalAlertsData));

    window.dispatchEvent(new CustomEvent('criticalAlertsUpdate', {
      detail: criticalAlertsData
    }));
  }

  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/map']);
    }
  }

  // 🆕 Changer d'onglet
  setActiveTab(tab: 'real' | 'predictive') {
    this.activeTab = tab;
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
    // Filtrer alertes RÉELLES
    let filteredReal = this.realAlerts;
    if (this.filterStatus !== 'all') {
      filteredReal = filteredReal.filter(alert => alert.status === this.filterStatus);
    }
    if (this.filterSeverity !== 'all') {
      filteredReal = filteredReal.filter(alert => alert.severity === this.filterSeverity);
    }
    this.filteredRealAlerts = filteredReal.sort((a, b) => b.timestamp - a.timestamp);

    // Filtrer alertes PRÉVENTIVES
    let filteredPredictive = this.predictiveAlerts;
    if (this.filterStatus !== 'all') {
      filteredPredictive = filteredPredictive.filter(alert => alert.status === this.filterStatus);
    }
    if (this.filterSeverity !== 'all') {
      filteredPredictive = filteredPredictive.filter(alert => alert.severity === this.filterSeverity);
    }
    this.filteredPredictiveAlerts = filteredPredictive.sort((a, b) => b.timestamp - a.timestamp);
  }

  async resolveAlert(alert: Alert) {
    try {
      if (alert.id) {
        await this.kuzzleService.updateAlert(alert.id, {
          status: 'resolved',
          resolvedAt: Date.now()
        });
      }
      alert.status = 'resolved';
      this.applyFilter();

      if (alert.severity === 'critical' && !alert.isPredictive) {
        this.notifyCriticalAlertsToMap();
      }
    } catch (error) {
      console.error('❌ Erreur résolution alerte:', error);
    }
  }

  getSeverityClass(severity: string): string {
    const classes: any = {
      critical: 'bg-danger',
      high: 'bg-warning text-dark',
      medium: 'bg-info',
      low: 'bg-secondary',
      warning: 'bg-warning text-dark',
      info: 'bg-primary'
    };
    return classes[severity] || 'bg-secondary';
  }

  getSeverityIcon(severity: string): string {
    const icons: any = {
      critical: 'bi-exclamation-triangle-fill',
      high: 'bi-exclamation-circle-fill',
      medium: 'bi-info-circle-fill',
      low: 'bi-check-circle',
      warning: 'bi-exclamation-diamond-fill',
      info: 'bi-info-circle'
    };
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

  clearEmailCache(): void {
    const confirmation = confirm(
      '⚠️ Voulez-vous réinitialiser le cache des emails envoyés ?'
    );

    if (confirmation) {
      try {
        localStorage.removeItem('sentEmailAlertIds');
        this.sentEmailAlertIds.clear();
        alert('✅ Cache nettoyé avec succès !');
        this.loadAllData();
      } catch (error) {
        console.error('❌ Erreur nettoyage cache:', error);
        alert('❌ Erreur lors du nettoyage du cache.');
      }
    }
  }
}
