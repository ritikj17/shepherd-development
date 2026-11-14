import { apiConfig } from "@/lib/api/config";
import type { ApiErrorBody } from "@/lib/types/api";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "NETWORK_ERROR";
    this.details = options.details;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export function errorMessage(error: unknown): string {
  if (isApiRequestError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;

/**
 * The auth provider registers a token getter that reads the current Supabase
 * session. Tokens are never written to localStorage by this application.
 */
export function registerApiTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

/** Used by the multipart uploader, which needs the same Bearer token. */
export async function getApiAccessToken(): Promise<string | null> {
  return tokenProvider();
}

/** Exposed for the XHR uploader so there is one source of base URLs. */
export function buildApiUrl(path: string): string {
  return buildUrl(path);
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: boolean;
  /** Internal: used by the multipart uploader. */
  formData?: FormData;
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiConfig.baseUrl}${normalized}`;
}

async function parseError(response: Response): Promise<ApiRequestError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  const message =
    body?.error?.message ||
    (response.status === 401
      ? "Your session has expired. Please sign in again."
      : response.status === 403
        ? "You do not have access to this record."
        : response.status === 404
          ? "The requested record could not be found."
          : response.status === 413
            ? "The file is larger than the 10 MB limit."
            : response.status === 415
              ? "That file type is not supported."
              : response.status === 429
                ? "Too many requests. Please wait a moment and try again."
                : `Request failed (${response.status}).`);

  return new ApiRequestError(message, {
    status: response.status,
    code: body?.error?.code ?? `HTTP_${response.status}`,
    details: body?.error?.details,
  });
}

/**
 * Single typed entry point for all Core API calls.
 * Responses are never cached, and credentials are sent as a Bearer token
 * rather than cookies so cross-origin deployments stay explicit.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    signal,
    timeoutMs = apiConfig.requestTimeoutMs,
    auth = true,
    formData,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      ...headers,
    };

    let payload: BodyInit | undefined;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    if (auth) {
      const token = await tokenProvider();
      if (!token) {
        throw new ApiRequestError(
          "Sign in to continue. Your session is missing or has expired.",
          { status: 401, code: "UNAUTHENTICATED" },
        );
      }
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body: payload,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        "The request took too long. Check your connection and try again.",
        { code: "TIMEOUT" },
      );
    }
    throw new ApiRequestError(
      "Unable to reach the SHEPHERD API. Check your connection and try again.",
      { code: "NETWORK_ERROR" },
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
