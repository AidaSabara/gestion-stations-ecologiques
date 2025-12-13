// src/types/user.types.ts

export interface UserPermissions {
  canAccessAlerts: boolean;
  canAccessGraphs: boolean;
  canAccessFilters: boolean;
  canAccessData: boolean;
  canManageUsers: boolean;
}

export type UserRole = 'agent' | 'admin' | 'supervisor';

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  station_id: string;
  station_name: string;
  permissions: UserPermissions;
  phone: string;
  active: boolean;
  department: string;
  position: string;
  createdAt: string;
  lastLogin: string | null;
  avatar?: string;
  _kuzzle_info?: any;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  station_id: string;
  station_name: string;
  permissions: UserPermissions;
  phone: string;
  department: string;
  position: string;
  active?: boolean;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  station_id?: string;
  station_name?: string;
  permissions?: UserPermissions;
  phone?: string;
  department?: string;
  position?: string;
  active?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserFilters {
  role?: UserRole;
  station_id?: string;
  active?: boolean;
  search?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: { [key: string]: number };
  byStation: { [key: string]: number };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user?: Omit<User, 'password'>;
}