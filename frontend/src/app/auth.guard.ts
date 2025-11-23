// src/app/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 ========================================');
  console.log('🔒 AUTH GUARD - Vérification d\'accès');
  console.log('🔒 ========================================');

  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();

  console.log('👤 Utilisateur authentifié:', isAuthenticated);
  console.log('👤 Utilisateur actuel:', currentUser);

  if (isAuthenticated && currentUser) {
    console.log('✅ Accès autorisé');
    console.log('👤 Nom:', currentUser.name);
    console.log('🎭 Rôle:', currentUser.role);
    console.log('✅ ========================================');
    return true;
  }

  console.log('❌ Accès refusé - Redirection vers /auth');
  console.log('❌ ========================================');

  // Récupérer l'URL demandée pour redirection après connexion
  const redirectUrl = route.url.map(segment => segment.path).join('/') || 'stations';

  // Rediriger vers la page d'authentification
  router.navigate(['/auth'], {
    queryParams: { redirect: redirectUrl }
  });

  return false;
}
