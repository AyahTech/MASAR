/**
 * MASAR: session_records storage — a small standalone Postgres table owned by
 * MASAR (not upstream @openmaic/storage). Follows the repo's persistence
 * pattern: an idempotent schema constant + ensureSessionLogSchema(), executed
 * once per process before first use (see packages/@openmaic/storage/src/
 * runtime/pg.ts for the upstream equivalent).
 */

import { Pool } from 'pg';
import type { SessionRecord } from '@/lib/types/session-record';

export const SESSION_LOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS session_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  duration_minutes REAL NOT NULL,
  message_count INTEGER NOT NULL,
  avg_message_length REAL NOT NULL,
  completion_status TEXT NOT NULL CHECK (completion_status IN ('completed', 'partial', 'abandoned')),
  drop_off_point TEXT,
  quiz_score INTEGER,
  struggle_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  engagement_score INTEGER NOT NULL,
  recommendation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS session_records_student_course_ts_idx
  ON session_records (student_id, course_id, timestamp DESC);
`;

let schemaPromise: Promise<void> | undefined;

/** Create the session_records table when absent. Safe to call repeatedly. */
export function ensureSessionLogSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // One statement at a time, mirroring upstream's ensureSchema split.
      for (const sql of SESSION_LOG_SCHEMA.split(';')) {
        const statement = sql.trim();
        if (statement !== '') await pool.query(statement);
      }
    })().catch((error) => {
      // Do not poison the singleton with a rejected promise.
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

interface SessionLogStoreState {
  pool?: Pool;
  poolPromise?: Promise<Pool>;
}

const STATE_KEY = Symbol.for('masar.persistence.session-log');
const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: SessionLogStoreState };
const state = (globalState[STATE_KEY] ??= {});

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('session-log requires DATABASE_URL to be configured');
  }
  if (!state.pool) {
    state.pool = new Pool({ connectionString, max: 5 });
  }
  return state.pool;
}

function rowToRecord(row: Record<string, unknown>): SessionRecord {
  return {
    studentId: row.student_id as string,
    courseId: row.course_id as string,
    sessionId: row.session_id as string,
    timestamp: row.timestamp as string,
    durationMinutes: row.duration_minutes as number,
    messageCount: row.message_count as number,
    avgMessageLength: row.avg_message_length as number,
    completionStatus: row.completion_status as SessionRecord['completionStatus'],
    ...(row.drop_off_point != null ? { dropOffPoint: row.drop_off_point as string } : {}),
    ...(row.quiz_score != null ? { quizScore: row.quiz_score as number } : {}),
    struggleTopics: Array.isArray(row.struggle_topics) ? (row.struggle_topics as string[]) : [],
    engagementScore: row.engagement_score as number,
    recommendation: row.recommendation as string,
  };
}

/** Insert one session record. Returns the generated row id. */
export async function insertSessionRecord(record: SessionRecord): Promise<string> {
  const pool = getPool();
  await ensureSessionLogSchema(pool);
  const id = `sr_${record.sessionId || Date.now().toString(36)}`;
  await pool.query(
    `INSERT INTO session_records (
       id, student_id, course_id, session_id, timestamp,
       duration_minutes, message_count, avg_message_length, completion_status,
       drop_off_point, quiz_score, struggle_topics, engagement_score, recommendation
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      record.studentId,
      record.courseId,
      record.sessionId,
      record.timestamp,
      record.durationMinutes,
      record.messageCount,
      record.avgMessageLength,
      record.completionStatus,
      record.dropOffPoint ?? null,
      record.quizScore ?? null,
      JSON.stringify(record.struggleTopics ?? []),
      record.engagementScore,
      record.recommendation,
    ],
  );
  return id;
}

/** Most recent records for a student+course, newest first. */
export async function getRecentSessionRecords(
  studentId: string,
  courseId: string,
  limit = 5,
): Promise<SessionRecord[]> {
  const pool = getPool();
  await ensureSessionLogSchema(pool);
  const result = await pool.query(
    `SELECT * FROM session_records
     WHERE student_id = $1 AND course_id = $2
     ORDER BY timestamp DESC
     LIMIT $3`,
    [studentId, courseId, limit],
  );
  return result.rows.map(rowToRecord);
}
