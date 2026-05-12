// product-dto.model.ts
export interface ProductResponseDto {
  id: string; // UUID
  slug: string;
  title: string;
  brand: string;
  mainImage: string;
  basePrice?: number;
  minPrice: number;
  discountPrice?: number;
  inStock: boolean;
  shopName: string;
  shopSlug: string;
  categoryId: number;
  categoryName: string;
  wbNmId: number;
  vendorCode: string;
  defaultVariantId?: string;
  averageRate?: number;
  reviewCount?: number;
}

export interface ReviewResponseDto {
  id: string;
  customerName: string;
  content: string;
  rate: number;
  createdAt: string;
}

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
}

export interface CategoryResponseDto {
  id: number;
  name: string;
  productCount: number;
}

export interface ShopDto {
  id: string; // UUID
  name: string;
  slug: string;
}

export interface CharacteristicDto {
  name: string;
  value: string;
}

export interface VariantDto {
  id: string; // UUID
  techSize: string;
  wbSize: string;
  basePrice: number;
  discountPrice?: number;
  stockQuantity: number;
  inStock: boolean;
}

export interface ProductDetailResponseDto {
  id: string; // UUID
  slug: string;
  title: string;
  description: string;
  brand: string;
  category: CategoryDto;
  shop: ShopDto;
  images: string[];
  characteristics: CharacteristicDto[];
  variants: VariantDto[];
  wbNmId?: number;
  reviewCount?: number;
  averageRate?: number;
}

export interface ProductPricingResponseDto {
  id: string; // UUID
  title: string;
  wbNmId: number;
  vendorCode: string;
  categoryName: string;
  mainImage: string;
  minBasePrice: number;
  maxBasePrice: number;
  minDiscountPrice: number;
  maxDiscountPrice: number;
  hasPriceRange: boolean;
  variants: VariantDto[];
}

export interface VariantPriceUpdate {
  variantId: string; // UUID
  basePrice: number;
  discountPrice: number;
}

export interface VariantPricingBulkUpdateRequestDto {
  updates: VariantPriceUpdate[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface FilterSuggestions {
  categories: string[];
  brands: string[];
}

export interface ProductMetadataRequestDto {
  localTitle?: string;
  localDescription?: string;
  visibility?: string;
  slugOverride?: string;
}

export interface VariantPricingRequestDto {
  basePrice?: number;
  discountPrice?: number;
}

export interface VariantInventoryRequestDto {
  stockQuantity?: number;
}

export interface VariantInventoryResponseDto {
  variantId: string; // UUID
  productId: string; // UUID
  productTitle: string;
  wbNmId: number;
  vendorCode: string;
  categoryName: string;
  mainImage: string;
  techSize: string;
  wbSize: string;
  stockQuantity: number;
  reservedStock: number;
}

export interface VariantInventoryUpdate {
  variantId: string; // UUID
  stockQuantity: number;
}

export interface VariantInventoryBulkUpdateRequestDto {
  updates: VariantInventoryUpdate[];
}
