/**
 * Mirrors backend CartItemResponseDto exactly.
 * Note: `subtotal` is a computed frontend convenience — multiply price * quantity.
 */
export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug?: string;
  shopName?: string;
  shopId?: string;
  /** productImage — matches backend field name (was productImageUrl before, now corrected) */
  productImage?: string;
  techSize?: string;
  wbSize?: string;
  quantity: number;
  price: number;
  isAvailable: boolean;
  /** Computed convenience field: price * quantity (not returned by backend) */
  subtotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
}

