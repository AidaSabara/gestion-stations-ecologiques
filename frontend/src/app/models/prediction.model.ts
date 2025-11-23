// src/app/models/prediction.model.ts
export interface Prediction {
  entree: number;
  sortie_predite: number;
  rendement_predit: number;
  methode: 'ML' | 'Fallback (moyenne)';
  fiabilite: 'haute' | 'moyenne' | 'limitée';
  r2?: number;
  confiance?: string;
}

export interface PredictionResult {
  dco_mg_l?: Prediction;
  dbo5_mg_l?: Prediction;
  mes_mg_l?: Prediction;
}

export interface AlerteAnalyse {
  conforme: boolean;
  alertes: AlerteDepassement[];
  niveau_global: 'CONFORME' | 'ATTENTION' | 'ALERTE' | 'CRITIQUE';
}

export interface AlerteDepassement {
  parametre: string;
  valeur_predite: number;
  seuil: number;
  niveau: string;
  action: string;
}
