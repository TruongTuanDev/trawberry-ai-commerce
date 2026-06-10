import { BadRequestException } from '@nestjs/common';
import {
  MANUAL_PRODUCT_CODES_MAX_COUNT,
  MANUAL_PRODUCT_CODES_MAX_LENGTH,
  parseManualProductCodes,
} from '../src/modules/wb-sync/manual-product-code-parser';

describe('WB manual product code parser', () => {
  it.each([
    ['comma-separated', '234-xanh,356-đỏ,789-den'],
    ['semicolon-separated', '234-xanh;356-đỏ;789-den'],
    ['newline-separated', '234-xanh\n356-đỏ\n789-den'],
    ['mixed separators', '234-xanh, 356-đỏ\n789-den'],
  ])('parses %s codes', (_name, input) => {
    expect(parseManualProductCodes(input)).toEqual([
      '234-xanh',
      '356-đỏ',
      '789-den',
    ]);
  });

  it('deduplicates codes while preserving the first original token', () => {
    expect(parseManualProductCodes(' 234-Xanh,234-xanh, 356-đỏ ')).toEqual([
      '234-Xanh',
      '356-đỏ',
    ]);
  });

  it('keeps dashes, underscores, Vietnamese, Cyrillic, and internal spaces', () => {
    expect(
      parseManualProductCodes('234-xanh;356_đỏ\n789-чёрный\ncode with space'),
    ).toEqual(['234-xanh', '356_đỏ', '789-чёрный', 'code with space']);
  });

  it('rejects empty input', () => {
    expect(() => parseManualProductCodes(' , ; \r\n ')).toThrow(
      BadRequestException,
    );
  });

  it('rejects more than the maximum code count', () => {
    const input = Array.from(
      { length: MANUAL_PRODUCT_CODES_MAX_COUNT + 1 },
      (_, index) => `code-${index}`,
    ).join(',');

    expect(() => parseManualProductCodes(input)).toThrow(
      `Too many product codes. Maximum is ${MANUAL_PRODUCT_CODES_MAX_COUNT}.`,
    );
  });

  it('rejects input longer than the maximum length', () => {
    expect(() =>
      parseManualProductCodes('x'.repeat(MANUAL_PRODUCT_CODES_MAX_LENGTH + 1)),
    ).toThrow(
      `Product codes input must not exceed ${MANUAL_PRODUCT_CODES_MAX_LENGTH} characters.`,
    );
  });
});
