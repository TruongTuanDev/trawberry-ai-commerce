import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { SellerShipmentApiService } from '../../../core/api/seller-shipment-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import {
  CreateShipmentRequestDto,
  DeliveryIssueResponseDto,
  DeliveryIssueStatus,
  ShipmentResponseDto,
  ShipmentStatus,
} from '../../../core/models/shipping.model';

@Injectable({ providedIn: 'root' })
export class SellerShipmentFacade {
  private api = inject(SellerShipmentApiService);
  private toast = inject(ToastService);
  private context = inject(ShopContextService);

  shipments = signal<ShipmentResponseDto[]>([]);
  deliveryIssues = signal<DeliveryIssueResponseDto[]>([]);
  loading = signal<boolean>(false);
  creatingForOrderId = signal<string | null>(null);
  updatingShipmentId = signal<string | null>(null);
  updatingIssueId = signal<string | null>(null);

  loadShipments() {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.loading.set(true);
    this.api.getShopShipments(shopId).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (res) => this.shipments.set(res),
      error: () => this.toast.error('Failed to load shipments')
    });

    this.api.getDeliveryIssues(shopId).subscribe({
      next: (res) => this.deliveryIssues.set(res),
      error: () => this.toast.error('Failed to load delivery issues')
    });
  }

  createShipment(orderId: string, request: CreateShipmentRequestDto) {
    const shopId = this.context.currentShopId();
    if (!shopId) throw new Error('No active shop context');

    this.creatingForOrderId.set(orderId);
    return this.api.createShipment(shopId, orderId, request).pipe(
      finalize(() => this.creatingForOrderId.set(null))
    );
  }

  updateShipmentStatus(shipmentId: string, newStatus: ShipmentStatus) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.updatingShipmentId.set(shipmentId);
    this.api.updateShipmentStatus(shopId, shipmentId, newStatus).pipe(
      finalize(() => this.updatingShipmentId.set(null))
    ).subscribe({
      next: (updated) => {
        this.toast.success(`Shipment status updated to ${newStatus}`);
        this.shipments.update(list => list.map(s => s.id === shipmentId ? updated : s));
      },
      error: () => this.toast.error('Failed to update shipment status')
    });
  }

  updateDeliveryIssueStatus(issueId: string, status: DeliveryIssueStatus) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.updatingIssueId.set(issueId);
    this.api.updateDeliveryIssueStatus(shopId, issueId, status).pipe(
      finalize(() => this.updatingIssueId.set(null))
    ).subscribe({
      next: (updated) => {
        this.toast.success(`Delivery issue marked ${status}`);
        this.deliveryIssues.update(list => list.map(issue => issue.id === issueId ? updated : issue));
      },
      error: () => this.toast.error('Failed to update delivery issue')
    });
  }
}
