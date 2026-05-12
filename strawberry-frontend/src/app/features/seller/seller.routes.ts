import { Routes } from '@angular/router';
import { SellerLayoutComponent } from './layout/seller-layout.component';
import { SellerEntryComponent } from './management/seller-entry.component';
import { shopGuard } from '../../core/guards/shop.guard';
import { pricingDirtyGuard } from './pricing/pricing-dirty.guard';
import { inventoryDirtyGuard } from './inventory/inventory-dirty.guard';

export const SELLER_ROUTES: Routes = [
  {
    path: '',
    component: SellerEntryComponent
  },
  {
    path: 'shops',
    children: [
      {
        path: '',
        component: SellerEntryComponent
      },
      {
        path: 'create',
        loadComponent: () => import('./management/create-shop.component').then(m => m.CreateShopComponent)
      }
    ]
  },
  {
    path: 'shops/:shopId',
    component: SellerLayoutComponent,
    canActivate: [shopGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./products/product-list.component').then(m => m.ProductListComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./inventory/inventory-list.component').then(m => m.InventoryListComponent),
        canDeactivate: [inventoryDirtyGuard]
      },
      {
        path: 'pricing',
        loadComponent: () => import('./pricing/pricing-list.component').then(m => m.PricingListComponent),
        canDeactivate: [pricingDirtyGuard]
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./products/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders/orders-list.component').then(m => m.OrdersListComponent)
      },
      {
        path: 'payments',
        loadComponent: () => import('./payments/payment-review.component').then(m => m.PaymentReviewComponent)
      },
      {
        path: 'shipments',
        loadComponent: () => import('./shipments/shipment-manager.component').then(m => m.ShipmentManagerComponent)
      },
      {
        path: 'sync',
        loadComponent: () => import('./sync/sync-dashboard.component').then(m => m.SyncDashboardComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/shop-settings.component').then(m => m.ShopSettingsComponent)
      }
    ]
  }
];
