import { Injectable } from '@angular/core';
import { Kuzzle, WebSocket, JSONObject } from 'kuzzle-sdk';

@Injectable({
  providedIn: 'root',
})
export class StationService {
  private kuzzle: Kuzzle;
  private connected = false;

  constructor() {
    this.kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));
  }

  async init(): Promise<void> {
    if (!this.connected) {
      await this.kuzzle.connect();
      this.connected = true;
    }
  }

  async getStations(): Promise<any[]> {
    await this.init();

    try {
      const result = await this.kuzzle.document.search('iot', 'stations', {
        query: { match_all: {} },
        size: 100,
      });
      return result.hits.map((hit) => ({ id: hit._id, ...hit._source }));
    } catch (error) {
      console.error('Erreur lors de la recherche des stations :', error);
      return [];
    }
  }

  async getLatestReading(stationId: string): Promise<JSONObject | null> {
    await this.init();
    const result = await this.kuzzle.document.search('iot', 'readings', {
      query: { term: { stationId } },
      sort: [{ timestamp: 'desc' }],
      size: 1,
    });
    return result.hits[0]?._source ?? null;
  }

  async getLatestAlert(stationId: string): Promise<JSONObject | null> {
    await this.init();
    const result = await this.kuzzle.document.search('iot', 'alerts', {
      query: { term: { stationId } },
      sort: [{ timestamp: 'desc' }],
      size: 1,
    });
    return result.hits[0]?._source ?? null;
  }

  async getStation(stationId: string): Promise<JSONObject | null> {
    await this.init();
    try {
      const result = await this.kuzzle.document.get(
        'iot',
        'stations',
        stationId
      );
      return result._source;
    } catch {
      return null;
    }
  }

  onNewReading(callback: (reading: JSONObject) => void): void {
    this.kuzzle.realtime.subscribe('iot', 'readings', {}, (notif) => {
      if (notif.type === 'document' && notif.action === 'create') {
        callback(notif.result._source);
      }
    });
  }

  onNewCriticalAlert(callback: (alert: JSONObject) => void): void {
    this.kuzzle.realtime.subscribe(
      'iot',
      'alerts',
      {
        query: {
          bool: { must: [{ term: { level: 'critical' } }] },
        },
      },
      (notif) => {
        if (notif.type === 'document' && notif.action === 'create') {
          callback(notif.result._source);
        }
      }
    );
  }
}
