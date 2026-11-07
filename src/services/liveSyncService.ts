import { TrainingModule } from '../types/training';

export const LIVE_SYNC_TOPIC = 'oracle18xe_treinamento_live_sync_v4';
const NTFY_BASE_URL = 'https://ntfy.sh';

export interface LiveClassroomSync {
  version: number;
  updatedAt: number;
  activeModuleId: string; // ID do módulo que o instrutor está apresentando
  completedModuleIds: string[];
  moduleDurations: Record<string, number>; // moduleId -> segundos registrados
  keyPointOrders?: Record<string, string[]>;
  modifiedModules?: Record<string, Partial<TrainingModule>>;
  customModules?: TrainingModule[];
  modules?: TrainingModule[];
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
  timerRunning: boolean,
  modifiedModules?: Record<string, Partial<TrainingModule>>
): LiveClassroomSync {
  const completedModuleIds = modules.filter((m) => m.completed).map((m) => m.id);
  const moduleDurations: Record<string, number> = {};
  const keyPointOrders: Record<string, string[]> = {};

  modules.forEach((mod) => {
    if (mod.completedDurationSeconds !== undefined) {
      moduleDurations[mod.id] = mod.completedDurationSeconds;
    }
    keyPointOrders[mod.id] = mod.keyPoints.map((kp) => kp.title);
  });

  const customModules = modules.filter((m) => m.isCustom);

  return {
    version: 3,
    updatedAt: Date.now(),
    activeModuleId,
    completedModuleIds,
    moduleDurations,
    keyPointOrders,
    modifiedModules: modifiedModules && Object.keys(modifiedModules).length > 0 ? modifiedModules : undefined,
    customModules: customModules.length > 0 ? customModules : undefined,
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
  let result = [...currentModules];

  // 1. Adicionar novos tópicos customizados criados pelo instrutor
  if (Array.isArray(sync.customModules) && sync.customModules.length > 0) {
    sync.customModules.forEach((cm) => {
      if (!result.some((m) => m.id === cm.id)) {
        result.push(cm);
      }
    });
  }

  // 2. Aplicar lista completa de módulos se transmitida
  if (Array.isArray(sync.modules) && sync.modules.length > 0) {
    result = sync.modules;
  }

  // 3. Aplicar edições de conteúdo e scripts feitas pelo instrutor
  if (sync.modifiedModules) {
    result = result.map((m) => {
      const patch = sync.modifiedModules?.[m.id];
      if (patch) {
        return {
          ...m,
          ...patch,
          usageExample: patch.usageExample
            ? { ...m.usageExample, ...patch.usageExample }
            : m.usageExample,
          exercise: patch.exercise
            ? { ...m.exercise, ...patch.exercise }
            : m.exercise,
        };
      }
      return m;
    });
  }

  // 4. Aplicar nova ordem dos blocos caso o instrutor tenha reordenado
  if (sync.keyPointOrders) {
    result = result.map((mod) => {
      // Se patch já continha keyPoints completos e atualizados, não sobrescreve
      if (sync.modifiedModules?.[mod.id]?.keyPoints) {
        return mod;
      }
      const savedOrder = sync.keyPointOrders?.[mod.id];
      if (savedOrder && savedOrder.length > 0) {
        const orderMap = new Map<string, number>();
        savedOrder.forEach((title, idx) => orderMap.set(title, idx));

        const reordered = [...mod.keyPoints].sort((a, b) => {
          const orderA = orderMap.has(a.title) ? orderMap.get(a.title)! : 999;
          const orderB = orderMap.has(b.title) ? orderMap.get(b.title)! : 999;
          return orderA - orderB;
        });

        return { ...mod, keyPoints: reordered };
      }
      return mod;
    });
  }

  // 5. Atualizar sinalizadores de conclusão e tempos de cada etapa
  const completedIds = Array.isArray(sync.completedModuleIds) ? sync.completedModuleIds : [];
  return result.map((mod) => {
    const isCompleted = completedIds.includes(mod.id);
    const duration =
      sync.moduleDurations && typeof sync.moduleDurations[mod.id] === 'number'
        ? sync.moduleDurations[mod.id]
        : isCompleted
        ? mod.completedDurationSeconds
        : undefined;

    return {
      ...mod,
      completed: isCompleted,
      completedDurationSeconds: isCompleted ? duration : undefined,
    };
  });
}

// BroadcastChannel for instant local cross-tab sync in the same browser (<1ms latency)
let localClassroomChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    localClassroomChannel = new BroadcastChannel('oracle18xe_classroom_sync_v4');
  } catch {
    // ignore
  }
}

/**
 * Publish updated classroom state from instructor to all participants worldwide
 */
let publishDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function publishLiveSync(payload: LiveClassroomSync, debounceMs = 100): void {
  // 1. Instant local delivery between open tabs on the same computer (<1ms)
  if (localClassroomChannel) {
    try {
      localClassroomChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  if (publishDebounceTimer) {
    clearTimeout(publishDebounceTimer);
    publishDebounceTimer = null;
  }

  const executePublish = async () => {
    try {
      const body = JSON.stringify(payload);
      await fetch(`${NTFY_BASE_URL}/${LIVE_SYNC_TOPIC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Title: 'Treinamento Oracle 18c XE Sync',
        },
        body,
      });
      console.log('[LiveSync] Broadcast enviado com sucesso:', {
        activeModuleId: payload.activeModuleId,
        completed: payload.completedModuleIds?.length,
        timerRunning: payload.stopwatch?.timerRunning,
        seconds: payload.stopwatch?.secondsElapsed,
      });
    } catch (err) {
      console.warn('Falha temporária ao sincronizar com participantes:', err);
    }
  };

  if (debounceMs <= 0) {
    executePublish();
  } else {
    publishDebounceTimer = setTimeout(executePublish, debounceMs);
  }
}

/**
 * Helper to safely extract sync payload from ntfy raw message or attachment URL
 */
async function parseNtfyRecord(raw: any): Promise<LiveClassroomSync | null> {
  try {
    if (raw && typeof raw === 'object') {
      if (raw.attachment && raw.attachment.url) {
        const resp = await fetch(raw.attachment.url);
        if (resp.ok) {
          return (await resp.json()) as LiveClassroomSync;
        }
      }
      if (typeof raw.message === 'object' && raw.message !== null) {
        return raw.message as LiveClassroomSync;
      }
      if (typeof raw.message === 'string') {
        if (!raw.message.startsWith('You received a file')) {
          return JSON.parse(raw.message) as LiveClassroomSync;
        }
      }
    }
  } catch {
    // Ignore corrupted records
  }
  return null;
}

/**
 * Subscribe participants to real-time events via Server-Sent Events (SSE)
 * and initial fetch on page load/F5.
 */
export function subscribeToLiveSync(
  onSyncReceived: (sync: LiveClassroomSync) => void
): () => void {
  let isSubscribed = true;

  // 1. Instant local BroadcastChannel listener (<1ms) for split-screen tabs on the same device
  const handleLocalChannelMessage = (event: MessageEvent) => {
    if (!isSubscribed) return;
    if (event.data && typeof event.data === 'object' && event.data.version) {
      console.log('[LiveSync] Atualização recebida via BroadcastChannel local:', event.data);
      onSyncReceived(event.data as LiveClassroomSync);
    }
  };

  if (localClassroomChannel) {
    localClassroomChannel.addEventListener('message', handleLocalChannelMessage);
  }

  // 2. Initial fetch (runs immediately on F5 or first page open)
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
          if (parsed.event === 'message') {
            const syncPayload = await parseNtfyRecord(parsed);
            if (syncPayload && isSubscribed) {
              console.log('[LiveSync] Estado inicial carregado via poll:', syncPayload);
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

  // 3. Real-Time SSE Listener (sub-second instant delivery when instructor changes anything)
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`${NTFY_BASE_URL}/${LIVE_SYNC_TOPIC}/sse`);

    eventSource.onmessage = async (event) => {
      if (!isSubscribed) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'message') {
          const syncPayload = await parseNtfyRecord(parsed);
          if (syncPayload && isSubscribed) {
            console.log('[LiveSync] Atualização recebida via SSE:', syncPayload);
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

  // 4. Fallback Interval (every 5 seconds in case SSE disconnected)
  const fallbackInterval = setInterval(() => {
    if (isSubscribed) {
      fetchLatestState();
    }
  }, 5000);

  return () => {
    isSubscribed = false;
    clearInterval(fallbackInterval);
    if (localClassroomChannel) {
      localClassroomChannel.removeEventListener('message', handleLocalChannelMessage);
    }
    if (eventSource) {
      eventSource.close();
    }
    if (publishDebounceTimer) {
      clearTimeout(publishDebounceTimer);
    }
  };
}
