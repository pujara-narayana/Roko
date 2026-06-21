/**
 * Artifact persistence — writes run artifacts to ./data/runs/<runId>/.
 * Async and non-blocking; errors are logged but never thrown to callers.
 */

import fs from 'fs/promises';
import path from 'path';
import type { Submission, OracleResult, OracleBatchResult, AcceptanceRequirements } from './types';

const DATA_ROOT = path.join(process.cwd(), 'data', 'runs');

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function runDir(runId: string) {
  return path.join(DATA_ROOT, runId);
}

export async function persistRequirements(
  runId: string,
  bountyId: string,
  requirements: AcceptanceRequirements,
): Promise<void> {
  try {
    const dir = runDir(runId);
    await ensureDir(dir);
    const filePath = path.join(dir, 'requirements.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ bountyId, requirements, savedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('[persist] Failed to write requirements:', err);
  }
}

export async function persistSubmission(
  runId: string,
  submission: Submission,
): Promise<void> {
  try {
    const dir = runDir(runId);
    await ensureDir(dir);
    const filePath = path.join(dir, `submission-${submission.agentId}.json`);
    await fs.writeFile(
      filePath,
      JSON.stringify(submission, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('[persist] Failed to write submission:', err);
  }
}

export async function persistOracleResults(
  runId: string,
  bountyId: string,
  results: OracleResult[],
  batch: OracleBatchResult,
): Promise<void> {
  try {
    const dir = runDir(runId);
    await ensureDir(dir);
    const filePath = path.join(dir, 'oracle-scores.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ bountyId, batch, savedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('[persist] Failed to write oracle results:', err);
  }
}
