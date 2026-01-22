import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth.service';
import { User } from '../../models/user.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // S'abonner aux changements de l'utilisateur
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        console.log('👤 Sidebar - Utilisateur actuel:', user);
        console.log('🛡️ Permissions:', user?.permissions);
        console.log('🎭 Rôle:', user?.role);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   */
  hasPermission(permission: string): boolean {
    if (!this.currentUser || !this.currentUser.permissions) {
      return false;
    }

    const hasPerm = this.currentUser.permissions[permission as keyof typeof this.currentUser.permissions] === true;
    return hasPerm;
  }

  /**
   * Vérifie si l'utilisateur est admin
   */
  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  /**
   * Vérifie si l'utilisateur est supervisor
   */
  isSupervisor(): boolean {
    return this.currentUser?.role === 'supervisor';
  }

  /**
   * Vérifie si l'utilisateur est agent
   */
  isAgent(): boolean {
    return this.currentUser?.role === 'agent';
  }

  /**
   * Déconnexion avec redirection immédiate
   */
  logout(): void {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      console.log('🚪 Déconnexion en cours...');

      // 1. Nettoyer l'authentification
      this.authService.logout();

      // 2. Redirection immédiate vers /auth (comme dans votre guard)
      this.router.navigate(['/auth']).then(() => {
        console.log('✅ Redirection vers /auth effectuée');
        // 3. Forcer le rechargement de la page pour s'assurer que tout est nettoyé
        window.location.reload();
      });
    }
  }
}
