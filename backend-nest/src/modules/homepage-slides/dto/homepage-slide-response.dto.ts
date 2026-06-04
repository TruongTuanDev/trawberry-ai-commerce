export class HomepageSlideResponseDto {
  id: string;
  titleRu?: string;
  titleEn?: string;
  subtitleRu?: string;
  subtitleEn?: string;
  ctaLabelRu?: string;
  ctaLabelEn?: string;
  ctaUrl?: string;
  altTextRu?: string;
  altTextEn?: string;
  imageDesktopUrl: string;
  imageDesktopStorageKey?: string;
  imageMobileUrl?: string;
  imageMobileStorageKey?: string;
  backgroundColor?: string;
  displayOrder: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
