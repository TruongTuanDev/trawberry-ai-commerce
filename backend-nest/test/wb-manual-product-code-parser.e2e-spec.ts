import { BadRequestException } from '@nestjs/common';
import {
  MANUAL_PRODUCT_CODES_MAX_COUNT,
  MANUAL_PRODUCT_CODES_MAX_LENGTH,
  parseManualProductCodes,
} from '../src/modules/wb-sync/manual-product-code-parser';

describe('WB manual product code parser', () => {
  it.each([
    ['comma-separated', '1013414108,123456789,789012345'],
    ['semicolon-separated', '1013414108;123456789;789012345'],
    ['newline-separated', '1013414108\n123456789\n789012345'],
    ['mixed separators', '1013414108, 123456789\n789012345'],
  ])('parses %s codes', (_name, input) => {
    expect(parseManualProductCodes(input)).toEqual({
      requestedCodes: ['1013414108', '123456789', '789012345'],
      valid: [
        { original: '1013414108', normalizedNmId: '1013414108' },
        { original: '123456789', normalizedNmId: '123456789' },
        { original: '789012345', normalizedNmId: '789012345' },
      ],
      invalid: [],
    });
  });

  it('deduplicates codes while preserving the first original token', () => {
    expect(
      parseManualProductCodes(' 001013414108,1013414108, 123456789 '),
    ).toEqual({
      requestedCodes: ['001013414108', '123456789'],
      valid: [
        { original: '001013414108', normalizedNmId: '1013414108' },
        { original: '123456789', normalizedNmId: '123456789' },
      ],
      invalid: [],
    });
  });

  it('reports non-numeric seller articles as invalid while keeping valid nmIDs', () => {
    expect(parseManualProductCodes('1013414108;234-xanh\nabc')).toEqual({
      requestedCodes: ['1013414108', '234-xanh', 'abc'],
      valid: [{ original: '1013414108', normalizedNmId: '1013414108' }],
      invalid: ['234-xanh', 'abc'],
    });
  });

  it('rejects input containing no valid numeric nmID', () => {
    expect(() => parseManualProductCodes('234-xanh,abc')).toThrow(
      'WB article codes must be numeric nmID values.',
    );
  });

  it('rejects empty input', () => {
    expect(() => parseManualProductCodes(' , ; \r\n ')).toThrow(
      BadRequestException,
    );
  });

  it('rejects more than the maximum code count', () => {
    const input = Array.from(
      { length: MANUAL_PRODUCT_CODES_MAX_COUNT + 1 },
      (_, index) => String(1000000000 + index),
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
