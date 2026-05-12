import { Injectable, inject, signal } from '@angular/core';
import { SellerSyncApiService } from '../../../core/api/seller-sync-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { SyncHealthDto, SyncHistoryDto } from '../../../core/models/shipping.model';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SellerSyncFacade {
  private api = inject(SellerSyncApiService);
  private toast = inject(ToastService);
  private context = inject(ShopContextService);

  health = signal<SyncHealthDto | null>(null);
  history = signal<SyncHistoryDto[]>([]);
  loading = signal<boolean>(false);
  triggering = signal<boolean>(false);
  savingSettings = signal<boolean>(false);

  loadAll() {
    this.loading.set(true);
    this.loadHealth();
    this.loadHistory();
  }

  private loadHealth() {
    const id = this.context.currentShopId();
    if (!id) return;
    this.api.getSyncHealth(id).subscribe({
      next: (h) => this.health.set(h),
      error: () => {}
    });
  }

  private loadHistory() {
    const id = this.context.currentShopId();
    if (!id) {
       this.loading.set(false);
       return;
    }
    this.api.getSyncHistory(id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (h) => this.history.set(h),
      error: () => {}
    });
  }

  triggerFull() {
    const id = this.context.currentShopId();
    if (!id) return;
    this.triggering.set(true);
    this.api.triggerFullSync(id).pipe(
      finalize(() => this.triggering.set(false))
    ).subscribe({
      next: () => { 
        this.toast.success('Full sync triggered. This may take a while.'); 
        this.loadAll(); 
      },
      error: () => this.toast.error('Failed to trigger full sync')
    });
  }

  triggerIncremental() {
    const id = this.context.currentShopId();
    if (!id) return;
    this.triggering.set(true);
    this.api.triggerIncrementalSync(id).pipe(
      finalize(() => this.triggering.set(false))
    ).subscribe({
      next: () => { 
        this.toast.success('Incremental sync triggered.'); 
        this.loadAll(); 
      },
      error: () => this.toast.error('Failed to trigger incremental sync')
    });
  }

  saveSettings(intervalMinutes: number, paused: boolean) {
    const id = this.context.currentShopId();
    if (!id) return;
    this.savingSettings.set(true);
    this.api.updateSyncSettings(id, intervalMinutes, paused).pipe(
      finalize(() => this.savingSettings.set(false))
    ).subscribe({
      next: () => { 
        this.toast.success('Sync settings saved.'); 
        this.loadAll(); 
      },
      error: () => this.toast.error('Failed to save sync settings')
    });
  }
}
