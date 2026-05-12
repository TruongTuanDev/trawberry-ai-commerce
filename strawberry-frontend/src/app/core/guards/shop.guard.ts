import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, CanActivateFn } from '@angular/router';
import { ShopService } from '../services/shop.service';
import { ToastService } from '../services/toast.service';
import { catchError, map, of } from 'rxjs';

export const shopGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const router = inject(Router);
  const shopService = inject(ShopService);
  const toastService = inject(ToastService);
  const shopId = route.paramMap.get('shopId');

  if (!shopId) {
    router.navigate(['/seller']);
    return of(false);
  }

  return shopService.getShopDetail(shopId).pipe(
    map(() => true),
    catchError((err) => {
      toastService.error(err.error?.message || 'Access denied or shop invalid');
      router.navigate(['/seller']);
      return of(false);
    })
  );
};
