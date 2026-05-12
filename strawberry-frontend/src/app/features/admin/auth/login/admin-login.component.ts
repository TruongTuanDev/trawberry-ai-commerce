import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { InputComponent } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent, Button],
  templateUrl: './admin-login.component.html',
  styles: [`
    :host {
      display: block;
      background-color: #111827;
      min-height: 100vh;
    }
    ::ng-deep .admin-input input {
      background-color: #1f2937 !important;
      border-color: #374151 !important;
      color: white !important;
    }
    ::ng-deep .admin-input input:focus {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
    }
  `]
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return 'Required';
      if (ctrl.hasError('email')) return 'Invalid identity';
      if (ctrl.hasError('minlength')) return 'Complexity error';
    }
    return '';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.value;
    this.authService.login({ email: email!, password: password! }).subscribe({
      next: (res) => {
        if (this.authService.currentUser()?.role === 'ADMIN') {
          this.toast.success('Authentication successful. Welcome, Admin.');
          this.router.navigate(['/admin']);
        } else {
          this.toast.error('Access Denied: Improper Clearance');
          this.authService.logout();
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Authentication Failed');
        this.loading.set(false);
      }
    });
  }
}
