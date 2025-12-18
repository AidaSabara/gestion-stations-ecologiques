// src/app/activity-log.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  ActivityLog,
  ActivityLogFilters,
  ActivityLogStats
} from './models/activity-log.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityLogService {
  private apiUrl = `${environment.apiUrl}/activity-logs`;
  private logsSubject = new BehaviorSubject<ActivityLog[]>([]);
  public logs$ = this.logsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * ✅ CORRECTION: Créer les headers avec le token
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Récupère l'historique des activités avec filtres
   */
  getActivityLogs(
    filters?: ActivityLogFilters,
    page: number = 1,
    limit: number = 50
  ): Observable<{ logs: ActivityLog[]; total: number }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (filters) {
      if (filters.userId) params = params.set('userId', filters.userId);
      if (filters.action) params = params.set('action', filters.action);
      if (filters.status) params = params.set('status', filters.status);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
      if (filters.stationId) params = params.set('stationId', filters.stationId);
      if (filters.search) params = params.set('search', filters.search);
    }

    // ✅ CORRECTION: Ajouter les headers
    return this.http.get<ApiResponse<ActivityLog[]>>(this.apiUrl, {
      params,
      headers: this.getHeaders()
    }).pipe(
      map(response => ({
        logs: response.data,
        total: response.total || 0
      })),
      tap(result => this.logsSubject.next(result.logs))
    );
  }

  /**
   * Récupère les statistiques des activités
   */
  getActivityStats(): Observable<ActivityLogStats> {
    // ✅ CORRECTION: Ajouter les headers
    return this.http.get<ApiResponse<ActivityLogStats>>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Récupère les logs d'un utilisateur spécifique
   */
  getUserActivityLogs(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Observable<{ logs: ActivityLog[]; total: number }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    // ✅ CORRECTION: Ajouter les headers
    return this.http.get<ApiResponse<ActivityLog[]>>(
      `${this.apiUrl}/user/${userId}`,
      { params, headers: this.getHeaders() }
    ).pipe(
      map(response => ({
        logs: response.data,
        total: response.total || 0
      }))
    );
  }

  /**
   * Enregistre manuellement une activité
   */
  logActivity(
    action: string,
    description: string,
    metadata?: any,
    status: string = 'success'
  ): Observable<ActivityLog> {
    // ✅ CORRECTION: Ajouter les headers
    return this.http.post<ApiResponse<ActivityLog>>(this.apiUrl, {
      action,
      description,
      metadata,
      status
    }, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Exporte l'historique au format CSV
   */
  exportToCSV(filters?: ActivityLogFilters): void {
    this.getActivityLogs(filters, 1, 10000).subscribe(result => {
      const logs = result.logs;
      const headers = ['Date', 'Utilisateur', 'Email', 'Rôle', 'Action', 'Description', 'Statut'];
      const csvData = [
        headers.join(','),
        ...logs.map(log => [
          new Date(log.timestamp).toLocaleString('fr-FR'),
          log.userName,
          log.userEmail,
          log.userRole,
          log.action,
          `"${log.description.replace(/"/g, '""')}"`,
          log.status
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Exporte l'historique au format JSON
   */
  exportToJSON(filters?: ActivityLogFilters): void {
    this.getActivityLogs(filters, 1, 10000).subscribe(result => {
      const dataStr = JSON.stringify(result.logs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Nettoie les anciens logs (Admin seulement)
   */
  cleanOldLogs(daysToKeep: number = 90): Observable<any> {
    // ✅ CORRECTION: Ajouter les headers
    return this.http.delete(`${this.apiUrl}/cleanup`, {
      params: { days: daysToKeep.toString() },
      headers: this.getHeaders()
    });
  }
}
