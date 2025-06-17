import { Component } from '@angular/core';
import { MapComponent } from './map/map.component';
import { CommonModule } from '@angular/common';
import { ResumeComponent } from './resume/resume.component';
import { RouterLink } from '@angular/router';
import { KpisComponent } from './kpis/kpis.component';
import { Chart } from 'chart.js';
import { TemperatureChartComponent } from "./temperature-chart/temperature-chart.component";

@Component({
  selector: 'app-dashboard',
  imports: [
    MapComponent,
    CommonModule,
    ResumeComponent,
    RouterLink,
    KpisComponent,
    TemperatureChartComponent
],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  ngAfterViewInit(): void {
    new Chart('temperatureChart', {
      type: 'line',
      data: {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [
          {
            label: 'Température (°C)',
            data: [28, 30, 29, 32, 31, 33, 30],
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.3,
          },
        ],
      },
    });

    new Chart('humidityChart', {
      type: 'doughnut',
      data: {
        labels: ['Nord', 'Sud', 'Est', 'Ouest'],
        datasets: [
          {
            label: 'Humidité (%)',
            data: [70, 75, 60, 80],
            backgroundColor: [
              'rgb(54, 162, 235)',
              'rgb(75, 192, 192)',
              'rgb(153, 102, 255)',
              'rgb(255, 205, 86)',
            ],
          },
        ],
      },
    });
  }

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

  events = [
    {
      time: 'il y a 15 minutes',
      title: 'Station #3 dépasse 35°C',
      detail: 'Température anormale détectée',
    },
    {
      time: 'il y a 1 heure',
      title: 'Nouvelle station ajoutée',
      detail: 'Station : Ziguinchor',
    },
    {
      time: 'hier',
      title: 'Humidité basse détectée',
      detail: 'Station : Matam',
    },
  ];
}
