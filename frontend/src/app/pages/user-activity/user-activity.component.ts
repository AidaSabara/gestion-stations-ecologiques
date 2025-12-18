// src/app/pages/user-activity/user-activity.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogService } from '../../activity-log.service';
import { AuthService } from '../../auth.service';
import {
  ActivityLog,
  ActivityLogFilters,
  ActivityLogStats,
  ActivityAction,
  ActivityStatus,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_COLORS,
  STATUS_LABELS
} from '../../models/activity-log.model';

@Component({
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-activity.component.html',
  styleUrls: ['./user-activity.component.css']
})
export class UserActivityComponent implements OnInit {
  logs: ActivityLog[] = [];
  stats: ActivityLogStats | null = null;
  loading = false;
  currentUser: any;

  // Filtres
  filters: ActivityLogFilters = {};
  searchTerm = '';
  selectedAction = 'all';
  selectedStatus = 'all';
  startDate = '';
  endDate = '';

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalLogs = 0;
  totalPages = 0;

  // Actions disponibles pour le filtre - CORRECTION ICI
  availableActions: string[] = [
    'user.login',
    'user.logout',
    'user.create',
    'user.update',
    'user.delete',
    'user.toggle_status',
    'user.reset_password',
    'data.export',
    'data.view',
    'alert.view',
    'alert.resolve',
    'station.access',
    'settings.update'
  ];

  constructor(
    private activityLogService: ActivityLogService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStats();
    this.loadLogs();
  }

  getActionLabel(action: string): string {
    return ACTION_LABELS[action as ActivityAction] || action;
  }

  getActionIcon(action: string): string {
    return ACTION_ICONS[action as ActivityAction] || '📝';
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status as ActivityStatus] || status;
  }

  getActionColor(action: string): string {
    const colorMap: Record<string, string> = {
      'blue': '#3b82f6',
      'gray': '#6b7280',
      'green': '#10b981',
      'yellow': '#f59e0b',
      'red': '#ef4444',
      'purple': '#8b5cf6',
      'orange': '#f97316',
      'indigo': '#6366f1',
      'cyan': '#06b6d4',
      'amber': '#f59e0b',
      'emerald': '#10b981',
      'sky': '#0ea5e9',
      'violet': '#8b5cf6'
    };

    const colorName = ACTION_COLORS[action as ActivityAction] || 'gray';
    return colorMap[colorName] || '#6b7280';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      success: 'status-success',
      error: 'status-error',
      warning: 'status-warning'
    };
    return classes[status] || 'status-success';
  }

  loadLogs(): void {
    this.loading = true;

    this.filters = {
      action: this.selectedAction !== 'all' ? this.selectedAction as ActivityAction : undefined,
      status: this.selectedStatus !== 'all' ? this.selectedStatus as ActivityStatus : undefined,
      search: this.searchTerm || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
    };

    this.activityLogService.getActivityLogs(this.filters, this.currentPage, this.pageSize)
      .subscribe({
        next: (result) => {
          this.logs = result.logs;
          this.totalLogs = result.total;
          this.totalPages = Math.ceil(this.totalLogs / this.pageSize);
          this.loading = false;
        },
        error: (error) => {
          console.error('Erreur chargement logs:', error);
          this.loading = false;
        }
      });
  }

  loadStats(): void {
    this.activityLogService.getActivityStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Erreur chargement stats:', error);
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedAction = 'all';
    this.selectedStatus = 'all';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.loadLogs();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadLogs();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadLogs();
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadLogs();
  }

  exportCSV(): void {
    this.activityLogService.exportToCSV(this.filters);
  }

  exportJSON(): void {
    this.activityLogService.exportToJSON(this.filters);
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return past.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }
}
