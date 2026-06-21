/**
 * Redis lazy singleton client.
 *
 * - Only created when REDIS_URL is set (env-guard — never import unconditionally).
 * - Connection errors are caught and logged; app falls back to in-memory.
 * - getRedis() returns null when Redis is unavailable; callers must handle null.
 * - getRedisStatus() returns a string suitable for the /api/health endpoint.
 */

import type { RedisClientType } from 'redis';

type RedisStatus = 'configured' | 'connected' | 'disconnected' | 'fallback';

let _client: RedisClientType | null = null;
let _status: RedisStatus = 'fallback';
let _initialized = false;

/**
 * Initialize the Redis client. Call once at boot (from hydrate or seed init).
 * Safe to call multiple times — idempotent.
 */
export async function initRedis(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[redis] REDIS_URL not set — using in-memory store only');
    _status = 'fallback';
    return;
  }

  _status = 'configured';

  try {
    // Dynamic import so the redis module is never loaded when REDIS_URL is absent.
    const { createClient } = await import('redis');

    const client = createClient({
      url,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: (retries) => {
          // Back off up to 10s; stop after 10 consecutive failures.
          if (retries > 10) {
            console.error('[redis] Too many reconnect attempts — giving up');
            return new Error('Redis reconnect limit reached');
          }
          return Math.min(retries * 500, 10_000);
        },
      },
    }) as RedisClientType;

    client.on('connect', () => {
      // Socket is open but auth/handshake (HELLO) has NOT completed yet.
      // Do NOT report 'connected' here — an unauthenticated socket connects
      // fine and then fails every command with NOAUTH. Wait for 'ready'.
      if (_status !== 'connected') _status = 'configured';
      console.log('[redis] Socket connected (awaiting ready/auth)');
    });

    client.on('ready', () => {
      // Fired only after a successful handshake (incl. AUTH when credentials
      // are present). This is the only safe place to report 'connected'.
      _status = 'connected';
      console.log('[redis] Ready');
    });

    client.on('error', (err: Error) => {
      // Only downgrade status — never crash.
      if (_status === 'connected') {
        _status = 'disconnected';
      }
      console.error('[redis] Client error:', err.message);
    });

    client.on('end', () => {
      if (_status === 'connected') {
        _status = 'disconnected';
      }
    });

    await client.connect();
    _client = client;
    // Status is owned by the 'ready' handler (post-auth). If 'ready' already
    // fired during connect() it is 'connected'; if auth is still pending or
    // failing it stays 'configured' so /api/health never reports a false green.
  } catch (err) {
    console.error('[redis] Failed to connect:', err instanceof Error ? err.message : String(err));
    _client = null;
    _status = 'fallback';
  }
}

/** Returns the connected Redis client, or null if unavailable. */
export function getRedis(): RedisClientType | null {
  return _client;
}

/** Returns the current Redis connection status. */
export function getRedisStatus(): RedisStatus {
  return _status;
}
