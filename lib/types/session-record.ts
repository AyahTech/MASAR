/**
 * MASAR: Session Record — the persistent artifact of one completed learning
 * session. Written by the session-end hook (Task 9), enriched by the Analyzer
 * Agent (Task 10), stored via /api/session-log (Task 8), and read by the Path
 * Agent (Task 12) to adapt the next session for the same student + course.
 */

export type SessionRecord = {
  studentId: string;
  courseId: string;
  sessionId: string;
  timestamp: string; // ISO 8601

  // engagement signals
  durationMinutes: number;
  messageCount: number;
  avgMessageLength: number;
  completionStatus: 'completed' | 'partial' | 'abandoned';
  dropOffPoint?: string; // scene id where the student left

  // learning signals
  quizScore?: number; // 0-100
  struggleTopics: string[];
  engagementScore: number; // 0-100

  // guidance for the next session
  recommendation: string; // one sentence
};
