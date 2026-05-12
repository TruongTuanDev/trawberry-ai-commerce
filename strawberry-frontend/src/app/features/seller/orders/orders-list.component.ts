import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SellerOrderFacade } from './seller-order.facade';
import { SellerShipmentApiService } from '../../../core/api/seller-shipment-api.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShipmentResponseDto, ShipmentStatus } from '../../../core/models/shipping.model';
import { OrderItem, OrderStatus } from '../../../core/models/order.model';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

type FulfillmentTab = {
  label: string;
  status: OrderStatus;
  description: string;
};

@Component({
  selector: 'app-seller-orders-list',
  standalone: true,
  imports: [CommonModule, BadgeComponent, LoadingSpinnerComponent, EmptyStateComponent],
  providers: [CurrencyPipe, DatePipe],
  templateUrl: './orders-list.component.html',
  styleUrl: './orders-list.component.css',
})
export class OrdersListComponent implements OnInit {
  facade = inject(SellerOrderFacade);
  private shipmentApi = inject(SellerShipmentApiService);
  private shopContext = inject(ShopContextService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  readonly tabs: FulfillmentTab[] = [
    {
      label: 'New Orders',
      status: 'NEW',
      description: 'Freshly placed orders grouped by customer order. Payment approval stays in the separate Payments screen.',
    },
    {
      label: 'Confirmed / Packing',
      status: 'ASSEMBLING',
      description: 'Orders already accepted into fulfillment and waiting to be boxed and dispatched.',
    },
    {
      label: 'Shipping',
      status: 'SHIPPING',
      description: 'Orders already shipped. Update shipment progress and drive them toward delivery.',
    },
    {
      label: 'Delivered',
      status: 'DELIVERED',
      description: 'Orders whose shipment flow has completed successfully.',
    },
    {
      label: 'Cancelled',
      status: 'CANCELLED',
      description: 'Orders cancelled before completion.',
    },
  ];

  activeTab = signal<OrderStatus>('NEW');
  shipments = signal<ShipmentResponseDto[]>([]);
  shipmentLoading = signal(false);
  creatingShipmentOrderId = signal<string | null>(null);
  updatingShipmentId = signal<string | null>(null);
  shipmentDrafts = signal<Record<string, { carrier: string; trackingNumber: string }>>({});

  activeTabMeta = computed(
    () => this.tabs.find((tab) => tab.status === this.activeTab()) ?? this.tabs[0],
  );

  ngOnInit() {
    this.reloadCurrentStage();
    this.shopContext.shopChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadCurrentStage());
  }

  selectTab(status: OrderStatus) {
    if (this.activeTab() === status) return;
    this.activeTab.set(status);
    this.reloadCurrentStage();
  }

  private reloadCurrentStage() {
    this.facade.setFilterStatus(this.activeTab());
    this.loadShipments();
  }

  private loadShipments() {
    const shopId = this.shopContext.currentShopId();
    if (!shopId) {
      this.shipments.set([]);
      return;
    }

    this.shipmentLoading.set(true);
    this.shipmentApi
      .getShopShipments(shopId)
      .pipe(finalize(() => this.shipmentLoading.set(false)))
      .subscribe({
        next: (shipments) => this.shipments.set(shipments),
        error: () => {
          this.shipments.set([]);
          this.toast.error('Failed to load shipment data');
        },
      });
  }

  moveToPacking(orderId: string) {
    this.facade.updateStatus(orderId, 'ASSEMBLING');
  }

  cancel(orderId: string) {
    this.facade.updateStatus(orderId, 'CANCELLED');
  }

  shipmentDraft(orderId: string) {
    return this.shipmentDrafts()[orderId] ?? { carrier: '', trackingNumber: '' };
  }

  updateShipmentDraft(orderId: string, field: 'carrier' | 'trackingNumber', value: string) {
    this.shipmentDrafts.update((drafts) => ({
      ...drafts,
      [orderId]: {
        ...this.shipmentDraft(orderId),
        [field]: value,
      },
    }));
  }

  createShipment(orderId: string) {
    const shopId = this.shopContext.currentShopId();
    if (!shopId) return;

    const draft = this.shipmentDraft(orderId);
    if (!draft.carrier.trim()) {
      this.toast.error('Carrier is required before shipping an order');
      return;
    }

    this.creatingShipmentOrderId.set(orderId);
    this.shipmentApi
      .createShipment(shopId, orderId, {
        carrier: draft.carrier.trim(),
        trackingNumber: draft.trackingNumber.trim() || undefined,
      })
      .pipe(finalize(() => this.creatingShipmentOrderId.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('Shipment created and order moved to Shipping');
          this.shipmentDrafts.update((drafts) => {
            const next = { ...drafts };
            delete next[orderId];
            return next;
          });
          this.reloadCurrentStage();
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Failed to create shipment'),
      });
  }

  updateShipment(shipmentId: string, status: ShipmentStatus) {
    const shopId = this.shopContext.currentShopId();
    if (!shopId) return;

    this.updatingShipmentId.set(shipmentId);
    this.shipmentApi
      .updateShipmentStatus(shopId, shipmentId, status)
      .pipe(finalize(() => this.updatingShipmentId.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`Shipment updated to ${status}`);
          this.reloadCurrentStage();
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Failed to update shipment'),
      });
  }

  shipmentByOrder(orderId: string) {
    return this.shipments().find((shipment) => shipment.orderId === orderId) ?? null;
  }

  nextShipmentStatuses(shipment: ShipmentResponseDto): ShipmentStatus[] {
    switch (shipment.shipmentStatus) {
      case 'CREATED':
        return ['PICKED_UP'];
      case 'PICKED_UP':
        return ['IN_TRANSIT'];
      case 'IN_TRANSIT':
        return ['DELIVERED'];
      default:
        return [];
    }
  }

  shipmentActionLabel(status: ShipmentStatus) {
    switch (status) {
      case 'PICKED_UP':
        return 'Mark Picked Up';
      case 'IN_TRANSIT':
        return 'Mark In Transit';
      case 'DELIVERED':
        return 'Mark Delivered';
      default:
        return status;
    }
  }

  lineSubtotal(item: OrderItem) {
    return item.priceAtPurchase * item.quantity;
  }

  inputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  getStatusVariant(status: string) {
    switch (status) {
      case 'NEW':
        return 'gray';
      case 'ASSEMBLING':
        return 'yellow';
      case 'SHIPPING':
        return 'purple';
      case 'DELIVERED':
        return 'green';
      case 'CANCELLED':
        return 'red';
      default:
        return 'gray';
    }
  }

  getPaymentVariant(status: string) {
    switch (status) {
      case 'APPROVED':
        return 'green';
      case 'WAITING_CONFIRMATION':
        return 'yellow';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  }
}
