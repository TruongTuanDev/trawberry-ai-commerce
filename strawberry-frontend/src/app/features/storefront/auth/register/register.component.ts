import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { InputComponent } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent, Button],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  error = signal('');

  form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return 'This field is required';
      if (ctrl.hasError('email')) return 'Valid email is required';
      if (ctrl.hasError('minlength')) return 'Password must be at least 8 characters';
    }
    return '';
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { fullName, email, phone, password } = this.form.value;
    this.authService.register({
      fullName: fullName!, email: email!, password: password!, phone: phone ?? undefined
    }).subscribe({
      next: () => {
        this.toast.success('Account created! Welcome to Strawberry.');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Registration failed. Try again.');
        this.loading.set(false);
      }
    });
  }
}
