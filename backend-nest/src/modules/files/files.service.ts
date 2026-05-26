import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

type StoredFileResult = {
  publicUrl: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

@Injectable()
export class FilesService {
  constructor(private readonly configService: ConfigService) {}

  createUploadDescriptor(dto: CreateUploadUrlDto) {
    const bucket = this.getS3Bucket();
    const baseUrl = this.configService.get<string>(
      'S3_PUBLIC_BASE_URL',
      'http://localhost:9000',
    );
    const key = `${Date.now()}-${dto.filename}`;

    return {
      provider: 's3-compatible',
      bucket,
      key,
      contentType: dto.contentType ?? 'application/octet-stream',
      uploadUrl: `${baseUrl}/${bucket}/${key}`,
    };
  }

  async storeProductImage(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      productId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeProductImageLocally(file, context);
    }

    return this.storeProductImageInS3(file, context);
  }

  async storePaymentProof(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      orderId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storePaymentProofLocally(file, context);
    }

    return this.storePaymentProofInS3(file, context);
  }

  async storeShopPaymentQr(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeShopPaymentQrLocally(file, context);
    }

    return this.storeShopPaymentQrInS3(file, context);
  }

  async storeSellerDocument(
    file: ProductImageUploadFile,
    context: {
      userId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeSellerDocumentLocally(file, context);
    }

    return this.storeSellerDocumentInS3(file, context);
  }

  async storeReturnRefundEvidence(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      caseId: string;
      folder?: 'evidence' | 'refund-proof';
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeReturnRefundEvidenceLocally(file, context);
    }

    return this.storeReturnRefundEvidenceInS3(file, context);
  }

  async storeReviewImage(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      reviewId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeReviewImageLocally(file, context);
    }

    return this.storeReviewImageInS3(file, context);
  }

  async storeHomepageSlideImage(
    file: ProductImageUploadFile,
    context: {
      slideId: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeHomepageSlideImageLocally(file, context);
    }

    return this.storeHomepageSlideImageInS3(file, context);
  }

  async storeAiTryOnReference(
    file: ProductImageUploadFile,
    context: {
      scope: 'guest' | 'customer';
      identifier: string;
    },
  ): Promise<StoredFileResult> {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      return this.storeAiTryOnReferenceLocally(file, context);
    }

    return this.storeAiTryOnReferenceInS3(file, context);
  }

  async deleteProductImageFile(params: {
    storageKey?: string | null;
    fileUrl?: string | null;
  }) {
    const storageDriver = this.getStorageDriver();
    if (storageDriver === 'local') {
      await this.deleteStoredFileLocally(params.storageKey, params.fileUrl);
      return;
    }

    if (!params.storageKey) {
      return;
    }

    const client = this.createS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: params.storageKey,
      }),
    );
  }

  async deleteStoredFile(params: {
    storageKey?: string | null;
    fileUrl?: string | null;
  }) {
    await this.deleteProductImageFile(params);
  }

  private async storeProductImageLocally(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      productId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'products',
      context.shopId,
      context.productId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = [
      'products',
      context.shopId,
      context.productId,
      filename,
    ].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeProductImageInS3(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      productId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'products',
      context.shopId,
      context.productId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storePaymentProofLocally(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      orderId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'payment-proofs',
      context.shopId,
      context.orderId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = [
      'payment-proofs',
      context.shopId,
      context.orderId,
      filename,
    ].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storePaymentProofInS3(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      orderId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'payment-proofs',
      context.shopId,
      context.orderId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeSellerDocumentLocally(
    file: ProductImageUploadFile,
    context: {
      userId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'seller-documents',
      context.userId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = ['seller-documents', context.userId, filename].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeShopPaymentQrLocally(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'shop-payment-qr',
      context.shopId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = ['shop-payment-qr', context.shopId, filename].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeSellerDocumentInS3(
    file: ProductImageUploadFile,
    context: {
      userId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'seller-documents',
      context.userId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeShopPaymentQrInS3(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'shop-payment-qr',
      context.shopId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeReturnRefundEvidenceLocally(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      caseId: string;
      folder?: 'evidence' | 'refund-proof';
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const folder = context.folder ?? 'evidence';
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'return-refund',
      context.shopId,
      context.caseId,
      folder,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = [
      'return-refund',
      context.shopId,
      context.caseId,
      folder,
      filename,
    ].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeReturnRefundEvidenceInS3(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      caseId: string;
      folder?: 'evidence' | 'refund-proof';
    },
  ): Promise<StoredFileResult> {
    const folder = context.folder ?? 'evidence';
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'return-refund',
      context.shopId,
      context.caseId,
      folder,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeReviewImageLocally(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      reviewId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'review-images',
      context.shopId,
      context.reviewId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = [
      'review-images',
      context.shopId,
      context.reviewId,
      filename,
    ].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeReviewImageInS3(
    file: ProductImageUploadFile,
    context: {
      shopId: string;
      reviewId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'review-images',
      context.shopId,
      context.reviewId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeHomepageSlideImageLocally(
    file: ProductImageUploadFile,
    context: {
      slideId: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'homepage-slides',
      context.slideId,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = ['homepage-slides', context.slideId, filename].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeHomepageSlideImageInS3(
    file: ProductImageUploadFile,
    context: {
      slideId: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'homepage-slides',
      context.slideId,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeAiTryOnReferenceLocally(
    file: ProductImageUploadFile,
    context: {
      scope: 'guest' | 'customer';
      identifier: string;
    },
  ): Promise<StoredFileResult> {
    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const targetDirectory = join(
      process.cwd(),
      uploadRoot,
      'ai-try-on',
      context.scope,
      context.identifier,
    );
    const extension = extname(file.originalname) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const absolutePath = join(targetDirectory, filename);
    const storageKey = [
      'ai-try-on',
      context.scope,
      context.identifier,
      filename,
    ].join('/');

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      publicUrl: this.buildLocalPublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async storeAiTryOnReferenceInS3(
    file: ProductImageUploadFile,
    context: {
      scope: 'guest' | 'customer';
      identifier: string;
    },
  ): Promise<StoredFileResult> {
    const extension = extname(file.originalname) || '.bin';
    const storageKey = [
      'ai-try-on',
      context.scope,
      context.identifier,
      `${Date.now()}-${randomUUID()}${extension}`,
    ].join('/');

    const client = this.createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      publicUrl: this.buildS3PublicUrl(storageKey),
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async deleteStoredFileLocally(
    storageKey?: string | null,
    fileUrl?: string | null,
  ) {
    if (!storageKey && !fileUrl) {
      return;
    }

    const uploadRoot = this.configService.get<string>('UPLOAD_ROOT', 'uploads');
    const uploadsPrefix = '/uploads/';
    const relativePath =
      storageKey ?? this.extractRelativePath(fileUrl ?? '', uploadsPrefix);
    if (!relativePath) {
      return;
    }

    const absolutePath = join(
      process.cwd(),
      uploadRoot,
      ...relativePath.split('/'),
    );
    try {
      await unlink(absolutePath);
    } catch {
      return;
    }
  }

  private buildLocalPublicUrl(relativePath: string) {
    const publicBaseUrl =
      this.configService.get<string>('FILES_PUBLIC_BASE_URL') ??
      this.configService.get<string>('APP_PUBLIC_URL') ??
      `http://localhost:${this.configService.get<number>('PORT', 3001)}`;

    return `${publicBaseUrl.replace(/\/$/, '')}/uploads/${relativePath}`;
  }

  private buildS3PublicUrl(storageKey: string) {
    const publicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_BASE_URL') ??
      this.configService.get<string>('S3_ENDPOINT') ??
      'http://localhost:9000';

    return `${publicBaseUrl.replace(/\/$/, '')}/${this.getS3Bucket()}/${storageKey}`;
  }

  private extractRelativePath(fileUrl: string, uploadsPrefix: string) {
    if (fileUrl.startsWith(uploadsPrefix)) {
      return fileUrl.slice(uploadsPrefix.length);
    }

    try {
      const parsed = new URL(fileUrl);
      if (parsed.pathname.startsWith(uploadsPrefix)) {
        return parsed.pathname.slice(uploadsPrefix.length);
      }
    } catch {
      return null;
    }

    return null;
  }

  private createS3Client() {
    return new S3Client({
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      endpoint: this.configService.get<string>(
        'S3_ENDPOINT',
        'http://localhost:9000',
      ),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>(
          'S3_ACCESS_KEY_ID',
          'minioadmin',
        ),
        secretAccessKey: this.configService.get<string>(
          'S3_SECRET_ACCESS_KEY',
          'minioadmin',
        ),
      },
    });
  }

  private getS3Bucket() {
    return this.configService.get<string>('S3_BUCKET', 'strawberry-assets');
  }

  private getStorageDriver() {
    return this.configService.get<string>(
      'STORAGE_DRIVER',
      this.configService.get<string>('FILE_STORAGE_DRIVER', 'local'),
    );
  }
}
