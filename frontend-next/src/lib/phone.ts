const PHONE_DIGIT_MIN = 10;
const PHONE_DIGIT_MAX = 15;

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Phone is required.");
  }

  const sanitized = trimmed.replace(/[\s\-()]/g, "");
  if (!/^\+?\d+$/.test(sanitized)) {
    throw new Error("Phone format is invalid.");
  }

  const hasPlus = sanitized.startsWith("+");
  const digits = hasPlus ? sanitized.slice(1) : sanitized;

  if (digits.length < PHONE_DIGIT_MIN || digits.length > PHONE_DIGIT_MAX) {
    throw new Error("Phone format is invalid.");
  }

  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith("8")) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 11 && digits.startsWith("7")) {
      return `+${digits}`;
    }
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function maybeNormalizePhone(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return normalizePhone(trimmed);
}
