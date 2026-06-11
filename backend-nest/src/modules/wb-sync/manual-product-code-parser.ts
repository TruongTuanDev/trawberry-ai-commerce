import { BadRequestException } from '@nestjs/common';

export const MANUAL_PRODUCT_CODES_MAX_LENGTH = 5000;
export const MANUAL_PRODUCT_CODES_MAX_COUNT = 100;

export type ParsedManualWbNmIds = {
  requestedCodes: string[];
  valid: Array<{ original: string; normalizedNmId: string }>;
  invalid: string[];
};

export function normalizeManualWbNmId(value: string) {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? BigInt(trimmed).toString() : null;
}

export function parseManualProductCodes(input: string): ParsedManualWbNmIds {
  if (typeof input !== 'string' || !input.trim()) {
    throw new BadRequestException('No product codes entered.');
  }

  if (input.length > MANUAL_PRODUCT_CODES_MAX_LENGTH) {
    throw new BadRequestException(
      `Product codes input must not exceed ${MANUAL_PRODUCT_CODES_MAX_LENGTH} characters.`,
    );
  }

  const requestedCodes: string[] = [];
  const valid: ParsedManualWbNmIds['valid'] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of input.split(/[,;\r\n]+/)) {
    const code = token.trim();
    if (!code) {
      continue;
    }

    const normalizedNmId = normalizeManualWbNmId(code);
    const dedupeKey = normalizedNmId
      ? `valid:${normalizedNmId}`
      : `invalid:${code.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    requestedCodes.push(code);
    if (normalizedNmId) {
      valid.push({ original: code, normalizedNmId });
    } else {
      invalid.push(code);
    }
  }

  if (requestedCodes.length === 0) {
    throw new BadRequestException('No product codes entered.');
  }

  if (requestedCodes.length > MANUAL_PRODUCT_CODES_MAX_COUNT) {
    throw new BadRequestException(
      `Too many product codes. Maximum is ${MANUAL_PRODUCT_CODES_MAX_COUNT}.`,
    );
  }

  if (valid.length === 0) {
    throw new BadRequestException(
      `Invalid WB article codes: ${invalid.join(', ')}. WB article codes must be numeric nmID values.`,
    );
  }

  return { requestedCodes, valid, invalid };
}
