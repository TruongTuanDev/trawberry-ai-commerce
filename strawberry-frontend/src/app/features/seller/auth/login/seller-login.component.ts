import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { InputComponent } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';

@Component({
  selector: 'app-seller-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent, Button],
  templateUrl: './seller-login.component.html',
})
export class SellerLoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return 'Required';
      if (ctrl.hasError('email')) return 'Invalid email';
      if (ctrl.hasError('minlength')) return 'Too short';
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
        if (this.authService.currentUser()?.role === 'SELLER') {
          this.toast.success('Signed in successfully');
          this.router.navigate(['/seller/shops']);
        } else {
          this.toast.error('Insufficient permissions');
          this.authService.logout();
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Invalid credentials');
        this.loading.set(false);
      },
    });
  }
}
