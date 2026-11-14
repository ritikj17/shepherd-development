import { ApiRequestError } from "@/lib/api/client";

export function mockError(
  status: number,
  code: string,
  message: string,
): ApiRequestError {
  return new ApiRequestError(message, { status, code });
}

export const MOCK_NOTICE =
  "Demo adapter: this response is synthetic sample data, not a live backend result.";
