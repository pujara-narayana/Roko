/**
 * Arize provider — server-only, fire-and-forget observability.
 *
 * Logs each oracle verification (sub-scores, verdict, confidence) so a
 * pass-rate / oracle-confidence metric is visible after a run. Env-gated on
 * ARIZE_API_KEY + ARIZE_SPACE_ID; a complete no-op when unset, and always
 * non-blocking — failures are swallowed and never add user-visible latency.
 */

const API_URL = process.env.ARIZE_API_URL ?? 'https://api.arize.com/v1/log';
const MODEL_ID = 'bounty-verification-oracle';

export function isConfigured(): boolean {
  return !!process.env.ARIZE_API_KEY && !!process.env.ARIZE_SPACE_ID;
}

export interface OracleLogRecord {
  runId: string;
  bountyId: string;
  agentId: string;
  verdict: 'pass' | 'fail';
  overallScore: number;
  criteriaMatch: number;
  completeness: number;
  validity: number;
  taskType: string;
}

/**
 * Log one oracle scoring event. Returns immediately; the network write happens
 * detached. Safe to call unconditionally — it self-gates on configuration.
 */
export function logOracleScore(record: OracleLogRecord): void {
  if (!isConfigured()) return;

  // Detached, non-blocking write.
  void (async () => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.ARIZE_API_KEY as string}`,
          'space-id': process.env.ARIZE_SPACE_ID as string,
        },
        body: JSON.stringify({
          model_id: MODEL_ID,
          model_type: 'score_categorical',
          environment: 'production',
          prediction_id: `${record.runId}:${record.agentId}`,
          features: {
            bounty_id: record.bountyId,
            agent_id: record.agentId,
            task_type: record.taskType,
            criteria_match: record.criteriaMatch,
            completeness: record.completeness,
            validity: record.validity,
          },
          prediction: { label: record.verdict, score: record.overallScore / 100 },
          ts: Date.now(),
        }),
      });
    } catch {
      /* observability must never break the run */
    }
  })();
}
