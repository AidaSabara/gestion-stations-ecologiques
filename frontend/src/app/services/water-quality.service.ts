import { Injectable } from '@angular/core';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';

@Injectable({
  providedIn: 'root'
})
export class WaterQualityService {
  private kuzzle: Kuzzle;

  constructor() {
    this.kuzzle = new Kuzzle(new WebSocket('localhost', { port: 7512 }));
  }

  async connect() {
    if (!this.kuzzle.connected) {
      await this.kuzzle.connect();
      console.log('✅ Connecté à Kuzzle');
    }
  }

  async getWaterQualityData(stationId: string) {
    try {
      await this.connect();

      const result = await this.kuzzle.document.search('iot', 'water_quality', {
        query: {
          term: { id_station: stationId }
        }
      });

      return result.hits.map((doc: any) => doc._source);
    } catch (err) {
      console.error('❌ Erreur récupération données eau:', err);
      return [];
    }
  }
}
