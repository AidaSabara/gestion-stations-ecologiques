/*
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KuzzleService } from '../../kuzzle.service';

interface Station {
  _id: string;
  _source?: { name: string; [key: string]: any; };
  body?: { name: string; [key: string]: any; };
}

@Component({
  selector: 'app-alert-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './alert-history.component.html',
  styleUrls: ['./alert-history.component.css']
})
export class AlertHistoryComponent implements OnInit {
  historique: HistoriqueAlerte[] = [];
  filteredHistorique: HistoriqueAlerte[] = [];
  isLoading = true;

  // Filtres
  filterStation: string = 'all';
  filterStatut: string = 'all';
  filterSeverity: string = 'all';
  filterDateDebut: string = '';
  filterDateFin: string = '';
  searchTerm: string = '';

  // Contexte station
  stationId: string | null = null;
  stationName: string = '';
  isStationSpecific: boolean = false;

  // Stations disponibles
  private stations: Map<string, string> = new Map();

  // Statistiques
  /*stats = {
    total: 0,
    resolues: 0,
    resoluesAvecIntervention: 0,
    faussesAlertes: 0,
    dureeeMoyenne: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  constructor(
    private kuzzleService: KuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    // Récupérer le station ID depuis l'URL (optionnel)
    this.stationId = this.route.snapshot.paramMap.get('id');
    this.isStationSpecific = !!this.stationId;

    console.log('📍 Station ID:', this.stationId);

    await this.loadStations();

    if (this.stationId) {
      this.stationName = this.stations.get(this.stationId) || 'Station';
      this.filterStation = this.stationId;
    }

    // Définir la plage de dates par défaut (30 derniers jours)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.filterDateFin = this.formatDateForInput(now);
    this.filterDateDebut = this.formatDateForInput(thirtyDaysAgo);

    await this.loadHistorique();
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async loadStations() {
    try {
      const stationsData = await this.kuzzleService.getStations();
      stationsData.forEach((station: Station) => {
        const source: { name?: string } = station._source || station.body || {};
        this.stations.set(station._id, source.name || station._id);
      });
      console.log('✅ Stations chargées:', this.stations.size);
    } catch (error) {
      console.error('❌ Erreur chargement stations:', error);
    }
  }

  async loadHistorique() {
    try {
      this.isLoading = true;
      console.log('🔄 Chargement historique...');

      const dateDebut = this.filterDateDebut ? new Date(this.filterDateDebut).toISOString() : undefined;
      const dateFin = this.filterDateFin ? new Date(this.filterDateFin + 'T23:59:59').toISOString() : undefined;

      this.historique = await this.kuzzleService.getHistoriqueAlertes(
        this.filterStation === 'all' ? undefined : this.filterStation,
        dateDebut,
        dateFin
      );

      console.log('✅ Historique chargé:', this.historique.length, 'alertes');

      this.calculateStats();
      this.applyFilters();
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters() {
    let filtered = [...this.historique];

    // Filtre par statut
    if (this.filterStatut !== 'all') {
      filtered = filtered.filter(h => h.statut === this.filterStatut);
    }

    // Filtre par sévérité
    if (this.filterSeverity !== 'all') {
      filtered = filtered.filter(h => h.niveau_gravite === this.filterSeverity);
    }

    // Filtre par recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(h =>
        h.type_alerte.toLowerCase().includes(term) ||
        h.parametre_concerne.toLowerCase().includes(term) ||
        h.operateur?.toLowerCase().includes(term) ||
        h.notes?.toLowerCase().includes(term)
      );
    }

    // Trier par date (plus récent d'abord)
    filtered.sort((a, b) => {
      const dateA = new Date(a.date_detection).getTime();
      const dateB = new Date(b.date_detection).getTime();
      return dateB - dateA;
    });

    this.filteredHistorique = filtered;
    console.log('🔍 Alertes filtrées:', this.filteredHistorique.length);
  }

  calculateStats() {
    this.stats = {
      total: this.historique.length,
      resolues: this.historique.filter(h => h.statut === 'Résolu').length,
      resoluesAvecIntervention: this.historique.filter(h => h.statut === 'Résolu avec intervention').length,
      faussesAlertes: this.historique.filter(h => h.statut === 'Fausse alerte').length,
      dureeeMoyenne: 0,
      critical: this.historique.filter(h => h.niveau_gravite === 'critical').length,
      high: this.historique.filter(h => h.niveau_gravite === 'high').length,
      medium: this.historique.filter(h => h.niveau_gravite === 'medium').length,
      low: this.historique.filter(h => h.niveau_gravite === 'low' || h.niveau_gravite === 'warning').length
    };

    // Calculer durée moyenne de résolution
    const alertesResolues = this.historique.filter(h => h.duree_resolution_minutes);
    if (alertesResolues.length > 0) {
      const totalMinutes = alertesResolues.reduce((sum, h) => sum + (h.duree_resolution_minutes || 0), 0);
      this.stats.dureeeMoyenne = Math.round(totalMinutes / alertesResolues.length);
    }
  }

  getStationName(stationId: string): string {
    return this.stations.get(stationId) || stationId;
  }

  getSeverityClass(severity: string): string {
    const classes: any = {
      critical: 'bg-danger',
      high: 'bg-warning text-dark',
      medium: 'bg-info',
      low: 'bg-secondary',
      warning: 'bg-warning text-dark',
      info: 'bg-primary'
    };
    return classes[severity] || 'bg-secondary';
  }

  getStatutClass(statut: string): string {
    const classes: any = {
      'Actif': 'bg-danger',
      'Résolu': 'bg-success',
      'Résolu avec intervention': 'bg-primary',
      'Fausse alerte': 'bg-secondary'
    };
    return classes[statut] || 'bg-secondary';
  }

  formatDuration(minutes?: number): string {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}min`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}j ${remainingHours}h`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  exportToCSV() {
    const headers = [
      'ID Alerte',
      'Station',
      'Type',
      'Sévérité',
      'Paramètre',
      'Valeur',
      'Seuil',
      'Date Détection',
      'Date Résolution',
      'Durée (min)',
      'Statut',
      'Opérateur',
      'Action Corrective',
      'Notes'
    ];

    const rows = this.filteredHistorique.map(h => [
      h.alert_id,
      this.getStationName(h.id_station),
      h.type_alerte,
      h.niveau_gravite,
      h.parametre_concerne,
      h.valeur_mesuree,
      h.seuil_depasse,
      this.formatDate(h.date_detection),
      h.date_resolution ? this.formatDate(h.date_resolution) : 'N/A',
      h.duree_resolution_minutes || 'N/A',
      h.statut,
      h.operateur || 'N/A',
      h.action_corrective || 'N/A',
      h.notes || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique_alertes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  goBack() {
    if (this.stationId) {
      this.router.navigate(['/station', this.stationId]);
    } else {
      this.router.navigate(['/alerts']);
    }
  }

  get stationsArray() {
    return Array.from(this.stations.entries()).map(([id, name]) => ({ id, name }));
  }
}
*/
