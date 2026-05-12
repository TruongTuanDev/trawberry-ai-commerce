import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, NgClass, DatePipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { Order, OrderItem, OrderStatus, PaymentStatus, Tracking } from '../../../core/models/order.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, NgClass, DatePipe, LoadingSpinnerComponent],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  order = signal<Order | null>(null);
  tracking = signal<Tracking | null>(null);
  loading = signal(true);
  trackingLoading = signal(false);
  actionLoading = signal(false);

  reviewingItem = signal<OrderItem | null>(null);
  reviewRating = signal(0);
  reviewHover = signal(0);
  reviewContent = signal('');
  reviewSubmitting = signal(false);
  issueNote = signal('');

  itemsTotal() {
    return this.order()?.items.reduce((acc, i) => acc + i.priceAtPurchase * i.quantity, 0) ?? 0;
  }

  formatAttrs(attrs: string | undefined) {
    return attrs ?? '';
  }

  canShowDeliveredActions(): boolean {
    const order = this.order();
    return !!order && order.status === 'DELIVERED' && !order.customerCompletedAt && !order.deliveryIssue;
  }

  canReviewItem(item: OrderItem): boolean {
    const order = this.order();
    return !!order && order.status === 'DELIVERED' && !item.reviewId;
  }

  ngOnInit(): void {
    this.reloadOrder();
  }

  reloadOrder(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading.set(true);
    this.orderService.getOrder(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
        if (o.status === 'SHIPPING' || o.status === 'DELIVERED') {
          this.loadTracking(o.id);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  loadTracking(orderId: string): void {
    this.trackingLoading.set(true);
    this.orderService.getTracking(orderId).subscribe({
      next: (t) => { this.tracking.set(t); this.trackingLoading.set(false); },
      error: () => this.trackingLoading.set(false)
    });
  }

  completeOrder(): void {
    const order = this.order();
    if (!order || this.actionLoading()) return;

    this.actionLoading.set(true);
    this.orderService.completeOrder(order.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.toast.success('Order marked as complete.');
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Failed to complete order');
        this.actionLoading.set(false);
      }
    });
  }

  reportNotReceived(): void {
    const order = this.order();
    if (!order || this.actionLoading()) return;

    this.actionLoading.set(true);
    this.orderService.reportNotReceived(order.id, this.issueNote().trim() || undefined).subscribe({
      next: (issue) => {
        this.order.update(current => current ? { ...current, deliveryIssue: issue } : current);
        this.toast.success('Your delivery issue has been reported.');
        this.issueNote.set('');
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Failed to report delivery issue');
        this.actionLoading.set(false);
      }
    });
  }

  startReview(item: OrderItem): void {
    this.reviewingItem.set(item);
    this.reviewRating.set(item.reviewRate ?? 0);
    this.reviewHover.set(0);
    this.reviewContent.set(item.reviewContent ?? '');
  }

  closeReview(): void {
    this.reviewingItem.set(null);
    this.reviewRating.set(0);
    this.reviewHover.set(0);
    this.reviewContent.set('');
  }

  selectRating(value: number): void {
    this.reviewRating.set(value);
  }

  onIssueNoteInput(event: Event): void {
    this.issueNote.set((event.target as HTMLTextAreaElement)?.value ?? '');
  }

  onReviewContentInput(event: Event): void {
    this.reviewContent.set((event.target as HTMLTextAreaElement)?.value ?? '');
  }

  submitReview(): void {
    const order = this.order();
    const item = this.reviewingItem();
    if (!order || !item) return;
    if (this.reviewRating() < 1) {
      this.toast.error('Please select a rating from 1 to 5 stars.');
      return;
    }

    this.reviewSubmitting.set(true);
    this.orderService.submitReview(order.id, item.id, {
      rate: this.reviewRating(),
      content: this.reviewContent().trim() || undefined,
    }).subscribe({
      next: (review) => {
        this.order.update(current => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map(existing => existing.id === item.id ? {
              ...existing,
              reviewId: review.id,
              reviewRate: review.rate,
              reviewContent: review.content,
              reviewCreatedAt: review.createdAt,
            } : existing),
          };
        });
        this.toast.success('Review submitted successfully.');
        this.reviewSubmitting.set(false);
        this.closeReview();
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Failed to submit review');
        this.reviewSubmitting.set(false);
      }
    });
  }

  orderStatusClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      NEW: 'badge-purple', ASSEMBLING: 'badge-yellow',
      SHIPPING: 'badge-yellow', DELIVERED: 'badge-green', CANCELLED: 'badge-red'
    };
    return map[status] ?? 'badge-gray';
  }

  paymentStatusClass(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      PENDING: 'badge-gray', WAITING_CONFIRMATION: 'badge-yellow',
      APPROVED: 'badge-green', REJECTED: 'badge-red', REFUNDED: 'badge-gray'
    };
    return map[status] ?? 'badge-gray';
  }

  trackingBadge(status?: string): string {
    if (!status) return 'badge-gray';
    if (status === 'DELIVERED') return 'badge-green';
    if (status === 'IN_TRANSIT' || status === 'PICKED_UP') return 'badge-yellow';
    return 'badge-purple';
  }
}
