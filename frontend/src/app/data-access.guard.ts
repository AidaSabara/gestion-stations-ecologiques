import { CanActivateFn } from '@angular/router';

export const dataAccessGuard: CanActivateFn = (route, state) => {
  return true;
};
