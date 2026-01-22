// frontend/src/app/services/water-quality.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface WaterQualityDocument {
  id_station: string;
  phase: 'Entree' | 'Sortie';
  type_filtre?: string;
  id_filtre?: string;
  date: string;
  mois?: string;
  temperature_c?: number | null;
  ph?: number | null;
  conductivite_us_cm?: number | null;
  potentiel_redox_mv?: number | null;
  dbo5_mg_l?: number | null;
  dco_mg_l?: number | null;
  mes_mg_l?: number | null;
  mvs_pct?: number | null;
  nitrates_mg_l?: number | null;
  ammonium_mg_l?: number | null;
  azote_total_mg_l?: number | null;
  phosphates_mg_l?: number | null;
  coliformes_fecaux_cfu_100ml?: number | null;
  oeufs_helminthes?: number | null;
  huiles_graisses?: number | null;
  nom_feuille?: string;
  contient_valeurs_estimees?: boolean;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    parsing: {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      sheets: string[];
      warnings: string[];
    };
    ingestion: {
      inserted: number;
      failed: number;
      duration: number;
      errors: Array<{ row: number; error: string }>;
    };
  };
}

export interface StatsResponse {
  success: boolean;
  data: {
    stationId: string;
    totalMeasurements: number;
    latestMeasurements: any[];
  };
}

export interface DataResponse {
  success: boolean;
  count: number;
  data: WaterQualityDocument[];
}

@Injectable({
  providedIn: 'root'
})
export class WaterQualityService {
  private readonly apiUrl = `${environment.apiUrl}/water-quality`;

  constructor(private http: HttpClient) {
    console.log('🔗 Water Quality Service initialized with API:', this.apiUrl);
  }

  /**
   * Upload un fichier Excel/CSV
   */
  uploadFile(
    file: File,
    options?: {
      defaultStation?: string;
      defaultPhase?: 'Entree' | 'Sortie';
      strictValidation?: boolean;
    }
  ): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.defaultStation) {
      formData.append('defaultStation', options.defaultStation);
    }
    if (options?.defaultPhase) {
      formData.append('defaultPhase', options.defaultPhase);
    }
    if (options?.strictValidation !== undefined) {
      formData.append('strictValidation', String(options.strictValidation));
    }

    console.log('📤 Envoi du fichier vers:', `${this.apiUrl}/upload`);
    console.log('📦 Options:', options);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  /**
   * Crée une mesure manuelle
   */
  createManual(document: WaterQualityDocument): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, document, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }

  /**
   * Récupère les stats d'une station
   */
  getStats(stationId: string): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/stats/${stationId}`);
  }

  /**
   * Télécharge le template Excel
   */
  downloadTemplate(): void {
    const url = `${this.apiUrl}/download-template`;
    console.log('📥 Téléchargement du template depuis:', url);
    window.open(url, '_blank');
  }

  /**
   * Récupère toutes les données water_quality d'une station
   * Si stationId n'est pas fourni, récupère toutes les données
   */
  getWaterQualityData(stationId?: string): Observable<DataResponse> {
    const url = stationId
      ? `${this.apiUrl}/data/${stationId}`
      : `${this.apiUrl}/data`;

    console.log('🔍 Récupération des données depuis:', url);
    return this.http.get<DataResponse>(url);
  }
}
