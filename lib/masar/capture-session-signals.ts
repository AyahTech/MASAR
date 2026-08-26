/**
 * MASAR: session signal capture — assembles the raw engagement facts of one
 * learning session from the client stores, for the Analyzer (Task 10) and the
 * Session Log (Task 8). Pure functions over store snapshots so it is trivially
 * testable and never touches the network itself.
 */

import type { ChatSession } from '@/lib/types/chat';
import type { Scene } from '@/lib/types/stage';
import type { QuestionResult } from '@/lib/quiz/grading';
import type { SessionRecord } from '@/lib/types/session-record';

export interface RawSessionSignals {
  studentId: string;
  courseId: string;
  sessionId: string;

  durationMinutes: number;
  messageCount: number;
  avgMessageLength: number;
  completionStatus: SessionRecord['completionStatus'];
  dropOffPoint?: string;
  quizScore?: number;
}

export interface SessionTranscriptEntry {
  speaker: string;
  role: 'student' | 'agent' | 'teacher';
  text: string;
}

function messageText(message: ChatSession['messages'][number]): string {
  // AI SDK UIMessage: text lives in parts[]
  const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join(' ');
  }
  return '';
}

export function isStudentMessage(message: ChatSession['messages'][number]): boolean {
  if (message.role === 'user') return true;
  const meta = message.metadata as ChatSessionMetadata | undefined;
  return meta?.originalRole === 'user';
}

interface ChatSessionMetadata {
  originalRole?: 'teacher' | 'agent' | 'user';
  senderName?: string;
}

/**
 * Compute quiz score (0-100) from QuestionResults, if any quiz occurred.
 * Returns undefined when there are no graded questions.
 */
export function computeQuizScore(results: QuestionResult[]): number | undefined {
  if (results.length === 0) return undefined;
  const correct = results.filter((r) => r.correct === true).length;
  return Math.round((correct / results.length) * 100);
}

export interface CaptureInput {
  studentId: string;
  courseId: string;
  sessionId: string;
  sessionStartedAtMs: number;
  nowMs?: number;
  scenes: Scene[];
  currentSceneId: string | null;
  chats: ChatSession[];
  quizResults?: QuestionResult[];
}

/**
 * Build the raw signal bundle for a session that just ended.
 *
 * completionStatus:
 *  - 'completed': the current scene is the last scene (student reached the end)
 *  - 'partial':   student left mid-course but engaged (has student messages)
 *  - 'abandoned': student left with no meaningful engagement
 */
export function captureSessionSignals(input: CaptureInput): RawSessionSignals {
  const { scenes, currentSceneId, chats } = input;
  const nowMs = input.nowMs ?? Date.now();
  const durationMinutes = Math.max(0, (nowMs - input.sessionStartedAtMs) / 60000);

  // Student-authored messages across all chat sessions (QA/discussion).
  const studentTexts: string[] = [];
  for (const session of chats) {
    for (const message of session.messages ?? []) {
      if (isStudentMessage(message)) {
        const text = messageText(message).trim();
        if (text) studentTexts.push(text);
      }
    }
  }
  const messageCount = studentTexts.length;
  const avgMessageLength =
    messageCount > 0
      ? Math.round((studentTexts.reduce((sum, t) => sum + t.length, 0) / messageCount) * 10) / 10
      : 0;

  const lastSceneId = scenes.length > 0 ? scenes[scenes.length - 1].id : undefined;
  const reachedLastScene =
    lastSceneId !== undefined &&
    (currentSceneId === lastSceneId || currentSceneId === null ? currentSceneId === lastSceneId : false);
  const completionStatus: SessionRecord['completionStatus'] = reachedLastScene
    ? 'completed'
    : messageCount > 0
      ? 'partial'
      : 'abandoned';

  const quizScore = input.quizResults ? computeQuizScore(input.quizResults) : undefined;

  return {
    studentId: input.studentId,
    courseId: input.courseId,
    sessionId: input.sessionId,
    durationMinutes: Math.round(durationMinutes * 10) / 10,
    messageCount,
    avgMessageLength,
    completionStatus,
    ...(currentSceneId ? { dropOffPoint: currentSceneId } : {}),
    ...(quizScore !== undefined ? { quizScore } : {}),
  };
}

/**
 * Full ordered transcript (student + agents + teacher) for the Analyzer.
 * Ordered by session createdAt, then message order within a session.
 */
export function buildTranscript(chats: ChatSession[]): SessionTranscriptEntry[] {
  const entries: SessionTranscriptEntry[] = [];
  const sorted = [...chats].sort((a, b) => a.createdAt - b.createdAt);
  for (const session of sorted) {
    for (const message of session.messages ?? []) {
      const text = messageText(message).trim();
      if (!text) continue;
      const meta = message.metadata as ChatSessionMetadata | undefined;
      const role: SessionTranscriptEntry['role'] = isStudentMessage(message)
        ? 'student'
        : meta?.originalRole === 'teacher'
          ? 'teacher'
          : 'agent';
      entries.push({
        speaker: meta?.senderName ?? message.role,
        role,
        text,
      });
    }
  }
  return entries;
}
