import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/order.model';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { InputComponent } from '../../../shared/ui/input/input';
import { Button } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-payment-confirm',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, LoadingSpinnerComponent, InputComponent, Button],
  templateUrl: './payment-confirm.component.html',
})
export class PaymentConfirmComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  orderId = signal('');
  order = signal<Order | null>(null);
  loading = signal(true);
  uploading = signal(false);
  selectedFile = signal<File | null>(null);
  error = signal('');

  form = this.fb.group({
    payerName: ['', Validators.required],
    transferAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    transferTime: ['', Validators.required],
  });

  canSubmit = computed(() => {
    const status = this.order()?.paymentStatus;
    return status === 'PENDING' || status === 'REJECTED';
  });

  statusMessage = computed(() => {
    const order = this.order();
    if (!order) return '';
    switch (order.paymentStatus) {
      case 'WAITING_CONFIRMATION':
        return 'Your payment proof has been submitted and is waiting for seller review.';
      case 'APPROVED':
        return 'Your payment has been approved. No further action is needed.';
      case 'REJECTED':
        return 'Your previous payment proof was rejected. Please review the note and upload a corrected proof.';
      default:
        return 'Submit your bank transfer proof so the seller can review and approve the payment.';
    }
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
    this.orderId.set(orderId);
    this.loadOrder();
  }

  loadOrder() {
    this.loading.set(true);
    this.orderService.getOrder(this.orderId()).subscribe({
      next: (order) => {
        this.order.set(order);
        this.form.patchValue({
          payerName: order.payerName || order.customerName || '',
          transferAmount: order.transferAmount ?? order.totalAmount,
          transferTime: order.transferTime ? this.toLocalDateTimeInput(order.transferTime) : '',
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load order');
        this.loading.set(false);
      },
    });
  }

  onFileChange(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    this.selectedFile.set(files?.length ? files[0] : null);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    this.selectedFile.set(files?.length ? files[0] : null);
  }

  submit() {
    if (!this.canSubmit()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const file = this.selectedFile();
    if (!file) {
      this.error.set('Receipt image is required.');
      return;
    }

    const value = this.form.getRawValue();
    this.uploading.set(true);
    this.error.set('');

    this.orderService.uploadPaymentConfirmation(this.orderId(), {
      receiptImage: file,
      payerName: value.payerName!,
      transferAmount: Number(value.transferAmount),
      transferTime: value.transferTime!,
    }).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.selectedFile.set(null);
        this.toast.success('Payment proof submitted successfully.');
        this.uploading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Upload failed. Please try again.');
        this.uploading.set(false);
      },
    });
  }

  getError(field: 'payerName' | 'transferAmount' | 'transferTime') {
    const control = this.form.get(field);
    if (!control?.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'This field is required';
    if (control.hasError('min')) return 'Value must be greater than zero';
    return 'Invalid value';
  }

  private toLocalDateTimeInput(value: string) {
    return value.slice(0, 16);
  }
}
