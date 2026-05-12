import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ProductImageResponseDto } from './dto/product-image-response.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import type { ProductImageUploadFile } from './product-image-file.type';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PRODUCT_IMAGE_TYPES = new Set([
  'ORIGINAL',
  'AI_GENERATED',
  'MODEL_REFERENCE',
  'FRONT',
  'BACK',
  'DETAIL',
]);

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
  ) {}

  async findByProduct(shopId: string, productId: string) {
    await this.assertProductBelongsToShop(shopId, productId);

    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return images.map((image) => this.toResponse(shopId, image));
  }

  async upload(
    shopId: string,
    productId: string,
    files: ProductImageUploadFile[],
    imageType?: string,
  ) {
    await this.assertProductBelongsToShop(shopId, productId);

    if (!files.length) {
      throw new BadRequestException('At least one image file is required.');
    }

    const normalizedImageType = this.normalizeImageType(imageType);
    const existingCount = await this.prisma.productImage.count({
      where: { productId },
    });

    const createdImages: ProductImageResponseDto[] = [];
    for (const [index, file] of files.entries()) {
      this.validateUploadFile(file);

      const storedFile = await this.filesService.storeProductImage(file, {
        shopId,
        productId,
      });

      const image = await this.prisma.productImage.create({
        data: {
          id: randomUUID(),
          productId,
          wbUrl: storedFile.publicUrl,
          localUrl: storedFile.publicUrl,
          storageKey: storedFile.storageKey,
          originalName: storedFile.originalName,
          mimeType: storedFile.mimeType,
          size: storedFile.size,
          imageType: normalizedImageType,
          isMain: existingCount === 0 && index === 0,
          sortOrder: existingCount + index,
        },
      });

      createdImages.push(this.toResponse(shopId, image));
    }

    return createdImages;
  }

  async update(
    shopId: string,
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
  ) {
    await this.assertProductBelongsToShop(shopId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundException(
        `Image ${imageId} was not found for product ${productId}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.productImage.updateMany({
          where: {
            productId,
            id: {
              not: imageId,
            },
          },
          data: {
            isMain: false,
          },
        });
      }

      const nextImage = await tx.productImage.update({
        where: {
          id: imageId,
        },
        data: {
          imageType: dto.imageType,
          sortOrder: dto.sortOrder,
          isMain: dto.isMain,
        },
      });

      if (dto.isMain === false) {
        const hasMain = await tx.productImage.count({
          where: {
            productId,
            isMain: true,
          },
        });

        if (hasMain === 0) {
          const replacement = await tx.productImage.findFirst({
            where: {
              productId,
              id: {
                not: imageId,
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          });

          if (replacement) {
            await tx.productImage.update({
              where: { id: replacement.id },
              data: { isMain: true },
            });
          }
        }
      }

      return nextImage;
    });

    return this.toResponse(shopId, updated);
  }

  async remove(shopId: string, productId: string, imageId: string) {
    await this.assertProductBelongsToShop(shopId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundException(
        `Image ${imageId} was not found for product ${productId}.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({
        where: {
          id: imageId,
        },
      });

      if (image.isMain) {
        const replacement = await tx.productImage.findFirst({
          where: {
            productId,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        if (replacement) {
          await tx.productImage.update({
            where: {
              id: replacement.id,
            },
            data: {
              isMain: true,
            },
          });
        }
      }
    });

    await this.filesService.deleteProductImageFile({
      storageKey: image.storageKey,
      fileUrl: image.localUrl ?? image.wbUrl,
    });
  }

  private async assertProductBelongsToShop(shopId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} was not found in shop ${shopId}.`,
      );
    }
  }

  private validateUploadFile(file: ProductImageUploadFile) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type for ${file.originalname}. Allowed: image/jpeg, image/png, image/webp.`,
      );
    }

    const maxSizeMb = this.configService.get<number>('MAX_IMAGE_SIZE_MB', 10);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `${file.originalname} exceeds the maximum file size of ${maxSizeMb} MB.`,
      );
    }
  }

  private normalizeImageType(imageType?: string) {
    if (!imageType) {
      return 'ORIGINAL';
    }

    const normalized = imageType.toUpperCase();
    if (!PRODUCT_IMAGE_TYPES.has(normalized)) {
      throw new BadRequestException(`Unsupported imageType: ${imageType}.`);
    }

    return normalized;
  }

  private toResponse(
    shopId: string,
    image: {
      id: string;
      productId: string;
      wbUrl: string;
      localUrl: string | null;
      storageKey: string | null;
      originalName: string | null;
      mimeType: string | null;
      size: number | null;
      imageType: string;
      isMain: boolean | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    return {
      id: image.id,
      shopId,
      productId: image.productId,
      url: image.localUrl ?? image.wbUrl,
      wbUrl: image.wbUrl,
      localUrl: image.localUrl,
      storageKey: image.storageKey,
      originalName: image.originalName,
      mimeType: image.mimeType,
      size: image.size,
      imageType: image.imageType,
      isMain: image.isMain ?? false,
      sortOrder: image.sortOrder,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }
}
