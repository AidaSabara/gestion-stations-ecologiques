import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // S'abonner aux changements de l'utilisateur
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        console.log('👤 Sidebar - Utilisateur actuel:', user);
        console.log('🛡️ Permissions:', user?.permissions);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasPermission(permission: string): boolean {
    if (!this.currentUser || !this.currentUser.permissions) {
      console.log(`❌ Pas de permission ${permission}: pas d'utilisateur`);
      return false;
    }

    const hasPerm = this.currentUser.permissions[permission as keyof typeof this.currentUser.permissions] === true;
    console.log(`🔍 hasPermission(${permission}):`, hasPerm);
    return hasPerm;
  }

  logout(): void {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      this.authService.logout();
    }
  }
}
