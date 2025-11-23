import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService } from '../../auth.service';
import { StationAuthModalComponent } from '../../station-auth-modal/station-auth-modal.component';


interface StationStats {
  activeAlerts: number;
  waterQuality: number;
  responseTime: string;
  totalFiltres: number;
}

@Component({
  selector: 'app-station-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, StationAuthModalComponent],
  templateUrl: './station-detail.component.html',
  styleUrls: ['./station-detail.component.css']
})
export class StationDetailComponent implements OnInit {
   @ViewChild(StationAuthModalComponent) authModal!: StationAuthModalComponent;

  stationId: string = '';
  station: any = null;
  isLoading = true;

  stats: StationStats = {
    activeAlerts: 0,
    waterQuality: 0,
    responseTime: '< 1s',
    totalFiltres: 0
  };

  // Données de la station
  alerts: any[] = [];
  waterData: any[] = [];
  readings: any[] = [];
  filtres: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private kuzzleService: KuzzleService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.stationId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.stationId) {
      this.router.navigate(['/map']);
      return;
    }

    await this.loadStationData();
  }

  private async loadStationData() {
  try {
    this.isLoading = true;

    // 1. Charger les infos de la station
    await this.loadStation();

    // 2. Charger les données qualité eau EN PREMIER
    await this.loadWaterQuality();

    // 3. Charger les readings (capteurs) EN DEUXIÈME
    await this.loadReadings();

    // 4. Charger les alertes APRÈS (car elles dépendent de waterData et readings)
    await this.loadAlerts();

    // 5. Charger les filtres
    await this.loadFiltres();

    // 6. Calculer les stats
    this.calculateStats();

  } catch (error) {
    console.error('Erreur chargement station:', error);
  } finally {
    this.isLoading = false;
  }
}

  private async loadStation() {
    try {
      const stations = await this.kuzzleService.getStations();
      const found = stations.find((s: any) => s._id === this.stationId);

      if (found) {
        const source = found._source || found.body || {};
        this.station = {
          id: found._id,
          name: source.name || `Station ${found._id.substring(0, 8)}`,
          location: source.location || {},
          installedAt: source.installedAt,
          ...source
        };
      }
    } catch (error) {
      console.error('Erreur chargement station:', error);
    }
  }

private async loadAlerts() {
  try {
    console.log(`🔔 Chargement des alertes pour: ${this.stationId}`);
    this.alerts = [];

    // 1. Récupérer les alertes stockées dans Kuzzle
    const kuzzleAlerts = await this.kuzzleService.getActiveAlertsByStation(this.stationId, 50);
    console.log(`📨 Alertes Kuzzle: ${kuzzleAlerts.length}`);

    // Ajouter les alertes Kuzzle
    kuzzleAlerts.forEach((alert: any) => {
      const source = alert._source || alert.body || {};
      this.alerts.push({
        id: alert._id,
        type: 'kuzzle',
        message: source.message || 'Alerte système',
        severity: source.level || source.severity || 'warning',
        timestamp: source.timestamp
      });
    });

    // 2. Détecter les alertes depuis les données water_quality
    await this.detectWaterQualityAlerts();

    // 3. Détecter les alertes depuis les capteurs
    await this.detectSensorAlerts();

    console.log(`✅ Total alertes détectées: ${this.alerts.length}`);

  } catch (error) {
    console.error('Erreur chargement alertes:', error);
    this.alerts = [];
  }
}

private async detectWaterQualityAlerts() {
  try {
    // Utiliser les données déjà chargées dans waterData
    // (assurez-vous que loadWaterQuality() est appelée AVANT loadAlerts())

    this.waterData.forEach((doc: any) => {
      const source = doc._source || doc.body || {};

      // pH anormal
      const ph = source.ph;
      if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 9.5)) {
        this.alerts.push({
          type: 'water_quality',
          parameter: 'pH',
          message: `pH anormal : ${ph.toFixed(2)} (norme: 6.5-9.5)`,
          severity: ph < 5 || ph > 10 ? 'critical' : 'high',
          value: ph
        });
      }

      // Coliformes
      const coliformes = source.coliformes_fecaux_cfu_100ml;
      if (coliformes !== null && coliformes !== undefined && coliformes > 0) {
        this.alerts.push({
          type: 'water_quality',
          parameter: 'Coliformes',
          message: `Coliformes détectés : ${coliformes} CFU/100ml`,
          severity: coliformes > 10 ? 'high' : 'medium',
          value: coliformes
        });
      }

      // Nitrates
      const nitrates = source.nitrates_mg_l;
      if (nitrates !== null && nitrates !== undefined && nitrates > 50) {
        this.alerts.push({
          type: 'water_quality',
          parameter: 'Nitrates',
          message: `Nitrates élevés : ${nitrates.toFixed(1)} mg/L (seuil: 50 mg/L)`,
          severity: 'high',
          value: nitrates
        });
      }

      // DBO5
      const dbo5 = source.dbo5_mg_l;
      if (dbo5 !== null && dbo5 !== undefined && dbo5 > 5) {
        this.alerts.push({
          type: 'water_quality',
          parameter: 'DBO5',
          message: `DBO5 élevée : ${dbo5.toFixed(1)} mg/L (norme: ≤ 5 mg/L)`,
          severity: dbo5 > 20 ? 'high' : 'medium',
          value: dbo5
        });
      }
    });

    console.log(`💧 Alertes water_quality détectées: ${this.alerts.filter(a => a.type === 'water_quality').length}`);
  } catch (error) {
    console.error('Erreur détection alertes water_quality:', error);
  }
}

private async detectSensorAlerts() {
  try {
    this.readings.forEach((doc: any) => {
      const source = doc._source || doc.body || {};

      // Température
      const temp = source.temperature;
      if (temp !== null && temp !== undefined) {
        if (temp > 30) {
          this.alerts.push({
            type: 'sensor',
            parameter: 'Température',
            message: `Température élevée : ${temp.toFixed(1)}°C (seuil: 30°C)`,
            severity: temp > 35 ? 'high' : 'medium',
            value: temp
          });
        } else if (temp < 5) {
          this.alerts.push({
            type: 'sensor',
            parameter: 'Température',
            message: `Température basse : ${temp.toFixed(1)}°C`,
            severity: 'medium',
            value: temp
          });
        }
      }

      // Humidité
      const humidity = source.humidity;
      if (humidity !== null && humidity !== undefined && (humidity < 30 || humidity > 90)) {
        this.alerts.push({
          type: 'sensor',
          parameter: 'Humidité',
          message: `Humidité anormale : ${humidity.toFixed(1)}%`,
          severity: 'warning',
          value: humidity
        });
      }
    });

    console.log(`🌡️ Alertes capteurs détectées: ${this.alerts.filter(a => a.type === 'sensor').length}`);
  } catch (error) {
    console.error('Erreur détection alertes capteurs:', error);
  }
}
  private async loadWaterQuality() {
    try {
      const allData = await this.kuzzleService.getWaterQualityData();
      this.waterData = allData.filter((d: any) => {
        const source = d._source || d.body || {};
        return source.id_station === this.stationId;
      });
    } catch (error) {
      console.error('Erreur chargement water quality:', error);
      this.waterData = [];
    }
  }

  private async loadReadings() {
    try {
      const allData = await this.kuzzleService.getReadingData();
      this.readings = allData.filter((r: any) => {
        const source = r._source || r.body || {};
        return source.stationId === this.stationId;
      });
    } catch (error) {
      console.error('Erreur chargement readings:', error);
      this.readings = [];
    }
  }

private async loadFiltres() {
  try {
    console.log(`🔧 Chargement des filtres pour la station: ${this.stationId}`);

    // Essayer d'abord la méthode spécifique
    this.filtres = await this.kuzzleService.getFiltresByStation(this.stationId);

    console.log(`📊 Filtres spécifiques: ${this.filtres.length}`);

    // Si pas de résultats, essayer avec tous les filtres et filtrer
    if (this.filtres.length === 0) {
      console.log('ℹ️  Aucun filtre avec getFiltresByStation, chargement de tous les filtres...');
      const allFiltres = await this.kuzzleService.getAllFiltres();

      this.filtres = allFiltres.filter((f: any) => {
        const source = f._source || f.body || {};
        const filtreStationId = source.stationId || source.id_station;
        const matches = filtreStationId === this.stationId;

        if (matches) {
          console.log(`  📍 Filtre correspondant:`, {
            id: f._id,
            stationId: filtreStationId,
            type: source.type,
            status: source.status
          });
        }

        return matches;
      });

      console.log(`📊 Filtres filtrés: ${this.filtres.length}`);
    }

    // Debug final
    console.log(`🎯 Total filtres pour station ${this.stationId}: ${this.filtres.length}`);

  } catch (error) {
    console.error('Erreur chargement filtres:', error);
    this.filtres = [];
  }
}

  private calculateStats() {
  console.log('📈 Calcul des stats...');

  // Alertes actives - compter toutes les alertes chargées (déjà filtrées pour être actives)
  this.stats.activeAlerts = this.alerts.length;
  console.log(`🚨 Alertes actives: ${this.stats.activeAlerts}`);

  // Qualité d'eau basée sur le pH
  if (this.waterData.length > 0) {
    const validData = this.waterData.filter((d: any) => {
      const source = d._source || d.body || {};
      const ph = source.ph || source.pH;
      return ph !== undefined && ph !== null && ph >= 6.5 && ph <= 8.5;
    });
    this.stats.waterQuality = Math.round((validData.length / this.waterData.length) * 100);
    console.log(`💧 Qualité eau: ${this.stats.waterQuality}% (${validData.length}/${this.waterData.length} valides)`);
  } else {
    this.stats.waterQuality = 0;
    console.log('💧 Aucune donnée eau pour calculer la qualité');
  }

  // Nombre total de filtres
  this.stats.totalFiltres = this.filtres.length;
  console.log(`🔧 Total filtres: ${this.stats.totalFiltres}`);

  // Temps de réponse
  this.stats.responseTime = this.readings.length > 0 ? '< 1s' : '< 1s';

  console.log('📊 Stats finales:', this.stats);
}

  // Navigation retour
  goBack() {
    this.router.navigate(['/map']);
  }

  // Getters pour le template
  getStationName(): string {
    return this.station?.name || 'Station';
  }

  getStationStatus(): string {
    return this.alerts.length > 0 ? 'alert' : 'active';
  }

  getStatusClass(): string {
    return this.alerts.length > 0 ? 'bg-danger' : 'bg-success';
  }

  getStatusText(): string {
    return this.alerts.length > 0 ? 'En alerte' : 'Active';

  }
  // Dans StationDetailComponent
async navigateToData() {
  console.log('🔐 Ouverture modal auth pour accès données');
  this.authModal.openModal();
}


  // 👇 AJOUTER LES GESTIONNAIRES D'ÉVÉNEMENTS POUR LA MODAL
  onAuthSuccess() {
    console.log('✅ Authentification réussie - redirection vers données');

    // Petite pause pour que l'utilisateur voie le succès
    setTimeout(() => {
      this.router.navigate(['/station', this.stationId, 'data']);
    }, 500);
  }

  onAuthFailed(errorMessage: string) {
    console.log('❌ Échec authentification modal:', errorMessage);
    // Le message d'erreur est déjà géré dans la modal
  }

  private showAccessDeniedMessage() {
    // Vous pouvez utiliser un toast plus élégant
    alert('⚠️ Accès refusé : Vous n\'avez pas les permissions nécessaires pour accéder aux données de cette station.');
  }
}
