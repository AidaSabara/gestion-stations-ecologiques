// src/types/activity-log.types.ts

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
  _kuzzle_info?: any;
}

export interface CreateActivityLogDto {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: ActivityAction;
  status: ActivityStatus;
  description: string;
  metadata?: ActivityLog['metadata'];
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

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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