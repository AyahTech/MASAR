/**
 * MASAR: Session Analyzer API
 *
 * POST accepts { rawSignals, transcript, studentId, courseId, sessionId } and
 * returns a complete SessionRecord: raw engagement facts merged with LLM-judged
 * learning signals (struggleTopics, engagementScore, Arabic recommendation).
 *
 * Calls the model strictly through the app's provider abstraction
 * (callLLM + resolveModel) — provider-portable by construction, no raw fetch.
 * Parsing is defensive: any model-output failure degrades to a valid fallback
 * record; this route never throws.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModel } from '@/lib/server/resolve-model';
import type { SessionRecord } from '@/lib/types/session-record';
import type { RawSessionSignals, SessionTranscriptEntry } from '@/lib/masar/capture-session-signals';

const log = createLogger('SessionAnalyze');

const ANALYZER_SYSTEM_PROMPT = `You analyze one completed learning session and return a structured record.

Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation.

Schema:
{
  "struggleTopics": string[],   // max 3 concepts the student visibly struggled with; [] if none
  "engagementScore": number,    // 0-100 integer, based on participation depth and quality
  "recommendation": string      // ONE sentence in Arabic: what to change next session
}

Base your judgement only on the evidence provided. If the session was too
short to judge, return an empty struggleTopics array, a low engagementScore,
and a recommendation to re-engage the student.`;

interface AnalyzerFields {
  struggleTopics: string[];
  engagementScore: number;
  recommendation: string;
}

export function parseAnalyzerOutput(raw: string): AnalyzerFields {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      struggleTopics: Array.isArray(parsed.struggleTopics) ? parsed.struggleTopics.slice(0, 3) : [],
      engagementScore: Number.isFinite(parsed.engagementScore)
        ? Math.max(0, Math.min(100, Math.round(parsed.engagementScore)))
        : 0,
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
    };
  } catch {
    return { struggleTopics: [], engagementScore: 0, recommendation: '' }; // never throw
  }
}

function transcriptToPromptText(transcript: SessionTranscriptEntry[]): string {
  if (!Array.isArray(transcript) || transcript.length === 0) return '(no transcript)';
  return transcript
    .map((e) => `[${e.role}] ${e.speaker}: ${e.text}`)
    .join('\n')
    .slice(0, 12000); // keep the prompt bounded for small-context models
}

function isValidSignals(value: Partial<RawSessionSignals>): value is RawSessionSignals {
  return (
    typeof value.studentId === 'string' &&
    typeof value.courseId === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.durationMinutes === 'number' &&
    typeof value.messageCount === 'number' &&
    typeof value.avgMessageLength === 'number'
  );
}

function fallbackRecord(signals: Partial<RawSessionSignals>): SessionRecord {
  return {
    studentId: typeof signals.studentId === 'string' ? signals.studentId : 'unknown',
    courseId: typeof signals.courseId === 'string' ? signals.courseId : 'unknown',
    sessionId: typeof signals.sessionId === 'string' ? signals.sessionId : 'unknown',
    timestamp: new Date().toISOString(),
    durationMinutes: Number.isFinite(signals.durationMinutes) ? (signals.durationMinutes as number) : 0,
    messageCount: Number.isFinite(signals.messageCount) ? (signals.messageCount as number) : 0,
    avgMessageLength: Number.isFinite(signals.avgMessageLength) ? (signals.avgMessageLength as number) : 0,
    completionStatus:
      signals.completionStatus === 'completed' ||
      signals.completionStatus === 'partial' ||
      signals.completionStatus === 'abandoned'
        ? signals.completionStatus
        : 'abandoned',
    ...(typeof signals.dropOffPoint === 'string' ? { dropOffPoint: signals.dropOffPoint } : {}),
    ...(Number.isFinite(signals.quizScore) ? { quizScore: signals.quizScore as number } : {}),
    struggleTopics: [],
    engagementScore: 0,
    recommendation: 'جلسة قصيرة — يُنصح بإعادة المحاولة والتفاعل أكثر في الجلسة القادمة.',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      rawSignals?: Partial<RawSessionSignals>;
      transcript?: SessionTranscriptEntry[];
      studentId?: string;
      courseId?: string;
      sessionId?: string;
    };

    // Degrade gracefully on anything malformed: merge identity from body or signals.
    const signals: Partial<RawSessionSignals> = { ...(body.rawSignals ?? {}) };
    if (body.studentId) signals.studentId = body.studentId;
    if (body.courseId) signals.courseId = body.courseId;
    if (body.sessionId) signals.sessionId = body.sessionId;
    if (!signals.studentId || !signals.courseId || !signals.sessionId) {
      return apiError('INVALID_REQUEST', 400, 'studentId, courseId, sessionId are required');
    }
    void isValidSignals;

    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    // Empty/1-message transcript: skip the LLM entirely, return a valid fallback.
    const tooShort = transcript.length <= 1;
    let analyzer: AnalyzerFields = {
      struggleTopics: [],
      engagementScore: 0,
      recommendation: '',
    };
    if (!tooShort) {
      try {
        const { model: languageModel, thinkingConfig } = await resolveModel({
          stage: 'session-analyze',
        });
        const result = await callLLM(
          {
            model: languageModel,
            system: ANALYZER_SYSTEM_PROMPT,
            prompt: `Raw engagement signals:
${JSON.stringify(signals, null, 2)}

Session transcript:
${transcriptToPromptText(transcript)}`,
          },
          'session-analyze',
          undefined,
          thinkingConfig,
        );
        analyzer = parseAnalyzerOutput(result.text);
      } catch (error) {
        log.warn('analyzer LLM call failed, using fallback:', error);
      }
    }

    const record: SessionRecord = {
      ...fallbackRecord(signals),
      struggleTopics: analyzer.struggleTopics,
      engagementScore: analyzer.engagementScore,
      recommendation:
        analyzer.recommendation || fallbackRecord(signals).recommendation,
    };

    return apiSuccess({ record });
  } catch (error) {
    log.error('session-analyze failed:', error);
    // Never throw: emit a minimal valid record even on total failure.
    return apiSuccess({
      record: fallbackRecord({}),
      degraded: true,
      ...(error instanceof Error ? { error: error.message } : {}),
    });
  }
}
