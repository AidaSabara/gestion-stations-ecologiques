// src/app/pages/predictions/predictions.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictionsService } from '../../services/predictions.service';
import { Alert, AlertStats } from '../../models/alert.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictions.component.html',
  styleUrls: ['./predictions.component.css']
})
export class PredictionsComponent implements OnInit, OnDestroy {

  // Données
  alertes: Alert[] = [];
  alertesPreventives: Alert[] = [];
  alertesReactives: Alert[] = [];
  stats: AlertStats;

  // Filtres
  filtreSelectionne = 'TOUS';
  filtres = ['TOUS', 'FV1', 'FV2', 'FH'];

  // UI
  loading = true;
  error: string | null = null;
  derniereMaj = new Date();

  private subscriptions: Subscription[] = [];

  constructor(private predictionsService: PredictionsService) {
    this.stats = {
      total_alertes: 0,
      alertes_critiques: 0,
      alertes_warning: 0,
      alertes_info: 0,
      predictions_conformes: 0,
      predictions_non_conformes: 0,
      taux_conformite: 0
    };
  }

  async ngOnInit() {
    // Demander permission notifications
    this.predictionsService.requestNotificationPermission();

    try {
      // Connecter à Kuzzle
      await this.predictionsService.connect();

      // S'abonner aux alertes
      const alertesSub = this.predictionsService.alertes$.subscribe(alertes => {
        this.alertes = alertes;
        this.alertesPreventives = this.predictionsService.getAlertesPreventives();
        this.alertesReactives = this.predictionsService.getAlertesReactives();
        this.derniereMaj = new Date();
      });

      // S'abonner aux stats
      const statsSub = this.predictionsService.stats$.subscribe(stats => {
        this.stats = stats;
      });

      this.subscriptions.push(alertesSub, statsSub);
      this.loading = false;

    } catch (err: any) {
      this.error = 'Erreur de connexion: ' + err.message;
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.predictionsService.disconnect();
  }

  // Actions
  async refresh() {
    this.loading = true;
    try {
      await this.predictionsService.loadAlertes();
    } finally {
      this.loading = false;
    }
  }

  async accuserReception(alerte: Alert) {
    try {
      await this.predictionsService.acknowledgeAlert(alerte._id);
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de l\'accusé de réception');
    }
  }

  async resoudreAlerte(alerte: Alert) {
    const notes = prompt('Notes de résolution (optionnel):');
    try {
      await this.predictionsService.resolveAlert(alerte._id, 'current_user', notes || undefined);
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la résolution');
    }
  }

  // Filtrage
  get alertesFiltrees(): Alert[] {
    return this.predictionsService.getAlertesByFiltre(this.filtreSelectionne);
  }
  getPredictionsArray(predictions: any): Array<{key: string, value: any}> {
    if (!predictions) return [];

    return Object.entries(predictions)
      .filter(([key, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({ key, value }));
  }
  // UI Helpers
  getLevelClass(level: string): string {
    const classes: Record<string, string> = {
      'critical': 'alert-critical',
      'warning': 'alert-warning',
      'info': 'alert-info'
    };
    return classes[level] || 'alert-default';
  }

  getLevelIcon(level: string): string {
    return this.predictionsService.getLevelIcon(level);
  }

getMethodeIcon(methode?: string): string {
    return methode === 'ML' ? '🤖' : '📊';
  }
formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date invalide';
    }
  }
  getParamDisplay(param: string): string {
    return param.replace('_mg_l', '').toUpperCase();
  }

}
