import { Injectable } from '@angular/core';
import { KuzzleService } from '../kuzzle.service';

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  constructor(private kuzzleService: KuzzleService) {}

  async getAlerts() {
    return this.kuzzleService.getActiveAlerts();
  }
}
