/**
 * The envelope every non-2xx response carries.
 */
export interface BridgErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryAfterMs?: number;
  };
}

/**
 * An error the API answered with. Branch on `code`, never on `message`.
 * `details` carries what there is to act on: both figures of a drifted quote,
 * the verdict that refused a venue override. `retryAfterMs` is set on `429`.
 */
export class BridgError extends Error {
  override readonly name = 'BridgError';
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly retryAfterMs: number | undefined;
  readonly endpoint: string;

  constructor(
    endpoint: string,
    status: number,
    body: Partial<BridgErrorBody['error']> | undefined,
  ) {
    super(body?.message ?? `Bridg API responded ${status} on ${endpoint}`);
    this.code = body?.code ?? 'unknown';
    this.status = status;
    this.details = body?.details ?? {};
    this.retryAfterMs = body?.retryAfterMs;
    this.endpoint = endpoint;
  }
}

export function isBridgError(error: unknown): error is BridgError {
  return error instanceof BridgError;
}

/**
 * Thrown by `waitForTransfer` when the transfer is still in flight at the
 * deadline.
 */
export class TransferTimeoutError extends Error {
  override readonly name = 'TransferTimeoutError';
  constructor(
    readonly transferId: string,
    readonly lastStatus: string,
  ) {
    super(`Transfer ${transferId} was still ${lastStatus} when the wait timed out`);
  }
}
