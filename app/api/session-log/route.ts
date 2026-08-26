/**
 * MASAR: Session Log API
 *
 * POST — body is a SessionRecord; validates required fields, inserts, returns { ok, id }.
 * GET  — query params studentId, courseId, limit (default 5); returns most recent N,
 *        newest first.
 *
 * Conventions follow neighbouring routes (apiError/apiSuccess, createLogger).
 * Auth: same development posture as the rest of the app pre-pilot (see
 * MASAR_NOTES.md security debt); the persistence dev token gates nothing here
 * because this data is written by the app's own session-end hook.
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  getRecentSessionRecords,
  insertSessionRecord,
} from '@/lib/persistence/session-log-store';
import type { SessionRecord } from '@/lib/types/session-record';

const log = createLogger('SessionLog');

function isValidRecord(value: Partial<SessionRecord>): value is SessionRecord {
  return (
    typeof value.studentId === 'string' &&
    value.studentId.length > 0 &&
    typeof value.courseId === 'string' &&
    value.courseId.length > 0 &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    typeof value.timestamp === 'string' &&
    value.timestamp.length > 0 &&
    typeof value.durationMinutes === 'number' &&
    Number.isFinite(value.durationMinutes) &&
    typeof value.messageCount === 'number' &&
    typeof value.avgMessageLength === 'number' &&
    (value.completionStatus === 'completed' ||
      value.completionStatus === 'partial' ||
      value.completionStatus === 'abandoned') &&
    Array.isArray(value.struggleTopics) &&
    typeof value.engagementScore === 'number' &&
    typeof value.recommendation === 'string'
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SessionRecord>;
    if (!isValidRecord(body)) {
      return apiError(
        'INVALID_REQUEST',
        400,
        'Invalid SessionRecord: required fields missing or wrong types',
      );
    }
    const id = await insertSessionRecord(body);
    return apiSuccess({ ok: true, id }, 201);
  } catch (error) {
    log.error('session-log POST failed:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to write session record',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');
    if (!studentId || !courseId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'studentId and courseId are required');
    }
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '5', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 5;
    const records = await getRecentSessionRecords(studentId, courseId, limit);
    return apiSuccess({ records, count: records.length });
  } catch (error) {
    log.error('session-log GET failed:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to read session records',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
