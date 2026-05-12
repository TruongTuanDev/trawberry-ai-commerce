import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const sellerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const user = authService.getCurrentUser();

  if (user?.token && user.role === 'SELLER') {
    return true;
  }

  return router.createUrlTree(['/seller/login'], {
    queryParams: { returnUrl: state.url },
  });
};
