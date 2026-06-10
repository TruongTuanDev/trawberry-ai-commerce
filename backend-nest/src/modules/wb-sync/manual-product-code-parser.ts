import { BadRequestException } from '@nestjs/common';

export const MANUAL_PRODUCT_CODES_MAX_LENGTH = 5000;
export const MANUAL_PRODUCT_CODES_MAX_COUNT = 100;

export function normalizeManualProductCode(value: string) {
  return value.trim().toLowerCase();
}

export function parseManualProductCodes(input: string) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new BadRequestException('No product codes entered.');
  }

  if (input.length > MANUAL_PRODUCT_CODES_MAX_LENGTH) {
    throw new BadRequestException(
      `Product codes input must not exceed ${MANUAL_PRODUCT_CODES_MAX_LENGTH} characters.`,
    );
  }

  const codes: string[] = [];
  const seen = new Set<string>();

  for (const token of input.split(/[,;\r\n]+/)) {
    const code = token.trim();
    if (!code) {
      continue;
    }

    const normalized = normalizeManualProductCode(code);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    codes.push(code);
  }

  if (codes.length === 0) {
    throw new BadRequestException('No product codes entered.');
  }

  if (codes.length > MANUAL_PRODUCT_CODES_MAX_COUNT) {
    throw new BadRequestException(
      `Too many product codes. Maximum is ${MANUAL_PRODUCT_CODES_MAX_COUNT}.`,
    );
  }

  return codes;
}
