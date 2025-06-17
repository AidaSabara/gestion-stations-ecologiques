import { Component, OnInit } from '@angular/core';
import { ChartOptions, ChartType } from 'chart.js';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { NgChartsModule } from 'ng2-charts';

@Component({
  selector: 'app-temperature-chart',
  standalone: true, // ✅ si tu es en standalone
  imports: [NgChartsModule],
  templateUrl: './temperature-chart.component.html',
  styleUrls: ['./temperature-chart.component.css'],
})
export class TemperatureChartComponent implements OnInit {
  public labels: string[] = [];
  public chartData: any[] = []; // ✅ doit être recréé après fetch
  public chartType: ChartType = 'line';

  public chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Température moyenne des 7 derniers jours',
      },
    },
  };

  private kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));

  async ngOnInit(): Promise<void> {
    await this.kuzzle.connect();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const result = await this.kuzzle.document.search('iot', 'readings', {
      size: 1000,
      query: {
        range: {
          timestamp: {
            gte: startDate.toISOString(),
            lte: endDate.toISOString(),
          },
        },
      },
    });

    const tempsByDate: Record<string, number[]> = {};

    for (const doc of result.hits) {
      const date = doc._source['timestamp'].split('T')[0];
      if (!tempsByDate[date]) tempsByDate[date] = [];
      if (typeof doc._source['temperature'] === 'number') {
        tempsByDate[date].push(doc._source['temperature']);
      }
    }

    // ✅ Reconstruire labels et chartData
    this.labels = Object.keys(tempsByDate).sort();
    const values = this.labels.map(date => {
      const temps = tempsByDate[date];
      return temps.reduce((acc, val) => acc + val, 0) / temps.length;
    });

    this.chartData = [
      {
        data: values,
        label: 'Température (°C)',
        fill: true,
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.3,
      },
    ];
  }
}
