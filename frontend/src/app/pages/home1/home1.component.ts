import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';

@Component({
  selector: 'app-home1',
  imports: [CommonModule, RouterModule],
  templateUrl: './home1.component.html',
  styleUrl: './home1.component.css'
})
export class Home1Component implements OnInit {
  stats = {
    totalStations: 0,
    activeStations: 0,
    alertStations: 0
  };

  isLoading = true;

  constructor(private kuzzleService: KuzzleService) {}

  async ngOnInit() {
    await this.loadStats();
  }

  private async loadStats() {
    try {
      const stations = await this.kuzzleService.getStations();
      this.stats.totalStations = stations.length;
      // Vous pouvez ajouter d'autres stats si nécessaire
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      this.isLoading = false;
    }
  }

}
