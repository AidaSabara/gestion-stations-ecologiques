// src/services/scheduler.service.ts
import * as cron from 'node-cron';
import { KuzzleService } from './kuzzle.service';
import { ReportService } from './report.service';
import { EmailService } from './email.service';

// Définir l'interface pour les données utilisateur
interface UserDocument {
  _id: string;
  _source?: {
    email: string;
    role: string;
    station_id?: string;
    [key: string]: any;
  };
  body?: {
    email: string;
    role: string;
    station_id?: string;
    [key: string]: any;
  };
}

interface Station {
  _id: string;
  _source?: {
    name: string;
    location: {
      lat: number;
      lon: number;
    };
    status: 'active' | 'inactive';
    type: 'mobile' | 'fixed';
    installedAt: string;
    region?: string;
  };
  body?: {
    name: string;
    [key: string]: any;
  };
  name?: string;
  location?: any;
  status?: any;
  type?: any;
  installedAt?: any;
  region?: string;
}

interface ScheduledReport {
  stationId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  enabled: boolean;
}

// Définir un type pour le job cron si les types ne sont pas trouvés
type CronScheduledTask = any; // Type temporaire

export class SchedulerService {
  private kuzzleService: KuzzleService;
  private reportService: ReportService;
  private emailService: EmailService;
  private scheduledJobs: Map<string, CronScheduledTask> = new Map();

  constructor() {
    this.kuzzleService = new KuzzleService();
    this.reportService = new ReportService();
    this.emailService = new EmailService();
  }

  /**
   * Initialise tous les rapports planifiés
   */
  async initialize() {
    console.log('📅 Initialisation du système de planification...');

    // Rapport hebdomadaire - Tous les lundis à 8h
    this.scheduleWeeklyReports();

    // Rapport mensuel - Le 1er de chaque mois à 9h
    this.scheduleMonthlyReports();

    console.log('✅ Système de planification initialisé');
  }
    public async getStation(stationId: string): Promise<Station> {
    // Utilise le service PRIVE kuzzleService, mais est accessible de l'extérieur
    const station = await this.kuzzleService.kuzzle.document.get('iot', 'stations', stationId);
    return station as Station; // Utilisez l'interface Station que nous avons définie
  }


  /**
   * Planifie les rapports hebdomadaires
   */
  private scheduleWeeklyReports() {
    // Cron: Tous les lundis à 8h00
    const weeklyJob = cron.schedule('0 8 * * 1', async () => {
      console.log('🔄 Génération des rapports hebdomadaires...');
      await this.generateWeeklyReportsForAllStations();
    });

    this.scheduledJobs.set('weekly', weeklyJob);
    console.log('📅 Rapports hebdomadaires planifiés: Lundis à 8h00');
  }

  /**
   * Planifie les rapports mensuels
   */
  private scheduleMonthlyReports() {
    // Cron: Le 1er de chaque mois à 9h00
    const monthlyJob = cron.schedule('0 9 1 * *', async () => {
      console.log('🔄 Génération des rapports mensuels...');
      await this.generateMonthlyReportsForAllStations();
    });

    this.scheduledJobs.set('monthly', monthlyJob);
    console.log('📅 Rapports mensuels planifiés: 1er du mois à 9h00');
  }

  /**
   * Génère les rapports hebdomadaires pour toutes les stations
   */
  async generateWeeklyReportsForAllStations() {
    try {
      const stations = await this.kuzzleService.getStations();
      
      if (stations.length === 0) {
        console.log('⚠️ Aucune station trouvée');
        return;
      }

      console.log(`📊 Génération de ${stations.length} rapports hebdomadaires...`);

      for (const station of stations) {
        try {
          await this.generateAndSendReport(station, 'weekly');
        } catch (error) {
          console.error(`❌ Erreur rapport station ${station.body?.name || station._id}:`, error);
        }
      }

      console.log('✅ Tous les rapports hebdomadaires ont été générés');
    } catch (error) {
      console.error('❌ Erreur génération rapports hebdomadaires:', error);
    }
  }

  /**
   * Génère les rapports mensuels pour toutes les stations
   */
  async generateMonthlyReportsForAllStations() {
    try {
      const stations = await this.kuzzleService.getStations();
      
      console.log(`📊 Génération de ${stations.length} rapports mensuels...`);

      for (const station of stations) {
        try {
          await this.generateAndSendReport(station, 'monthly');
        } catch (error) {
          console.error(`❌ Erreur rapport station ${station.body?.name || station._id}:`, error);
        }
      }

      console.log('✅ Tous les rapports mensuels ont été générés');
    } catch (error) {
      console.error('❌ Erreur génération rapports mensuels:', error);
    }
  }

  /**
   * Génère et envoie un rapport pour une station
   */
  async generateAndSendReport(station: Station, frequency: 'weekly' | 'monthly') {
    const stationName = station.body?.name || station._source?.name || station._id;
    console.log(`📄 Génération rapport ${frequency} pour ${stationName}...`);

    // Calculer la période
    const period = this.calculatePeriod(frequency);

    // Récupérer les données
    const [waterQuality, alerts, maintenances] = await Promise.all([
      this.getWaterQualityForPeriod(station._id, period),
      this.getAlertsForPeriod(station._id, period),
      this.getMaintenancesForPeriod(station._id, period)
    ]);

    // Préparer les données du rapport
    const reportData = {
      station: {
        ...station,
        body: {
          ...station.body,
          name: stationName
        }
      },
      waterQuality,
      alerts,
      maintenances,
      period
    };

    // Générer le PDF
    const pdfPath = await this.reportService.generateWeeklyReport(reportData);
    console.log(`✅ PDF généré: ${pdfPath}`);

    // Récupérer les destinataires
    const recipients = await this.getReportRecipients(station);

    // Envoyer par email
    await this.emailService.sendReportEmail(
      recipients,
      stationName,
      frequency,
      period,
      pdfPath
    );

    console.log(`✅ Rapport envoyé à ${recipients.length} destinataires`);
  }

  /**
   * Calcule la période selon la fréquence
   */
  private calculatePeriod(frequency: 'weekly' | 'monthly'): { start: string; end: string } {
    const end = new Date();
    const start = new Date();

    if (frequency === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (frequency === 'monthly') {
      start.setMonth(end.getMonth() - 1);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  /**
   * Récupère les données de qualité d'eau pour une période
   */
  private async getWaterQualityForPeriod(stationId: string, period: { start: string; end: string }) {
    const allData = await this.kuzzleService.getWaterQualityData(stationId);
    
    return allData.filter((d: any) => {
      const date = new Date(d.body.date);
      return date >= new Date(period.start) && date <= new Date(period.end);
    });
  }

  /**
   * Récupère les alertes pour une période
   */
  private async getAlertsForPeriod(stationId: string, period: { start: string; end: string }) {
    try {
      const response = await this.kuzzleService.kuzzle.document.search(
        'iot',
        'alerts',
        {
          query: {
            bool: {
              must: [
                { term: { 'stationId': stationId } },
                {
                  range: {
                    timestamp: {
                      gte: period.start,
                      lte: period.end
                    }
                  }
                }
              ]
            }
          }
        },
        { size: 1000 }
      );

      return response.hits;
    } catch (error) {
      console.error('Erreur récupération alertes:', error);
      return [];
    }
  }

  /**
   * Récupère les maintenances pour une période
   */
  private async getMaintenancesForPeriod(stationId: string, period: { start: string; end: string }) {
    try {
      const response = await this.kuzzleService.kuzzle.document.search(
        'iot',
        'maintenance_intervention',
        {
          query: {
            bool: {
              must: [
                {
                  range: {
                    date_intervention: {
                      gte: period.start,
                      lte: period.end
                    }
                  }
                }
              ]
            }
          }
        },
        { size: 1000 }
      );

      return response.hits;
    } catch (error) {
      console.error('Erreur récupération maintenances:', error);
      return [];
    }
  }

  /**
   * Récupère les destinataires d'un rapport (admins, superviseurs, agents)
   */
  private async getReportRecipients(station: Station): Promise<string[]> {
    try {
      const response = await this.kuzzleService.kuzzle.document.search(
        'iot',
        'users',
        {
          query: {
            bool: {
              should: [
                { term: { 'role': 'admin' } },
                { term: { 'role': 'superviseur' } },
                {
                  bool: {
                    must: [
                      { term: { 'role': 'agent' } },
                      { term: { 'station_id': station._id } }
                    ]
                  }
                }
              ]
            }
          }
        },
        { size: 1000 }
      );

      return response.hits
  .filter((user: any) => {  // ← Change UserDocument → any
    const userBody = user.body || user._source || {};
    const email = userBody.email;
    return email && typeof email === 'string' && email.trim() !== '';
  })
  .map((user: any) => {  // ← Change UserDocument → any
    const userBody = user.body || user._source || {};
    return userBody.email as string;
  });
    } catch (error) {
      console.error('Erreur récupération destinataires:', error);
      return [];
    }
  }

  /**
   * Génère un rapport manuel pour une station
   */
  async generateManualReport(stationId: string, frequency: 'weekly' | 'monthly'): Promise<string> {
    const station = await this.kuzzleService.kuzzle.document.get('iot', 'stations', stationId);
    
    const period = this.calculatePeriod(frequency);
    const [waterQuality, alerts, maintenances] = await Promise.all([
      this.getWaterQualityForPeriod(stationId, period),
      this.getAlertsForPeriod(stationId, period),
      this.getMaintenancesForPeriod(stationId, period)
    ]);

    const reportData = {
      station,
      waterQuality,
      alerts,
      maintenances,
      period
    };

    return await this.reportService.generateWeeklyReport(reportData);
  }

  /**
   * Arrête tous les jobs planifiés
   */
  stopAll() {
    this.scheduledJobs.forEach((job, name) => {
      if (job && typeof job.stop === 'function') {
        job.stop();
        console.log(`⏹️ Job ${name} arrêté`);
      }
    });
  }

  /**
   * Liste tous les jobs actifs
   */
  listActiveJobs() {
    const jobs: Array<{ name: string; active: boolean }> = [];
    this.scheduledJobs.forEach((job, name) => {
      jobs.push({
        name,
        active: job ? true : false
      });
    });
    return jobs;
  }
}