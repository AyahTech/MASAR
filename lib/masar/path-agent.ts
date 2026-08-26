/**
 * MASAR: Path Agent — runs before session content generation. Reads the
 * student's last few SessionRecords and asks the LLM for adapted generation
 * guidance, expressed through prompt content (the pipeline's real levers):
 * the requirement text and the outline prompt's teacherContext slot.
 *
 * Per Task 5C findings, the pipeline has no global difficulty API; quizConfig
 * difficulty exists per quiz outline but is LLM-chosen. We therefore express
 * adaptation via prompt content only — mapping onto parameters that exist.
 *
 * Server-side: uses callLLM through resolveModel (provider-portable) and
 * reads session_records directly from the store (no HTTP self-call).
 * Every failure falls back to default parameters.
 */

import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { getRecentSessionRecords } from '@/lib/persistence/session-log-store';
import type { SessionRecord } from '@/lib/types/session-record';

const log = createLogger('PathAgent');

export interface PathAdaptation {
  difficultyAdjustment: 'easier' | 'same' | 'harder';
  reinforceTopics: string[];
  pacingNote: string;
  openingMessage: string;
  /** true when no prior records existed (first session) or all paths failed. */
  isDefault: boolean;
}

export const DEFAULT_ADAPTATION: PathAdaptation = {
  difficultyAdjustment: 'same',
  reinforceTopics: [],
  pacingNote: '',
  openingMessage: '',
  isDefault: true,
};

const PATH_SYSTEM_PROMPT = `You are the Path Agent for an adaptive learning platform. You receive a student's recent session records for one course and decide how the NEXT session's generated content should adapt.

Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation.

Schema:
{
  "difficultyAdjustment": "easier" | "same" | "harder",
  "reinforceTopics": string[],   // topics from past struggleTopics worth revisiting; [] if none
  "pacingNote": string,          // one short sentence (any language matching the records' language)
  "openingMessage": string       // one warm sentence IN ARABIC to open the next session with
}

Judge from the evidence only. Low engagement + abandonment → "easier" and a re-engaging
opening. Completed + high scores → "same" or "harder". Struggle topics → reinforce.`;

function parseAdaptation(raw: string): PathAdaptation | null {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const difficulty = parsed.difficultyAdjustment;
    if (difficulty !== 'easier' && difficulty !== 'same' && difficulty !== 'harder') return null;
    return {
      difficultyAdjustment: difficulty,
      reinforceTopics: Array.isArray(parsed.reinforceTopics)
        ? parsed.reinforceTopics.filter((t: unknown) => typeof t === 'string').slice(0, 5)
        : [],
      pacingNote: typeof parsed.pacingNote === 'string' ? parsed.pacingNote : '',
      openingMessage: typeof parsed.openingMessage === 'string' ? parsed.openingMessage : '',
      isDefault: false,
    };
  } catch {
    return null; // never throw
  }
}

/**
 * Query the Session Log and produce an adaptation.
 * - No records → default parameters (first session).
 * - Records + LLM failure → default parameters.
 */
export async function runPathAgent(
  studentId: string,
  courseId: string,
): Promise<PathAdaptation> {
  try {
    const records = await getRecentSessionRecords(studentId, courseId, 3);
    if (records.length === 0) {
      log.info(`no prior sessions for ${courseId}; default parameters`);
      return DEFAULT_ADAPTATION;
    }

    const { model: languageModel, thinkingConfig } = await resolveModel({
      stage: 'path-agent',
    });
    const result = await callLLM(
      {
        model: languageModel,
        system: PATH_SYSTEM_PROMPT,
        prompt: `Recent session records (newest first):
${JSON.stringify(
  records.map((r: SessionRecord) => ({
    timestamp: r.timestamp,
    completionStatus: r.completionStatus,
    durationMinutes: r.durationMinutes,
    messageCount: r.messageCount,
    avgMessageLength: r.avgMessageLength,
    quizScore: r.quizScore,
    struggleTopics: r.struggleTopics,
    engagementScore: r.engagementScore,
    recommendation: r.recommendation,
  })),
  null,
  2,
)}`,
      },
      'path-agent',
      undefined,
      thinkingConfig,
    );

    const adaptation = parseAdaptation(result.text);
    if (adaptation) {
      log.info(
        `adaptation: ${adaptation.difficultyAdjustment}, reinforce=${adaptation.reinforceTopics.join('|') || '-'}`,
      );
      return adaptation;
    }
    log.warn('path agent output unparseable; default parameters');
    return DEFAULT_ADAPTATION;
  } catch (error) {
    log.warn('path agent failed; default parameters:', error);
    return DEFAULT_ADAPTATION;
  }
}

/**
 * Render the adaptation into the outline prompt's teacherContext slot.
 * Empty string when default (template slot renders nothing — upstream behavior).
 */
export function adaptationToTeacherContext(adaptation: PathAdaptation): string {
  if (adaptation.isDefault) return '';
  const lines: string[] = ['### Adaptive Guidance for This Session'];
  if (adaptation.difficultyAdjustment === 'easier') {
    lines.push(
      '- Adjust difficulty EASIER than the default for this audience: simpler vocabulary, more everyday examples, smaller steps.',
    );
  } else if (adaptation.difficultyAdjustment === 'harder') {
    lines.push(
      '- Adjust difficulty HARDER: deeper analysis, more advanced terminology, richer problem variants.',
    );
  }
  if (adaptation.reinforceTopics.length > 0) {
    lines.push(
      `- Reinforce these previously-struggled topics with dedicated examples or a refresher beat: ${adaptation.reinforceTopics.join(', ')}.`,
    );
  }
  if (adaptation.pacingNote) {
    lines.push(`- Pacing: ${adaptation.pacingNote}`);
  }
  if (adaptation.openingMessage) {
    lines.push(
      `- Open the first scene's dialogue with a message close in spirit to: "${adaptation.openingMessage}"`,
    );
  }
  return lines.join('\n');
}
