const getApiUrl = () => {
  if (typeof window === "undefined") {
    return "http://backend-nest:3001";
  }
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
  return rawApiUrl.replace("://localhost", "://127.0.0.1");
};

const API_URL = getApiUrl();

export type AuthRoleKey = "admin" | "seller" | "customer";

type RequestOptions = RequestInit & {
  token?: string | null;
  authRole?: AuthRoleKey | null;
  retryOnAuthFailure?: boolean;
};

type InternalRequestOptions = RequestOptions & {
  retryAttempted?: boolean;
};

const refreshInFlight = new Map<AuthRoleKey, Promise<boolean>>();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function inferAuthRole(path: string): AuthRoleKey | null {
  if (
    path.startsWith("/api/admin") ||
    path.startsWith("/api/auth/admin/")
  ) {
    return "admin";
  }

  if (
    path.startsWith("/api/shops") ||
    path.startsWith("/api/seller") ||
    path.startsWith("/api/auth/seller/")
  ) {
    return "seller";
  }

  if (
    path.startsWith("/api/customer") ||
    path.startsWith("/api/auth/customer/")
  ) {
    return "customer";
  }

  return null;
}

function shouldSkipRefresh(path: string) {
  if (!path.startsWith("/api/auth/")) {
    return false;
  }

  return (
    path.includes("/login") ||
    path.includes("/register") ||
    path.includes("/logout") ||
    path.includes("/refresh")
  );
}

async function readErrorMessage(response: Response) {
  let message = "Request failed";

  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      message = body.message.join(", ");
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    message = response.statusText || message;
  }

  return message;
}

async function requestRefresh(role: AuthRoleKey): Promise<boolean> {
  const existing = refreshInFlight.get(role);
  if (existing) {
    return existing;
  }

  const refreshPromise = (async () => {
    const response = await fetch(`${API_URL}/api/auth/${role}/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    return response.ok;
  })().finally(() => {
    refreshInFlight.delete(role);
  });

  refreshInFlight.set(role, refreshPromise);
  return refreshPromise;
}

async function executeRequest<T>(
  path: string,
  options: InternalRequestOptions = {},
): Promise<T> {
  const {
    token,
    headers,
    body,
    authRole,
    retryOnAuthFailure = true,
    retryAttempted = false,
    ...rest
  } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    body,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const resolvedRole = authRole ?? inferAuthRole(path);

    if (
      response.status === 401 &&
      retryOnAuthFailure &&
      !retryAttempted &&
      resolvedRole &&
      !shouldSkipRefresh(path)
    ) {
      const refreshed = await requestRefresh(resolvedRole);
      if (refreshed) {
        return executeRequest<T>(path, {
          ...options,
          authRole: resolvedRole,
          retryAttempted: true,
        });
      }
    }

    throw new ApiError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return executeRequest<T>(path, options);
}

export { API_URL, requestRefresh };
