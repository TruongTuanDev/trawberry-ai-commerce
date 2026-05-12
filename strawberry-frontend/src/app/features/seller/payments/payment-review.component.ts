import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerPaymentFacade, PaymentStatusFilter } from './seller-payment.facade';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';

@Component({
  selector: 'app-seller-payment-review',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, EmptyStateComponent, NgClass],
  providers: [CurrencyPipe, DatePipe],
  templateUrl: './payment-review.component.html',
  styleUrl: './payment-review.component.css',
})
export class PaymentReviewComponent implements OnInit, AfterViewInit, OnDestroy {
  facade = inject(SellerPaymentFacade);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('sentinel')
  set sentinelRef(value: ElementRef<HTMLElement> | undefined) {
    this.sentinel = value;
    if (value) {
      queueMicrotask(() => this.setupInfiniteScroll());
    }
  }

  searchValue = '';
  receiptPreviewUrl: string | null = null;
  receiptPreviewLabel = '';
  private observer?: IntersectionObserver;
  private searchDebounce?: ReturnType<typeof setTimeout>;
  private sentinel?: ElementRef<HTMLElement>;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.searchValue = this.facade.search();
    this.facade.initialize();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    queueMicrotask(() => this.setupInfiniteScroll());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  onSearchChange(value: string) {
    this.searchValue = value;
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.facade.setSearch(value), 300);
  }

  onStatusChange(value: PaymentStatusFilter) {
    this.facade.setStatus(value);
  }

  onFromDateChange(value: string) {
    this.facade.setDateRange(value, this.facade.toDate());
  }

  onToDateChange(value: string) {
    this.facade.setDateRange(this.facade.fromDate(), value);
  }

  approve(orderId: string) {
    if (confirm('Approve this payment and make the order eligible for fulfillment?')) {
      this.facade.approve(orderId);
    }
  }

  reject(orderId: string) {
    const reason = prompt('Reason for rejection (optional). This will be visible to the customer.');
    if (reason === null) return;
    if (confirm('Reject this payment proof and ask the customer to submit a new one?')) {
      this.facade.reject(orderId, reason || undefined);
    }
  }

  openReceipt(url: string, orderNumber: string) {
    this.receiptPreviewUrl = url;
    this.receiptPreviewLabel = orderNumber;
  }

  closeReceipt() {
    this.receiptPreviewUrl = null;
    this.receiptPreviewLabel = '';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'WAITING_CONFIRMATION':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  private setupInfiniteScroll(): void {
    if (!this.isBrowser) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (!this.sentinel?.nativeElement) return;

    this.observer?.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      this.facade.loadNextPage();
    }, { rootMargin: '240px 0px' });

    this.observer.observe(this.sentinel.nativeElement);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.receiptPreviewUrl) {
      this.closeReceipt();
    }
  }
}
