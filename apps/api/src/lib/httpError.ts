import type { ErrorCode } from "@briefklar/shared";

/** The message is English and meant for logs; the web app shows its own text for the code */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
