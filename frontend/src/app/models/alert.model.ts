// src/app/models/alert.model.ts
import { PredictionResult } from './prediction.model';

export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertType = 'seuil dépassé' | 'prédiction_dépassement' | 'défaillance d\'équipement';

export interface Alert {
  _id: string;
  _source: AlertSource;
}

export interface AlertSource {
  stationId: string;
  type: AlertType;
  level: AlertLevel;
  message: string;
  timestamp: string;
  resolved: boolean;
  acknowledged?: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  metadata?: AlertMetadata;
}

export interface AlertMetadata {
  predictive?: boolean;
  groupe_filtre?: string;
  methode_prediction?: 'ML' | 'Fallback';
  predictions?: PredictionResult;
  alertes?: AlerteDepassement[];
  timestamp_analyse?: string;
  modele_utilise?: string;
}

export interface AlertStats {
  total_alertes: number;
  alertes_critiques: number;
  alertes_warning: number;
  alertes_info: number;
  predictions_conformes: number;
  predictions_non_conformes: number;
  taux_conformite: number;
}

// Interface manquante pour AlerteDepassement
export interface AlerteDepassement {
  parametre: string;
  valeur_predite: number;
  seuil: number;
  niveau: string;
  action: string;
}
