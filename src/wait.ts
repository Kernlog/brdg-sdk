import { TERMINAL_TRANSFER_STATUSES } from './constants';
import { TransferTimeoutError } from './errors';
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
  signal?: AbortSignal;
}

export function isTerminalStatus(status: TransferStatus): boolean {
  return (TERMINAL_TRANSFER_STATUSES as readonly string[]).includes(status);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      },
      { once: true },
    );
  });

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
    last = await read();
    options.onUpdate?.(last);
    if (isTerminalStatus(last.status)) return last;
    if (Date.now() >= deadline) throw new TransferTimeoutError(transferId, last.status);
    await sleep(intervalMs, options.signal);
  }
}
