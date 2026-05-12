import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { InputComponent } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';

@Component({
  selector: 'app-seller-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent, Button],
  templateUrl: './seller-register.component.html'
})
export class SellerRegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return 'Required';
      if (ctrl.hasError('email')) return 'Invalid email';
      if (ctrl.hasError('minlength')) return 'Min 8 chars';
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

    const { fullName, email, phone, password } = this.form.value;
    this.authService.registerSeller({
      fullName: fullName!,
      email: email!,
      phone: phone!,
      password: password!
    }).subscribe({
      next: () => {
        this.toast.success('Application submitted! Welcome to the portal.');
        this.router.navigate(['/seller']);
      },
      error: (err) => {
        console.log(err)
        this.errorMessage.set(err?.error || 'Registration failed');
        this.loading.set(false);
      }
    });
  }
}
