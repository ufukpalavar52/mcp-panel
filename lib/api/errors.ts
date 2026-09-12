/** Error payload the gateway returns for every failure. */
export type ApiErrorBody = {
  status: number;
  error: string;
  message: string;
  path: string;
  details?: { field: string; message: string }[];
  timestamp: string;
};

/**
 * Thrown for any non-2xx response.
 *
 * Carries the gateway's structured body so a form can highlight the exact fields that
 * failed instead of showing one flat message.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field: string; message: string }[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiRequestError";
    this.status = body.status;
    this.code = body.error;
    this.details = body.details ?? [];
  }

  /** Field errors keyed by field path, for binding to form inputs. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      this.details.map((detail) => [detail.field, detail.message]),
    );
  }
}

/**
 * Raised when the gateway cannot be reached at all.
 *
 * The message is technical and not shown: this one is written by the panel rather than
 * sent by the gateway, so it is the one failure text that has to follow the interface
 * language. `messageKey` is what reaches the screen.
 */
export class ApiUnreachableError extends Error {
  readonly messageKey = "errors.unreachable" as const;

  constructor(cause: unknown) {
    super("The gateway could not be reached");
    this.name = "ApiUnreachableError";
    this.cause = cause;
  }
}
