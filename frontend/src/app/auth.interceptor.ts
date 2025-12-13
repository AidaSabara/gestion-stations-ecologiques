// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 🔑 Récupérer le token
    const token = this.authService.getToken();

    // 🚫 Ne pas ajouter le token aux requêtes de login
    const isAuthRequest = request.url.includes('/auth/login') ||
                          request.url.includes('/auth/register');

    // ➕ Ajouter le token si présent et pas une requête d'authentification
    if (token && !isAuthRequest) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('🔐 Token ajouté à la requête:', request.url);
    }

    // 📡 Envoyer la requête et gérer les erreurs
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur HTTP:', error);

        // 🚪 Token invalide ou expiré (401)
        if (error.status === 401) {
          console.warn('⚠️ Token invalide ou expiré (401), déconnexion...');
          this.authService.logout();
          this.router.navigate(['/auth'], {
            queryParams: { redirect: this.router.url }
          });
        }

        // 🚫 Accès interdit (403)
        if (error.status === 403) {
          console.warn('⚠️ Accès interdit (403)');
          alert('Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.');
        }

        return throwError(() => error);
      })
    );
  }
}
