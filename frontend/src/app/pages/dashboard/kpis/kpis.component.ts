import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-kpis',
  imports: [CommonModule],
  templateUrl: './kpis.component.html',
  styleUrl: './kpis.component.css',
})
export class KpisComponent {
  kpis = [
    {
      title: 'Stations',
      value: 12,
      icon: 'bi-geo-alt',
      trend: '+5%',
      trendIcon: 'bsb-rotate-n45 text-success',
      trendClass: 'bg-success-subtle text-success rounded-circle p-1',
      description: 'depuis la semaine dernière',
    },
    {
      title: 'Temp. Moyenne',
      value: '29°C',
      icon: 'bi-thermometer-half',
      trend: '+1°C',
      trendIcon: 'bsb-rotate-n45 text-warning',
      trendClass: 'bg-warning-subtle text-warning rounded-circle p-1',
      description: 'variation moyenne',
    },
    {
      title: 'Humidité Moy.',
      value: '75%',
      icon: 'bi-droplet-half',
      trend: '-3%',
      trendIcon: 'bsb-rotate-45 text-danger',
      trendClass: 'bg-danger-subtle text-danger rounded-circle p-1',
      description: 'sur 7 jours',
    },
    {
      title: 'Alertes',
      value: 3,
      icon: 'bi-exclamation-triangle',
      trend: '+1',
      trendIcon: 'bsb-rotate-45 text-danger',
      trendClass: 'bg-danger-subtle text-danger rounded-circle p-1',
      description: 'nouvelle alerte',
    },
  ];
}
