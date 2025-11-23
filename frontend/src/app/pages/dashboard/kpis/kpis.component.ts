import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-kpis',
  imports: [CommonModule],
  templateUrl: './kpis.component.html',
  styleUrl: './kpis.component.css',
})
export class KpisComponent implements OnChanges {
  @Input() waterData: any[] = [];
  @Input() readingData: any[] = [];
  @Input() alerts: any[] = [];

  kpis = [
    {
      title: 'Stations',
      value: 0,
      icon: 'bi-geo-alt',
      trend: '+0%',
      trendIcon: 'bsb-rotate-n45 text-success',
      trendClass: 'bg-success-subtle text-success rounded-circle p-1',
      description: 'stations actives',
    },
    {
      title: 'Temp. Moyenne',
      value: '0°C',
      icon: 'bi-thermometer-half',
      trend: '+0°C',
      trendIcon: 'bsb-rotate-n45 text-warning',
      trendClass: 'bg-warning-subtle text-warning rounded-circle p-1',
      description: 'moyenne actuelle',
    },
    {
      title: 'Humidité Moy.',
      value: '0%',
      icon: 'bi-droplet-half',
      trend: '+0%',
      trendIcon: 'bsb-rotate-45 text-info',
      trendClass: 'bg-info-subtle text-info rounded-circle p-1',
      description: 'moyenne actuelle',
    },
    {
      title: 'Alertes',
      value: 0,
      icon: 'bi-exclamation-triangle',
      trend: '+0',
      trendIcon: 'bsb-rotate-45 text-danger',
      trendClass: 'bg-danger-subtle text-danger rounded-circle p-1',
      description: 'alertes actives',
    },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['waterData'] || changes['readingData'] || changes['alerts']) {
      this.updateKPIs();
    }
  }

  private updateKPIs(): void {
    // KPI 1: Nombre de stations uniques
    const uniqueStations = new Set([
      ...this.waterData.map(d => d.body.id_station),
      ...this.readingData.map(d => d.body.stationId)
    ]).size;

    // KPI 2: Température moyenne
    const validTemps = this.readingData
      .map(d => d.body.temperature)
      .filter(temp => temp != null && !isNaN(temp));
    const avgTemp = validTemps.length > 0
      ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1)
      : '0';

    // KPI 3: Humidité moyenne
    const validHumidities = this.readingData
      .map(d => d.body.humidity)
      .filter(hum => hum != null && !isNaN(hum));
    const avgHum = validHumidities.length > 0
      ? (validHumidities.reduce((a, b) => a + b, 0) / validHumidities.length).toFixed(1)
      : '0';

    // KPI 4: Nombre d'alertes
    const alertCount = this.alerts.length;

    this.kpis[0] = {
      ...this.kpis[0],
      value: uniqueStations,
      description: `stations actives`
    };

    this.kpis[1] = {
      ...this.kpis[1],
      value: `${avgTemp}°C`,
      trend: this.getTemperatureTrend(),
      description: `basé sur ${validTemps.length} mesures`
    };

    this.kpis[2] = {
      ...this.kpis[2],
      value: `${avgHum}%`,
      trend: this.getHumidityTrend(),
      description: `basé sur ${validHumidities.length} mesures`
    };

    this.kpis[3] = {
      ...this.kpis[3],
      value: alertCount,
      description: alertCount === 1 ? 'alerte active' : 'alertes actives'
    };
  }

  private getTemperatureTrend(): string {
    // Implémentez la logique de tendance basée sur les données historiques
    // Pour l'instant, retournez une valeur par défaut
    return '+0°C';
  }

  private getHumidityTrend(): string {
    // Implémentez la logique de tendance basée sur les données historiques
    // Pour l'instant, retournez une valeur par défaut
    return '+0%';
  }
}
