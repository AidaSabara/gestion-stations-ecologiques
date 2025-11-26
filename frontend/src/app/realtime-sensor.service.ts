import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';
import { SensorReading } from './models/sensor-reading.model';

@Injectable({
  providedIn: 'root'  // Service disponible partout dans l'app
})
export class RealtimeSensorService implements OnDestroy {
  // Instance Kuzzle
  private kuzzle!: Kuzzle;

  // Subject pour émettre les nouvelles données
  private realTimeData$ = new Subject<SensorReading>();

  // État de connexion
  private connectionStatus$ = new BehaviorSubject<boolean>(false);

  // ID de souscription (pour se désabonner)
  private roomId: string | null = null;

  // Configuration Kuzzle
  private readonly INDEX = 'iot';
  private readonly COLLECTION = 'readings';
  private readonly HOST = 'localhost';
  private readonly PORT = 7512;

  constructor() {
    this.initKuzzle();
  }

  /**
   * Initialise la connexion à Kuzzle
   */
  private async initKuzzle(): Promise<void> {
    try {
      this.kuzzle = new Kuzzle(
        new WebSocket(this.HOST, { port: this.PORT })
      );

      await this.kuzzle.connect();
      console.log('✅ Frontend connecté à Kuzzle');
      this.connectionStatus$.next(true);

    } catch (error) {
      console.error('❌ Erreur connexion Kuzzle:', error);
      this.connectionStatus$.next(false);
    }
  }

  /**
   * Récupère les dernières lectures (historique)
   * @param stationId - Filtrer par station (optionnel)
   * @param limit - Nombre max de résultats
   * @returns Liste des lectures
   */
  async getLatestReadings(stationId?: string, limit: number = 50): Promise<SensorReading[]> {
    try {
      const query: any = {};

      if (stationId) {
        query.equals = { stationId };
      }

      const result = await this.kuzzle.document.search(
        this.INDEX,
        this.COLLECTION,
        {
          query,
          sort: { timestamp: 'desc' }
        },
        { size: limit }
      );

      return result.hits.map(hit => ({
        _id: hit._id,
        ...hit._source
      })) as SensorReading[];

    } catch (error) {
      console.error('❌ Erreur récupération données:', error);
      return [];
    }
  }

  /**
   * S'abonner aux mises à jour en temps réel
   * @param stationId - Filtrer par station (optionnel)
   * @returns Observable qui émet chaque nouvelle lecture
   */
  async subscribeToRealtimeUpdates(stationId?: string): Promise<Observable<SensorReading>> {
    try {
      // Se désabonner d'abord si déjà abonné
      if (this.roomId) {
        await this.unsubscribe();
      }

      const filters: any = {};
      if (stationId) {
        filters.equals = { stationId };
      }

      // S'abonner aux notifications Kuzzle
      this.roomId = await this.kuzzle.realtime.subscribe(
        this.INDEX,
        this.COLLECTION,
        filters,
        (notification: any) => {
          // Quand un nouveau document est créé
          if (notification.action === 'create') {
            const reading: SensorReading = {
              _id: notification.result._id,
              ...notification.result._source
            };

            console.log('📊 Nouvelle lecture temps réel:', reading);

            // Émettre la nouvelle donnée
            this.realTimeData$.next(reading);
          }
        }
      );

      console.log('🔔 Abonné aux mises à jour temps réel (Room:', this.roomId, ')');

    } catch (error) {
      console.error('❌ Erreur abonnement temps réel:', error);
    }

    return this.realTimeData$.asObservable();
  }

  /**
   * Se désabonner des mises à jour
   */
  async unsubscribe(): Promise<void> {
    if (this.roomId) {
      try {
        await this.kuzzle.realtime.unsubscribe(this.roomId);
        console.log('🔕 Désabonné');
        this.roomId = null;
      } catch (error) {
        console.error('❌ Erreur désabonnement:', error);
      }
    }
  }

  /**
   * Observable pour surveiller l'état de connexion
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Se déconnecter de Kuzzle
   */
  disconnect(): void {
    if (this.kuzzle) {
      this.kuzzle.disconnect();
      this.connectionStatus$.next(false);
      console.log('🔌 Déconnecté de Kuzzle');
    }
  }

  /**
   * Nettoyage à la destruction du service
   */
  ngOnDestroy(): void {
    this.unsubscribe();
    this.disconnect();
  }
}
