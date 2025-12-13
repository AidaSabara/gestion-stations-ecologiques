// src/services/user.service.ts
import { Kuzzle, WebSocket } from 'kuzzle-sdk'; // Assurez-vous que l'import est correct
import { PasswordUtil } from '../utils/password.util';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilters,
  UserStats,
  PaginationParams
} from '../types/user.types';

export class UserService {
  private kuzzle: any;
  private readonly INDEX = 'iot';
  private readonly COLLECTION = 'users';

  constructor() {
    // ✅ Nouvelle syntaxe SDK v7+
    const protocol = new WebSocket(
      process.env.KUZZLE_HOST || 'localhost',
      {
        port: parseInt(process.env.KUZZLE_PORT || '7512'),
        ssl: false  // 'ssl' au lieu de 'sslConnection'
      }
    );
    
    this.kuzzle = new Kuzzle(protocol);
  }

  /**
   * Connexion à Kuzzle
   */
  async connect(): Promise<void> {
    try {
      await this.kuzzle.connect();
      console.log('✅ UserService connecté à Kuzzle');
    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les utilisateurs avec pagination et filtres
   */
  async getAllUsers(
    filters?: UserFilters,
    pagination?: PaginationParams
  ): Promise<{ users: User[]; total: number }> {
    try {
      const query: any = { bool: { must: [] } };

      if (filters) {
        if (filters.role) {
          query.bool.must.push({ term: { role: filters.role } });
        }
        if (filters.station_id) {
          query.bool.must.push({ term: { station_id: filters.station_id } });
        }
        if (filters.active !== undefined) {
          query.bool.must.push({ term: { active: filters.active } });
        }
        if (filters.search) {
          query.bool.must.push({
            multi_match: {
              query: filters.search,
              fields: ['name', 'email', 'department', 'position']
            }
          });
        }
      }

      const searchQuery = query.bool.must.length > 0 ? query : { match_all: {} };

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 100;
      const from = (page - 1) * limit;

      const result = await this.kuzzle.document.search(
        this.INDEX,
        this.COLLECTION,
        { query: searchQuery },
        {
          from,
          size: limit,
          sort: pagination?.sortBy
            ? [{ [pagination.sortBy]: pagination.sortOrder || 'asc' }]
            : [{ createdAt: 'desc' }]
        }
      );

      const users = result.hits.map((hit: any) => this.mapKuzzleToUser(hit));

      return { users, total: result.total };
    } catch (error) {
      console.error('❌ Erreur getAllUsers:', error);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par ID
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await this.kuzzle.document.get(
        this.INDEX,
        this.COLLECTION,
        id
      );
      return this.mapKuzzleToUser(result);
    } catch (error: any) {
      if (error.status === 404) return null;
      console.error('❌ Erreur getUserById:', error);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.kuzzle.document.search(
        this.INDEX,
        this.COLLECTION,
        {
          query: {
            term: { email: email.toLowerCase() }
          }
        },
        { size: 1 }
      );

      if (result.hits.length === 0) return null;
      return this.mapKuzzleToUser(result.hits[0]);
    } catch (error) {
      console.error('❌ Erreur getUserByEmail:', error);
      throw error;
    }
  }

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(userData: CreateUserDto): Promise<User> {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('EMAIL_EXISTS');
      }

      // Hasher le mot de passe
      const hashedPassword = await PasswordUtil.hash(userData.password);

      const userDocument = {
        ...userData,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        active: userData.active !== undefined ? userData.active : true
      };

      const result = await this.kuzzle.document.create(
        this.INDEX,
        this.COLLECTION,
        userDocument,
        undefined,
        { refresh: 'wait_for' }
      );

      console.log(`✅ Utilisateur créé: ${result._id}`);
      return this.mapKuzzleToUser(result);
    } catch (error) {
      console.error('❌ Erreur createUser:', error);
      throw error;
    }
  }

  /**
   * Met à jour un utilisateur
   */
  async updateUser(id: string, userData: UpdateUserDto): Promise<User> {
    try {
      // Si le mot de passe est fourni, le hasher
      if (userData.password) {
        userData.password = await PasswordUtil.hash(userData.password);
      }

      // Si l'email est fourni, vérifier qu'il n'existe pas
      if (userData.email) {
        const existingUser = await this.getUserByEmail(userData.email);
        if (existingUser && existingUser._id !== id) {
          throw new Error('EMAIL_EXISTS');
        }
        userData.email = userData.email.toLowerCase();
      }

      const result = await this.kuzzle.document.update(
        this.INDEX,
        this.COLLECTION,
        id,
        userData,
        { refresh: 'wait_for' }
      );

      console.log(`✅ Utilisateur mis à jour: ${id}`);
      return this.mapKuzzleToUser(result);
    } catch (error) {
      console.error('❌ Erreur updateUser:', error);
      throw error;
    }
  }

  /**
   * Supprime un utilisateur
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await this.kuzzle.document.delete(
        this.INDEX,
        this.COLLECTION,
        id,
        { refresh: 'wait_for' }
      );
      console.log(`✅ Utilisateur supprimé: ${id}`);
    } catch (error) {
      console.error('❌ Erreur deleteUser:', error);
      throw error;
    }
  }

  /**
   * Active/désactive un utilisateur
   */
  async toggleUserStatus(id: string): Promise<User> {
    try {
      const user = await this.getUserById(id);
      if (!user) throw new Error('USER_NOT_FOUND');

      return await this.updateUser(id, { active: !user.active });
    } catch (error) {
      console.error('❌ Erreur toggleUserStatus:', error);
      throw error;
    }
  }

  /**
   * Met à jour la dernière connexion
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.kuzzle.document.update(
        this.INDEX,
        this.COLLECTION,
        id,
        { lastLogin: new Date().toISOString() },
        { refresh: 'wait_for' }
      );
      console.log(`✅ Dernière connexion mise à jour: ${id}`);
    } catch (error) {
      console.error('❌ Erreur updateLastLogin:', error);
      throw error;
    }
  }

  /**
   * Réinitialise le mot de passe
   */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await PasswordUtil.hash(newPassword);
      await this.kuzzle.document.update(
        this.INDEX,
        this.COLLECTION,
        id,
        { password: hashedPassword },
        { refresh: 'wait_for' }
      );
      console.log(`✅ Mot de passe réinitialisé: ${id}`);
    } catch (error) {
      console.error('❌ Erreur resetPassword:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques des utilisateurs
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const { users } = await this.getAllUsers();

      const stats: UserStats = {
        total: users.length,
        active: users.filter(u => u.active).length,
        inactive: users.filter(u => !u.active).length,
        byRole: {},
        byStation: {}
      };

      users.forEach(user => {
        stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
        const stationName = user.station_name || 'Non assigné';
        stats.byStation[stationName] = (stats.byStation[stationName] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Erreur getUserStats:', error);
      throw error;
    }
  }

  /**
   * Mappe un document Kuzzle vers User
   */
  private mapKuzzleToUser(doc: any): User {
    const source = doc._source || doc;

    return {
      _id: doc._id,
      _kuzzle_info: doc._kuzzle_info,
      name: source.name || '',
      email: source.email || '',
      password: source.password,
      role: source.role || 'agent',
      station_id: source.station_id || '',
      station_name: source.station_name || '',
      permissions: source.permissions || {
        canAccessAlerts: false,
        canAccessGraphs: false,
        canAccessFilters: false,
        canAccessData: false,
        canManageUsers: false
      },
      phone: source.phone || '',
      active: source.active !== undefined ? source.active : true,
      department: source.department || '',
      position: source.position || '',
      createdAt: source.createdAt || new Date().toISOString(),
      lastLogin: source.lastLogin || null,
      avatar: source.avatar
    };
  }

  /**
   * Déconnexion de Kuzzle
   */
  async disconnect(): Promise<void> {
    try {
      this.kuzzle.disconnect();
      console.log('✅ UserService déconnecté de Kuzzle');
    } catch (error) {
      console.error('❌ Erreur déconnexion Kuzzle:', error);
    }
  }
}