// backend/src/types/water-quality.types.ts
import { WaterQualityReading } from './water-quality.interface';

/**
 * Type pour le body d'un document water_quality
 */
export type WaterQualityDocument = WaterQualityReading['body'];

/**
 * Interface pour les données brutes du fichier Excel/CSV
 */
export interface RawWaterQualityData {
  [key: string]: any;
}

/**
 * Résultat du parsing de fichier
 */
export interface ParseResult {
  success: boolean;
  data: WaterQualityDocument[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    sheets: string[];
  };
}

/**
 * Résultat de l'ingestion
 */
export interface IngestionResult {
  success: boolean;
  inserted: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  duration: number;
}

/**
 * Options de parsing
 */
export interface ParseOptions {
  strictValidation?: boolean;
  skipEmptyRows?: boolean;
  defaultStation?: string;
  defaultPhase?: 'Entree' | 'Sortie';
}

/**
 * Mapping des colonnes Excel/CSV vers les champs du document
 */
export const COLUMN_MAPPING: Record<string, string> = {
  // Colonnes principales
  'id_station': 'id_station',
  'station': 'id_station',
  'Station': 'id_station',
  'ID Station': 'id_station',
  
  'phase': 'phase',
  'Phase': 'phase',
  
  'type_filtre': 'type_filtre',
  'Type_Filtre': 'type_filtre',
  'type filtre': 'type_filtre',
  'Type Filtre': 'type_filtre',
  
  'id_filtre': 'id_filtre',
  'ID_Filtre': 'id_filtre',
  'id filtre': 'id_filtre',
  'ID Filtre': 'id_filtre',
  
  'date': 'date',
  'Date': 'date',
  'Data': 'date',
  
  'mois': 'mois',
  'Mois': 'mois',
  
  // Paramètres physico-chimiques
  'temperature_c': 'temperature_c',
  'Temperature': 'temperature_c',
  'Temperature (ºC)': 'temperature_c',
  'Température': 'temperature_c',
  'Température (°C)': 'temperature_c',
  
  'ph': 'ph',
  'pH': 'ph',
  'PH': 'ph',
  
  'conductivite_us_cm': 'conductivite_us_cm',
  'Conductivité': 'conductivite_us_cm',
  'conductivité (µS/cm)': 'conductivite_us_cm',
  'Conductivite': 'conductivite_us_cm',
  
  'potentiel_redox_mv': 'potentiel_redox_mv',
  'Potentiel Redox': 'potentiel_redox_mv',
  'Potentiel Redox (mV)': 'potentiel_redox_mv',
  
  'dbo5_mg_l': 'dbo5_mg_l',
  'DBO5': 'dbo5_mg_l',
  'DBO5(mg/L)': 'dbo5_mg_l',
  'DBO5 (mg/L)': 'dbo5_mg_l',
  
  'dco_mg_l': 'dco_mg_l',
  'DCO': 'dco_mg_l',
  'DCO (mg/l)': 'dco_mg_l',
  'DCO (mg/L)': 'dco_mg_l',
  
  'mes_mg_l': 'mes_mg_l',
  'MES': 'mes_mg_l',
  'MeS (mg/L)': 'mes_mg_l',
  'MES (mg/L)': 'mes_mg_l',
  
  'mvs_pct': 'mvs_pct',
  'MVS': 'mvs_pct',
  'MVS (%)': 'mvs_pct',
  'MVS(%)': 'mvs_pct',
  
  'nitrates_mg_l': 'nitrates_mg_l',
  'Nitrates': 'nitrates_mg_l',
  'Nitrates (mgNO3-/l)': 'nitrates_mg_l',
  'Nitrates (mg/L)': 'nitrates_mg_l',
  
  'ammonium_mg_l': 'ammonium_mg_l',
  'Ammonium': 'ammonium_mg_l',
  'Ammonium (mgNH4-/l)': 'ammonium_mg_l',
  'Ammonium (mg/L)': 'ammonium_mg_l',
  
  'azote_total_mg_l': 'azote_total_mg_l',
  'Azote Total': 'azote_total_mg_l',
  'Azote kjeldahl (mgN/l)': 'azote_total_mg_l',
  'Azote Total (mg/L)': 'azote_total_mg_l',
  
  'phosphates_mg_l': 'phosphates_mg_l',
  'Phosphates': 'phosphates_mg_l',
  'Phosphates (mgPO4-/l)': 'phosphates_mg_l',
  'Phosphates (mg/L)': 'phosphates_mg_l',
  
  'coliformes_fecaux_cfu_100ml': 'coliformes_fecaux_cfu_100ml',
  'Coliformes Fécaux': 'coliformes_fecaux_cfu_100ml',
  'Coliformes fécaux (CFU/100ml)': 'coliformes_fecaux_cfu_100ml',
  'Coliformes Fecaux': 'coliformes_fecaux_cfu_100ml',
  
  'oeufs_helminthes': 'oeufs_helminthes',
  'Oeufs Helminthes': 'oeufs_helminthes',
  'Œufs Helminthes': 'oeufs_helminthes',
  
  'huiles_graisses': 'huiles_graisses',
  'Huiles et Graisses': 'huiles_graisses',
  'Huiles Graisses': 'huiles_graisses',
  
  'nom_feuille': 'nom_feuille',
  'Nom_Feuille': 'nom_feuille',
  'Nom Feuille': 'nom_feuille',
  
  'contient_valeurs_estimees': 'contient_valeurs_estimees',
  'Valeurs Estimées': 'contient_valeurs_estimees',
  'Valeurs Estimees': 'contient_valeurs_estimees'
};

/**
 * Champs obligatoires
 */
export const REQUIRED_FIELDS: (keyof WaterQualityDocument)[] = [
  'id_station', 
  'phase', 
  'date'
];

/**
 * Champs numériques
 */
export const NUMERIC_FIELDS: (keyof WaterQualityDocument)[] = [
  'temperature_c',
  'ph',
  'conductivite_us_cm',
  'potentiel_redox_mv',
  'dbo5_mg_l',
  'dco_mg_l',
  'mes_mg_l',
  'mvs_pct',
  'nitrates_mg_l',
  'ammonium_mg_l',
  'azote_total_mg_l',
  'phosphates_mg_l',
  'coliformes_fecaux_cfu_100ml',
  'oeufs_helminthes',
  'huiles_graisses'
];