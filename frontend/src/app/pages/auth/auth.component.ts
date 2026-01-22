import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, LoginResponse } from '../../auth.service';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit {
  authForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  redirectUrl = '/stations';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.authForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.redirectUrl = params['redirect'] || '/stations';
    });

    if (this.authService.isAuthenticated()) {
      console.log('Déjà authentifié, redirection...');
      this.router.navigate([this.redirectUrl]);
    }
  }

  onSubmit(): void {
    if (this.authForm.invalid) {
      Object.keys(this.authForm.controls).forEach(key => {
        this.authForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.authForm.value;

    console.log('📧 Email:', email);

    this.authService.login(email, password).subscribe({
      next: (result) => {
        console.log('📊 Résultat authentification:', result);

        if (result.success) {
          console.log('✅ Authentification réussie');

          // Récupérer l'utilisateur connecté
          const currentUser = this.authService.getCurrentUser();

          if (!currentUser) {
            console.error('❌ Utilisateur non trouvé après connexion');
            this.router.navigate(['/']);
            return;
          }

          console.log('👤 Utilisateur:', currentUser.email);
          console.log('🎭 Rôle:', currentUser.role);
          console.log('🏢 Station ID:', currentUser.station_id);

          // ✅ REDIRECTION INTELLIGENTE SELON LE RÔLE
          setTimeout(() => {
            if (currentUser.role === 'admin') {
              // Admin → Page d'accueil (dashboard)
              console.log('🏠 Redirection admin vers accueil');
              this.router.navigate(['/']);
            } else if (['agent', 'operator', 'supervisor'].includes(currentUser.role)) {
              // Agent, Operator, Supervisor → Leur station
              if (currentUser.station_id) {
                const stationUrl = `/station/${currentUser.station_id}`;
                console.log('🏢 Redirection vers station:', stationUrl);
                this.router.navigate([stationUrl]);
              } else {
                console.warn('⚠️ Utilisateur sans station_id, redirection vers /stations');
                this.router.navigate(['/stations']);
              }
            } else {
              // Rôle inconnu → Accueil par défaut
              console.log('❓ Rôle inconnu, redirection vers accueil');
              this.router.navigate(['/']);
            }
          }, 500);

        } else {
          this.errorMessage = result.message;
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('❌ Erreur authentification:', error);
        this.errorMessage = error.message || 'Erreur de connexion. Veuillez réessayer.';
        this.isLoading = false;
      },
      complete: () => {
        console.log('✅ Login observable terminé');
      }
    });
  }

  useTestAccount(role: 'admin' | 'supervisor' | 'agent'): void {
    let email = '';
    let password = '';

    switch (role) {
      case 'admin':
        email = 'aidasabara1111@gmail.com';
        password = 'passer123';
        break;
      case 'supervisor':
        email = 'supervisor@ecostations.sn';
        password = 'passer123';
        break;
      case 'agent':
        email = 'agent@ecostations.sn';
        password = 'passer123';
        break;
    }

    this.authForm.patchValue({ email, password });
    this.onSubmit();
  }

  private redirectToStations(): void {
    this.router.navigate([this.redirectUrl]);
  }
}
