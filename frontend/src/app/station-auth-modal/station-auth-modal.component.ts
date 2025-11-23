import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-station-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './station-auth-modal.component.html',
  styleUrls: ['./station-auth-modal.component.css']
})
export class StationAuthModalComponent {
  @Input() stationId!: string;
  @Input() stationName: string = 'Station';
  @Input() redirectUrl: string = '';
  @Output() authSuccess = new EventEmitter<void>();
  @Output() authFailed = new EventEmitter<string>();

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  // ID unique pour la modal pour éviter les conflits
get modalId(): string {
  return 'stationAuthModal';
}


  constructor(private authService: AuthService) {}

  async onSubmit() {
    // Validation basique
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('🔐 Tentative d\'authentification via modal:', {
        stationId: this.stationId,
        email: this.email
      });

      const result = await this.authService.authenticateForStation(
        this.stationId,
        this.email,
        this.password
      );

      if (result.success) {
        console.log('✅ Authentification réussie via modal');

        // Fermer la modal
        this.closeModal();

        // Émettre l'événement de succès
        this.authSuccess.emit();

        // Réinitialiser le formulaire
        this.resetForm();
      } else {
        this.errorMessage = result.message;
        this.authFailed.emit(result.message);
      }
    } catch (error) {
      console.error('❌ Erreur authentification modal:', error);
      this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
      this.authFailed.emit('Erreur technique');
    } finally {
      this.isLoading = false;
    }
  }

  private closeModal() {
    // Fermer la modal Bootstrap
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  private resetForm() {
    this.email = '';
    this.password = '';
    this.errorMessage = '';
  }

  // Méthode pour ouvrir la modal depuis le parent
  openModal() {
    this.resetForm();
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  // Méthode pour fermer la modal depuis le parent
  close() {
    this.closeModal();

 }
 onAuthSuccess() {
  console.log('✅ Authentification réussie - redirection vers données');
  setTimeout(() => {
    window.location.href = this.redirectUrl; // ou utilise router si tu veux
  }, 500);
}

}
