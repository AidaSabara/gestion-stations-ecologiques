import { TestBed } from '@angular/core/testing';

import { RealtimeSensorService } from './realtime-sensor.service';

describe('RealtimeSensorService', () => {
  let service: RealtimeSensorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RealtimeSensorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
