// backend/src/services/activity-log.service.ts
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import {
  ActivityLog,
  CreateActivityLogDto,
  ActivityLogFilters,
  PaginationParams,
  ActivityLogStats
} from '../types/activity-log.types';

export class ActivityLogService {
  private kuzzle: any;
  private readonly INDEX = 'iot';
  private readonly COLLECTION = 'user_activity_logs';
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    const protocol = new WebSocket(
      process.env.KUZZLE_HOST || 'localhost',
      {
        port: parseInt(process.env.KUZZLE_PORT || '7512'),
        ssl: false
      }
    );
    
    this.kuzzle = new Kuzzle(protocol);
  }

  /**
   * Connexion à Kuzzle
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        await this.kuzzle.connect();
        this.isConnected = true;
        console.log('✅ ActivityLogService connecté à Kuzzle');
        await this.ensureCollection();
      } catch (error) {
        console.error('❌ Erreur connexion ActivityLogService:', error);
        this.isConnected = false;
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * S'assure que la connexion est établie
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      console.log('⚠️ ActivityLogService pas connecté, connexion en cours...');
      await this.connect();
    }
  }

  /**
   * S'assure que la collection existe
   */
  private async ensureCollection(): Promise<void> {
    try {
      const exists = await this.kuzzle.collection.exists(this.INDEX, this.COLLECTION);
      if (!exists) {
        await this.kuzzle.collection.create(this.INDEX, this.COLLECTION);
        console.log('✅ Collection user_activity_logs créée');
      } else {
        console.log('✅ Collection user_activity_logs existe déjà');
      }
    } catch (error) {
      console.error('❌ Erreur vérification/création collection:', error);
    }
  }

  /**
   * Enregistre une nouvelle activité
   */
  async logActivity(logData: CreateActivityLogDto): Promise<ActivityLog> {
    try {
      // 🔥 S'assurer que la connexion est établie
      await this.ensureConnected();

      const document = {
        ...logData,
        timestamp: new Date().toISOString()
      };

      console.log('📝 Tentative d\'enregistrement d\'activité:', {
        action: logData.action,
        userId: logData.userId,
        userEmail: logData.userEmail
      });

      const result = await this.kuzzle.document.create(
        this.INDEX,
        this.COLLECTION,
        document,
        undefined,
        { refresh: 'wait_for' }
      );

      console.log(`✅ Activité enregistrée: ${logData.action} par ${logData.userName}`);
      console.log(`📄 Document ID: ${result._id}`);
      
      return this.mapKuzzleToActivityLog(result);
    } catch (error: any) {
      console.error('❌ Erreur logActivity:', error);
      console.error('📋 Détails de l\'erreur:', {
        message: error.message,
        stack: error.stack,
        logData
      });
      throw error;
    }
  }

  /**
   * Récupère les logs avec filtres et pagination
   */
  async getActivityLogs(
    filters?: ActivityLogFilters,
    pagination?: PaginationParams,
    currentUser?: { userId: string; role: string; stationId?: string }
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    try {
      // 🔥 S'assurer que la connexion est établie
      await this.ensureConnected();

      const query: any = { bool: { must: [] } };

      // Filtrer par permissions
      if (currentUser) {
        if (currentUser.role === 'agent') {
          // Agent voit seulement ses propres logs
          query.bool.must.push({ term: { userId: currentUser.userId } });
        } else if (currentUser.role === 'supervisor') {
          // Supervisor voit les logs de sa station
          const stationId = currentUser.stationId || 'ALL';
          if (stationId !== 'ALL') {
            query.bool.must.push({ term: { 'metadata.stationId': stationId } });
          }
        }
        // Admin voit tout
      }

      // Filtres additionnels
      if (filters) {
        if (filters.userId) {
          query.bool.must.push({ term: { userId: filters.userId } });
        }
        if (filters.action) {
          query.bool.must.push({ term: { action: filters.action } });
        }
        if (filters.status) {
          query.bool.must.push({ term: { status: filters.status } });
        }
        if (filters.stationId) {
          query.bool.must.push({ term: { 'metadata.stationId': filters.stationId } });
        }
        if (filters.startDate || filters.endDate) {
          const rangeQuery: any = { timestamp: {} };
          if (filters.startDate) rangeQuery.timestamp.gte = filters.startDate;
          if (filters.endDate) rangeQuery.timestamp.lte = filters.endDate;
          query.bool.must.push({ range: rangeQuery });
        }
        if (filters.search) {
          query.bool.must.push({
            multi_match: {
              query: filters.search,
              fields: ['userName', 'userEmail', 'description', 'action']
            }
          });
        }
      }

      const searchQuery = query.bool.must.length > 0 ? query : { match_all: {} };

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const from = (page - 1) * limit;

      console.log('🔍 Recherche logs avec query:', JSON.stringify(searchQuery, null, 2));

      const result = await this.kuzzle.document.search(
        this.INDEX,
        this.COLLECTION,
        { query: searchQuery },
        {
          from,
          size: limit,
          sort: [{ timestamp: 'desc' }]
        }
      );

      console.log(`📊 ${result.total} logs trouvés, ${result.hits.length} retournés`);

      const logs = result.hits.map((hit: any) => this.mapKuzzleToActivityLog(hit));

      return { logs, total: result.total };
    } catch (error: any) {
      console.error('❌ Erreur getActivityLogs:', error);
      console.error('📋 Détails:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les statistiques des activités
   */
  async getActivityStats(currentUser?: { userId: string; role: string }): Promise<ActivityLogStats> {
    try {
      await this.ensureConnected();

      const { logs } = await this.getActivityLogs(
        {},
        { limit: 10000 },
        currentUser
      );

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const stats: ActivityLogStats = {
        totalLogs: logs.length,
        todayLogs: logs.filter(log => new Date(log.timestamp) >= todayStart).length,
        byAction: {},
        byStatus: {},
        recentUsers: []
      };

      // Comptage par action
      logs.forEach(log => {
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
        stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
      });

      // Utilisateurs récents
      const userMap = new Map<string, { userName: string; lastActivity: string; count: number }>();
      logs.forEach(log => {
        const existing = userMap.get(log.userId);
        if (!existing) {
          userMap.set(log.userId, {
            userName: log.userName,
            lastActivity: log.timestamp,
            count: 1
          });
        } else {
          existing.count++;
          if (new Date(log.timestamp) > new Date(existing.lastActivity)) {
            existing.lastActivity = log.timestamp;
          }
        }
      });

      stats.recentUsers = Array.from(userMap.entries())
        .map(([userId, data]) => ({
          userId,
          userName: data.userName,
          lastActivity: data.lastActivity,
          activityCount: data.count
        }))
        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
        .slice(0, 10);

      return stats;
    } catch (error) {
      console.error('❌ Erreur getActivityStats:', error);
      throw error;
    }
  }

  /**
   * Récupère les logs d'un utilisateur spécifique
   */
  async getUserActivityLogs(
    userId: string,
    pagination?: PaginationParams
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    await this.ensureConnected();
    return this.getActivityLogs({ userId }, pagination);
  }

  /**
   * Supprime les anciens logs (nettoyage)
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      await this.ensureConnected();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.kuzzle.document.deleteByQuery(
        this.INDEX,
        this.COLLECTION,
        {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate.toISOString()
              }
            }
          }
        }
      );

      console.log(`✅ ${result.deleted} anciens logs supprimés`);
      return result.deleted;
    } catch (error) {
      console.error('❌ Erreur cleanOldLogs:', error);
      throw error;
    }
  }

  /**
   * Mappe un document Kuzzle vers ActivityLog
   */
  private mapKuzzleToActivityLog(doc: any): ActivityLog {
    const source = doc._source || doc;
    return {
      _id: doc._id,
      userId: source.userId,
      userName: source.userName,
      userEmail: source.userEmail,
      userRole: source.userRole,
      action: source.action,
      status: source.status,
      description: source.description,
      metadata: source.metadata,
      timestamp: source.timestamp,
      _kuzzle_info: doc._kuzzle_info
    };
  }

  /**
   * Déconnexion de Kuzzle
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        this.kuzzle.disconnect();
        this.isConnected = false;
        this.connectionPromise = null;
        console.log('✅ ActivityLogService déconnecté');
      }
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
    }
  }
}