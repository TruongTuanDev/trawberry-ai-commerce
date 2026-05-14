import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { WildberriesExcelParserService } from '../src/modules/wb-imports/wildberries-excel-parser.service';

function fileFromBuffer(
  buffer: Buffer,
  originalname = 'wb-products-sample.xlsx',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
    size: buffer.length,
    stream: undefined as never,
    destination: '',
    filename: originalname,
    path: '',
  };
}

function buildWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    'Товары',
  );

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer;
}

describe('WildberriesExcelParserService', () => {
  const parser = new WildberriesExcelParserService();

  it('parses a WB Excel fixture and groups variants by seller SKU', () => {
    const buffer = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'wb-products-sample.xlsx'),
    );

    const preview = parser.parse(fileFromBuffer(buffer), {
      defaultStockQuantity: 7,
      publishMode: 'ACTIVE',
      imageMode: 'REMOTE_URL',
    });

    expect(preview.errors).toHaveLength(0);
    expect(preview.products).toHaveLength(2);
    expect(preview.products[0].sellerSku).toBe('SKU-100');
    expect(preview.products[0].variants).toHaveLength(2);
    expect(preview.products[0].images.map((image) => image.url)).toEqual([
      'https://example.com/a1.jpg',
      'https://example.com/a2.jpg',
    ]);
    expect(preview.products[0].variants[0]).toMatchObject({
      rowNumber: 5,
      sizeName: 'S',
      russianSize: '42',
      wbBarcode: '460000000001',
      price: 1200,
      stockQuantity: 7,
    });
    expect(preview.products[0]).toMatchObject({
      externalProductId: '990000001',
      needKiz: true,
      packageWeightGram: 500,
      packageHeightCm: 5,
      packageLengthCm: 30,
      packageWidthCm: 30,
    });
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_SKU_ROW', row: 6 }),
        expect.objectContaining({ code: 'MISSING_PRICE', row: 7 }),
        expect.objectContaining({ code: 'MISSING_BARCODE', row: 7 }),
      ]),
    );
  });

  it('returns an error when the WB products sheet is missing', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['Name']]),
      'Other',
    );
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const preview = parser.parse(fileFromBuffer(buffer), {
      defaultStockQuantity: 0,
      publishMode: 'DRAFT',
      imageMode: 'REMOTE_URL',
    });

    expect(preview.errors).toEqual([
      expect.objectContaining({ code: 'SHEET_NOT_FOUND' }),
    ]);
  });

  it('dedupes remote images, skips invalid URLs, and keeps the first valid image as main', () => {
    const buffer = buildWorkbook([
      [],
      [],
      [
        'Артикул продавца',
        'Наименование',
        'Категория продавца',
        'Описание',
        'Фото',
        'Размер',
        'Рос. размер',
        'Цена',
      ],
      ['Help text'],
      [
        'SKU-IMAGE',
        'WB Image Product',
        'Shirts',
        'Description',
        'not-a-url; https://example.com/valid-a.jpg ;https://example.com/valid-a.jpg;https://example.com/valid-b.jpg',
        'S',
        '42',
        1000,
      ],
    ]);

    const preview = parser.parse(fileFromBuffer(buffer), {
      defaultStockQuantity: 0,
      publishMode: 'DRAFT',
      imageMode: 'REMOTE_URL',
    });

    expect(preview.products[0].images).toEqual([
      {
        url: 'https://example.com/valid-a.jpg',
        isMain: true,
        sortOrder: 0,
      },
      {
        url: 'https://example.com/valid-b.jpg',
        isMain: false,
        sortOrder: 1,
      },
    ]);
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_IMAGE_URL', row: 5 }),
      ]),
    );
  });

  it('warns that DOWNLOAD_TO_STORAGE is not implemented and keeps remote URL parsing', () => {
    const buffer = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'wb-products-sample.xlsx'),
    );

    const preview = parser.parse(fileFromBuffer(buffer), {
      defaultStockQuantity: 0,
      publishMode: 'DRAFT',
      imageMode: 'DOWNLOAD_TO_STORAGE',
    });

    expect(preview.products[0].images[0].url).toBe(
      'https://example.com/a1.jpg',
    );
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IMAGE_DOWNLOAD_NOT_IMPLEMENTED' }),
      ]),
    );
  });

  it('rejects unsupported file types', () => {
    expect(() =>
      parser.parse(fileFromBuffer(Buffer.from('not excel'), 'bad.csv'), {
        defaultStockQuantity: 0,
        publishMode: 'DRAFT',
        imageMode: 'REMOTE_URL',
      }),
    ).toThrow(BadRequestException);
  });
});
