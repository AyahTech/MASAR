'use client';

/**
 * MASAR Task 13c: pre-session classmate picker.
 * Student selects up to 2 classmates, each = archetype (default registry 3-6)
 * × country (cultural perspective). Selection materializes as *derived* agent
 * configs (archetype persona + culturalPersona) registered in the agent
 * registry and selected via settings store — the existing orchestration flow
 * consumes them unchanged.
 *
 * RTL-safe: plain flex layout, logical CSS properties, no hardcoded left/right.
 */

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useSettingsStore } from '@/lib/store/settings';
import { createAgentFromTemplate } from '@/lib/orchestration/registry/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassmatePicker');

export const MASAR_CLASSMATE_ARCHETYPES = [
  { registryId: 'default-3', key: 'clown' },
  { registryId: 'default-4', key: 'curious' },
  { registryId: 'default-5', key: 'noteTaker' },
  { registryId: 'default-6', key: 'thinker' },
] as const;

export const MASAR_CLASSMATE_COUNTRIES = [
  { code: 'om', ar: 'عُمان' },
  { code: 'sa', ar: 'السعودية' },
  { code: 'eg', ar: 'مصر' },
  { code: 'jo', ar: 'الأردن' },
  { code: 'ma', ar: 'المغرب' },
  { code: 'ae', ar: 'الإمارات' },
] as const;

export interface ClassmateChoice {
  archetypeRegistryId: string;
  countryAr: string;
}

interface ClassmatePickerProps {
  open: boolean;
  onClose: () => void;
}

export function ClassmatePicker({ open, onClose }: ClassmatePickerProps) {
  const { t } = useI18n();
  const registry = useAgentRegistry();
  const [choices, setChoices] = useState<ClassmateChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const archetypes = useMemo(
    () =>
      MASAR_CLASSMATE_ARCHETYPES.map((a) => {
        const config = registry.agents[a.registryId];
        return config ? { ...a, config } : null;
      }).filter((x): x is NonNullable<typeof x> => x != null),
    [registry.agents],
  );

  if (!open) return null;

  const toggle = (registryId: string, countryAr: string) => {
    setError(null);
    setChoices((prev) => {
      const existing = prev.findIndex((c) => c.archetypeRegistryId === registryId);
      if (existing >= 0) {
        // Same archetype card toggled: remove (deselect).
        const next = [...prev];
        next.splice(existing, 1);
        return next;
      }
      // New archetype: replace oldest if already at 2.
      const next = prev.length >= 2 ? [...prev.slice(1)] : [...prev];
      next.push({ archetypeRegistryId: registryId, countryAr });
      return next;
    });
  };

  const confirm = () => {
    try {
      const registryState = useAgentRegistry.getState();
      const settings = useSettingsStore.getState();
      const ids: string[] = ['default-1', 'default-2']; // teacher + assistant stay
      for (const choice of choices) {
        const base = registryState.agents[choice.archetypeRegistryId];
        if (!base) continue;
        const derivedId = `masar-${choice.archetypeRegistryId}-${Date.now().toString(36)}`;
        registryState.addAgent(
          createAgentFromTemplate(
            {
              name: base.name,
              role: base.role,
              persona: base.persona,
              culturalPersona: choice.countryAr,
              avatar: base.avatar,
              color: base.color,
              allowedActions: base.allowedActions,
              priority: base.priority,
            },
            derivedId,
          ),
        );
        ids.push(derivedId);
      }
      settings.setSelectedAgentIds(ids);
      log.info(`classmates confirmed: ${choices.length} selected`);
      onClose();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      dir="auto"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
          اختر زملاءك في الفصل
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          اختر حتى زميلين اثنين — لكل زميل شخصية وبلد مختلفان. {choices.length}/2
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {archetypes.map(({ registryId, key, config }) => {
            const selected = choices.find((c) => c.archetypeRegistryId === registryId);
            return (
              <div
                key={registryId}
                className={`rounded-xl border-2 p-3 transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{config.avatar}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {config.name}
                  </span>
                </div>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {t(`agentBar.personas.${key}`) !== `agentBar.personas.${key}`
                    ? t(`agentBar.personas.${key}`)
                    : config.role}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MASAR_CLASSMATE_COUNTRIES.map((c) => {
                    const isSelected =
                      selected?.countryAr === c.ar && selected != null;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggle(registryId, c.ar)}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {c.ar}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            تخطي
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={choices.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            تأكيد الزملاء
          </button>
        </div>
      </div>
    </div>
  );
}
