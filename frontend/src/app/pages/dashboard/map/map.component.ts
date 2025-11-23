import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { KuzzleService } from '../../../kuzzle.service';
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

// Configuration des icônes
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent implements OnInit, OnChanges, OnDestroy {
  @Input() waterData: WaterQualityData[] = [];
  @Input() alerts: any[] = [];
  @Input() stations: any[] = [];
  @Input() newStation: any = null;
  private map: L.Map | undefined;
  private stationMarkers = new Map<string, L.Marker>();
  private realTimeSubscription: any;
  public isLoading: boolean = true;
  private loadedStations: any[] = [];

  private cityCoordinates: { [key: string]: { lat: number; lon: number; name: string } } = {
    'Sanar': { lat: 14.7645, lon: -17.3660, name: 'Sanar' },
    'Dakar': { lat: 14.6928, lon: -17.4467, name: 'Dakar' },
    'Thiès': { lat: 14.7914, lon: -16.9256, name: 'Thiès' },
    'Saint_Louis': { lat: 16.0179, lon: -16.4896, name: 'Saint-Louis' },
    'Ziguinchor': { lat: 12.5833, lon: -16.2667, name: 'Ziguinchor' },
    'Kaolack': { lat: 14.146, lon: -16.0726, name: 'Kaolack' },
    'Louga': { lat: 15.6144, lon: -16.2286, name: 'Louga' },
    'Tambacounda': { lat: 13.7699, lon: -13.6673, name: 'Tambacounda' },
    'Kolda': { lat: 12.8833, lon: -14.95, name: 'Kolda' },
    'Matam': { lat: 15.6559, lon: -13.2559, name: 'Matam' },
    'Fatick': { lat: 14.3396, lon: -16.4117, name: 'Fatick' }
  };

  constructor(private kuzzleService: KuzzleService) {}

  async ngOnInit(): Promise<void> {
    this.initMap();
    await this.loadStationsFromKuzzle();
    await this.loadWaterQualityData();
    await this.updateStationsFromData();
    this.setupRealTimeUpdates();
  }

ngOnChanges(changes: SimpleChanges): void {
  console.log('🔄 MapComponent - Changements détectés:', changes);

  if (changes['newStation'] && changes['newStation'].currentValue) {
    console.log('🎯 Nouvelle station détectée:', changes['newStation'].currentValue);
    this.addNewStationToMap(changes['newStation'].currentValue);
  }

  if (changes['waterData'] || changes['stations'] || changes['alerts']) {
    console.log('🔄 Mise à jour des données');
    setTimeout(() => {
      this.updateStationsFromData();
    }, 500);
  }
}
  private initMap(): void {
    this.map = L.map('map').setView([14.5, -14.5], 6);
    const bounds = L.latLngBounds([12.3, -17.6], [16.7, -11.3]);
    this.map.fitBounds(bounds);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private async loadStationsFromKuzzle(): Promise<void> {
    try {
      this.isLoading = true;
      const results = await this.kuzzleService.getStations();
      this.loadedStations = results.map((station: any) => {
        const source = station._source || station.body || {};
        return {
          _id: station._id,
          body: {
            name: source.name || `Station ${station._id.substring(0, 8)}`,
            location: source.location || this.getDefaultLocation(station._id),
            status: source.status || 'active',
            type: source.type || 'fixed',
            installedAt: source.installedAt || new Date().toISOString()
          }
        };
      });
    } catch (error) {
      this.loadedStations = [];
    } finally {
      this.isLoading = false;
    }
  }
  private addNewStationToMap(newStation: any): void {
  console.log('📍 Ajout nouvelle station sur la carte:', newStation);

  const stationId = newStation._id;
  const stationInfo = newStation.body || newStation._source || newStation;

  // Ajouter à la liste des stations chargées
  if (!this.loadedStations.find(s => s._id === stationId)) {
    this.loadedStations.push(newStation);
    console.log('✅ Nouvelle station ajoutée à loadedStations');
  }

  // Créer le marqueur immédiatement
  this.addOrUpdateMarker(
    stationId,
    undefined, // Pas de données d'eau initiales
    [],        // Pas d'alertes initiales
    stationInfo
  );

  // Centrer la carte sur la nouvelle station
  if (this.map && stationInfo.location) {
    this.map.setView([stationInfo.location.lat, stationInfo.location.lon], 10);
    console.log('🎯 Carte centrée sur nouvelle station');
  }
}
  private async loadWaterQualityData(): Promise<void> {
    if (!this.waterData || this.waterData.length === 0) {
      try {
        this.waterData = await this.kuzzleService.getWaterQualityData();
      } catch (error) {
        this.waterData = [];
      }
    }
  }

  private async updateStationsFromData(): Promise<void> {
  console.log('🔄 Mise à jour des stations sur la carte');

  this.stationMarkers.forEach(marker => this.map?.removeLayer(marker));
  this.stationMarkers.clear();

  // Fusionner toutes les sources de stations
  const allStations = [
    ...this.loadedStations,
    ...this.stations
  ].filter((station, index, array) =>
    array.findIndex(s => s._id === station._id) === index
  );

  console.log(`📊 Stations à afficher: ${allStations.length}`, allStations);

  if (allStations.length === 0) {
    console.log('⚠️ Aucune station à afficher');
    return;
  }

  const promises = allStations.map(station => {
    const stationId = station._id;
    const stationWaterData = this.waterData?.filter(w => w.body.id_station === stationId) || [];
    const latestWaterData = stationWaterData.length > 0 ? stationWaterData[stationWaterData.length - 1] : undefined;
    const stationAlerts = this.alerts?.filter(a => a.station === stationId) || [];

    console.log(`📍 Traitement station ${stationId}:`, {
      dataEau: stationWaterData.length,
      alertes: stationAlerts.length,
      stationInfo: station.body
    });

    return this.addOrUpdateMarker(stationId, latestWaterData, stationAlerts, station.body);
  });

  await Promise.all(promises);
  console.log('✅ Tous les marqueurs mis à jour');
}

  private getStationInfo(stationId: string): any {
    const allStations = [...this.loadedStations, ...this.stations];
    const stationFromCollection = allStations.find(s => s._id === stationId);
    if (stationFromCollection) return stationFromCollection.body;
    const cityName = this.guessCityFromStationId(stationId);
    const coordinates = this.cityCoordinates[cityName] || this.getDefaultLocation(stationId);
    return {
      name: `Station ${cityName}`,
      location: coordinates,
      status: 'active',
      type: 'fixed'
    };
  }

  private guessCityFromStationId(stationId: string): string {
    const lowerStationId = stationId.toLowerCase();
    if (lowerStationId.includes('sanar') || lowerStationId.includes('ugb')) return 'Sanar';
    if (lowerStationId.includes('dakar')) return 'Dakar';
    if (lowerStationId.includes('thies')) return 'Thiès';
    if (lowerStationId.includes('saint') || lowerStationId.includes('stlouis')) return 'Saint_Louis';
    if (lowerStationId.includes('ziguinchor')) return 'Ziguinchor';
    if (lowerStationId.includes('kaolack')) return 'Kaolack';
    if (lowerStationId.includes('louga')) return 'Louga';
    if (lowerStationId.includes('tamba')) return 'Tambacounda';
    if (lowerStationId.includes('kolda')) return 'Kolda';
    if (lowerStationId.includes('matam')) return 'Matam';
    if (lowerStationId.includes('fatick')) return 'Fatick';
    return 'Sanar';
  }

  private async addOrUpdateMarker(
    stationId: string,
    waterData?: WaterQualityData,
    alerts: any[] = [],
    stationInfo?: any
  ): Promise<void> {
    const location = stationInfo?.location || this.getDefaultLocation(stationId);
    const stationName = stationInfo?.name || `Station ${stationId}`;
    const localityName = stationInfo?.location?.name || this.guessCityFromStationId(stationId);

    const ph = waterData?.body.ph ?? 'N/A';
    const dbo5 = waterData?.body.dbo5_mg_l ?? 'N/A';
    const coliformes = waterData?.body.coliformes_fecaux_cfu_100ml ?? 'N/A';
    const nitrates = waterData?.body.nitrates_mg_l ?? 'N/A';
    const ammonium = waterData?.body.ammonium_mg_l ?? 'N/A';
    const phosphates = waterData?.body.phosphates_mg_l ?? 'N/A';

    let icon = greenIcon;
    if (alerts.length > 0) {
      icon = redIcon;
    } else if (typeof ph === 'number' && (ph < 6.5 || ph > 8.5)) {
      icon = yellowIcon;
    } else if (typeof coliformes === 'number' && coliformes > 100) {
      icon = redIcon;
    } else if (typeof dbo5 === 'number' && dbo5 > 25) {
      icon = yellowIcon;
    }

    let popupContent = `
      <div style="font-size: 14px; min-width: 300px;">
        <strong style="font-size: 16px; color: #007bff;">${stationName}</strong><br/>
        <strong>ID:</strong> ${stationId}<br/>
        <strong>Localité:</strong> ${localityName}<br/>
        <strong>Statut:</strong> ${stationInfo?.status || 'active'}<br/>
        <strong>Type:</strong> ${stationInfo?.type || 'fixe'}<br/>
    `;

    if (waterData) {
      const phStatus = typeof ph === 'number' ? (ph >= 6.5 && ph <= 8.5 ? '✅ Normal' : '⚠️ Hors norme') : 'N/A';
      const coliformesStatus = typeof coliformes === 'number' ? (coliformes <= 100 ? '✅ Normal' : '🚨 Élevé') : 'N/A';
      const dbo5Status = typeof dbo5 === 'number' ? (dbo5 <= 25 ? '✅ Normal' : '⚠️ Élevé') : 'N/A';

      popupContent += `
        <div style="margin-top: 8px; padding: 8px; background: #e8f4fd; border-radius: 4px;">
          <strong>💧 Qualité d'Eau:</strong><br/>
          🧪 <strong>pH:</strong> ${ph} (${phStatus})<br/>
          📈 <strong>DBO5:</strong> ${dbo5} mg/L (${dbo5Status})<br/>
          🦠 <strong>Coliformes:</strong> ${coliformes} CFU/100ml (${coliformesStatus})<br/>
          🔬 <strong>Nitrates:</strong> ${nitrates} mg/L<br/>
          🧪 <strong>Ammonium:</strong> ${ammonium} mg/L<br/>
          🧪 <strong>Phosphates:</strong> ${phosphates} mg/L
        </div>
      `;
    } else {
      popupContent += `
        <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <em>Aucune donnée de qualité d'eau disponible</em>
        </div>
      `;
    }

    if (alerts.length > 0) {
      popupContent += `
        <div style="margin-top: 8px; padding: 8px; background: #ffe6e6; border-radius: 4px;">
          <strong>🚨 Alertes (${alerts.length}):</strong><br/>
          ${alerts.slice(0, 3).map(alert => `• ${alert.message}`).join('<br/>')}
          ${alerts.length > 3 ? `<br/><em>... et ${alerts.length - 3} autres</em>` : ''}
        </div>
      `;
    }

    popupContent += `
        <br/>
        <small><em>Dernière mise à jour: ${new Date().toLocaleTimeString('fr-FR')}</em></small>
      </div>
    `;

    const existingMarker = this.stationMarkers.get(stationId);
    if (existingMarker) {
      existingMarker.setIcon(icon);
      existingMarker.setPopupContent(popupContent);
    } else {
      const marker = L.marker([location.lat, location.lon], { icon })
        .addTo(this.map!)
        .bindPopup(popupContent);

      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());

      this.stationMarkers.set(stationId, marker);
    }
  }

  private getDefaultLocation(stationId: string): { lat: number; lon: number; name: string } {
    const cityName = this.guessCityFromStationId(stationId);
    return this.cityCoordinates[cityName] || {
      lat: 14.7645,
      lon: -17.3660,
      name: 'Sanar'
    };
  }

  private setupRealTimeUpdates(): void {
    if (this.kuzzleService.subscribeToWaterQuality) {
      this.realTimeSubscription = this.kuzzleService.subscribeToWaterQuality((waterData: WaterQualityData) => {
        const stationId = waterData.body.id_station;
        const criticalAlerts = this.alerts.filter(alert =>
          alert.station === stationId &&
          (alert.severity === 'critical' || alert.severity === 'high')
        );
        const stationInfo = this.getStationInfo(stationId);
        this.addOrUpdateMarker(stationId, waterData, criticalAlerts, stationInfo);
      });
    }

    if (this.kuzzleService.subscribeToAlerts) {
      this.kuzzleService.subscribeToAlerts((alert: any) => {
        const stationId = alert._source.stationId;
        const stationWaterData = this.waterData.filter(w => w.body.id_station === stationId);
        const latestWaterData = stationWaterData.length > 0 ? stationWaterData[stationWaterData.length - 1] : undefined;
        const stationAlerts = this.alerts.filter(a => a.station === stationId);
        const stationInfo = this.getStationInfo(stationId);
        this.addOrUpdateMarker(stationId, latestWaterData, stationAlerts, stationInfo);
      });
    }
  }

  ngOnDestroy(): void {
    if (this.realTimeSubscription) {
      this.realTimeSubscription.unsubscribe();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  focusOnStation(stationId: string): void {
    const marker = this.stationMarkers.get(stationId);
    if (marker && this.map) {
      const latlng = marker.getLatLng();
      this.map.setView(latlng, 12);
      marker.openPopup();
    }
  }

  async refreshMarkers(): Promise<void> {
    this.stationMarkers.forEach(marker => this.map?.removeLayer(marker));
    this.stationMarkers.clear();
    await this.updateStationsFromData();
  }

  getDisplayedStations(): string[] {
    return Array.from(this.stationMarkers.keys());
  }

  getTotalStationsCount(): number {
    return this.stationMarkers.size;
  }
}
