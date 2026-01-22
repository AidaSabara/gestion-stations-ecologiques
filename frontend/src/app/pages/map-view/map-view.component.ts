import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService } from '../../auth.service';
import * as L from 'leaflet';

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'alert';
  lastUpdate: number;
  region?: string;
}

interface Alert {
  station: string;
  message: string;
  time: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'warning' | 'info';
  type?: string;
  details?: string;
}

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

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.css']
})
export class MapViewComponent implements OnInit, AfterViewInit, OnDestroy {
  stations: Station[] = [];
  isLoading = true;
  selectedStation: Station | null = null;
  currentUserRole: 'admin' | 'supervisor' | 'agent' = 'agent';
  currentUserStationId: string | null = null;

  stationAlerts: Map<string, Alert[]> = new Map();
  stationWaterData: Map<string, WaterQualityData[]> = new Map();
  stationReadings: Map<string, ReadingData[]> = new Map();
  allAlerts: Alert[] = [];

  private map: L.Map | undefined;
  private markers: Map<string, L.Marker> = new Map();
  private criticalAlertsByStation: Map<string, number> = new Map();
  private alertsSubscription: any;

  constructor(
    private kuzzleService: KuzzleService,
    private authService: AuthService,
    private router: Router
  ) {}
  private loadUserInfo(): void {
    const user = this.authService.getCurrentUser();

    if (user) {
      this.currentUserRole = user.role;
      this.currentUserStationId = user.station_id;

      console.log('👤 Utilisateur connecté:', user.email);
      console.log('🎭 Rôle:', this.currentUserRole);
      console.log('🏭 Station ID:', this.currentUserStationId);
    } else {
      console.error('❌ Aucun utilisateur connecté !');
      this.router.navigate(['/auth']);
    }
  }

  async ngOnInit() {
    console.log('🗺️ Initialisation de la carte avec alertes...');
    this.loadUserInfo();
    await this.loadAllData();
    this.setupRealTimeMonitoring();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.alertsSubscription) {
      this.alertsSubscription.unsubscribe();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  private async loadAllData() {
    try {
      this.isLoading = true;
      await this.loadStations();
      await this.loadWaterQualityData();
      await this.loadReadingData();
      await this.loadAlerts();
      this.detectAlerts();
      this.updateStationStatuses();
      this.initMap();
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private async loadStations() {
    try {
      const results = await this.kuzzleService.getStations();

      console.log('📊 === DEBUG CHARGEMENT STATIONS ===');
      console.log('📊 Nombre total reçu de Kuzzle:', results.length);
      console.log('🎭 Rôle utilisateur:', this.currentUserRole);
      console.log('🏭 Station utilisateur:', this.currentUserStationId);

      // ✅ ÉTAPE 1 : Mapper TOUTES les stations d'abord
      let allStations = results
        .map((doc: any) => {
          const source = doc._source || doc.body || {};
          const location = source.location || {};

          const lat = parseFloat(location.lat) || 0;
          const lon = parseFloat(location.lon) || 0;

          const station = {
            id: doc._id,
            name: source.name || `Station ${doc._id.substring(0, 8)}`,
            latitude: lat,
            longitude: lon,
            status: 'active' as 'active' | 'alert',
            lastUpdate: source.installedAt || Date.now(),
            region: source.region || 'Non spécifiée'
          };

          return station;
        })
        .filter((station: Station) => {
          const isValid = station.latitude !== 0 && station.longitude !== 0;
          if (!isValid) {
            console.warn(`⚠️ Station ignorée (coordonnées nulles): ${station.name}`);
          }
          return isValid;
        });

      // ✅ ÉTAPE 2 : FILTRAGE PAR RÔLE
      if (this.currentUserRole === 'admin') {
        // Admin voit TOUTES les stations
        this.stations = allStations;
        console.log('✅ ADMIN - Affichage de toutes les stations:', this.stations.length);
      } else {
        // Agent/Supervisor voit UNIQUEMENT sa station
        if (this.currentUserStationId) {
          this.stations = allStations.filter(
            (station: Station) => station.id === this.currentUserStationId
          );
          console.log('✅ AGENT/SUPERVISOR - Affichage station spécifique:', this.stations.length);

          if (this.stations.length === 0) {
            console.warn('⚠️ Aucune station trouvée pour cet utilisateur !');
            console.warn('⚠️ Station ID recherché:', this.currentUserStationId);
          }
        } else {
          console.error('❌ Aucune station_id pour cet utilisateur !');
          this.stations = [];
        }
      }

      console.log('✅ Stations à afficher:', this.stations.length);
      console.log('📊 === FIN DEBUG ===');

      // ✅ Afficher le détail par région (seulement pour admin)
      if (this.currentUserRole === 'admin') {
        const stationsByRegion = this.groupStationsByRegion();
        stationsByRegion.forEach((stations, region) => {
          console.log(`📍 ${region}: ${stations.length} station(s)`);
          stations.forEach(s => console.log(`   - ${s.name} (${s.latitude}, ${s.longitude})`));
        });
      }

    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
      this.stations = [];
    }
  }

  // ✅ Grouper les stations par région
  private groupStationsByRegion(): Map<string, Station[]> {
    const grouped = new Map<string, Station[]>();

    this.stations.forEach(station => {
      const region = station.region || 'Non spécifiée';
      if (!grouped.has(region)) {
        grouped.set(region, []);
      }
      grouped.get(region)!.push(station);
    });

    return grouped;
  }

  private async loadWaterQualityData() {
    try {
      const allData = await this.kuzzleService.getWaterQualityData();

      allData.forEach((doc: any) => {
        const source = doc._source || doc.body || {};
        const stationId = source.id_station;

        // ✅ FILTRAGE : Charger uniquement les données des stations visibles
        if (stationId && this.stations.some(s => s.id === stationId)) {
          if (!this.stationWaterData.has(stationId)) {
            this.stationWaterData.set(stationId, []);
          }
          this.stationWaterData.get(stationId)!.push({ _id: doc._id, body: source });
        }
      });

      console.log('💧 Données water_quality chargées pour', this.stationWaterData.size, 'station(s)');
    } catch (error) {
      console.error('❌ Erreur chargement water_quality:', error);
    }
  }

  private async loadReadingData() {
    try {
      const allData = await this.kuzzleService.getReadingData();

      allData.forEach((doc: any) => {
        const source = doc._source || doc.body || {};
        const stationId = source.stationId;

        // ✅ FILTRAGE : Charger uniquement les données des stations visibles
        if (stationId && this.stations.some(s => s.id === stationId)) {
          if (!this.stationReadings.has(stationId)) {
            this.stationReadings.set(stationId, []);
          }
          this.stationReadings.get(stationId)!.push({ _id: doc._id, body: source });
        }
      });

      console.log('📊 Données readings chargées pour', this.stationReadings.size, 'station(s)');
    } catch (error) {
      console.error('❌ Erreur chargement readings:', error);
    }
  }

  private async loadAlerts() {
    try {
      const activeAlerts = await this.kuzzleService.getActiveAlerts();

      activeAlerts.forEach((alert: any) => {
        const source = alert._source || alert.body || {};
        const stationId = source.stationId;

        // ✅ FILTRAGE : Charger uniquement les alertes des stations visibles
        if (stationId && this.stations.some(s => s.id === stationId)) {
          const alertData: Alert = {
            station: stationId || 'Station inconnue',
            message: source.message || 'Pas de message',
            time: new Date(source.timestamp || Date.now()).toLocaleTimeString('fr-FR'),
            severity: source.level || 'info',
            type: source.type || 'unknown'
          };

          this.allAlerts.push(alertData);

          if (!this.stationAlerts.has(stationId)) {
            this.stationAlerts.set(stationId, []);
          }
          this.stationAlerts.get(stationId)!.push(alertData);
        }
      });

      console.log('🔔 Alertes chargées pour', this.stationAlerts.size, 'station(s)');
    } catch (error) {
      console.error('❌ Erreur chargement alertes:', error);
    }
  }

  private detectAlerts() {
    this.stations.forEach(station => {
      const alerts: Alert[] = [];
      const waterData = this.stationWaterData.get(station.id);
      if (waterData && waterData.length > 0) {
        waterData.forEach(d => {
          if (!d || !d.body) return;
          const ph = d.body.ph;
          if (ph !== null && ph !== undefined && (ph < 6.5 || ph > 9.5)) {
            alerts.push({
              station: station.name,
              message: `pH anormal : ${ph.toFixed(2)}`,
              time: new Date().toLocaleTimeString('fr-FR'),
              severity: ph < 5 || ph > 10 ? 'critical' : 'high',
              type: 'water_quality'
            });
          }
        });
      }
      if (alerts.length > 0) {
        if (!this.stationAlerts.has(station.id)) {
          this.stationAlerts.set(station.id, []);
        }
        this.stationAlerts.get(station.id)!.push(...alerts);
        this.allAlerts.push(...alerts);
      }
    });
  }

  private updateStationStatuses() {
    this.stations.forEach(station => {
      const alerts = this.stationAlerts.get(station.id);
      station.status = (alerts && alerts.length > 0) ? 'alert' : 'active';
    });
  }

  private setupRealTimeMonitoring() {
    this.kuzzleService.subscribeToAlerts((alert) => {
      const source = alert._source || alert.body || {};
      const stationId = source.stationId;
      const newAlert: Alert = {
        station: stationId || 'Station inconnue',
        message: source.message || 'Alerte sans message',
        time: new Date().toLocaleTimeString('fr-FR'),
        severity: source.level || 'warning',
        type: source.type
      };
      this.allAlerts.unshift(newAlert);
      if (stationId) {
        if (!this.stationAlerts.has(stationId)) {
          this.stationAlerts.set(stationId, []);
        }
        this.stationAlerts.get(stationId)!.unshift(newAlert);
        this.updateMarkerForStation(stationId);
      }
    });
  }

  private updateMarkerForStation(stationId: string) {
    const station = this.stations.find(s => s.id === stationId);
    if (!station) return;
    const alerts = this.stationAlerts.get(stationId);
    station.status = (alerts && alerts.length > 0) ? 'alert' : 'active';
    const marker = this.markers.get(stationId);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.addSingleStationMarker(station);
    }
  }

  private initMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    this.map = L.map('map').setView([14.5, -14.5], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);

    if (this.stations.length > 0) {
      this.addStationMarkers();
    }
  }

  private addStationMarkers(): void {
    if (!this.map) return;

    const bounds: L.LatLngBoundsExpression = [];

    console.log('🗺️ === AJOUT DES MARQUEURS ===');
    console.log('🗺️ Nombre de marqueurs à ajouter:', this.stations.length);

    this.stations.forEach((station, index) => {
      console.log(`🗺️ Marqueur ${index + 1}/${this.stations.length}: ${station.name} à [${station.latitude}, ${station.longitude}]`);
      this.addSingleStationMarker(station);
      bounds.push([station.latitude, station.longitude]);
    });

    console.log('🗺️ Total marqueurs ajoutés:', this.markers.size);
    console.log('🗺️ === FIN AJOUT MARQUEURS ===');

    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private addSingleStationMarker(station: Station): void {
    if (!this.map) return;

    const iconColor = this.getIconColor(station.status);

    // ✅ MARQUEUR ORIGINAL - Taille fixe 16px
    const customIcon = L.divIcon({
      html: `<div style="background-color: ${iconColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      className: 'station-marker',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const popupContent = this.createPopupContent(station);
    const marker = L.marker([station.latitude, station.longitude], { icon: customIcon })
      .addTo(this.map!)
      .bindPopup(popupContent, {
        closeButton: true,
        maxWidth: 300,
        minWidth: 250,
        maxHeight: 350,
        autoPan: true,
        autoPanPadding: [50, 50],
        keepInView: true
      });

    marker.on('mouseover', () => marker.openPopup());
    marker.on('mouseout', () => marker.closePopup());
    marker.on('click', () => {
      this.selectStation(station);
    });

    this.markers.set(station.id, marker);

    console.log(`✅ Marqueur ajouté pour ${station.name} (ID: ${station.id})`);
  }

  private createPopupContent(station: Station): string {
    const alerts = this.stationAlerts.get(station.id) || [];
    const waterData = this.stationWaterData.get(station.id) || [];
    const readings = this.stationReadings.get(station.id) || [];
    const statusIcon = station.status === 'alert' ? '🔴' : '🟢';
    const statusText = station.status === 'alert' ? 'Alerte' : 'En ligne';

    let html = `
      <div style="min-width: 250px; max-width: 300px; font-size: 11px;">
        <h6 style="margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 2px solid #ddd; font-size: 13px;">
          <strong>${station.name}</strong>
        </h6>
        <div style="margin-bottom: 8px; padding: 5px; background: ${station.status === 'alert' ? '#f8d7da' : '#d1e7dd'}; border-radius: 4px; text-align: center;">
          <span style="color: ${this.getIconColor(station.status)}; font-weight: bold; font-size: 12px;">
            ${statusIcon} ${statusText}
          </span>
        </div>
        <div style="margin-bottom: 8px; font-size: 10px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
          <strong>📍 Région:</strong> ${station.region}<br>
          <strong>📍 Position:</strong><br>
          ${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}
        </div>
    `;

    if (alerts.length > 0) {
      html += `<div style="margin-top: 8px; padding: 6px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 3px;">
        <strong style="color: #856404; font-size: 11px;">⚠️ ${alerts.length} Alerte(s)</strong>
      </div>`;
    }

    if (waterData.length > 0) {
      const latest = waterData[0].body;
      html += `<div style="margin-top: 8px; padding: 6px; background: #e7f3ff; border-left: 3px solid #0d6efd; border-radius: 3px;">
        <strong style="color: #004085; font-size: 11px;">💧 pH: ${latest.ph?.toFixed(1) || 'N/A'}</strong>
      </div>`;
    }

    html += `
      <div style="margin-top: 12px; text-align: center; padding-top: 10px; border-top: 1px solid #ddd;">
        <a href="/station/${station.id}"
           style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #0d6efd, #0a58ca);
                  color: white; text-decoration: none; border-radius: 25px; font-size: 12px; font-weight: 600;
                  box-shadow: 0 4px 10px rgba(13, 110, 253, 0.3); transition: all 0.3s ease;">
          📊 Voir les détails
        </a>
      </div>
    `;

    html += `</div>`;
    return html;
  }

  private getIconColor(status: string): string {
    return status === 'alert' ? '#dc3545' : '#28a745';
  }

  selectStation(station: Station) {
    console.log('📍 Station sélectionnée:', station.name);
    this.router.navigate(['/station', station.id]);
  }

  getStatusClass(status: string): string {
    return status === 'alert' ? 'bg-danger' : 'bg-success';
  }

  getStationAlerts(station: Station): Alert[] {
    return this.stationAlerts.get(station.id) || [];
  }

  getActiveStationsCount(): number {
    return this.stations.filter(s => s.status === 'active').length;
  }

  getAlertStationsCount(): number {
    return this.stations.filter(s => s.status === 'alert').length;
  }
}
