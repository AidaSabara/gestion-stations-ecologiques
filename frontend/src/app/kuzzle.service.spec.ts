// src/app/data-access.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

export const dataAccessGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 ========================================');
  console.log('🔒 DATA ACCESS GUARD - Vérification accès données');
  console.log('🔒 ========================================');

  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();
  const stationId = route.paramMap.get('id');

  console.log('👤 Utilisateur authentifié:', isAuthenticated);
  console.log('👤 Utilisateur actuel:', currentUser);
  console.log('🏭 Station ID demandée:', stationId);

  if (!isAuthenticated || !currentUser) {
    console.log('❌ Utilisateur non authentifié - Redirection vers auth');
    router.navigate(['/auth'], {
      queryParams: {
        redirect: `station/${stationId}/data`,
        stationId: stationId
      }
    });
    return false;
  }

  // Vérifier les permissions d'accès aux données
  const hasDataAccess = currentUser.permissions?.canAccessData;
  const hasStationAccess = authService.hasAccessToStation(stationId!);

  console.log('📊 Permission accès données:', hasDataAccess);
  console.log('🏭 Permission accès station:', hasStationAccess);

  if (!hasDataAccess) {
    console.log('❌ Accès refusé - Pas de permission pour les données');
    router.navigate([`/station/${stationId}`], {
      queryParams: { error: 'no_data_access' }
    });
    return false;
  }

  if (!hasStationAccess) {
    console.log('❌ Accès refusé - Pas d\'accès à cette station');
    router.navigate([`/station/${stationId}`], {
      queryParams: { error: 'no_station_access' }
    });
    return false;
  }

  console.log('✅ Accès aux données autorisé');
  console.log('👤 Nom:', currentUser.name);
  console.log('🎭 Rôle:', currentUser.role);
  console.log('🏭 Station:', currentUser.station_id);
  console.log('✅ ========================================');

  return true;
};
