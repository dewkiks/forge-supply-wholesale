// ByteFlow Socket.IO connection hook — UI GEN 2.0
// Exchanges the embedded account-level ByteFlow API key for a short-lived
// session token, then connects to the /ui-live namespace. The token is
// auto-refreshed on every (re)connect since it expires after 15 min.
//
// On a revoked / invalid key or an empty wallet, `exchangeForSessionToken`
// raises a ByteflowAuthError and notifies `onByteflowAuthError` subscribers —
// register a listener (see config/byteflow.ts) to show the user a clear
// message instead of a silent connection failure.
//
// Socket.IO retries TRANSPORT failures on its own, but never a namespace
// REFUSAL (e.g. "Token expired" when the exchange fell back to a stale token):
// after one the socket sits inactive until connect() is called again. This
// hook owns that recovery, so an app the user comes back to after a while
// reconnects instead of staying dead until a page reload. It also never mints
// a second socket while the first is still connecting or reconnecting.

import { io, Socket } from 'socket.io-client';
import {
  BYTEFLOW_CONFIG,
  exchangeForSessionToken,
  ByteflowAuthError,
} from '../config/byteflow';

let currentToken: string | null = null;
let socketInstance: Socket | null = null;
let reviveTimer: ReturnType<typeof setTimeout> | null = null;
let reviveAttempt = 0;
// Set on a revoked/invalid key or an empty wallet: reconnecting cannot help,
// so recovery stops until the page reloads.
let authDead = false;

const REVIVE_BASE_DELAY = 1000;
const REVIVE_MAX_DELAY = 15000;

/**
 * Schedule a revive of the SAME socket after a failure Socket.IO won't retry
 * (namespace refusal / server-side disconnect). Capped exponential backoff,
 * at most one pending. The auth callback fetches a fresh token for the retry,
 * and every subscriber keeps its listeners because the instance is reused.
 */
function scheduleRevive(socket: Socket, reason: string): void {
  if (authDead || reviveTimer || socketInstance !== socket) return;
  const delay = Math.min(REVIVE_BASE_DELAY * 2 ** reviveAttempt, REVIVE_MAX_DELAY);
  reviveAttempt++;
  console.warn(`[ByteFlow] Reconnecting in ${delay}ms (${reason})`);
  reviveTimer = setTimeout(() => {
    reviveTimer = null;
    if (socketInstance === socket && !socket.active) socket.connect();
  }, delay);
}

/**
 * Create a Socket.IO connection to the /ui-live namespace.
 * Auto-refreshes the token on every connection attempt (including reconnects).
 */
export function createByteflowSocket(): Socket {
  if (socketInstance) {
    // `active` covers connected, connecting and Socket.IO's own reconnecting.
    // Inactive with no revive pending = a refused handshake nobody is
    // retrying — revive in place instead of creating a second socket.
    if (!authDead && !socketInstance.active && !reviveTimer) socketInstance.connect();
    return socketInstance;
  }

  const socket = io(`${BYTEFLOW_CONFIG.apiUrl}/ui-live`, {
    // Socket.IO calls this before EVERY connection attempt (including reconnects)
    // → automatically fetches a fresh token when the old one expires (15 min).
    auth: async (cb: (data: Record<string, string>) => void) => {
      try {
        currentToken = await exchangeForSessionToken();
        cb({ token: currentToken });
      } catch (err) {
        if (err instanceof ByteflowAuthError && err.kind !== 'unknown') {
          // A revoked/invalid key or empty wallet — listeners registered via
          // onByteflowAuthError() have already been notified by byteflow.ts.
          // Reconnecting will not help, so stop retrying.
          console.error('[ByteFlow] Auth failed:', err.userMessage);
          authDead = true;
          if (socketInstance) {
            socketInstance.io.opts.reconnection = false;
          }
        } else {
          // Transient (network / 5xx): the revive scheduled by the refusal
          // handler retries with a fresh exchange.
          console.error('[ByteFlow] Token exchange failed:', err);
        }
        // Fall back to the last good token (if any) so a transient failure can
        // still reconnect; otherwise the connection attempt fails cleanly.
        cb({ token: currentToken || '' });
      }
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    randomizationFactor: 0.2,
  });
  socketInstance = socket;

  socket.on('connect', () => {
    console.log('[ByteFlow] Socket.IO connected');
    reviveAttempt = 0;
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[ByteFlow] Socket.IO disconnected:', reason);
    // 'io server disconnect' is not retried by Socket.IO. A client-initiated
    // disconnect (project deleted / teardown) is deliberate and stays down.
    if (reason !== 'io client disconnect' && !socket.active) scheduleRevive(socket, reason);
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[ByteFlow] Connection error:', error.message);
    // Transport errors keep `active` true and Socket.IO retries them itself;
    // a namespace refusal does not — recover it here.
    if (!socket.active) scheduleRevive(socket, error.message);
  });

  socket.io.on('reconnect_failed', () => scheduleRevive(socket, 'reconnect_failed'));

  return socket;
}

/**
 * Get the current Socket.IO instance (or create one).
 */
export function getByteflowSocket(): Socket {
  return socketInstance || createByteflowSocket();
}

/**
 * Disconnect and cleanup.
 */
export function disconnectByteflowSocket(): void {
  if (reviveTimer) {
    clearTimeout(reviveTimer);
    reviveTimer = null;
  }
  reviveAttempt = 0;
  authDead = false;
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default createByteflowSocket;
