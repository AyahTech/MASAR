'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { mutateDocument, type AppDocument } from '@/lib/document-store';
import type { AppScene, AppStage } from '@/lib/types/stage';
import { createLogger } from '@/lib/logger';

const log = createLogger('ImportPrebuilt');

export interface PrebuiltSummary {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
}

interface UseImportPrebuiltOptions {
  onImported?: (stageId: string) => void;
}

export function useImportPrebuilt(options: UseImportPrebuiltOptions = {}) {
  const [loading, setLoading] = useState(false);

  const listPrebuilt = useCallback(async (): Promise<PrebuiltSummary[]> => {
    const response = await fetch('/api/prebuilt-classrooms');
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    return (await response.json()) as PrebuiltSummary[];
  }, []);

  const importPrebuilt = useCallback(
    async (id: string): Promise<string> => {
      setLoading(true);
      try {
        const response = await fetch(`/api/prebuilt-classrooms?id=${encodeURIComponent(id)}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        const document = (await response.json()) as AppDocument<AppScene, AppStage>;
        const stageId = document.stage.id;

        await mutateDocument(
          stageId,
          async (_existing, store) => {
            await store.saveDocument(document);
          },
          {},
          { mode: 'replace' },
        );

        toast.success(`Imported "${document.stage.name || stageId}"`);
        options.onImported?.(stageId);
        return stageId;
      } catch (error) {
        log.error('Failed to import prebuilt classroom:', error);
        toast.error('Failed to import saved course');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options],
  );

  return {
    loading,
    listPrebuilt,
    importPrebuilt,
  };
}
