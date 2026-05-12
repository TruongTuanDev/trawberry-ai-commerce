import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Cart } from '../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/customer/cart`;

  cart = signal<Cart | null>(null);

  load() {
    return this.http.get<Cart>(this.base).pipe(
      tap(c => this.cart.set(c))
    );
  }

  addItem(variantId: string, quantity: number) {
    return this.http.post<Cart>(`${this.base}/items`, { variantId, quantity }).pipe(
      tap(c => this.cart.set(c))
    );
  }

  updateItem(itemId: string, quantity: number) {
    return this.http.put<Cart>(`${this.base}/items/${itemId}`, { quantity }).pipe(
      tap(c => this.cart.set(c))
    );
  }

  removeItem(itemId: string) {
    return this.http.delete<Cart>(`${this.base}/items/${itemId}`).pipe(
      tap(c => this.cart.set(c))
    );
  }

  clear() {
    return this.http.delete<void>(this.base).pipe(
      tap(() => this.cart.set(null))
    );
  }
}
