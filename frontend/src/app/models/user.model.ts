// src/app/models/user.model.ts
export interface User {
  _id: string;
  _kuzzle_info?: {
    author: string;
    createdAt: string;
    updatedAt: string | null;
    updater: string | null;
  };
  name: string;
  email: string;
  password?: string;
  role: 'agent' | 'admin' | 'supervisor';
  station_id: string;
  station_name: string;
  permissions: {
    canAccessAlerts: boolean;
    canAccessGraphs: boolean;
    canAccessFilters: boolean;
    canAccessData: boolean;
    canManageUsers: boolean;
  };
  phone: string;
  active: boolean;
  department: string;
  position: string;
  createdAt: string;
  lastLogin: string | null;
  avatar?: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: 'agent' | 'admin' | 'supervisor';
  station_id: string;
  station_name: string;
  permissions: {
    canAccessAlerts: boolean;
    canAccessGraphs: boolean;
    canAccessFilters: boolean;
    canAccessData: boolean;
    canManageUsers: boolean;
  };
  phone: string;
  department: string;
  position: string;
  active: boolean;
}

export interface UpdateUserDto extends Partial<CreateUserDto> {
  _id?: string;
}
