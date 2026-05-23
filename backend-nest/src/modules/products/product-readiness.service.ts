import { Injectable } from '@nestjs/common';
import {
  ProductCatalogStatus,
  ProductReadinessReason,
} from './product-catalog.constants';

type ProductReadinessVariant = {
  isActive: boolean;
  basePrice?: { gt?: (value: number) => boolean; toString(): string } | null;
  discountPrice?: {
    gt?: (value: number) => boolean;
    toString(): string;
  } | null;
  stockQuantity: number;
  trackInventory: boolean;
};

type ProductReadinessProduct = {
  catalogStatus: string | null;
  visibility?: string | null;
  wbTitle: string | null;
  localTitle: string | null;
  categoryId: bigint | null;
  categoryName?: string | null;
  sourceCategoryName?: string | null;
  images?: Array<unknown>;
  variants?: ProductReadinessVariant[];
  shop?: {
    status?: string | null;
    sellerProfile?: {
      approvalStatus?: string | null;
    } | null;
  } | null;
};

export type ProductReadinessResult = {
  ready: boolean;
  readyToSell: boolean;
  publicVisible: boolean;
  blockingReasons: ProductReadinessReason[];
  statusSuggestion: ProductCatalogStatus;
};

@Injectable()
export class ProductReadinessService {
  getReadiness(product: ProductReadinessProduct): ProductReadinessResult {
    const blockingReasons = this.getProductWarnings(product);
    const readyToSell = !blockingReasons.some(
      (r) => r !== 'SELLER_NOT_APPROVED' && r !== 'SHOP_INACTIVE',
    );
    const publicVisible = blockingReasons.length === 0;

    return {
      ready: publicVisible,
      readyToSell,
      publicVisible,
      blockingReasons,
      statusSuggestion: publicVisible ? 'READY' : this.fallbackStatus(product),
    };
  }

  getProductWarnings(
    product: ProductReadinessProduct,
  ): ProductReadinessReason[] {
    const reasons: ProductReadinessReason[] = [];
    const shopStatus = product.shop?.status ?? 'ACTIVE';
    const sellerApprovalStatus =
      product.shop?.sellerProfile?.approvalStatus ?? 'APPROVED';
    const images = product.images ?? [];
    const variants = product.variants ?? [];

    if (sellerApprovalStatus !== 'APPROVED') {
      reasons.push('SELLER_NOT_APPROVED');
    }

    if (shopStatus !== 'ACTIVE') {
      reasons.push('SHOP_INACTIVE');
    }

    if (product.catalogStatus === 'ARCHIVED') {
      reasons.push('PRODUCT_ARCHIVED');
    }

    if (product.visibility === 'DELETED') {
      reasons.push('PRODUCT_DELETED');
    }

    if (!(product.localTitle ?? product.wbTitle)?.trim()) {
      reasons.push('MISSING_NAME');
    }

    if (images.length < 1) {
      reasons.push('MISSING_IMAGE');
    }

    if (
      !product.categoryId &&
      !product.categoryName &&
      !product.sourceCategoryName
    ) {
      reasons.push('MISSING_CATEGORY');
    }

    const activeVariants = variants.filter(
      (variant) => variant.isActive !== false,
    );
    if (activeVariants.length < 1) {
      reasons.push('NO_ACTIVE_VARIANT');
      return reasons;
    }

    const hasPricedVariant = activeVariants.some((variant) => {
      const price = this.resolveVariantPrice(variant);
      return price > 0;
    });
    if (!hasPricedVariant) {
      reasons.push('MISSING_PRICE');
    }

    const hasSellableStock = activeVariants.some(
      (variant) => !variant.trackInventory || variant.stockQuantity > 0,
    );
    if (!hasSellableStock) {
      reasons.push('MISSING_STOCK');
    }

    return reasons;
  }

  private fallbackStatus(
    product: ProductReadinessProduct,
  ): ProductCatalogStatus {
    if (product.catalogStatus === 'ARCHIVED') {
      return 'ARCHIVED';
    }

    if (product.catalogStatus === 'PUBLISHED') {
      return 'PUBLISHED';
    }

    if (product.catalogStatus === 'UNPUBLISHED') {
      return 'UNPUBLISHED';
    }

    return product.catalogStatus === 'IMPORTED' ? 'IMPORTED' : 'DRAFT';
  }

  private resolveVariantPrice(variant: ProductReadinessVariant) {
    const candidate = variant.discountPrice ?? variant.basePrice;
    if (!candidate) {
      return 0;
    }
    return Number(candidate.toString()) || 0;
  }
}
