import { TrainingModule } from '../types/training';

export const LIVE_SYNC_TOPIC = 'oracle18xe_treinamento_live_sync_20261107';
const NTFY_BASE_URL = 'https://ntfy.sh';

export interface LiveClassroomSync {
  version: number;
  updatedAt: number;
  activeModuleId: string; // ID do módulo que o instrutor está apresentando
  completedModuleIds: string[];
  moduleDurations: Record<string, number>; // moduleId -> segundos registrados
  modules: TrainingModule[]; // Lista completa e sincronizada de módulos (com títulos e blocos atualizados)
  stopwatch: {
    secondsElapsed: number;
    timerRunning: boolean;
    startedAt?: number;
  };
}

export function buildSyncPayload(
  modules: TrainingModule[],
  activeModuleId: string,
  secondsElapsed: number,
  timerRunning: boolean
): LiveClassroomSync {
  const completedModuleIds = modules.filter((m) => m.completed).map((m) => m.id);
  const moduleDurations: Record<string, number> = {};

  modules.forEach((mod) => {
    if (mod.completedDurationSeconds !== undefined) {
      moduleDurations[mod.id] = mod.completedDurationSeconds;
    }
  });

  return {
    version: 2,
    updatedAt: Date.now(),
    activeModuleId,
    completedModuleIds,
    moduleDurations,
    modules,
    stopwatch: {
      secondsElapsed,
      timerRunning,
      startedAt: timerRunning ? Date.now() : undefined,
    },
  };
}

export function applySyncToModules(
  currentModules: TrainingModule[],
  sync: LiveClassroomSync
): TrainingModule[] {
  // If the sync includes the full modules list, prefer it to preserve content edits and block order
  if (Array.isArray(sync.modules) && sync.modules.length > 0) {
    return sync.modules.map((mod) => ({
      ...mod,
      completed: sync.completedModuleIds.includes(mod.id),
      completedDurationSeconds: sync.moduleDurations?.[mod.id] ?? mod.completedDurationSeconds,
    }));
  }

  // Fallback for partial/legacy payloads
  return currentModules.map((mod) => ({
    ...mod,
    completed: sync.completedModuleIds.includes(mod.id),
    completedDurationSeconds: sync.moduleDurations?.[mod.id] ?? mod.completedDurationSeconds,
  }));
}

/**
 * Publish updated classroom state from instructor to all participants worldwide
 */
let publishDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function publishLiveSync(payload: LiveClassroomSync, debounceMs = 250): void {
  if (publishDebounceTimer) {
    clearTimeout(publishDebounceTimer);
  }

  publishDebounceTimer = setTimeout(async () => {
    try {
      await fetch(`${NTFY_BASE_URL}/${LIVE_SYNC_TOPIC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Title: 'Treinamento Oracle 18c XE Sync',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Silently ignore network hiccup, next state change will sync
      console.warn('Falha temporária ao sincronizar com participantes:', err);
    }
  }, debounceMs);
}

/**
 * Subscribe participants (and instructor preview) to real-time events via Server-Sent Events (SSE)
 * and initial fetch on page load/F5.
 */
export function subscribeToLiveSync(
  onSyncReceived: (sync: LiveClassroomSync) => void
): () => void {
  let isSubscribed = true;

  // 1. Initial fetch (runs immediately on F5 or first page open)
  const fetchLatestState = async () => {
    try {
      const res = await fetch(`${NTFY_BASE_URL}/${LIVE_SYNC_TOPIC}/json?poll=1`);
      if (!res.ok) return;
      const text = await res.text();
      const lines = text.trim().split('\n');

      // Find the most recent valid sync message
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.event === 'message' && parsed.message) {
            const syncPayload = JSON.parse(parsed.message) as LiveClassroomSync;
            if (syncPayload && syncPayload.updatedAt && isSubscribed) {
              onSyncReceived(syncPayload);
              return;
            }
          }
        } catch {
          // ignore corrupted lines
        }
      }
    } catch {
      // ignore
    }
  };

  fetchLatestState();

  // 2. Real-Time SSE Listener (sub-second instant delivery when instructor changes anything)
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`${NTFY_BASE_URL}/${LIVE_SYNC_TOPIC}/sse`);

    eventSource.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'message' && parsed.message) {
          const syncPayload = JSON.parse(parsed.message) as LiveClassroomSync;
          if (syncPayload && syncPayload.updatedAt) {
            onSyncReceived(syncPayload);
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    eventSource.onerror = () => {
      // Browser EventSource automatically reconnects
    };
  } catch (err) {
    console.warn('SSE indisponível, usando fallback por intervalo:', err);
  }

  // 3. Fallback Interval (every 8 seconds in case SSE disconnected)
  const fallbackInterval = setInterval(() => {
    if (isSubscribed) {
      fetchLatestState();
    }
  }, 8000);

  return () => {
    isSubscribed = false;
    clearInterval(fallbackInterval);
    if (eventSource) {
      eventSource.close();
    }
    if (publishDebounceTimer) {
      clearTimeout(publishDebounceTimer);
    }
  };
}
