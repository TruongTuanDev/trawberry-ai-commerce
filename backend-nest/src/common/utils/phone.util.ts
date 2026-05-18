import { BadRequestException } from '@nestjs/common';

const PHONE_DIGIT_MIN = 10;
const PHONE_DIGIT_MAX = 15;

export function normalizePhone(input: string, fieldLabel = 'Phone') {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BadRequestException(`${fieldLabel} is required.`);
  }

  const sanitized = trimmed.replace(/[\s\-()]/g, '');
  if (!/^\+?\d+$/.test(sanitized)) {
    throw new BadRequestException(`${fieldLabel} format is invalid.`);
  }

  const hasPlus = sanitized.startsWith('+');
  const digits = hasPlus ? sanitized.slice(1) : sanitized;

  if (digits.length < PHONE_DIGIT_MIN || digits.length > PHONE_DIGIT_MAX) {
    throw new BadRequestException(`${fieldLabel} format is invalid.`);
  }

  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits}`;
    }
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function tryNormalizePhone(input?: string | null) {
  const trimmed = input?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  try {
    return normalizePhone(trimmed);
  } catch {
    return null;
  }
}

export function createSyntheticEmailFromPhone(phone: string) {
  const safePhone = phone.replace(/[^a-zA-Z0-9]/g, '');
  return `phone-${safePhone}@customer.local`;
}

export function isSyntheticEmail(email: string) {
  return (
    /@customer\.local$/i.test(email) &&
    /^phone-[a-zA-Z0-9]+@customer\.local$/i.test(email)
  );
}
