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
