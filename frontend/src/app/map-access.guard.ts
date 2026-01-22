// src/app/map-access.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * 🗺️ Guard spécifique pour l'accès à la carte complète
 *
 * Règles :
 * - Admin : Accès à TOUTES les stations sur la carte
 * - Agent/Supervisor : Redirection vers leur station spécifique
 */
export const mapAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🗺️ ========================================');
  console.log('🗺️ MAP ACCESS GUARD - Vérification accès carte');
  console.log('🗺️ ========================================');

  // ✅ Étape 1 : Vérifier l'authentification
  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();

  if (!isAuthenticated || !currentUser) {
    console.log('❌ Non authentifié - Redirection vers /auth');
    router.navigate(['/auth'], {
      queryParams: { redirect: state.url }
    });
    return false;
  }

  console.log('👤 Utilisateur:', currentUser.email);
  console.log('🎭 Rôle:', currentUser.role);
  console.log('🏭 Station ID:', currentUser.station_id);

  // ✅ Étape 2 : Vérifier le rôle
  if (currentUser.role === 'admin') {
    console.log('✅ ADMIN - Accès à la carte complète autorisé');
    console.log('✅ ========================================');
    return true;
  }

  // ❌ Étape 3 : Agent/Supervisor → Redirection vers leur station
  console.log('⚠️ AGENT/SUPERVISOR - Redirection vers station spécifique');
  console.log('📍 Station cible:', currentUser.station_id);
  console.log('⚠️ ========================================');

  if (!currentUser.station_id) {
    console.error('❌ ERREUR : Aucune station_id pour cet utilisateur !');
    alert('Erreur : Aucune station associée à votre compte. Contactez l\'administrateur.');
    router.navigate(['/']);
    return false;
  }

  // Redirection vers la station de l'utilisateur
  router.navigate(['/station', currentUser.station_id]);
  return false;
};
