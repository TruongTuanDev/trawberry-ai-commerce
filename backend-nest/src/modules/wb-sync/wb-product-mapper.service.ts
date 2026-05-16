import { Injectable } from '@nestjs/common';
import { WbCard, WbMappedProduct, WbSyncIssue } from './wb-sync.types';

@Injectable()
export class WbProductMapperService {
  mapCard(card: WbCard): WbMappedProduct {
    const warnings: WbSyncIssue[] = [];
    const errors: WbSyncIssue[] = [];
    const article = card.vendorCode?.trim() || null;
    if (!article)
      warnings.push(
        this.warning('MISSING_ARTICLE', 'WB card is missing vendorCode.', card),
      );
    if (!card.nmID)
      warnings.push(
        this.warning('MISSING_NM_ID', 'WB card is missing nmID.', card),
      );
    const images = this.images(card);
    if (images.length === 0)
      warnings.push(
        this.warning('MISSING_IMAGE', 'WB card has no images.', card),
      );
    const variants = (card.sizes ?? []).map((size, index) => {
      const barcode = size.skus?.find(Boolean) ?? null;
      if (!barcode)
        warnings.push(
          this.warning('MISSING_BARCODE', 'WB size has no barcode.', card),
        );
      if (!size.techSize && !size.wbSize)
        warnings.push(
          this.warning('MISSING_SIZE', 'WB size has no techSize/wbSize.', card),
        );
      return {
        chrtId: BigInt(
          size.chrtID ?? this.stableNumber(`${article ?? card.nmID}-${index}`),
        ),
        sellerSku: article,
        wbBarcode: barcode,
        sizeName: size.techSize ?? null,
        russianSize: size.wbSize ?? null,
      };
    });
    if (variants.length === 0) {
      warnings.push(
        this.warning('MISSING_SIZE', 'WB card has no sizes.', card),
      );
    }
    warnings.push(
      this.warning(
        'MISSING_PRICE',
        'Content cards API does not include price; variant price defaults to 0.',
        card,
      ),
    );
    warnings.push(
      this.warning(
        'MISSING_STOCK',
        'Content cards API does not include stock; variant stock defaults to 0.',
        card,
      ),
    );
    return {
      source: 'WILDBERRIES_API',
      externalProductId: card.nmID ? String(card.nmID) : null,
      sellerSku: article,
      wbNmId: BigInt(
        card.nmID ?? this.stableNumber(article ?? card.title ?? 'wb-card'),
      ),
      wbImtId: card.imtID ? BigInt(card.imtID) : null,
      wbNmUuid: card.nmUUID ?? null,
      name:
        card.title?.trim() || article || `WB product ${card.nmID ?? 'unknown'}`,
      description: card.description ?? null,
      brand: card.brand ?? null,
      categoryName: card.subjectName ?? null,
      categoryId: null,
      mappedCategoryName: null,
      sourceCategoryName: card.subjectName ?? null,
      subjectId: card.subjectID ? BigInt(card.subjectID) : null,
      videoUrl: card.video ?? null,
      needKiz: card.needKiz ?? null,
      dimensions: {
        width: card.dimensions?.width ?? null,
        height: card.dimensions?.height ?? null,
        length: card.dimensions?.length ?? null,
        weightBrutto: card.dimensions?.weightBrutto ?? null,
        isValid: card.dimensions?.isValid ?? null,
      },
      characteristics: {
        gender: this.characteristic(card, ['пол', 'gender']),
        composition: this.characteristic(card, ['состав', 'composition']),
        color: this.characteristic(card, ['цвет', 'color']),
      },
      variants,
      images,
      warnings,
      errors,
    };
  }

  private images(card: WbCard) {
    const seen = new Set<string>();
    return (card.photos ?? [])
      .map(
        (photo) =>
          photo.big ??
          photo.c516x688 ??
          photo.c246x328 ??
          photo.hq ??
          photo.square,
      )
      .filter((url): url is string => Boolean(url?.startsWith('http')))
      .filter((url) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .map((url, index) => ({ url, isMain: index === 0, sortOrder: index }));
  }

  private characteristic(card: WbCard, names: string[]) {
    const found = (card.characteristics ?? []).find((item) => {
      const name = item.name?.trim().toLowerCase();
      return name ? names.includes(name) : false;
    });
    if (!found) return null;
    return Array.isArray(found.value)
      ? found.value.join(', ')
      : String(found.value);
  }

  private warning(code: string, message: string, card: WbCard): WbSyncIssue {
    return {
      level: 'WARNING',
      code,
      message,
      article: card.vendorCode ?? null,
      nmID: card.nmID ?? null,
    };
  }

  private stableNumber(value: string) {
    let hash = 0;
    for (const char of value)
      hash = (hash * 31 + char.charCodeAt(0)) % 900000000;
    return 9000000000000 + hash;
  }
}
