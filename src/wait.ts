import { TERMINAL_TRANSFER_STATUSES } from './constants';
import { BrdgError, TransferTimeoutError } from './errors';
import { isTransientError, sleep } from './retry';
import type { Transfer, TransferStatus } from './types';

export interface WaitForTransferOptions {
  /**
   * Milliseconds between polls. Default 3000.
   */
  intervalMs?: number;
  /**
   * Give up after this long. Default 20 minutes.
   */
  timeoutMs?: number;
  /**
   * Called with every transfer read, including the final one.
   */
  onUpdate?: (transfer: Transfer) => void;
  /**
   * Called with every read that failed transiently (`429`, `5xx`, network) and
   * was polled through. Any other failure is thrown.
   */
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
}

export function isTerminalStatus(status: TransferStatus): boolean {
  return (TERMINAL_TRANSFER_STATUSES as readonly string[]).includes(status);
}

/**
 * Poll `read` until the transfer reaches a terminal status. Realtime is an
 * accelerator, not the source of truth: the transfer endpoint always answers,
 * so polling it is the reliable way to learn the outcome.
 */
export async function waitForTransfer(
  read: () => Promise<Transfer>,
  transferId: string,
  options: WaitForTransferOptions = {},
): Promise<Transfer> {
  const intervalMs = options.intervalMs ?? 3_000;
  const deadline = Date.now() + (options.timeoutMs ?? 20 * 60_000);
  let last: Transfer | undefined;
  for (;;) {
    let waitMs = intervalMs;
    try {
      last = await read();
      options.onUpdate?.(last);
      if (isTerminalStatus(last.status)) return last;
    } catch (error) {
      // A transient read failure says nothing about the transfer, which keeps moving on chain
      // either way: poll through it. A 404 or a 400 is an answer, and is thrown.
      if (!isTransientError(error) || options.signal?.aborted) throw error;
      options.onError?.(error);
      if (Date.now() >= deadline) {
        if (last === undefined) throw error;
        throw new TransferTimeoutError(transferId, last.status);
      }
      if (error instanceof BrdgError && error.retryAfterMs !== undefined)
        waitMs = Math.max(intervalMs, error.retryAfterMs);
      await sleep(waitMs, options.signal);
      continue;
    }
    if (Date.now() >= deadline) throw new TransferTimeoutError(transferId, last.status);
    await sleep(waitMs, options.signal);
  }
}
