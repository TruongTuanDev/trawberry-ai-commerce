// product-vm.model.ts
export interface ProductCardVm {
  id: string;
  slug: string;
  title: string;
  brand: string;
  originalPrice: number;
  finalPrice: number;
  hasDiscount: boolean;
  thumbnailUrl: string;
  productUrl: string;
  shopName: string;
  inStock: boolean;
  averageRating: number;
  reviewCount: number;
  defaultVariantId?: string;
}

export interface ProductVariantVm {
  id: string;
  size: string;
  standardSize?: string;
  russianSize?: string;
  price: number;
  originalPrice: number;
  hasDiscount: boolean;
  inStock: boolean;
}

export interface ProductDetailVm {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: string;
  wbNmId?: number;
  categoryName: string;
  shopName: string;
  shopSlug: string;
  images: string[];
  characteristics: { name: string; value: string }[];
  variants: ProductVariantVm[];
  reviewCount: number;
  averageRate: number;
}
