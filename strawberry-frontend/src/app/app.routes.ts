import { Routes } from '@angular/router';
import { sellerGuard } from './core/guards/seller.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/storefront/storefront.routes').then((m) => m.STOREFRONT_ROUTES),
  },
  {
    path: 'seller',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/seller/auth/login/seller-login.component').then(
            (m) => m.SellerLoginComponent,
          ),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/seller/auth/register/seller-register.component').then(
            (m) => m.SellerRegisterComponent,
          ),
      },
      {
        path: '',
        canActivate: [sellerGuard],
        loadChildren: () => import('./features/seller/seller.routes').then((m) => m.SELLER_ROUTES),
      },
    ],
  },
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/admin/auth/login/admin-login.component').then(
            (m) => m.AdminLoginComponent,
          ),
      },
      {
        path: '',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
