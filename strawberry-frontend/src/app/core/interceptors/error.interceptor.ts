import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

/**
 * Global HTTP error interceptor.
 * - 401 Unauthorized: clears auth storage and redirects to /login
 * - 403 Forbidden: shows a toast and does not redirect
 * - 5xx Server errors: shows a generic toast
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Clear stale auth state and redirect to login, preserving the requested URL
        localStorage.removeItem('sb_token');
        localStorage.removeItem('sb_user');
        const returnUrl = router.url;
        router.navigate(['/login'], {
          queryParams: returnUrl !== '/login' ? { returnUrl } : {}
        });
        toast.error('Your session has expired. Please log in again.');
      } else if (err.status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else if (err.status >= 500) {
        const message = err.error?.message ?? 'A server error occurred. Please try again.';
        toast.error(message);
      }
      return throwError(() => err);
    })
  );
};
