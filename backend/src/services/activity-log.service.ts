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
    try {
      await this.kuzzle.connect();
      console.log('✅ ActivityLogService connecté à Kuzzle');
      await this.ensureCollection();
    } catch (error) {
      console.error('❌ Erreur connexion ActivityLogService:', error);
      throw error;
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
      }
    } catch (error) {
      console.error('❌ Erreur création collection:', error);
    }
  }

  /**
   * Enregistre une nouvelle activité
   */
  async logActivity(logData: CreateActivityLogDto): Promise<ActivityLog> {
    try {
      const document = {
        ...logData,
        timestamp: new Date().toISOString()
      };

      const result = await this.kuzzle.document.create(
        this.INDEX,
        this.COLLECTION,
        document,
        undefined,
        { refresh: 'wait_for' }
      );

      console.log(`✅ Activité enregistrée: ${logData.action} par ${logData.userName}`);
      return this.mapKuzzleToActivityLog(result);
    } catch (error) {
      console.error('❌ Erreur logActivity:', error);
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

      const logs = result.hits.map((hit: any) => this.mapKuzzleToActivityLog(hit));

      return { logs, total: result.total };
    } catch (error) {
      console.error('❌ Erreur getActivityLogs:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques des activités
   */
  async getActivityStats(currentUser?: { userId: string; role: string }): Promise<ActivityLogStats> {
    try {
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
    return this.getActivityLogs({ userId }, pagination);
  }

  /**
   * Supprime les anciens logs (nettoyage)
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
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
      this.kuzzle.disconnect();
      console.log('✅ ActivityLogService déconnecté');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
    }
  }
}