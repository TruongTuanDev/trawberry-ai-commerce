import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { WildberriesImportOptionsDto } from './dto/wildberries-import-options.dto';
import {
  WbImportIssue,
  WbImportNormalizedPayload,
  WbImportProduct,
  WbImportVariant,
} from './wildberries-import.types';

type WbRawRow = Record<string, unknown> & { __rowNumber: number };
type WorksheetCell = { v?: unknown; w?: string };

const SHEET_NAME = '\u0422\u043e\u0432\u0430\u0440\u044b';
const HEADER_ROW = 3;
const DATA_START_ROW = 6;
const H = {
  sellerSku:
    '\u0410\u0440\u0442\u0438\u043a\u0443\u043b \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430',
  wbArticle: '\u0410\u0440\u0442\u0438\u043a\u0443\u043b WB',
  name: '\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435',
  sellerCategory:
    '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430',
  brand: '\u0411\u0440\u0435\u043d\u0434',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  photo: '\u0424\u043e\u0442\u043e',
  video: '\u0412\u0438\u0434\u0435\u043e',
  kiz: '\u041a\u0418\u0417',
  packageWeightKg:
    '\u0412\u0435\u0441 \u0441 \u0443\u043f\u0430\u043a\u043e\u0432\u043a\u043e\u0439 (\u043a\u0433)',
  gender: '\u041f\u043e\u043b',
  composition: '\u0421\u043e\u0441\u0442\u0430\u0432',
  color: '\u0426\u0432\u0435\u0442',
  barcodes: '\u0411\u0430\u0440\u043a\u043e\u0434\u044b',
  size: '\u0420\u0430\u0437\u043c\u0435\u0440',
  russianSize: '\u0420\u043e\u0441. \u0440\u0430\u0437\u043c\u0435\u0440',
  price: '\u0426\u0435\u043d\u0430',
  packageWeightGram:
    '\u0412\u0435\u0441 \u0442\u043e\u0432\u0430\u0440\u0430 \u0441 \u0443\u043f\u0430\u043a\u043e\u0432\u043a\u043e\u0439 (\u0433)',
  packageHeight:
    '\u0412\u044b\u0441\u043e\u0442\u0430 \u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0438',
  packageLength:
    '\u0414\u043b\u0438\u043d\u0430 \u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0438',
  packageWidth:
    '\u0428\u0438\u0440\u0438\u043d\u0430 \u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0438',
} as const;

@Injectable()
export class WildberriesExcelParserService {
  parse(
    file: Express.Multer.File,
    options: WildberriesImportOptionsDto,
  ): WbImportNormalizedPayload {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException({
        message: 'Unsupported file type. Upload a .xlsx Wildberries export.',
        errors: [
          {
            level: 'ERROR',
            code: 'UNSUPPORTED_FILE_TYPE',
            message:
              'Unsupported file type. Upload a .xlsx Wildberries export.',
          },
        ],
      });
    }

    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: false,
      raw: false,
    });
    const sheet = workbook.Sheets[SHEET_NAME];

    if (!sheet) {
      return {
        source: 'WILDBERRIES_EXCEL',
        totalRows: 0,
        products: [],
        warnings: [],
        errors: [
          {
            level: 'ERROR',
            code: 'SHEET_NOT_FOUND',
            message: `Sheet "${SHEET_NAME}" was not found.`,
          },
        ],
      };
    }

    const rows = this.readRows(sheet);
    const warnings: WbImportIssue[] = [];
    const errors: WbImportIssue[] = [];
    const productsByKey = new Map<string, WbImportProduct>();
    const seenSellerSkuRows = new Map<string, number>();

    for (const row of rows) {
      const sellerSku = this.text(row[H.sellerSku]);
      const externalProductId = this.text(row[H.wbArticle]);
      const name = this.text(row[H.name]);
      const color = this.text(row[H.color]);
      const groupKey =
        sellerSku ??
        externalProductId ??
        this.slug([name, color].filter(Boolean).join('-'));

      if (!name) {
        errors.push({
          level: 'ERROR',
          code: 'MISSING_PRODUCT_NAME',
          message: 'Product name is missing.',
          row: row.__rowNumber,
          sellerSku,
        });
      }

      if (!sellerSku && !externalProductId) {
        errors.push({
          level: 'ERROR',
          code: 'MISSING_SKU_AND_WB_ID',
          message: 'Both seller SKU and WB article are missing.',
          row: row.__rowNumber,
          sellerSku,
        });
      }

      if (!groupKey || !name) {
        continue;
      }

      if (sellerSku && seenSellerSkuRows.has(sellerSku)) {
        warnings.push({
          level: 'WARNING',
          code: 'DUPLICATE_SKU_ROW',
          message: `SKU ${sellerSku} appears on multiple rows and will be grouped into one product.`,
          row: row.__rowNumber,
          sellerSku,
        });
      } else if (sellerSku) {
        seenSellerSkuRows.set(sellerSku, row.__rowNumber);
      }

      let product = productsByKey.get(groupKey);
      if (!product) {
        product = {
          groupKey,
          sellerSku,
          externalProductId,
          name,
          categoryName: this.text(row[H.sellerCategory]),
          brand: this.text(row[H.brand]),
          description: this.text(row[H.description]),
          videoUrl: this.text(row[H.video]),
          needKiz: this.boolean(row[H.kiz]),
          gender: this.text(row[H.gender]),
          composition: this.text(row[H.composition]),
          color,
          packageWeightGram: this.weightGram(row),
          packageHeightCm: this.number(row[H.packageHeight]),
          packageLengthCm: this.number(row[H.packageLength]),
          packageWidthCm: this.number(row[H.packageWidth]),
          variants: [],
          images: this.parseImages(
            row[H.photo],
            row.__rowNumber,
            sellerSku,
            warnings,
          ),
          warnings: [],
          errors: [],
        };
        productsByKey.set(groupKey, product);
      } else {
        for (const image of this.parseImages(
          row[H.photo],
          row.__rowNumber,
          sellerSku,
          warnings,
        )) {
          if (!product.images.some((existing) => existing.url === image.url)) {
            product.images.push({
              ...image,
              isMain: product.images.length === 0,
              sortOrder: product.images.length,
            });
          }
        }
      }

      product.variants.push(this.parseVariant(row, sellerSku, options));
    }

    for (const product of productsByKey.values()) {
      this.validateProduct(product);
      warnings.push(...product.warnings);
      errors.push(...product.errors);
    }

    if (!productsByKey.size && errors.length === 0) {
      errors.push({
        level: 'ERROR',
        code: 'NO_VALID_DATA_ROWS',
        message: 'No valid data rows were found in the Wildberries sheet.',
      });
    }

    return {
      source: 'WILDBERRIES_EXCEL',
      totalRows: rows.length,
      products: [...productsByKey.values()],
      warnings,
      errors,
    };
  }

  private readRows(sheet: XLSX.WorkSheet): WbRawRow[] {
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    const headers = new Map<number, string>();

    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[
        XLSX.utils.encode_cell({ r: HEADER_ROW - 1, c: column })
      ] as WorksheetCell | undefined;
      const header = this.text(cell?.v);
      if (header) {
        headers.set(column, header);
      }
    }

    const rows: WbRawRow[] = [];
    for (
      let rowIndex = DATA_START_ROW - 1;
      rowIndex <= range.e.r;
      rowIndex += 1
    ) {
      const row: WbRawRow = { __rowNumber: rowIndex + 1 };
      let hasValue = false;

      for (const [column, header] of headers) {
        const cell = sheet[
          XLSX.utils.encode_cell({ r: rowIndex, c: column })
        ] as WorksheetCell | undefined;
        const value = cell?.w ?? cell?.v;
        if (this.text(value) !== null) {
          hasValue = true;
          row[header] = value;
        }
      }

      if (hasValue) {
        rows.push(row);
      }
    }

    return rows;
  }

  private parseVariant(
    row: WbRawRow,
    sellerSku: string | null,
    options: WildberriesImportOptionsDto,
  ): WbImportVariant {
    const price = this.number(row[H.price]) ?? options.priceFallback ?? null;

    return {
      rowNumber: row.__rowNumber,
      sellerSku,
      wbBarcode: this.text(row[H.barcodes]),
      sizeName: this.text(row[H.size]),
      russianSize: this.text(row[H.russianSize]),
      price,
      stockQuantity: options.defaultStockQuantity ?? 0,
    };
  }

  private parseImages(
    value: unknown,
    rowNumber: number,
    sellerSku: string | null,
    warnings: WbImportIssue[],
  ) {
    const seen = new Set<string>();
    return (this.text(value) ?? '')
      .split(';')
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url) => {
        if (seen.has(url)) {
          return false;
        }
        seen.add(url);
        return true;
      })
      .map((url, index) => {
        if (!this.isValidUrl(url)) {
          warnings.push({
            level: 'WARNING',
            code: 'INVALID_IMAGE_URL',
            message: `Image URL is invalid: ${url}`,
            row: rowNumber,
            sellerSku,
          });
        }

        return {
          url,
          isMain: index === 0,
          sortOrder: index,
        };
      });
  }

  private validateProduct(product: WbImportProduct) {
    if (!product.categoryName) {
      product.warnings.push({
        level: 'WARNING',
        code: 'UNKNOWN_CATEGORY',
        message: 'Category is missing.',
        sellerSku: product.sellerSku,
      });
    }

    if (!product.description) {
      product.warnings.push({
        level: 'WARNING',
        code: 'EMPTY_DESCRIPTION',
        message: 'Description is empty.',
        sellerSku: product.sellerSku,
      });
    }

    if (!product.images.length) {
      product.warnings.push({
        level: 'WARNING',
        code: 'MISSING_IMAGE',
        message: 'Product has no images.',
        sellerSku: product.sellerSku,
      });
    }

    if (
      product.packageHeightCm === null ||
      product.packageLengthCm === null ||
      product.packageWidthCm === null
    ) {
      product.warnings.push({
        level: 'WARNING',
        code: 'PACKAGE_DIMENSIONS_MISSING',
        message: 'Package dimensions are missing.',
        sellerSku: product.sellerSku,
      });
    }

    for (const variant of product.variants) {
      if (!variant.price || variant.price <= 0) {
        product.warnings.push({
          level: 'WARNING',
          code: 'MISSING_PRICE',
          message: 'Variant price is missing or zero.',
          row: variant.rowNumber,
          sellerSku: product.sellerSku,
        });
      }

      if (!variant.wbBarcode) {
        product.warnings.push({
          level: 'WARNING',
          code: 'MISSING_BARCODE',
          message: 'Variant barcode is missing.',
          row: variant.rowNumber,
          sellerSku: product.sellerSku,
        });
      }

      if (!variant.sizeName && !variant.russianSize) {
        product.warnings.push({
          level: 'WARNING',
          code: 'MISSING_SIZE',
          message: 'Variant size is missing.',
          row: variant.rowNumber,
          sellerSku: product.sellerSku,
        });
      }
    }
  }

  private weightGram(row: WbRawRow) {
    return (
      this.number(row[H.packageWeightGram]) ??
      this.toGram(this.number(row[H.packageWeightKg]))
    );
  }

  private text(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      typeof value !== 'bigint'
    ) {
      return null;
    }

    const text = String(value).trim();
    return text.length ? text : null;
  }

  private number(value: unknown): number | null {
    const text = this.text(value);
    if (!text) {
      return null;
    }

    const parsed = Number(text.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toGram(value: number | null) {
    return value === null ? null : Math.round(value * 1000);
  }

  private boolean(value: unknown) {
    const text = this.text(value)?.toLowerCase();
    if (!text) {
      return null;
    }

    return ['\u0434\u0430', 'true', '1', 'yes'].includes(text);
  }

  private isValidUrl(value: string) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  private slug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
  }
}
