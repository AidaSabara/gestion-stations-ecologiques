import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, LoginResponse } from '../../auth.service'; // <-- Ajouter l'import LoginResponse

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
  console.log('🎯 Redirection prévue vers:', this.redirectUrl);

  this.authService.login(email, password).subscribe({
    next: (result) => {
      console.log('📊 Résultat authentification:', result);

      if (result.success) {
        console.log('✅ Authentification réussie, redirection...');

        // ✅ DEBUGGING COMPLET
        console.log('🔍 ========== DEBUGGING POST-LOGIN ==========');

        // Vérifier localStorage
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('accessToken');
        console.log('💾 currentUser dans localStorage:', storedUser ? 'OUI' : 'NON');
        console.log('💾 accessToken dans localStorage:', storedToken ? 'OUI' : 'NON');

        if (storedToken) {
          console.log('🔑 Token (premiers 20 chars):', storedToken.substring(0, 20) + '...');
        }

        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            console.log('👤 User email:', user.email);
            console.log('👤 User role:', user.role);
            console.log('👤 User permissions:', user.permissions);
          } catch (e) {
            console.error('❌ Erreur parsing user:', e);
          }
        }

        // Vérifier isAuthenticated
        const isAuth = this.authService.isAuthenticated();
        console.log('🔐 isAuthenticated():', isAuth);

        // Vérifier getCurrentUser
        const currentUser = this.authService.getCurrentUser();
        console.log('👤 getCurrentUser():', currentUser?.email || 'NULL');

        console.log('🔍 ========================================');

        // Attendre un peu avant la redirection
        setTimeout(() => {
          console.log('🚀 Tentative de redirection vers:', this.redirectUrl);
          this.router.navigate([this.redirectUrl]);
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
