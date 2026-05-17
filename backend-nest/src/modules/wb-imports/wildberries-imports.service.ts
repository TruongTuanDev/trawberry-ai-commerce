import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CategoryMappingService } from '../categories/category-mapping.service';
import { WildberriesImportOptionsDto } from './dto/wildberries-import-options.dto';
import { WildberriesExcelParserService } from './wildberries-excel-parser.service';
import {
  WbImportConfirmResult,
  WbImportNormalizedPayload,
  WbImportProduct,
  WbImportVariant,
} from './wildberries-import.types';

const SOURCE = 'WILDBERRIES_EXCEL';

@Injectable()
export class WildberriesImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: WildberriesExcelParserService,
    private readonly categoryMappingService: CategoryMappingService,
  ) {}

  async preview(
    shopId: string,
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    options: WildberriesImportOptionsDto,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required.');
    }

    await this.assertApprovedSellerForShop(shopId, user);
    const resolvedOptions = this.resolveOptions(options);
    const payload = this.parser.parse(file, resolvedOptions);
    await this.applyCategoryMappings(payload);
    const session = await this.prisma.productImportSession.create({
      data: {
        shopId,
        sellerId: user.userId,
        source: SOURCE,
        originalFileName: file.originalname,
        status: 'PREVIEWED',
        totalRows: payload.totalRows,
        totalProducts: payload.products.length,
        totalVariants: this.countVariants(payload),
        totalImages: this.countImages(payload),
        warningsJson: payload.warnings,
        errorsJson: payload.errors,
        normalizedPayloadJson: payload,
        optionsJson: resolvedOptions,
      },
    });

    return this.mapPreview(session.id, payload);
  }

  async confirm(shopId: string, user: AuthenticatedUser, importId: string) {
    await this.assertApprovedSellerForShop(shopId, user);

    const session = await this.prisma.productImportSession.findFirst({
      where: {
        id: importId,
        shopId,
        sellerId: user.userId,
      },
    });

    if (!session) {
      throw new NotFoundException(`Import session ${importId} was not found.`);
    }

    if (session.status === 'COMPLETED') {
      return {
        ...(session.resultJson as WbImportConfirmResult),
        status: session.status,
      };
    }

    if (session.status !== 'PREVIEWED' && session.status !== 'FAILED') {
      throw new BadRequestException(
        `Import session ${importId} cannot be confirmed from status ${session.status}.`,
      );
    }

    const payload = session.normalizedPayloadJson as WbImportNormalizedPayload;
    if (payload.errors.length > 0) {
      throw new BadRequestException(
        'Import preview has errors. Fix the file and preview again.',
      );
    }

    await this.prisma.productImportSession.update({
      where: { id: session.id },
      data: { status: 'IMPORTING' },
    });

    try {
      const result = await this.prisma.$transaction((tx) =>
        this.importPayload(
          tx,
          shopId,
          session.id,
          payload,
          session.optionsJson as ReturnType<typeof this.resolveOptions>,
        ),
      );

      await this.prisma.productImportSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resultJson: result,
        },
      });

      return { ...result, status: 'COMPLETED' };
    } catch (error) {
      await this.prisma.productImportSession.update({
        where: { id: session.id },
        data: {
          status: 'FAILED',
          errorsJson: [
            ...payload.errors,
            {
              level: 'ERROR',
              code: 'IMPORT_FAILED',
              message:
                error instanceof Error ? error.message : 'Import failed.',
            },
          ],
        },
      });
      throw error;
    }
  }

  async getStatus(shopId: string, user: AuthenticatedUser, importId: string) {
    await this.assertApprovedSellerForShop(shopId, user);

    const session = await this.prisma.productImportSession.findFirst({
      where: {
        id: importId,
        shopId,
        sellerId: user.userId,
      },
    });

    if (!session) {
      throw new NotFoundException(`Import session ${importId} was not found.`);
    }

    return {
      importId: session.id,
      status: session.status,
      originalFileName: session.originalFileName,
      totalRows: session.totalRows,
      totalProducts: session.totalProducts,
      totalVariants: session.totalVariants,
      totalImages: session.totalImages,
      warnings: session.warningsJson,
      errors: session.errorsJson,
      result: session.resultJson,
      createdAt: session.createdAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    };
  }

  private async importPayload(
    tx: Prisma.TransactionClient,
    shopId: string,
    importId: string,
    payload: WbImportNormalizedPayload,
    options: ReturnType<typeof this.resolveOptions>,
  ): Promise<WbImportConfirmResult> {
    void options;
    const result: WbImportConfirmResult = {
      importId,
      createdProducts: 0,
      updatedProducts: 0,
      importedProducts: 0,
      createdVariants: 0,
      updatedVariants: 0,
      addedImages: 0,
      skippedImages: 0,
      alreadyPublished: 0,
      needsReview: 0,
      missingPrice: 0,
      missingStock: 0,
      missingCategory: 0,
    };

    for (const normalizedProduct of payload.products) {
      const existing = await this.findExistingProduct(
        tx,
        shopId,
        normalizedProduct,
      );
      const productData = {
        externalSource: SOURCE,
        externalProductId: normalizedProduct.externalProductId,
        sellerSku: normalizedProduct.sellerSku,
        wbNmId: this.resolveWbNmId(normalizedProduct),
        wbTitle: normalizedProduct.name,
        localTitle: normalizedProduct.name,
        wbDescription: normalizedProduct.description,
        localDescription: normalizedProduct.description,
        brand: normalizedProduct.brand,
        categoryName:
          normalizedProduct.mappedCategoryName ??
          normalizedProduct.categoryName,
        categoryId: normalizedProduct.categoryId
          ? BigInt(normalizedProduct.categoryId)
          : null,
        sourceCategoryName:
          normalizedProduct.sourceCategoryName ??
          normalizedProduct.categoryName,
        sourceCategorySource: SOURCE,
        wbVendorCode: normalizedProduct.sellerSku,
        wbVideoUrl: normalizedProduct.videoUrl,
        wbNeedKiz: normalizedProduct.needKiz ?? undefined,
        gender: normalizedProduct.gender,
        composition: normalizedProduct.composition,
        color: normalizedProduct.color,
        weightBrutto: normalizedProduct.packageWeightGram,
        height: normalizedProduct.packageHeightCm,
        length: normalizedProduct.packageLengthCm,
        width: normalizedProduct.packageWidthCm,
        dimensionsValid:
          normalizedProduct.packageHeightCm !== null &&
          normalizedProduct.packageLengthCm !== null &&
          normalizedProduct.packageWidthCm !== null,
        visibility: existing ? undefined : 'DRAFT',
        source: SOURCE,
        seoSlug: this.slug(
          `${normalizedProduct.sellerSku ?? normalizedProduct.externalProductId ?? normalizedProduct.name}-${normalizedProduct.name}`,
        ),
      };

      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: productData,
          })
        : await tx.product.create({
            data: {
              id: randomUUID(),
              shopId,
              catalogStatus: 'IMPORTED',
              ...productData,
            },
          });

      if (existing) {
        result.updatedProducts += 1;
        if (existing.catalogStatus === 'PUBLISHED') {
          result.alreadyPublished += 1;
        }
      } else {
        result.createdProducts += 1;
        result.importedProducts += 1;
      }

      for (const variant of normalizedProduct.variants) {
        const upsertedVariant = await this.upsertVariant(
          tx,
          product.id,
          normalizedProduct,
          variant,
        );
        if (upsertedVariant.created) {
          result.createdVariants += 1;
        } else {
          result.updatedVariants += 1;
        }
      }

      for (const image of normalizedProduct.images) {
        const existingImage = await tx.productImage.findFirst({
          where: {
            productId: product.id,
            OR: [{ wbUrl: image.url }, { localUrl: image.url }],
          },
          select: { id: true },
        });

        if (existingImage) {
          result.skippedImages += 1;
          continue;
        }

        await tx.productImage.create({
          data: {
            id: randomUUID(),
            productId: product.id,
            wbUrl: image.url,
            localUrl: image.url,
            imageType: 'ORIGINAL',
            isMain: image.isMain,
            sortOrder: image.sortOrder,
          },
        });
        result.addedImages += 1;
      }

      const hasMissingCategory = !normalizedProduct.categoryId;
      const hasMissingPrice = normalizedProduct.variants.every(
        (variant) => !(variant.price && variant.price > 0),
      );
      const hasMissingStock = normalizedProduct.variants.every(
        (variant) => variant.stockQuantity <= 0,
      );
      if (hasMissingCategory) {
        result.missingCategory += 1;
      }
      if (hasMissingPrice) {
        result.missingPrice += 1;
      }
      if (hasMissingStock) {
        result.missingStock += 1;
      }
      if (hasMissingCategory || hasMissingPrice || hasMissingStock) {
        result.needsReview += 1;
      }
    }

    return result;
  }

  private async upsertVariant(
    tx: Prisma.TransactionClient,
    productId: string,
    product: WbImportProduct,
    variant: WbImportVariant,
  ) {
    const variantPredicates: Prisma.ProductVariantWhereInput[] = [];
    if (variant.wbBarcode) {
      variantPredicates.push({ wbBarcode: variant.wbBarcode });
    }
    variantPredicates.push({
      sellerSku: variant.sellerSku,
      sizeName: variant.sizeName,
      russianSize: variant.russianSize,
    });

    const existing = await tx.productVariant.findFirst({
      where: {
        productId,
        OR: variantPredicates,
      },
      select: { id: true, chrtId: true },
    });

    const data = {
      externalSource: SOURCE,
      sellerSku: variant.sellerSku ?? product.sellerSku,
      wbBarcode: variant.wbBarcode,
      sizeName: variant.sizeName,
      russianSize: variant.russianSize,
      techSize: variant.sizeName,
      wbSize: variant.russianSize ?? variant.sizeName,
      isActive: true,
      basePrice: variant.price ?? 0,
      discountPrice: variant.price ?? 0,
      stockQuantity: variant.stockQuantity,
      reservedStock: 0,
      lowStockThreshold: 5,
      trackInventory: true,
    };

    if (existing) {
      await tx.productVariant.update({
        where: { id: existing.id },
        data,
      });
      return { created: false };
    }

    await tx.productVariant.create({
      data: {
        id: randomUUID(),
        productId,
        chrtId: this.stableBigInt(
          [
            product.sellerSku,
            product.externalProductId,
            variant.wbBarcode,
            variant.sizeName,
            variant.russianSize,
          ]
            .filter(Boolean)
            .join('|'),
          8_000_000_000_000n,
        ),
        ...data,
      },
    });

    return { created: true };
  }

  private async findExistingProduct(
    tx: Prisma.TransactionClient,
    shopId: string,
    product: WbImportProduct,
  ) {
    const predicates: Prisma.ProductWhereInput[] = [];
    if (product.sellerSku) {
      predicates.push({ sellerSku: product.sellerSku });
    }
    if (product.externalProductId) {
      predicates.push({
        externalProductId: product.externalProductId,
        externalSource: SOURCE,
      });
    }
    if (product.externalProductId && /^\d+$/.test(product.externalProductId)) {
      predicates.push({ wbNmId: BigInt(product.externalProductId) });
    }

    return tx.product.findFirst({
      where: {
        shopId,
        OR: predicates,
      },
      select: { id: true, catalogStatus: true },
    });
  }

  private resolveWbNmId(product: WbImportProduct) {
    if (product.externalProductId && /^\d+$/.test(product.externalProductId)) {
      return BigInt(product.externalProductId);
    }

    return this.stableBigInt(
      product.sellerSku ?? product.externalProductId ?? product.name,
      7_000_000_000_000n,
    );
  }

  private stableBigInt(value: string, offset: bigint) {
    let hash = 0n;
    for (const char of value) {
      hash = (hash * 31n + BigInt(char.charCodeAt(0))) % 900_000_000_000n;
    }
    return offset + hash;
  }

  private mapPreview(importId: string, payload: WbImportNormalizedPayload) {
    return {
      importId,
      totalRows: payload.totalRows,
      totalProducts: payload.products.length,
      totalVariants: this.countVariants(payload),
      totalImages: this.countImages(payload),
      warnings: payload.warnings,
      errors: payload.errors,
      products: payload.products.map((product) => ({
        sellerSku: product.sellerSku,
        externalProductId: product.externalProductId,
        name: product.name,
        brand: product.brand,
        categoryName: product.categoryName,
        categoryId: product.categoryId,
        mappedCategoryName: product.mappedCategoryName,
        sourceCategoryName: product.sourceCategoryName,
        variantsCount: product.variants.length,
        imagesCount: product.images.length,
        priceStatus: product.variants.some(
          (variant) => variant.price && variant.price > 0,
        )
          ? 'OK'
          : 'MISSING',
        warnings: product.warnings,
        errors: product.errors,
      })),
    };
  }

  private countVariants(payload: WbImportNormalizedPayload) {
    return payload.products.reduce(
      (sum, product) => sum + product.variants.length,
      0,
    );
  }

  private countImages(payload: WbImportNormalizedPayload) {
    return payload.products.reduce(
      (sum, product) => sum + product.images.length,
      0,
    );
  }

  private resolveOptions(options: WildberriesImportOptionsDto) {
    return {
      defaultStockQuantity: options.defaultStockQuantity ?? 0,
      publishMode: options.publishMode ?? 'DRAFT',
      imageMode: options.imageMode ?? 'REMOTE_URL',
      priceFallback: options.priceFallback,
    };
  }

  private async applyCategoryMappings(payload: WbImportNormalizedPayload) {
    const warnings = [...payload.warnings];
    for (const product of payload.products) {
      const mapping = await this.categoryMappingService.mapSourceCategory(
        SOURCE,
        product.categoryName,
      );
      product.sourceCategoryName = mapping.sourceCategoryName;
      product.categoryId = mapping.categoryId?.toString() ?? null;
      product.mappedCategoryName = mapping.categoryName;
      if (mapping.categoryName) {
        product.categoryName = mapping.categoryName;
      }
      if (mapping.warning) {
        const warning = {
          ...mapping.warning,
          sellerSku: product.sellerSku,
        };
        product.warnings.push(warning);
        warnings.push(warning);
      }
    }
    payload.warnings = warnings;
  }

  private async assertApprovedSellerForShop(
    shopId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException(
        'Only approved sellers can import products.',
      );
    }

    const shop = await this.prisma.shop.findFirst({
      where: {
        id: shopId,
        sellerProfile: {
          userId: user.userId,
        },
      },
      select: {
        id: true,
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!shop) {
      throw new ForbiddenException('You do not have access to this shop.');
    }

    if (shop.sellerProfile.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Only APPROVED sellers can import products.',
      );
    }
  }

  private slug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-я]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 500);
  }
}
