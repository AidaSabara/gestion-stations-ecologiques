import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-resume',
  imports: [CommonModule],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.css',
})
export class ResumeComponent implements OnChanges {
  @Input() waterData: any[] = [];
  @Input() readingData: any[] = [];
  @Input() alerts: any[] = [];

  stats = [
    {
      label: 'Échantillons analysés',
      value: '0',
      icon: 'bi-droplet-fill',
      detail: 'Données de qualité d\'eau',
    },
    {
      label: 'Température moyenne',
      value: '0°C',
      icon: 'bi-thermometer-half',
      detail: 'Calculée en temps réel',
    },
    {
      label: 'Humidité moyenne',
      value: '0%',
      icon: 'bi-droplet',
      detail: 'Moyenne des stations',
    },
    {
      label: 'Valeurs anormales',
      value: '0',
      icon: 'bi-exclamation-triangle',
      detail: 'pH hors norme détectés',
    },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['waterData'] || changes['readingData']) {
      this.updateStats();
    }
  }

  private updateStats(): void {
    // Stat 1: Nombre d'échantillons d'eau analysés
    const totalSamples = this.waterData.length;

    // Stat 2: Température moyenne
    const validTemps = this.readingData
      .map(d => d.body.temperature)
      .filter(temp => temp != null && !isNaN(temp));
    const avgTemp = validTemps.length > 0
      ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1)
      : '0';

    // Stat 3: Humidité moyenne
    const validHumidities = this.readingData
      .map(d => d.body.humidity)
      .filter(hum => hum != null && !isNaN(hum));
    const avgHum = validHumidities.length > 0
      ? (validHumidities.reduce((a, b) => a + b, 0) / validHumidities.length).toFixed(1)
      : '0';

    // Stat 4: Valeurs de pH anormales
    const abnormalPH = this.waterData.filter(d =>
      d.body.ph !== null && (d.body.ph < 6.5 || d.body.ph > 8.5)
    ).length;

    this.stats[0] = {
      label: 'Échantillons analysés',
      value: totalSamples.toString(),
      icon: 'bi-droplet-fill',
      detail: 'Données de qualité d\'eau'
    };

    this.stats[1] = {
      label: 'Température moyenne',
      value: `${avgTemp}°C`,
      icon: 'bi-thermometer-half',
      detail: `Basé sur ${validTemps.length} mesures`
    };

    this.stats[2] = {
      label: 'Humidité moyenne',
      value: `${avgHum}%`,
      icon: 'bi-droplet',
      detail: `Basé sur ${validHumidities.length} mesures`
    };

    this.stats[3] = {
      label: 'Valeurs anormales',
      value: abnormalPH.toString(),
      icon: 'bi-exclamation-triangle',
      detail: 'pH hors norme détectés'
    };
  }
}
