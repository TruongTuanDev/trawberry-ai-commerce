import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, NgClass, DatePipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { Order, OrderStatus, PaymentStatus } from '../../../core/models/order.model';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, NgClass, DatePipe, LoadingSpinnerComponent],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  private orderService = inject(OrderService);

  orders = signal<Order[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.orderService.getOrders().subscribe({
      next: (o) => { this.orders.set(o); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  orderStatusClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      NEW: 'badge-purple',
      ASSEMBLING: 'badge-yellow',
      SHIPPING: 'badge-yellow',
      DELIVERED: 'badge-green',
      CANCELLED: 'badge-red',
    };
    return map[status] ?? 'badge-gray';
  }

  paymentStatusClass(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      PENDING: 'badge-gray',
      WAITING_CONFIRMATION: 'badge-yellow',
      APPROVED: 'badge-green',
      REJECTED: 'badge-red',
      REFUNDED: 'badge-gray',
    };
    return map[status] ?? 'badge-gray';
  }
}
