import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { mapAccessGuard } from './map-access.guard';

describe('mapAccessGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => mapAccessGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
