/**
 * Lazy narration TTS for classroom playback.
 *
 * Scenes are generated WITHOUT speech audio (content + actions only) so the
 * generation pipeline never waits on a TTS provider — the "Generating Teaching
 * Actions" phase had stretched behind ElevenLabs bursts and one failed clip
 * could fail the whole scene. Instead, when a scene is activated in the
 * classroom, its speech clips are generated here in the background:
 *
 *   - `prefetchSceneSpeech` fires the whole-scene generation (splits long
 *     lines, stamps audioIds, stores clips) the moment the scene mounts.
 *   - The playback engine waits a bounded few seconds for the *current*
 *     line's clip via `awaitSceneSpeech` (see `ensureSpeechAudio` in
 *     lib/playback/types.ts), then falls back to the silent reading timer —
 *     playback is never blocked.
 *   - audioIds are persisted through `updateScene`, so replays and reloads
 *     play from cache with zero API calls.
 */

import { toast } from 'sonner';
import type { SpeechAction } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';
import { useSettingsStore } from '@/lib/store/settings';
import { useStageStore } from '@/lib/store/stage';
import { isTTSProviderEnabled } from '@/lib/audio/provider-enablement';
import { generateTTSForScene } from '@/lib/hooks/use-scene-generator';
import { getClientTranslation } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('PlaybackTTSPrefetch');

/** sceneId → in-flight prefetch, so activation can't double-fire generation. */
const inFlight = new Map<string, Promise<void>>();

/** True when the scene has at least one speech line that lacks cached audio. */
export function sceneNeedsSpeechAudio(scene: Scene): boolean {
  return (scene.actions ?? []).some(
    (a): a is SpeechAction => a.type === 'speech' && !!a.text && !a.audioId,
  );
}

/**
 * The in-flight prefetch for a scene, if one is running. The playback engine
 * races this (bounded) to give the current line its freshly baked clip.
 */
export function awaitSceneSpeech(sceneId: string): Promise<void> | undefined {
  return inFlight.get(sceneId);
}

/** Managed (server) TTS on and usable — browser-native needs no prefetch. */
function isManagedTTSAvailable(): boolean {
  const s = useSettingsStore.getState();
  return (
    s.ttsEnabled &&
    s.ttsProviderId !== 'browser-native-tts' &&
    isTTSProviderEnabled(s.ttsProviderId, s.ttsProvidersConfig?.[s.ttsProviderId])
  );
}

/**
 * Generate + cache all missing speech clips for a scene, fire-and-forget.
 *
 * Non-blocking by contract: failures warn via toast and leave playback on the
 * silent reading timer; a later scene visit retries (the dedup guards below
 * key on *in-flight* work, not on past failures). On success the mutated
 * actions array (with audioIds, and long lines split by
 * `splitLongSpeechActions`) is persisted through `updateScene`, which marks
 * the scene pending for the debounced IndexedDB save.
 */
export function prefetchSceneSpeech(scene: Scene, language?: string): void {
  if (!isManagedTTSAvailable()) return;
  if (!sceneNeedsSpeechAudio(scene)) return;
  if (inFlight.has(scene.id)) {
    log.debug('prefetch already in flight for scene', scene.id);
    return;
  }

  log.info('prefetching speech clips for scene', scene.id);
  // Register FIRST, then run: the IIFE body would race the registration on
  // immediate failure, and a self-referencing cleanup would trip definite
  // assignment. Clearing a pending token is idempotent-safe either way.
  let settle: () => void = () => undefined;
  const run = new Promise<void>((resolve) => {
    settle = resolve;
  });
  inFlight.set(scene.id, run);

  (async () => {
    try {
      // The scene object is mutated in place by generateTTSForScene (audioIds
      // stamped, long lines split); persist exactly that actions array.
      const result = await generateTTSForScene(scene, language);
      if (!result.success) {
        log.warn('scene speech prefetch failed:', scene.id, result.error);
        toast.warning(getClientTranslation('generation.speechFailed'));
        return;
      }
      useStageStore.getState().updateScene(scene.id, { actions: scene.actions });
    } catch (error) {
      // Storage-watchdog or unexpected failure: warn, never block playback.
      log.warn('scene speech prefetch error:', scene.id, error);
      toast.warning(getClientTranslation('generation.speechFailed'));
    } finally {
      if (inFlight.get(scene.id) === run) inFlight.delete(scene.id);
      settle();
    }
  })();
}
