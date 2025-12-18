// src/app/models/activity-log.model.ts

export type ActivityAction =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.toggle_status'
  | 'user.reset_password'
  | 'data.export'
  | 'data.view'
  | 'alert.view'
  | 'alert.resolve'
  | 'station.access'
  | 'settings.update';

export type ActivityStatus = 'success' | 'error' | 'warning';

export interface ActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: ActivityAction;
  status: ActivityStatus;
  description: string;
  metadata?: {
    targetUserId?: string;
    targetUserName?: string;
    stationId?: string;
    stationName?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };
  timestamp: string;
}

export interface ActivityLogFilters {
  userId?: string;
  action?: ActivityAction;
  status?: ActivityStatus;
  startDate?: string;
  endDate?: string;
  stationId?: string;
  search?: string;
}

export interface ActivityLogStats {
  totalLogs: number;
  todayLogs: number;
  byAction: { [key: string]: number };
  byStatus: { [key: string]: number };
  recentUsers: Array<{
    userId: string;
    userName: string;
    lastActivity: string;
    activityCount: number;
  }>;
}

export const ACTION_LABELS: { [key in ActivityAction]: string } = {
  'user.login': 'Connexion',
  'user.logout': 'Déconnexion',
  'user.create': 'Création utilisateur',
  'user.update': 'Modification utilisateur',
  'user.delete': 'Suppression utilisateur',
  'user.toggle_status': 'Changement statut',
  'user.reset_password': 'Réinitialisation mot de passe',
  'data.export': 'Export de données',
  'data.view': 'Consultation données',
  'alert.view': 'Consultation alerte',
  'alert.resolve': 'Résolution alerte',
  'station.access': 'Accès station',
  'settings.update': 'Modification paramètres'
};

export const STATUS_LABELS: { [key in ActivityStatus]: string } = {
  success: 'Réussi',
  error: 'Erreur',
  warning: 'Avertissement'
};

export const ACTION_ICONS: { [key in ActivityAction]: string } = {
  'user.login': '🔐',
  'user.logout': '👋',
  'user.create': '➕',
  'user.update': '✏️',
  'user.delete': '🗑️',
  'user.toggle_status': '🔄',
  'user.reset_password': '🔑',
  'data.export': '📥',
  'data.view': '👁️',
  'alert.view': '⚠️',
  'alert.resolve': '✅',
  'station.access': '🏢',
  'settings.update': '⚙️'
};

export const ACTION_COLORS: { [key in ActivityAction]: string } = {
  'user.login': 'blue',
  'user.logout': 'gray',
  'user.create': 'green',
  'user.update': 'yellow',
  'user.delete': 'red',
  'user.toggle_status': 'purple',
  'user.reset_password': 'orange',
  'data.export': 'indigo',
  'data.view': 'cyan',
  'alert.view': 'amber',
  'alert.resolve': 'emerald',
  'station.access': 'sky',
  'settings.update': 'violet'
};
