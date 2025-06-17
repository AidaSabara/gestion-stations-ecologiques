import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { StationService } from '../../../core/services/station/station.service';

const greenIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const yellowIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent {
  private map: L.Map | undefined;
  private stationMarkers = new Map<string, L.Marker>();

  constructor(private stationService: StationService) {}

  async ngOnInit(): Promise<void> {
    this.initMap();

    const stations = await this.stationService.getStations();

    for (const station of stations) {
      const reading = await this.stationService.getLatestReading(station.id);
      const alert = await this.stationService.getLatestAlert(station.id);
      this.addOrUpdateMarker(station.id, station, reading, alert);
    }

    this.stationService.onNewReading(async (reading) => {
      const stationId = reading['stationId'];
      const station = await this.stationService.getStation(stationId);
      const alert = await this.stationService.getLatestAlert(stationId);
      if (station) this.addOrUpdateMarker(stationId, station, reading, alert);
    });

    this.stationService.onNewCriticalAlert(async (alert) => {
      const stationId = alert['stationId'];
      const station = await this.stationService.getStation(stationId);
      const reading = await this.stationService.getLatestReading(stationId);
      if (station) this.addOrUpdateMarker(stationId, station, reading, alert);
    });
  }

  private initMap(): void {
    this.map = L.map('map').setView([14.5, -14.5], 6);
    const bounds = L.latLngBounds([12.3, -17.6], [16.7, -11.3]);
    this.map.fitBounds(bounds);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private addOrUpdateMarker(
    stationId: string,
    station: any,
    reading?: any,
    alert?: any
  ): void {
    const loc = station.location;
    const name = station.name;
    const temp = reading?.temperature ?? 'N/A';
    const hum = reading?.humidity ?? 'N/A';

    let icon = greenIcon;
    if (typeof temp === 'number') {
      if (temp > 35) icon = redIcon;
      else if (temp >= 30) icon = yellowIcon;
    }

    const alertMsg =
      alert?.level === 'critical'
        ? `<br/>🚨 <strong style="color:red">Alerte critique :</strong> ${alert.message}`
        : '';

    const popupContent = `
      <div style="font-size: 14px;">
        <strong style="font-size: 16px; color: #007bff;">${name}</strong><br/>
        🌡️ <strong>Température :</strong> ${temp} °C<br/>
        💧 <strong>Humidité :</strong> ${hum} %${alertMsg}
      </div>
    `;

    const existingMarker = this.stationMarkers.get(stationId);
    if (existingMarker) {
      existingMarker.setIcon(icon);
      existingMarker.setPopupContent(popupContent);
    } else {
      const marker = L.marker([loc.lat, loc.lon], { icon })
        .addTo(this.map!)
        .bindPopup(popupContent);
      this.stationMarkers.set(stationId, marker);
    }
  }
}
