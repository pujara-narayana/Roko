/**
 * GET /api/runs/:runId/stream — SSE event stream
 *
 * Streams all past events immediately, then keeps the connection open
 * and pushes new events as they arrive. Emits a heartbeat comment every
 * 8s to prevent proxy timeouts.
 *
 * Clients should use EventSource with Last-Event-ID for automatic reconnect.
 */

import { NextRequest } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { formatSSE } from '@/lib/sse';

seedStore();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = store.getRun(runId);

  // Parse Last-Event-ID for reconnect replay
  const lastEventId = req.headers.get('last-event-id');
  const afterSeq = lastEventId ? parseInt(lastEventId, 10) : 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Replay past events
      const pastEvents = run
        ? run.events.filter(e => e.seq > afterSeq)
        : [];
      for (const event of pastEvents) {
        controller.enqueue(encoder.encode(formatSSE(event)));
      }

      // If run is already complete, close immediately after replay
      if (!run || run.status !== 'running') {
        controller.enqueue(encoder.encode(': end\n\n'));
        controller.close();
        return;
      }

      // Subscribe to live events
      let closed = false;

      const unsubscribe = store.subscribeSSE(runId, (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
          // Close stream when run is done
          if (event.stage === 'done') {
            setTimeout(() => {
              if (!closed) {
                closed = true;
                controller.enqueue(encoder.encode(': end\n\n'));
                controller.close();
              }
            }, 500);
          }
        } catch {
          closed = true;
          unsubscribe();
        }
      });

      // Heartbeat every 8s
      const heartbeatTimer = setInterval(() => {
        if (closed) {
          clearInterval(heartbeatTimer);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          closed = true;
          clearInterval(heartbeatTimer);
          unsubscribe();
        }
      }, 8_000);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeatTimer);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
