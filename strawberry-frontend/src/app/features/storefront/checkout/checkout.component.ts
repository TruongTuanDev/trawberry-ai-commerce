import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CurrencyPipe, NgClass } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { ShippingService } from '../../../core/services/shipping.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { ShippingZone, ShippingMethod } from '../../../core/models/shipping.model';
import { InputComponent } from '../../../shared/ui/input/input';
import { Button } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, NgClass, LoadingSpinnerComponent, InputComponent, Button],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private shippingService = inject(ShippingService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  cart = this.cartService.cart;
  zones = signal<ShippingZone[]>([]);
  methods = signal<ShippingMethod[]>([]);
  loading = signal(true);
  submitting = signal(false);
  error = signal('');

  form = this.fb.group({
    customerName: ['', Validators.required],
    customerPhone: ['', Validators.required],
    customerEmail: ['', [Validators.required, Validators.email]],
    shippingAddress: ['', Validators.required],
    customerNote: [''],
    shippingZoneId: ['', Validators.required],
    shippingMethodId: ['', Validators.required],
  });

  selectedShippingCost() {
    const methodId = this.form.get('shippingMethodId')?.value;
    return this.methods().find(m => m.id === methodId)?.basePrice ?? 0;
  }

  getError(field: string): string {
    const ctrl = this.form.get(field);
    if (ctrl?.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return 'This field is required';
      if (ctrl.hasError('email')) return 'Invalid email address';
    }
    return '';
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.form.patchValue({ customerEmail: user.email, customerName: user.fullName });
    }
    if (!this.cart()) {
      this.cartService.load().subscribe({ next: () => this.loadZones(), error: () => this.loading.set(false) });
    } else {
      this.loadZones();
    }
  }

  loadZones(): void {
    this.shippingService.getZones().subscribe({
      next: (z) => { this.zones.set(z); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onZoneChange(): void {
    const zoneId = this.form.get('shippingZoneId')?.value;
    this.form.patchValue({ shippingMethodId: '' });
    this.methods.set([]);
    if (zoneId) {
      this.shippingService.getMethods(zoneId).subscribe({
        next: (m) => this.methods.set(m),
        error: () => {}
      });
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const v = this.form.value;
    this.orderService.checkout({
      customerName: v.customerName!,
      customerPhone: v.customerPhone!,
      customerEmail: v.customerEmail!,
      shippingAddress: v.shippingAddress!,
      customerNote: v.customerNote ?? '',
      shippingZoneId: v.shippingZoneId!,
      shippingMethodId: v.shippingMethodId!,
    }).subscribe({
      next: (orders) => {
        this.toast.success('Order placed successfully!');
        const orderId = orders[0]?.id;
        this.router.navigate(['/checkout/payment', orderId]);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Checkout failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }
}
