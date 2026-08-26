/**
 * MASAR: session-end hook — fires when a learning session reaches a terminal
 * state (playback of the final scene completes, or the student leaves).
 * Task 9 scope: collect raw signals and console.log them. Task 11 will replace
 * the console.log with Analyzer → Session Log calls (fire-and-forget, never
 * blocking, never throwing into the student's UI).
 */

import { getLearnerKey } from '@/lib/runtime/learner-key';
import { loadQuizAttemptState } from '@/lib/quiz/runtime';
import type { QuestionResult } from '@/lib/quiz/grading';
import { useStageStore } from '@/lib/store';
import type { ChatSession } from '@/lib/types/chat';
import type { Scene } from '@/lib/types/stage';
import type { SessionRecord } from '@/lib/types/session-record';
import {
  buildTranscript,
  captureSessionSignals,
  type SessionTranscriptEntry,
} from './capture-session-signals';

export interface SessionEndPayload {
  rawSignals: ReturnType<typeof captureSessionSignals>;
  transcript: SessionTranscriptEntry[];
}

export interface SessionEndContext {
  /** Stage/course id from the stage store. */
  courseId: string | undefined;
  scenes: Scene[];
  currentSceneId: string | null;
  chats: ChatSession[];
  sessionStartedAtMs: number;
  /** Distinct id for this sitting; falls back to timestamp. */
  sessionId?: string;
  nowMs?: number;
}

async function collectQuizResults(
  courseId: string,
  scenes: Scene[],
): Promise<QuestionResult[]> {
  const learnerKey = await getLearnerKey();
  const all: QuestionResult[] = [];
  for (const scene of scenes) {
    if (scene.type !== 'quiz') continue;
    try {
      const { state } = await loadQuizAttemptState({
        stageId: courseId,
        sceneId: scene.id,
      });
      if (state?.results?.length) all.push(...state.results);
    } catch {
      // A quiz-state read failure must never break session capture.
    }
  }
  void learnerKey;
  return all;
}

/**
 * Collect the session's raw signals + transcript, then forward through the
 * Analyzer → Session Log chain (Task 11). Fire-and-forget from the caller's
 * perspective; failures are logged and swallowed — a failed analysis must
 * never break the student's session.
 */
export async function captureAndLogSessionEnd(
  ctx: SessionEndContext,
): Promise<SessionEndPayload | null> {
  try {
    const courseId = ctx.courseId ?? 'unknown-course';
    const studentId = await getLearnerKey().catch(() => 'anonymous');
    const quizResults = await collectQuizResults(courseId, ctx.scenes);

    const rawSignals = captureSessionSignals({
      studentId,
      courseId,
      sessionId: ctx.sessionId ?? `sess-${(ctx.nowMs ?? Date.now()).toString(36)}`,
      sessionStartedAtMs: ctx.sessionStartedAtMs,
      nowMs: ctx.nowMs,
      scenes: ctx.scenes,
      currentSceneId: ctx.currentSceneId,
      chats: ctx.chats,
      quizResults,
    });
    const transcript = buildTranscript(ctx.chats);

    // eslint-disable-next-line no-console -- kept from Task 9 for observability
    console.log(
      `[MASAR session-end] ${JSON.stringify({ rawSignals, transcriptLength: transcript.length }, null, 2)}`,
    );
    return { rawSignals, transcript };
  } catch (error) {
    console.warn('[MASAR session-end] capture failed (never fatal):', error);
    return null;
  }
}

/**
 * Task 11: Analyzer → Session Log chain. Called fire-and-forget by the
 * session-end hook; every failure path is caught and logged, never thrown.
 */
export async function analyzeAndLogSession(payload: SessionEndPayload): Promise<void> {
  try {
    const analyzeRes = await fetch('/api/session-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawSignals: payload.rawSignals,
        transcript: payload.transcript,
        studentId: payload.rawSignals.studentId,
        courseId: payload.rawSignals.courseId,
        sessionId: payload.rawSignals.sessionId,
      }),
    });
    if (!analyzeRes.ok) {
      console.warn(`[MASAR session-end] analyzer HTTP ${analyzeRes.status}; session not logged`);
      return;
    }
    const analyzed = (await analyzeRes.json()) as { record?: SessionRecord };
    if (!analyzed.record) {
      console.warn('[MASAR session-end] analyzer returned no record; session not logged');
      return;
    }
    const logRes = await fetch('/api/session-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analyzed.record),
    });
    if (!logRes.ok) {
      console.warn(`[MASAR session-end] session-log HTTP ${logRes.status}; record not stored`);
      return;
    }
    console.info('[MASAR session-end] session analyzed and logged ✔');
  } catch (error) {
    console.warn('[MASAR session-end] analyze/log chain failed (never fatal):', error);
  }
}

/** Convenience: pull the context from the live stage store. */
export function sessionEndContextFromStore(sessionStartedAtMs: number): SessionEndContext {
  const s = useStageStore.getState();
  return {
    courseId: s.stage?.id,
    scenes: s.scenes,
    currentSceneId: s.currentSceneId,
    chats: s.chats,
    sessionStartedAtMs,
  };
}
