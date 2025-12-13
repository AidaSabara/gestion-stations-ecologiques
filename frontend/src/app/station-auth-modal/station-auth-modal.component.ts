import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, LoginResponse } from '../auth.service';

@Component({
  selector: 'app-station-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './station-auth-modal.component.html',
  styleUrls: ['./station-auth-modal.component.css']
})
export class StationAuthModalComponent {
  @Input() stationId!: string;
  @Input() redirectUrl: string = '';
  @Input() stationName: string = 'Station';
  @Output() authSuccess = new EventEmitter<void>();
  @Output() authFailed = new EventEmitter<string>();

  @ViewChild('modalElement') modalElement!: ElementRef; // Ajouter cette référence

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  isModalOpen: boolean = false; // Ajouter cet état

  // ID unique pour la modal
  get modalId(): string {
    return 'stationAuthModal';
  }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Ouvrir la modal
  openModal() {
    console.log('🔐 Ouverture modal auth');
    this.resetForm();
    this.isModalOpen = true;

    // Forcer l'affichage de la modal Bootstrap
    setTimeout(() => {
      const modalElement = document.getElementById(this.modalId);
      if (modalElement) {
        // Initialiser la modal Bootstrap
        const modal = new (window as any).bootstrap.Modal(modalElement, {
          backdrop: 'static',
          keyboard: false
        });
        modal.show();

        // Écouter l'événement de fermeture
        modalElement.addEventListener('hidden.bs.modal', () => {
          this.isModalOpen = false;
          this.resetForm();
        });
      }
    }, 100);
  }

  // Fermer la modal
  closeModal() {
    console.log('❌ Fermeture modal auth');
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    this.isModalOpen = false;
    this.resetForm();
  }

  // Soumettre le formulaire
onSubmit() {
  // Validation basique
  if (!this.email || !this.password) {
    this.errorMessage = 'Veuillez remplir tous les champs';
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  console.log('🔐 Tentative d\'authentification via modal:', {
    stationId: this.stationId,
    email: this.email,
    redirectUrl: this.redirectUrl // Ajouter pour debug
  });

  // ✅ Utiliser .subscribe() au lieu de await
  this.authService.authenticateForStation(
    this.stationId,
    this.email,
    this.password
  ).subscribe({
    next: (result) => {
      console.log('📊 Résultat authentification modal:', result);

      // ✅ Vérifier le format de la réponse
      if (result.success) {
        console.log('✅ Authentification réussie via modal');
        console.log('🔑 Token stocké:', !!localStorage.getItem('accessToken'));
        console.log('👤 User stocké:', !!localStorage.getItem('currentUser'));
        console.log('📍 Redirection vers:', this.redirectUrl);

        // Fermer la modal
        this.closeModal();

        // Émettre l'événement de succès
        this.authSuccess.emit();

        // Réinitialiser le formulaire
        this.resetForm();

        // ✅ CORRECTION: Ne pas rediriger ici, laisser le parent gérer
        // La redirection sera faite par onAuthSuccess() dans StationDetailComponent

      } else {
        // ✅ Gérer l'échec d'authentification
        console.error('❌ Échec authentification:', result.message);
        this.errorMessage = result.message || 'Authentification échouée';
        this.authFailed.emit(result.message || 'Authentification échouée');
      }

      this.isLoading = false;
    },
    error: (error) => {
      // ✅ Gérer les erreurs HTTP
      console.error('❌ Erreur authentification modal:', error);
      this.errorMessage = error.message || 'Erreur de connexion. Veuillez réessayer.';
      this.authFailed.emit('Erreur technique');
      this.isLoading = false;
    }
  });
}

  // Navigation vers la page des données
  private navigateToStationData(): void {
    console.log('🚀 Navigation vers /station/' + this.stationId + '/data');

    this.router.navigate(['/station', this.stationId, 'data'])
      .then(success => {
        if (success) {
          console.log('✅ Navigation réussie');
        } else {
          console.error('❌ Échec navigation');
          // Fallback
          window.location.href = `/station/${this.stationId}/data`;
        }
      })
      .catch(error => {
        console.error('❌ Erreur navigation:', error);
        window.location.href = `/station/${this.stationId}/data`;
      });
  }

  // Réinitialiser le formulaire
  private resetForm(): void {
    this.email = '';
    this.password = '';
    this.errorMessage = '';
    this.isLoading = false;
  }
}
