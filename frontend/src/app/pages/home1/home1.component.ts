import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { KuzzleService } from '../../kuzzle.service';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-home1',
  standalone: true,
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

  // Propriétés utilisateur
  currentUserRole: 'admin' | 'supervisor' | 'agent' = 'agent';
  currentUserStationId: string | null = null;

  constructor(
    private kuzzleService: KuzzleService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.loadUserInfo();
    await this.loadStats();
  }

  // Charger les infos utilisateur
  private loadUserInfo(): void {
    const user = this.authService.getCurrentUser();

    if (user) {
      this.currentUserRole = user.role;
      this.currentUserStationId = user.station_id;

      console.log('👤 Home1 - Utilisateur:', user.email);
      console.log('🎭 Rôle:', this.currentUserRole);
      console.log('🏭 Station ID:', this.currentUserStationId);
    }
  }

  private async loadStats() {
    try {
      const stations = await this.kuzzleService.getStations();
      this.stats.totalStations = stations.length;
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Navigation intelligente vers carte/station
  exploreMap(): void {
    if (this.currentUserRole === 'admin') {
      // Admin → Carte complète
      console.log('🗺️ Navigation vers carte complète (admin)');
      this.router.navigate(['/map']);
    } else {
      // Agent/Supervisor → Station spécifique
      if (this.currentUserStationId) {
        console.log('📍 Navigation vers station:', this.currentUserStationId);
        this.router.navigate(['/station', this.currentUserStationId]);
      } else {
        console.error('❌ Aucune station_id pour cet utilisateur');
        alert('Erreur : Aucune station associée à votre compte. Contactez l\'administrateur.');
      }
    }
  }
}
