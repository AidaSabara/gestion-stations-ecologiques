// src/app/data-access.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

export const dataAccessGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 ========================================');
  console.log('🔒 DATA ACCESS GUARD - Vérification d\'accès');
  console.log('🔒 Route demandée:', state.url);
  console.log('🔒 ========================================');

  // ✅ Étape 1 : Vérifier l'authentification
  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();

  console.log('👤 isAuthenticated():', isAuthenticated);
  console.log('👤 getCurrentUser():', currentUser?.email || 'NULL');

  // 🔍 DEBUG APPROFONDI
  const token = authService.getToken();
  console.log('🔑 Token présent:', !!token);
  if (token) {
    console.log('🔑 Token (20 premiers chars):', token.substring(0, 20) + '...');
  }

  const storedUser = localStorage.getItem('currentUser');
  const storedToken = localStorage.getItem('accessToken');
  console.log('💾 localStorage currentUser:', !!storedUser);
  console.log('💾 localStorage accessToken:', !!storedToken);

  if (!isAuthenticated || !currentUser) {
    console.log('❌ Accès refusé - Non authentifié');
    console.log('❌ Cause:', !currentUser ? 'User NULL' : 'isAuthenticated false');
    console.log('❌ Redirection vers /auth');
    console.log('❌ ========================================');

    router.navigate(['/auth'], {
      queryParams: { redirect: state.url }
    });

    return false;
  }

  console.log('✅ Utilisateur authentifié confirmé');
  console.log('👤 Email:', currentUser.email);
  console.log('🎭 Rôle:', currentUser.role);
  console.log('🔐 Permissions:', JSON.stringify(currentUser.permissions, null, 2));

  // 🛡️ Étape 2 : Vérifier la permission "canAccessData"
  console.log('🔐 Vérification permission: canAccessData');
  const hasDataAccess = authService.hasPermission('canAccessData');
  console.log('🔐 canAccessData:', hasDataAccess);

  if (!hasDataAccess) {
    console.log('⚠️ Permission "canAccessData" refusée');
    console.log('⚠️ Rôle:', currentUser.role);
    console.log('⚠️ Permissions:', currentUser.permissions);
    console.log('⚠️ ========================================');

    alert('Accès refusé : Vous n\'avez pas la permission d\'accéder aux données.');
    router.navigate(['/stations']);
    return false;
  }

  console.log('✅ Permission canAccessData accordée');

  // 📊 Étape 3 : Vérifier les permissions additionnelles (si spécifiées)
  const requiredPermission = route.data['permission'] as keyof typeof currentUser.permissions | undefined;

  if (requiredPermission) {
    console.log('🔐 Permission additionnelle requise:', requiredPermission);

    const hasPermission = authService.hasPermission(requiredPermission);
    console.log('🔐 Permission accordée:', hasPermission);

    if (!hasPermission) {
      console.log('⚠️ Permission refusée:', requiredPermission);
      console.log('⚠️ ========================================');

      alert(`Accès refusé : Vous n'avez pas la permission "${requiredPermission}"`);
      router.navigate(['/stations']);
      return false;
    }
  }

  // 🎭 Étape 4 : Vérifier le rôle (si spécifié)
  const requiredRole = route.data['role'] as 'admin' | 'supervisor' | 'agent' | undefined;

  if (requiredRole) {
    console.log('🎭 Rôle requis:', requiredRole);
    console.log('🎭 Rôle actuel:', currentUser.role);

    const hasRequiredRole = currentUser.role === requiredRole || currentUser.role === 'admin';

    if (!hasRequiredRole) {
      console.log('⚠️ Rôle insuffisant');
      console.log('⚠️ ========================================');

      alert(`Accès refusé : Cette page nécessite le rôle "${requiredRole}"`);
      router.navigate(['/stations']);
      return false;
    }
  }

  // ✅ Accès autorisé
  console.log('✅ ========================================');
  console.log('✅ ACCÈS AUTORISÉ');
  console.log('✅ Route:', state.url);
  console.log('✅ User:', currentUser.email);
  console.log('✅ Role:', currentUser.role);
  console.log('✅ ========================================');

  return true;
};
