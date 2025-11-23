import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth.service';


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


  async onSubmit(): Promise<void> {
  if (this.authForm.invalid) {
    Object.keys(this.authForm.controls).forEach(key => {
      this.authForm.get(key)?.markAsTouched();
    });
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  try {
    const { email, password } = this.authForm.value;

    console.log('📧 Email:', email);
    console.log('🎯 Redirection prévue vers:', this.redirectUrl);

    const result = await this.authService.login(email, password);

    console.log('📊 Résultat authentification:', result);

    if (result.success) {
      console.log('✅ Authentification réussie, redirection...');
      this.router.navigate([this.redirectUrl]);
    } else {
      this.errorMessage = result.message;
    }

  } catch (error) {
    console.error('Erreur authentification:', error);
    this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    this.isLoading = false;
  }
}


  useTestAccount(role: 'admin' | 'supervisor' | 'agent'): void {
    let email = '';
    let password = '';

    switch (role) {
      case 'admin':
        email = 'aidasabara1111@gmail.com';
        password = 'passer123'; // Même mot de passe que dans stations.ts
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
