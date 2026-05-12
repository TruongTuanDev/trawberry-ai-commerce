import { Injectable, inject, signal, computed, EffectRef, effect } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, startWith, switchMap, catchError, of } from 'rxjs';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ShopService, Shop } from './shop.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class ShopContextService {
  private router = inject(Router);
  private shopService = inject(ShopService);
  private toastService = inject(ToastService);

  // currentShopId is derived from the URL: /seller/shops/:shopId/...
  readonly currentShopId = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.getShopIdFromUrl())
    ),
    { initialValue: this.getShopIdFromUrl() }
  );

  /**
   * Observable that emits whenever the current shop ID changes.
   * Used by components that prefer RxJS over Signals for reactivity.
   */
  readonly shopChanged$ = toObservable(this.currentShopId).pipe(
    filter(id => !!id)
  );

  // currentShop signal fetches full details when ID changes
  private shopDetails$ = effect(() => {
    const id = this.currentShopId();
    if (id) {
       this.fetchShopDetails(id);
    } else {
       this._currentShop.set(null);
    }
  });

  private _currentShop = signal<Shop | null>(null);
  readonly currentShop = this._currentShop.asReadonly();

  private _isLoading = signal(false);
  readonly isLoading = this._isLoading.asReadonly();

  private getShopIdFromUrl(): string | null {
    const url = this.router.url;
    // Context: /seller/shops/[shopId]/...
    const match = url.match(/\/seller\/shops\/([0-9a-fA-F-]{36})/);
    return match ? match[1] : null;
  }

  private fetchShopDetails(id: string) {
    this._isLoading.set(true);
    this.shopService.getShopDetail(id).pipe(
      catchError((err) => {
        this._isLoading.set(false);
        this.toastService.error(err.error?.message || 'Access denied or shop not found');
        this.router.navigate(['/seller']);
        return of(null);
      })
    ).subscribe(shop => {
      this._currentShop.set(shop);
      this._isLoading.set(false);
    });
  }

  // Navigation helpers
  navigateToShop(shopId: string, page: string = 'dashboard') {
    this.router.navigate(['/seller/shops', shopId, page]);
  }
}
