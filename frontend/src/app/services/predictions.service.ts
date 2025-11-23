// src/app/services/predictions.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { Alert, AlertStats, AlertMetadata, AlertLevel } from '../models/alert.model';
import { PredictionResult } from '../models/prediction.model';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private kuzzle: Kuzzle;
  private alertesSubject = new BehaviorSubject<Alert[]>([]);
  public alertes$ = this.alertesSubject.asObservable();

  private statsSubject = new BehaviorSubject<AlertStats>({
    total_alertes: 0,
    alertes_critiques: 0,
    alertes_warning: 0,
    alertes_info: 0,
    predictions_conformes: 0,
    predictions_non_conformes: 0,
    taux_conformite: 0
  });
  public stats$ = this.statsSubject.asObservable();

  private roomId: string | null = null;

  constructor() {
    this.kuzzle = new Kuzzle(
      new WebSocket('localhost', { port: 7512 })
    );
  }

  // ==========================================
  // CONNEXION
  // ==========================================

  async connect(): Promise<void> {
    try {
      await this.kuzzle.connect();
      console.log('✅ Service Prédictions connecté à Kuzzle');
      await this.loadAlertes();
      await this.subscribeToAlertes();
    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.kuzzle) {
      this.kuzzle.disconnect();
    }
  }

  // ==========================================
  // CHARGEMENT ALERTES
  // ==========================================

  async loadAlertes(): Promise<void> {
  try {
    const result = await this.kuzzle.document.search(
      'iot',
      'alerts',
      {
        query: {
          term: { resolved: false }
        },
        sort: [{ timestamp: 'desc' }]
      },
      { size: 100 }
    );

    // Correction : mapper les résultats Kuzzle vers votre interface Alert
    const alertes: Alert[] = result.hits.map((hit: any) => ({
      _id: hit._id,
      _source: {
        stationId: hit._source.stationId,
        type: hit._source.type,
        level: hit._source.level,
        message: hit._source.message,
        timestamp: hit._source.timestamp,
        resolved: hit._source.resolved || false,
        acknowledged: hit._source.acknowledged || false,
        acknowledged_at: hit._source.acknowledged_at,
        acknowledged_by: hit._source.acknowledged_by,
        parameter: hit._source.parameter,
        value: hit._source.value,
        threshold: hit._source.threshold,
        metadata: hit._source.metadata ? {
          predictive: hit._source.metadata.predictive,
          groupe_filtre: hit._source.metadata.groupe_filtre,
          methode_prediction: hit._source.metadata.methode_prediction,
          predictions: hit._source.metadata.predictions,
          alertes: hit._source.metadata.alertes,
          timestamp_analyse: hit._source.metadata.timestamp_analyse,
          modele_utilise: hit._source.metadata.modele_utilise
        } : undefined
      }
    }));

    this.alertesSubject.next(alertes);
    this.updateStats(alertes);

  } catch (error) {
    console.error('Erreur chargement alertes:', error);
    throw error;
  }
}
  // ==========================================
  // ABONNEMENT TEMPS RÉEL
  // ==========================================

 async subscribeToAlertes(): Promise<void> {
  try {
    this.roomId = await this.kuzzle.realtime.subscribe(
      'iot',
      'alerts',
      { equals: { resolved: false } },
      (notification: any) => {
        if (notification.action === 'create') {
          console.log('🚨 Nouvelle alerte reçue');

          // Mapper la nouvelle alerte
          const hit = notification.result;
          const newAlert: Alert = {
            _id: hit._id,
            _source: {
              stationId: hit._source.stationId,
              type: hit._source.type,
              level: hit._source.level,
              message: hit._source.message,
              timestamp: hit._source.timestamp,
              resolved: hit._source.resolved || false,
              acknowledged: hit._source.acknowledged || false,
              acknowledged_at: hit._source.acknowledged_at,
              acknowledged_by: hit._source.acknowledged_by,
              parameter: hit._source.parameter,
              value: hit._source.value,
              threshold: hit._source.threshold,
              metadata: hit._source.metadata ? {
                predictive: hit._source.metadata.predictive,
                groupe_filtre: hit._source.metadata.groupe_filtre,
                methode_prediction: hit._source.metadata.methode_prediction,
                predictions: hit._source.metadata.predictions,
                alertes: hit._source.metadata.alertes,
                timestamp_analyse: hit._source.metadata.timestamp_analyse,
                modele_utilise: hit._source.metadata.modele_utilise
              } : undefined
            }
          };

          const currentAlertes = this.alertesSubject.value;
          const newAlertes = [newAlert, ...currentAlertes];

          this.alertesSubject.next(newAlertes);
          this.updateStats(newAlertes);

          this.showBrowserNotification(newAlert);
        }
      }
    );

    console.log('✅ Abonné aux alertes temps réel');
  } catch (error) {
    console.error('Erreur abonnement alertes:', error);
  }
}
  // ==========================================
  // STATISTIQUES
  // ==========================================

  private updateStats(alertes: Alert[]): void {
    const stats: AlertStats = {
      total_alertes: alertes.length,
      alertes_critiques: alertes.filter(a => a._source.level === 'critical').length,
      alertes_warning: alertes.filter(a => a._source.level === 'warning').length,
      alertes_info: alertes.filter(a => a._source.level === 'info').length,
      predictions_conformes: 0,
      predictions_non_conformes: 0,
      taux_conformite: 0
    };

    // Calculer conformité pour alertes préventives
    const alertesPreventives = alertes.filter(
      a => a._source.metadata?.predictive === true
    );

    stats.predictions_non_conformes = alertesPreventives.length;

    // Estimation : si X alertes, environ 3X prédictions totales
    const totalEstime = Math.max(stats.predictions_non_conformes * 3, 10);
    stats.predictions_conformes = totalEstime - stats.predictions_non_conformes;
    stats.taux_conformite = Math.round(
      (stats.predictions_conformes / totalEstime) * 100
    );

    this.statsSubject.next(stats);
  }

  // ==========================================
  // ACTIONS SUR ALERTES
  // ==========================================

  async acknowledgeAlert(alertId: string, userId: string = 'current_user'): Promise<void> {
    try {
      await this.kuzzle.document.update(
        'iot',
        'alerts',
        alertId,
        {
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId
        }
      );

      console.log('✅ Alerte accusée');
      await this.loadAlertes();
    } catch (error) {
      console.error('Erreur:', error);
      throw error;
    }
  }

  async resolveAlert(alertId: string, userId: string = 'current_user', notes?: string): Promise<void> {
    try {
      await this.kuzzle.document.update(
        'iot',
        'alerts',
        alertId,
        {
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes || ''
        }
      );

      console.log('✅ Alerte résolue');

      // Retirer de la liste locale
      const currentAlertes = this.alertesSubject.value;
      const updatedAlertes = currentAlertes.filter(a => a._id !== alertId);
      this.alertesSubject.next(updatedAlertes);
      this.updateStats(updatedAlertes);

    } catch (error) {
      console.error('Erreur:', error);
      throw error;
    }
  }

  // ==========================================
  // FILTRAGE
  // ==========================================

  getAlertesPreventives(): Alert[] {
    return this.alertesSubject.value.filter(
      a => a._source.metadata?.predictive === true
    );
  }

  getAlertesReactives(): Alert[] {
    return this.alertesSubject.value.filter(
      a => a._source.metadata?.predictive !== true
    );
  }

  getAlertesByFiltre(filtre: string): Alert[] {
    if (filtre === 'TOUS') {
      return this.alertesSubject.value;
    }

    return this.alertesSubject.value.filter(
      a => a._source.metadata?.groupe_filtre === filtre
    );
  }

  getAlertesByLevel(level: string): Alert[] {
    return this.alertesSubject.value.filter(
      a => a._source.level === level
    );
  }

  // ==========================================
  // NOTIFICATIONS NAVIGATEUR
  // ==========================================

  private showBrowserNotification(alert: Alert): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Nouvelle Alerte - Station Sanar', {
        body: alert._source.message,
        icon: '/assets/favicon/favicon-512x512.png',
        badge: '/assets/favicon/favicon-512x512.png',
        tag: alert._id,
        requireInteraction: alert._source.level === 'critical'
      });
    }
  }

  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Permission notifications:', permission);
      });
    }
  }

  // ==========================================
  // HELPERS - CORRECTION DES TYPES
  // ==========================================

  getLevelColor(level: string): string {
    const colors: Record<string, string> = {
      'critical': 'danger',
      'warning': 'warning',
      'info': 'info'
    };
    return colors[level] || 'secondary';
  }

  getLevelIcon(level: string): string {
    const icons: Record<string, string> = {
      'critical': '⚠️',
      'warning': '🟡',
      'info': '🔵'
    };
    return icons[level] || '⚪';
  }

  getMethodeIcon(methode: string): string {
    return methode === 'ML' ? '🤖' : '📊';
  }
}
