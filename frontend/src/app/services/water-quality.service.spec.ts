import { TestBed } from '@angular/core/testing';

import { WaterQualityService } from './water-quality.service';

describe('WaterQualityService', () => {
  let service: WaterQualityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WaterQualityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
