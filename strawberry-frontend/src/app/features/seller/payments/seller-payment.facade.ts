import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, of, tap } from 'rxjs';
import { SellerOrderApiService, PaymentDetail } from '../../../core/api/seller-order-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShopContextService } from '../../../core/services/shop-context.service';

export type PaymentStatusFilter = 'ALL' | 'WAITING_CONFIRMATION' | 'APPROVED' | 'REJECTED';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function defaultFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return formatDate(date);
}

function defaultToDate(): string {
  return formatDate(new Date());
}

function paymentPriority(status: string): number {
  switch (status) {
    case 'WAITING_CONFIRMATION':
      return 0;
    case 'APPROVED':
      return 1;
    case 'REJECTED':
      return 2;
    case 'REFUNDED':
      return 3;
    default:
      return 4;
  }
}

function paymentTimestamp(payment: PaymentDetail): number {
  return new Date(payment.submittedAt || payment.reviewedAt || payment.orderCreatedAt).getTime();
}

@Injectable({ providedIn: 'root' })
export class SellerPaymentFacade {
  private api = inject(SellerOrderApiService);
  private toast = inject(ToastService);
  private context = inject(ShopContextService);

  payments = signal<PaymentDetail[]>([]);
  loading = signal(false);
  loadingMore = signal(false);
  processingId = signal<string | null>(null);

  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  readonly pageSize = signal(20);
  readonly hasMore = computed(() => this.currentPage() < this.totalPages() - 1);

  search = signal('');
  status = signal<PaymentStatusFilter>('ALL');
  fromDate = signal(defaultFromDate());
  toDate = signal(defaultToDate());

  loadPayments(page = 0, append = false): Observable<unknown> {
    const shopId = this.context.currentShopId();
    if (!shopId) return of(null as unknown);

    if (append) this.loadingMore.set(true);
    else this.loading.set(true);

    const status = this.status() === 'ALL' ? undefined : this.status();

    return this.api.getShopPayments(
      shopId,
      page,
      this.pageSize(),
      this.search().trim() || undefined,
      status,
      this.fromDate(),
      this.toDate(),
    ).pipe(
      tap((res) => {
        const nextContent = append ? [...this.payments(), ...res.content] : res.content;
        this.payments.set(this.dedupeAndSort(nextContent));
        this.currentPage.set(res.number);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
      }),
      finalize(() => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }),
    );
  }

  initialize() {
    this.resetPaging();
    this.loadPayments(0, false).subscribe({
      error: (err: any) => this.toast.error(err?.error?.message ?? 'Failed to load payments'),
    });
  }

  loadNextPage() {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;

    this.loadPayments(this.currentPage() + 1, true).subscribe({
      error: (err: any) => this.toast.error(err?.error?.message ?? 'Failed to load more payments'),
    });
  }

  setSearch(search: string) {
    this.search.set(search);
    this.reloadWithCurrentFilters();
  }

  setStatus(status: PaymentStatusFilter) {
    this.status.set(status);
    this.reloadWithCurrentFilters();
  }

  setDateRange(fromDate: string, toDate: string) {
    this.fromDate.set(fromDate);
    this.toDate.set(toDate);
    this.reloadWithCurrentFilters();
  }

  approve(orderId: string) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.processingId.set(orderId);
    this.api.approvePayment(shopId, orderId).pipe(
      finalize(() => this.processingId.set(null)),
    ).subscribe({
      next: () => {
        this.toast.success('Payment approved successfully');
        this.updateLocalPayment(orderId, {
          paymentStatus: 'APPROVED',
          reviewedAt: new Date().toISOString(),
          reviewNote: undefined,
        });
      },
      error: (err) => this.toast.error(err?.error?.message ?? 'Failed to approve payment'),
    });
  }

  reject(orderId: string, reason?: string) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.processingId.set(orderId);
    this.api.rejectPayment(shopId, orderId, reason).pipe(
      finalize(() => this.processingId.set(null)),
    ).subscribe({
      next: () => {
        this.toast.success('Payment rejected');
        this.updateLocalPayment(orderId, {
          paymentStatus: 'REJECTED',
          reviewedAt: new Date().toISOString(),
          reviewNote: reason,
        });
      },
      error: (err) => this.toast.error(err?.error?.message ?? 'Failed to reject payment'),
    });
  }

  emptyStateTitle = computed(() => {
    if (this.search().trim()) return 'No matching payments found';
    if (this.status() === 'WAITING_CONFIRMATION') return 'No pending payments in this range';
    if (this.status() !== 'ALL') return `No ${this.status().toLowerCase().replace('_', ' ')} payments found`;
    return 'No payments found in this date range';
  });

  emptyStateDescription = computed(() => {
    if (this.search().trim()) return 'Try a different customer name, email, phone number, or order number.';
    if (this.status() === 'WAITING_CONFIRMATION') return 'There are no customer payment proofs waiting for review right now.';
    return 'Adjust the filters or expand the date range to see more payment records.';
  });

  private reloadWithCurrentFilters() {
    this.resetPaging();
    this.loadPayments(0, false).subscribe({
      error: (err: any) => this.toast.error(err?.error?.message ?? 'Failed to load payments'),
    });
  }

  private resetPaging() {
    this.payments.set([]);
    this.currentPage.set(0);
    this.totalPages.set(0);
    this.totalElements.set(0);
  }

  private updateLocalPayment(orderId: string, patch: Partial<PaymentDetail>) {
    const next = this.payments().map((payment) => (
      payment.orderId === orderId ? { ...payment, ...patch } : payment
    ));
    this.payments.set(this.dedupeAndSort(next));
  }

  private dedupeAndSort(payments: PaymentDetail[]): PaymentDetail[] {
    const deduped = new Map<string, PaymentDetail>();
    for (const payment of payments) {
      deduped.set(payment.orderId, payment);
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const priorityCompare = paymentPriority(a.paymentStatus) - paymentPriority(b.paymentStatus);
      if (priorityCompare !== 0) return priorityCompare;
      return paymentTimestamp(b) - paymentTimestamp(a);
    });
  }
}
