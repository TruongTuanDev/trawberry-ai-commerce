const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function parseBaseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function rewriteUrlForAiService(
  value: string | null | undefined,
  options: {
    backendInternalBaseUrl?: string | null;
    backendPublicBaseUrl?: string | null;
  } = {},
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const internalBaseUrl = parseBaseUrl(options.backendInternalBaseUrl);
  if (!internalBaseUrl) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return new URL(trimmed, internalBaseUrl).toString();
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (LOCAL_HOSTS.has(parsed.hostname)) {
    parsed.protocol = internalBaseUrl.protocol;
    parsed.username = internalBaseUrl.username;
    parsed.password = internalBaseUrl.password;
    parsed.hostname = internalBaseUrl.hostname;
    parsed.port = internalBaseUrl.port;
    return parsed.toString();
  }

  const publicBaseUrl = parseBaseUrl(options.backendPublicBaseUrl);
  if (
    publicBaseUrl &&
    parsed.origin === publicBaseUrl.origin &&
    parsed.pathname.startsWith('/uploads/')
  ) {
    return new URL(
      parsed.pathname + parsed.search + parsed.hash,
      internalBaseUrl,
    ).toString();
  }

  return trimmed;
}
