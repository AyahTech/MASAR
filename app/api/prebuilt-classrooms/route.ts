import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { createLogger } from '@/lib/logger';
import type { AppDocument } from '@/lib/document-store';
import type { AppScene, AppStage } from '@/lib/types/stage';
import {
  CLASSROOMS_DIR,
  isValidClassroomId,
  readClassroom,
  type PersistedClassroomData,
} from '@/lib/server/classroom-storage';

const log = createLogger('PrebuiltClassroomsAPI');

interface PrebuiltSummary {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
}

function summaryFromClassroom(data: PersistedClassroomData): PrebuiltSummary {
  const stage = data.stage;
  const createdAt =
    typeof stage.createdAt === 'number'
      ? stage.createdAt
      : new Date(data.createdAt).getTime() || Date.now();
  return {
    id: data.id,
    name: stage.name || data.id,
    description: stage.description,
    sceneCount: Array.isArray(data.scenes) ? data.scenes.length : 0,
    createdAt,
    updatedAt: stage.updatedAt || createdAt,
  };
}

async function listPrebuiltClassrooms(): Promise<PrebuiltSummary[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(CLASSROOMS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const summaries: PrebuiltSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    if (!isValidClassroomId(id)) continue;
    try {
      const classroom = await readClassroom(id);
      if (classroom) summaries.push(summaryFromClassroom(classroom));
    } catch (error) {
      log.warn(`Skipping unreadable prebuilt classroom ${entry}:`, error);
    }
  }
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function loadPrebuiltClassroom(id: string): Promise<AppDocument<AppScene, AppStage> | null> {
  if (!isValidClassroomId(id)) return null;
  const classroom = await readClassroom(id);
  if (!classroom) return null;
  return {
    stage: classroom.stage as AppStage,
    scenes: classroom.scenes as AppScene[],
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const document = await loadPrebuiltClassroom(id);
      if (!document) {
        return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
      }
      return NextResponse.json(document);
    }

    const summaries = await listPrebuiltClassrooms();
    return NextResponse.json(summaries);
  } catch (error) {
    log.error('Failed to serve prebuilt classrooms:', error);
    return NextResponse.json({ error: 'Failed to load prebuilt classrooms' }, { status: 500 });
  }
}
