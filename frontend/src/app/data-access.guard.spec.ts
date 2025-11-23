import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { dataAccessGuard } from './data-access.guard';

describe('dataAccessGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => dataAccessGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
