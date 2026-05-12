import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SellerShipmentFacade } from './seller-shipment.facade';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { ToastService } from '../../../core/services/toast.service';
import { DeliveryIssueStatus, ShipmentStatus } from '../../../core/models/shipping.model';

@Component({
  selector: 'app-seller-shipment-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableWrapperComponent, BadgeComponent],
  providers: [DatePipe],
  templateUrl: './shipment-manager.component.html',
  styleUrl: './shipment-manager.component.css',
})
export class ShipmentManagerComponent implements OnInit {
  facade = inject(SellerShipmentFacade);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  shipForm = this.fb.group({
    orderId: ['', Validators.required],
    carrier: ['', Validators.required],
    trackingNumber: [''],
  });

  ngOnInit() {
    this.facade.loadShipments();
  }

  createShipment() {
    if (this.shipForm.invalid) return;
    const { orderId, carrier, trackingNumber } = this.shipForm.value;
    this.facade.createShipment(orderId!, { carrier: carrier!, trackingNumber: trackingNumber || undefined }).subscribe({
      next: () => {
        this.toast.success('Shipment created and order marked as SHIPPING.');
        this.shipForm.reset();
        this.facade.loadShipments();
      },
      error: () => this.toast.error('Failed to create shipment. Check the Order ID and status.'),
    });
  }

  onUpdateStatus(shipmentId: string, event: Event) {
    const val = (event.target as HTMLSelectElement).value as ShipmentStatus;
    if (val) this.facade.updateShipmentStatus(shipmentId, val);
  }

  onUpdateIssueStatus(issueId: string, event: Event) {
    const val = (event.target as HTMLSelectElement).value as DeliveryIssueStatus;
    if (val) this.facade.updateDeliveryIssueStatus(issueId, val);
  }

  getStatusVariant(status: string) {
    switch (status) {
      case 'CREATED':
        return 'gray' as const;
      case 'PICKED_UP':
        return 'yellow' as const;
      case 'IN_TRANSIT':
        return 'purple' as const;
      case 'DELIVERED':
        return 'green' as const;
      case 'FAILED':
        return 'red' as const;
      default:
        return 'gray' as const;
    }
  }

  getIssueVariant(status: DeliveryIssueStatus) {
    switch (status) {
      case 'OPEN':
        return 'red' as const;
      case 'IN_REVIEW':
        return 'yellow' as const;
      case 'RESOLVED':
        return 'green' as const;
      default:
        return 'gray' as const;
    }
  }
}
