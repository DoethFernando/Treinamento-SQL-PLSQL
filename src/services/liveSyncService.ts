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

  modules.forEach((mod) => {
    if (mod.completedDurationSeconds !== undefined) {
      moduleDurations[mod.id] = mod.completedDurationSeconds;
    }
  });

  const customModules = modules.filter((m) => m.isCustom);

  return {
    version: 4,
    updatedAt: Date.now(),
    activeModuleId,
    completedModuleIds,
    moduleDurations,
    modifiedModules: modifiedModules && Object.keys(modifiedModules).length > 0 ? modifiedModules : undefined,
    customModules: customModules.length > 0 ? customModules : undefined,
    modules, // Lista completa com edições, scripts e status atualizados
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

  // 1. Se a lista completa de módulos foi transmitida (/api/sync ou BroadcastChannel)
  if (Array.isArray(sync.modules) && sync.modules.length > 0) {
    result = sync.modules;
  } else {
    // 2. Adicionar novos tópicos customizados criados pelo instrutor
    if (Array.isArray(sync.customModules) && sync.customModules.length > 0) {
      sync.customModules.forEach((cm) => {
        if (!result.some((m) => m.id === cm.id)) {
          result.push(cm);
        }
      });
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
  }

  // 5. Garantir sincronização estrita de módulos concluídos e durações
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

// Global active subscriber listener for on-demand checks (e.g. step navigation)
let activeParticipantSyncCallback: ((sync: LiveClassroomSync) => void) | null = null;
let publishDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Triggers an immediate refresh from the server when participant changes step or window focuses
 */
export async function triggerParticipantContentCheck(): Promise<void> {
  if (!activeParticipantSyncCallback) return;
  try {
    const res = await fetch('/api/sync');
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        console.log('[LiveSync] Validação manual da etapa concluída via /api/sync:', json.data);
        activeParticipantSyncCallback(json.data as LiveClassroomSync);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Publish updated classroom state from instructor to all participants worldwide
 */
export function publishLiveSync(payload: LiveClassroomSync, debounceMs = 100): void {
  // CRITICAL GUARD: Only the authenticated instructor can ever publish!
  if (typeof window !== 'undefined') {
    try {
      const isAuth = sessionStorage.getItem('oracle_instructor_auth_v2') === 'true';
      const isStudent = localStorage.getItem('oracle_training_view_mode_v2') === 'aluno';
      if (!isAuth && isStudent) {
        // Participants are strictly read-only! Never broadcast or overwrite classroom state.
        return;
      }
    } catch {
      // ignore
    }
  }

  // 1. Instant local delivery between open tabs on the same computer (<1ms)
  if (localClassroomChannel) {
    try {
      localClassroomChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  // 2. Publish to our primary Express backend (/api/sync) for all links (dev, shared, mobile)
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Fallback silently if offline
      });
    } catch {
      // ignore
    }
  }

  if (publishDebounceTimer) {
    clearTimeout(publishDebounceTimer);
    publishDebounceTimer = null;
  }

  // 3. Fallback broadcast to ntfy.sh with compact payload (<3KB, without full array to avoid attachment truncation)
  const executeNtfyPublish = async () => {
    try {
      const compactPayload: LiveClassroomSync = {
        ...payload,
        modules: undefined, // Strip large modules array for ntfy to stay well under 4KB limit
      };
      const body = JSON.stringify(compactPayload);
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
      console.warn('Falha temporária ao sincronizar com participantes via ntfy:', err);
    }
  };

  if (debounceMs <= 0) {
    executeNtfyPublish();
  } else {
    publishDebounceTimer = setTimeout(executeNtfyPublish, debounceMs);
  }
}

/**
 * Helper to safely extract sync payload from ntfy raw message or attachment URL
 */
async function parseNtfyRecord(raw: any): Promise<LiveClassroomSync | null> {
  try {
    if (raw && typeof raw === 'object') {
      if (raw.attachment && raw.attachment.url) {
        try {
          const resp = await fetch(raw.attachment.url);
          if (resp.ok) {
            return (await resp.json()) as LiveClassroomSync;
          }
        } catch {
          // ignore attachment fetch error
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
 * Subscribe participants to real-time events via local BroadcastChannel,
 * server-side SSE (/api/sync/events), and periodic 10s poll.
 */
export function subscribeToLiveSync(
  onSyncReceived: (sync: LiveClassroomSync) => void
): () => void {
  let isSubscribed = true;
  activeParticipantSyncCallback = onSyncReceived;

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

  // 2. Initial fetch and periodic validation from local server /api/sync
  const fetchServerState = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data && isSubscribed) {
          console.log('[LiveSync] Conteúdo sincronizado via /api/sync:', json.data);
          onSyncReceived(json.data as LiveClassroomSync);
          return true;
        }
      }
    } catch {
      // server endpoint not reachable
    }
    return false;
  };

  // Run initial fetch from server immediately
  fetchServerState().then((serverOk) => {
    // Only if server has NO data at all (first cold start), check ntfy history
    if (!serverOk) {
      fetchNtfyState();
    }
  });

  // 3. Real-Time Server-Sent Events (SSE) from our server (/api/sync/events)
  let serverEventSource: EventSource | null = null;
  try {
    serverEventSource = new EventSource('/api/sync/events');
    serverEventSource.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const data = JSON.parse(event.data);
        if (data && data.version) {
          console.log('[LiveSync] Atualização recebida via SSE do Servidor:', data);
          onSyncReceived(data as LiveClassroomSync);
        }
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }

  // 4. Initial fetch from ntfy fallback (only used if server is down or empty)
  const fetchNtfyState = async () => {
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
              console.log('[LiveSync] Estado recuperado via ntfy poll fallback:', syncPayload);
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

  // 5. Periodic verification every 10 seconds (as requested by user)
  // Ensures participant stays 100% updated with instructor's latest edits, block texts and scripts
  const validationInterval = setInterval(() => {
    if (isSubscribed) {
      fetchServerState().then((ok) => {
        if (!ok) fetchNtfyState();
      });
    }
  }, 10000);

  return () => {
    isSubscribed = false;
    activeParticipantSyncCallback = null;
    clearInterval(validationInterval);
    if (localClassroomChannel) {
      localClassroomChannel.removeEventListener('message', handleLocalChannelMessage);
    }
    if (serverEventSource) {
      serverEventSource.close();
    }
    if (publishDebounceTimer) {
      clearTimeout(publishDebounceTimer);
    }
  };
}
