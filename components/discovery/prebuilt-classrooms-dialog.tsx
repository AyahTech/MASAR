'use client';

import { useEffect, useState } from 'react';
import { Loader2, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImportPrebuilt, type PrebuiltSummary } from '@/lib/import/use-import-prebuilt';
import { createLogger } from '@/lib/logger';

const log = createLogger('PrebuiltClassroomsDialog');

interface PrebuiltClassroomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (stageId: string) => void;
}

export function PrebuiltClassroomsDialog({
  open,
  onOpenChange,
  onImported,
}: PrebuiltClassroomsDialogProps) {
  const [summaries, setSummaries] = useState<PrebuiltSummary[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { loading: importing, listPrebuilt, importPrebuilt } = useImportPrebuilt();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listPrebuilt()
      .then((data) => {
        if (!cancelled) {
          setSummaries(data);
          setFetchError(null);
        }
      })
      .catch((err) => {
        log.error('Failed to list prebuilt classrooms:', err);
        if (!cancelled) {
          setSummaries([]);
          setFetchError('Could not load saved courses.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, listPrebuilt]);

  const handleImport = async (id: string) => {
    try {
      const stageId = await importPrebuilt(id);
      onImported?.(stageId);
      onOpenChange(false);
    } catch {
      // Error is already toasted by the hook.
    }
  };

  const isLoading = summaries === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Saved Courses</DialogTitle>
          <DialogDescription>
            Courses generated earlier are stored on the server. Import one to open it locally.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 min-h-[120px]">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading saved courses…
            </div>
          ) : fetchError ? (
            <div className="flex h-24 items-center justify-center text-destructive text-sm">
              {fetchError}
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              No saved courses found.
            </div>
          ) : (
            <ul className="space-y-2">
              {summaries.map((summary) => (
                <li
                  key={summary.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{summary.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {summary.sceneCount} scene{summary.sceneCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleImport(summary.id)}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <BookOpen className="mr-1.5 size-3.5" />
                    )}
                    Import
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
