import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-resume',
  imports: [CommonModule],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.css',
})
export class ResumeComponent {
  stats = [
    {
      label: 'Stations actives',
      value: '12',
      icon: 'bi-map',
      detail: 'Données collectées en temps réel',
    },
    {
      label: 'Température moyenne',
      value: '28.7 °C',
      icon: 'bi-thermometer-half',
      detail: 'Calculée sur 24h',
    },
    {
      label: 'Humidité moyenne',
      value: '61%',
      icon: 'bi-droplet',
      detail: 'Sur l’ensemble du pays',
    },
    {
      label: 'Alertes',
      value: '3',
      icon: 'bi-exclamation-triangle',
      detail: 'Zones critiques',
    },
  ];
}
