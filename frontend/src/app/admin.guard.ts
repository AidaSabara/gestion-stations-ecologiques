// src/app/guards/admin.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { User } from './models/user.model';
import { map, take } from 'rxjs/operators';

/**
 * Type des clés de permissions
 */
type PermissionKey = keyof User['permissions'];

/**
 * Guard pour protéger les routes d'administration
 * Vérifie si l'utilisateur a les droits admin/supervisor ET la permission canManageUsers
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      // 1. Vérifier si l'utilisateur est connecté
      if (!user) {
        console.warn('🚫 Accès refusé: Utilisateur non connecté');
        router.navigate(['/auth']);
        return false;
      }

      // 2. Vérifier si l'utilisateur a la permission canManageUsers
      if (!user.permissions?.canManageUsers) {
        console.warn('🚫 Accès refusé: Permission canManageUsers requise');
        router.navigate(['/']);
        return false;
      }

      // 3. Vérifier le rôle (admin ou supervisor)
      const allowedRoles = ['admin', 'supervisor'];
      if (!allowedRoles.includes(user.role)) {
        console.warn('🚫 Accès refusé: Rôle insuffisant (requis: admin/supervisor)');
        router.navigate(['/']);
        return false;
      }

      console.log('✅ Accès autorisé à l\'administration pour:', user.name);
      return true;
    })
  );
};

/**
 * Guard strict pour les super administrateurs uniquement
 * Utilisé pour les actions critiques (suppression de comptes, etc.)
 */
export const superAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.warn('🚫 Accès refusé: Utilisateur non connecté');
        router.navigate(['/auth']);
        return false;
      }

      // Seul le rôle 'admin' peut accéder
      if (user.role !== 'admin') {
        console.warn('🚫 Accès refusé: Rôle admin requis');
        router.navigate(['/']);
        return false;
      }

      console.log('✅ Accès super admin autorisé pour:', user.name);
      return true;
    })
  );
};

/**
 * Factory pour créer des guards de permission personnalisés
 * Permet de protéger des routes selon une permission spécifique
 */
export const createPermissionGuard = (permission: PermissionKey): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
      take(1),
      map(user => {
        // Vérifier la connexion
        if (!user) {
          console.warn(`🚫 Accès refusé: Utilisateur non connecté`);
          router.navigate(['/auth']);
          return false;
        }

        // Vérifier si les permissions existent
        if (!user.permissions) {
          console.warn(`🚫 Accès refusé: Aucune permission définie`);
          router.navigate(['/']);
          return false;
        }

        // Vérification sécurisée de la permission
        // Conversion explicite en string pour éviter l'erreur TypeScript
        const permissionKey = String(permission) as keyof typeof user.permissions;
        if (!user.permissions[permissionKey]) {
          console.warn(`🚫 Accès refusé: Permission ${String(permission)} requise`);
          router.navigate(['/']);
          return false;
        }

        console.log(`✅ Permission ${String(permission)} validée pour:`, user.name);
        return true;
      })
    );
  };
};

/**
 * Factory pour créer des guards combinant rôle + permission
 * Utile pour des protections renforcées
 */
export const createRolePermissionGuard = (
  allowedRoles: string[],
  permission: PermissionKey
): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          console.warn('🚫 Accès refusé: Utilisateur non connecté');
          router.navigate(['/auth']);
          return false;
        }

        // Vérifier le rôle
        if (!allowedRoles.includes(user.role)) {
          console.warn(`🚫 Accès refusé: Rôle requis: ${allowedRoles.join(', ')}`);
          router.navigate(['/']);
          return false;
        }

        // Vérifier la permission avec conversion explicite
        const permissionKey = String(permission) as keyof typeof user.permissions;
        if (!user.permissions?.[permissionKey]) {
          console.warn(`🚫 Accès refusé: Permission ${String(permission)} requise`);
          router.navigate(['/']);
          return false;
        }

        console.log(`✅ Accès autorisé (rôle + permission) pour:`, user.name);
        return true;
      })
    );
  };
};

/**
 * Guard pour vérifier l'accès à une station spécifique
 * Utilisé pour s'assurer qu'un utilisateur accède uniquement à SA station
 */
export const stationAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.warn('🚫 Accès refusé: Utilisateur non connecté');
        router.navigate(['/auth']);
        return false;
      }

      // Récupérer l'ID de la station depuis les paramètres de la route
      const requestedStationId = route.params['stationId'] || route.queryParams['stationId'];

      // Les admins/superviseurs peuvent accéder à toutes les stations
      if (['admin', 'supervisor'].includes(user.role)) {
        return true;
      }

      // Pour les autres, vérifier que c'est leur station
      if (user.station_id !== requestedStationId) {
        console.warn('🚫 Accès refusé: Station non autorisée');
        router.navigate(['/']);
        return false;
      }

      console.log(`✅ Accès station ${requestedStationId} autorisé pour:`, user.name);
      return true;
    })
  );
};

/**
 * Guards prédéfinis pour chaque permission
 */
export const alertsGuard = createPermissionGuard('canAccessAlerts');
export const graphsGuard = createPermissionGuard('canAccessGraphs');
export const filtersGuard = createPermissionGuard('canAccessFilters');
export const dataGuard = createPermissionGuard('canAccessData');
export const manageUsersGuard = createPermissionGuard('canManageUsers');

/**
 * Guards combinés rôle + permission (pour sécurité renforcée)
 */
export const adminAlertsGuard = createRolePermissionGuard(
  ['admin', 'supervisor'],
  'canAccessAlerts'
);

export const adminGraphsGuard = createRolePermissionGuard(
  ['admin', 'supervisor', 'analyst'],
  'canAccessGraphs'
);

export const adminFiltersGuard = createRolePermissionGuard(
  ['admin', 'supervisor', 'technician'],
  'canAccessFilters'
);

export const adminDataGuard = createRolePermissionGuard(
  ['admin', 'supervisor', 'analyst'],
  'canAccessData'
);

/**
 * Guard pour vérifier si l'utilisateur est actif
 */
export const activeUserGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.warn('🚫 Accès refusé: Utilisateur non connecté');
        router.navigate(['/auth']);
        return false;
      }

      if (!user.active) {
        console.warn('🚫 Accès refusé: Compte utilisateur désactivé');
        authService.logout();
        router.navigate(['/auth']);
        return false;
      }

      return true;
    })
  );
};
