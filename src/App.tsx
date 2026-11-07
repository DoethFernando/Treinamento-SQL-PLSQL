import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  Eye,
  FileText,
  GripVertical,
  Lock,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Sliders,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  DEFAULT_SCRATCHPAD_TEXT,
  INITIAL_BRAINSTORM_IDEAS,
  INITIAL_MODULES,
  BRIDGE_SUGGESTIONS,
} from './data/initialCurriculum';
import {
  BrainstormIdea,
  BridgeSuggestion,
  KeyPointItem,
  NavSection,
  TrainingModule,
} from './types/training';
import { CodeBlock } from './components/CodeBlock';
import { TransactionSimulator } from './components/TransactionSimulator';
import { MasterScriptsView } from './components/MasterScriptsView';
import { BridgeTopicsView } from './components/BridgeTopicsView';
import { BrainstormView } from './components/BrainstormView';
import { ModuleEditorModal } from './components/ModuleEditorModal';
import { KeyPointDetailModal } from './components/KeyPointDetailModal';
import { InstructorAuthModal } from './components/InstructorAuthModal';
import {
  applySyncToModules,
  buildSyncPayload,
  LiveClassroomSync,
  publishLiveSync,
  subscribeToLiveSync,
  triggerParticipantContentCheck,
} from './services/liveSyncService';

const MODULES_STORAGE_KEY = 'oracle18xe_training_modules_v3';
const IDEAS_STORAGE_KEY = 'oracle18xe_training_ideas_v2';
const SCRATCHPAD_STORAGE_KEY = 'oracle_training_brainstorm_notes';
const VIEW_MODE_STORAGE_KEY = 'oracle_training_view_mode_v2';
const TIMER_SYNC_KEY = 'oracle_training_timer_sync_v2';
const ACTIVE_MODULE_SYNC_KEY = 'oracle_training_active_mod_sync_v2';
const INSTRUCTOR_AUTH_KEY = 'oracle_instructor_auth_v2';

function formatClock(totalSeconds: number): string {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDurationBadge(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) {
    return s > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

export default function App() {
  // Instructor authentication state (session-based)
  const [isInstructorAuthenticated, setIsInstructorAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem(INSTRUCTOR_AUTH_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Mode: Default is ALWAYS true (Visão do Participante).
  // Only enters Modo Instrutor if authenticated in session AND explicitly chosen.
  const [isStudentView, setIsStudentView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const urlView = search.get('view') || search.get('mode');
      if (urlView === 'participante' || urlView === 'aluno') return true;

      const isAuth = sessionStorage.getItem(INSTRUCTOR_AUTH_KEY) === 'true';
      const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (isAuth && savedMode === 'instrutor') {
        return false;
      }
    }
    return true; // Padrão: Sempre abrir na Visão do Participante
  });

  const [activeNav, setActiveNav] = useState<NavSection>('roteiro');

  // Persistent Curriculum State (v2 with deepDive explanations & new topics)
  const [modules, setModules] = useState<TrainingModule[]>(() => {
    try {
      const saved = localStorage.getItem(MODULES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migration from previous versions: preserve any custom modules
      const savedV2 = localStorage.getItem('oracle18xe_training_modules_v2') || localStorage.getItem('oracle18xe_training_modules_v1');
      if (savedV2) {
        const parsedV2 = JSON.parse(savedV2);
        if (Array.isArray(parsedV2)) {
          const customOnes = parsedV2.filter((m: TrainingModule) => m.isCustom);
          if (customOnes.length > 0) {
            return [...INITIAL_MODULES, ...customOnes];
          }
        }
      }
    } catch {
      // fallback to initial
    }
    return INITIAL_MODULES;
  });

  const [activeModuleId, setActiveModuleId] = useState<string>(() => modules[0]?.id ?? 'mod-setup');
  const [instructorActiveModuleId, setInstructorActiveModuleId] = useState<string>(
    () => modules[0]?.id ?? 'mod-setup'
  );

  // Persistent Brainstorm Backlog (v2)
  const [ideas, setIdeas] = useState<BrainstormIdea[]>(() => {
    try {
      const saved = localStorage.getItem(IDEAS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      const savedV1 = localStorage.getItem('oracle18xe_training_ideas_v1');
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1);
        if (Array.isArray(parsedV1)) {
          const existingIds = new Set(INITIAL_BRAINSTORM_IDEAS.map((i) => i.id));
          const extra = parsedV1.filter((i: BrainstormIdea) => !existingIds.has(i.id));
          return [...INITIAL_BRAINSTORM_IDEAS, ...extra];
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_BRAINSTORM_IDEAS;
  });

  // Persistent Freeform Scratchpad (compatible key with HTML snippet)
  const [scratchpad, setScratchpad] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SCRATCHPAD_STORAGE_KEY);
      if (saved !== null) return saved;
    } catch {
      // fallback
    }
    return DEFAULT_SCRATCHPAD_TEXT;
  });

  const [lastSavedAt, setLastSavedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  // Content and script modifications made by instructor
  const [modifiedModules, setModifiedModules] = useState<Record<string, Partial<TrainingModule>>>(() => {
    try {
      const saved = localStorage.getItem('oracle_training_modified_modules_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  // Solution Accordion State per Module
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  // Live Presentation Stopwatch
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Selected KeyPoint for Deep-Dive Modal
  const [selectedKeyPoint, setSelectedKeyPoint] = useState<KeyPointItem | null>(null);

  // Modal Editor State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [prefillIdeaTitle, setPrefillIdeaTitle] = useState<string | undefined>(undefined);
  const [convertingIdeaId, setConvertingIdeaId] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    // Only instructor saves to MODULES_STORAGE_KEY to prevent participant tabs from overriding state
    if (!isStudentView && !isApplyingRemoteSyncRef.current) {
      try {
        localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(modules));
        setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [modules, isStudentView]);

  useEffect(() => {
    try {
      localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // ignore
    }
  }, [ideas]);

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCHPAD_STORAGE_KEY, scratchpad);
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // ignore
    }
  }, [scratchpad]);

  useEffect(() => {
    // Only instructor writes modifiedModules to localStorage
    if (!isStudentView) {
      try {
        localStorage.setItem('oracle_training_modified_modules_v2', JSON.stringify(modifiedModules));
      } catch {
        // ignore
      }
    }
  }, [modifiedModules, isStudentView]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, isStudentView ? 'aluno' : 'instrutor');
      if (isStudentView && activeNav !== 'roteiro' && activeNav !== 'scripts') {
        setActiveNav('roteiro');
      }
    } catch {
      // ignore
    }
  }, [isStudentView, activeNav]);

  // Synchronize Active Module with local storage so student/projector tab can follow instructor live
  // CRITICAL: Only the instructor writes to ACTIVE_MODULE_SYNC_KEY!
  useEffect(() => {
    if (!isStudentView) {
      try {
        localStorage.setItem(ACTIVE_MODULE_SYNC_KEY, activeModuleId);
      } catch {
        // ignore
      }
    }
  }, [activeModuleId, isStudentView]);

  const isApplyingRemoteSyncRef = React.useRef(false);

  // Subscribe participants to real-time classroom updates from instructor
  useEffect(() => {
    const unsubscribe = subscribeToLiveSync((sync: LiveClassroomSync) => {
      // ONLY participant tabs apply remote sync! Instructor is authoritative master.
      if (isStudentView) {
        isApplyingRemoteSyncRef.current = true;
        setModules((prev) => {
          const updated = applySyncToModules(prev, sync);
          // If deep-dive modal was open, refresh the selected keypoint with updated data
          if (selectedKeyPoint) {
            const currentMod = updated.find((m) => m.id === activeModuleId);
            if (currentMod) {
              const matchedKp = currentMod.keyPoints.find(
                (kp) => kp.title === selectedKeyPoint.title || kp.detail === selectedKeyPoint.detail
              );
              if (matchedKp) {
                setSelectedKeyPoint(matchedKp);
              }
            }
          }
          return updated;
        });

        if (sync.modifiedModules) {
          setModifiedModules((prev) => ({
            ...prev,
            ...sync.modifiedModules,
          }));
        }

        if (sync.activeModuleId) {
          // Updates the instructor beacon ("Em Aula") without hijacking participant's current page view
          setInstructorActiveModuleId(sync.activeModuleId);
        }

        if (sync.stopwatch && typeof sync.stopwatch.timerRunning === 'boolean') {
          setTimerRunning(sync.stopwatch.timerRunning);
          if (sync.stopwatch.timerRunning && sync.stopwatch.startedAt) {
            const currentSeconds =
              sync.stopwatch.secondsElapsed +
              Math.max(0, Math.floor((Date.now() - sync.stopwatch.startedAt) / 1000));
            setSecondsElapsed(currentSeconds);
          } else {
            setSecondsElapsed(sync.stopwatch.secondsElapsed);
          }
        }

        setTimeout(() => {
          isApplyingRemoteSyncRef.current = false;
        }, 150);
      }
    });

    return () => unsubscribe();
  }, [isStudentView, selectedKeyPoint, activeModuleId]);

  // Synchronize timer state
  // CRITICAL: ONLY the instructor writes to TIMER_SYNC_KEY!
  // Participant tabs opening in new tabs/windows must NEVER write 0s or false here.
  useEffect(() => {
    if (!isStudentView) {
      try {
        localStorage.setItem(
          TIMER_SYNC_KEY,
          JSON.stringify({ secondsElapsed, timerRunning, timestamp: Date.now() })
        );
      } catch {
        // ignore
      }
    }
  }, [secondsElapsed, timerRunning, isStudentView]);

  // Broadcast any instructor updates (modules, order, status, timer, modified content) to participants worldwide
  useEffect(() => {
    if (!isStudentView && !isApplyingRemoteSyncRef.current) {
      const payload = buildSyncPayload(
        modules,
        activeModuleId,
        secondsElapsed,
        timerRunning,
        modifiedModules
      );
      publishLiveSync(payload, 200);
    }
  }, [isStudentView, modules, activeModuleId, timerRunning, modifiedModules]);

  // Listen to cross-tab updates (e.g. Instructor changes module or status in another tab/window)
  // ONLY participants accept remote changes from localStorage. The Instructor is the authoritative source!
  useEffect(() => {
    if (!isStudentView) {
      // Instructor NEVER listens to cross-tab storage events that could reset their timer or state
      return;
    }

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === MODULES_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setModules(parsed);
          }
        } catch {
          // ignore
        }
      }
      if (e.key === ACTIVE_MODULE_SYNC_KEY && e.newValue) {
        setInstructorActiveModuleId(e.newValue);
      }
      if (e.key === TIMER_SYNC_KEY && e.newValue) {
        try {
          const syncData = JSON.parse(e.newValue);
          if (typeof syncData.secondsElapsed === 'number') {
            setSecondsElapsed(syncData.secondsElapsed);
          }
          if (typeof syncData.timerRunning === 'boolean') {
            setTimerRunning(syncData.timerRunning);
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [isStudentView]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const activeModuleIndex = useMemo(() => {
    const idx = modules.findIndex((m) => m.id === activeModuleId);
    return idx >= 0 ? idx : 0;
  }, [modules, activeModuleId]);

  const currentModule = modules[activeModuleIndex] ?? modules[0];

  const totalMinutes = useMemo(
    () => modules.reduce((acc, m) => acc + m.durationMinutes, 0),
    [modules]
  );

  const completedCount = useMemo(
    () => modules.filter((m) => m.completed).length,
    [modules]
  );

  const durationBudgetStatus = useMemo(() => {
    if (totalMinutes < 90) {
      return {
        label: `Abaixo da meta (${totalMinutes} min / alvo 90–120 min)`,
        tone: 'text-amber-300',
      };
    }
    if (totalMinutes <= 120) {
      return {
        label: `Dentro da janela ideal (${totalMinutes} min / 1h30–2h00)`,
        tone: 'text-emerald-400',
      };
    }
    return {
      label: `Acima de 2h (${totalMinutes} min / reduza ou deixe tópicos opcionais)`,
      tone: 'text-rose-300',
    };
  }, [totalMinutes]);

  const moduleLinkedIdeas = useMemo(() => {
    if (!currentModule) return [];
    return ideas.filter(
      (i) => i.targetModuleId === currentModule.id && i.status === 'pendente'
    );
  }, [ideas, currentModule]);

  const handleSelectModule = (id: string) => {
    setActiveModuleId(id);
    if (!isStudentView) {
      publishLiveSync(buildSyncPayload(modules, id, secondsElapsed, timerRunning, modifiedModules), 50);
    } else {
      // Quando o participante muda de etapa, valida imediatamente com o servidor para sincronizar edições do instrutor
      triggerParticipantContentCheck();
    }
  };

  const handleToggleModuleCompleted = (id: string) => {
    const next = modules.map((m) => {
      if (m.id === id) {
        const willBeCompleted = !m.completed;
        return {
          ...m,
          completed: willBeCompleted,
          completedDurationSeconds: willBeCompleted
            ? secondsElapsed > 0
              ? secondsElapsed
              : undefined
            : undefined,
        };
      }
      return m;
    });

    setModules(next);
    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(next, activeModuleId, secondsElapsed, timerRunning, modifiedModules),
        0
      );
    }
  };

  const executeResetTraining = () => {
    const resetMods = modules.map((m) => ({
      ...m,
      completed: false,
      completedDurationSeconds: undefined,
    }));

    setModules(resetMods);
    setSecondsElapsed(0);
    setTimerRunning(false);
    const firstId = resetMods[0]?.id ?? 'mod-setup';
    setActiveModuleId(firstId);
    setInstructorActiveModuleId(firstId);

    if (!isStudentView) {
      publishLiveSync(buildSyncPayload(resetMods, firstId, 0, false, modifiedModules), 0);
    }
    setResetModalOpen(false);
    showToast('Treinamento reiniciado com sucesso! Todos os módulos e tempos foram zerados.');
  };

  const handleSaveKeyPointItem = (updatedItem: KeyPointItem) => {
    if (!currentModule || !selectedKeyPoint) return;

    const currentKeyPoints = [...currentModule.keyPoints];
    const idx = currentKeyPoints.findIndex(
      (kp) => kp.title === selectedKeyPoint.title || kp.detail === selectedKeyPoint.detail
    );

    if (idx >= 0) {
      currentKeyPoints[idx] = updatedItem;
    } else {
      currentKeyPoints.push(updatedItem);
    }

    const nextModules = modules.map((m) =>
      m.id === currentModule.id ? { ...m, keyPoints: currentKeyPoints } : m
    );

    setModules(nextModules);
    setSelectedKeyPoint(updatedItem);

    const nextModified = {
      ...modifiedModules,
      [currentModule.id]: {
        ...modifiedModules[currentModule.id],
        keyPoints: currentKeyPoints,
      },
    };
    setModifiedModules(nextModified);

    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(nextModules, activeModuleId, secondsElapsed, timerRunning, nextModified),
        0
      );
    }
    showToast('Bloco didático atualizado e sincronizado com os participantes!');
  };

  const handleSaveScript = (
    type: 'ddl' | 'dml' | 'usageExample' | 'gabarito',
    newCode: string
  ) => {
    if (!currentModule) return;

    const nextModules = modules.map((m) => {
      if (m.id === currentModule.id) {
        if (type === 'ddl') {
          return { ...m, ddlScript: newCode };
        }
        if (type === 'dml') {
          return { ...m, dmlScript: newCode };
        }
        if (type === 'usageExample') {
          return {
            ...m,
            usageExample: {
              ...m.usageExample,
              sql: newCode,
            },
          };
        }
        if (type === 'gabarito') {
          return {
            ...m,
            exercise: {
              ...m.exercise,
              solutionSql: newCode,
            },
          };
        }
      }
      return m;
    });

    setModules(nextModules);

    const updatedPatch: Partial<TrainingModule> =
      type === 'ddl'
        ? { ddlScript: newCode }
        : type === 'dml'
        ? { dmlScript: newCode }
        : type === 'usageExample'
        ? { usageExample: { ...currentModule.usageExample, sql: newCode } }
        : { exercise: { ...currentModule.exercise, solutionSql: newCode } };

    const nextModified = {
      ...modifiedModules,
      [currentModule.id]: {
        ...modifiedModules[currentModule.id],
        ...updatedPatch,
      },
    };
    setModifiedModules(nextModified);

    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(nextModules, activeModuleId, secondsElapsed, timerRunning, nextModified),
        0
      );
    }
    showToast('Script SQL atualizado e sincronizado com os participantes!');
  };

  const handleMoveModule = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const copy = [...modules];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setModules(copy);
    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(copy, activeModuleId, secondsElapsed, timerRunning, modifiedModules),
        0
      );
    }
  };

  // Drag and drop state for KeyPoint blocks
  const [draggedKeyPointIndex, setDraggedKeyPointIndex] = useState<number | null>(null);

  const handleReorderKeyPoints = (fromIndex: number, toIndex: number) => {
    if (!currentModule || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const keyPoints = [...currentModule.keyPoints];
    if (fromIndex >= keyPoints.length || toIndex >= keyPoints.length) return;

    const [moved] = keyPoints.splice(fromIndex, 1);
    keyPoints.splice(toIndex, 0, moved);

    const next = modules.map((m) => (m.id === currentModule.id ? { ...m, keyPoints } : m));
    setModules(next);

    const nextModified = {
      ...modifiedModules,
      [currentModule.id]: {
        ...modifiedModules[currentModule.id],
        keyPoints,
      },
    };
    setModifiedModules(nextModified);

    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(next, activeModuleId, secondsElapsed, timerRunning, nextModified),
        0
      );
    }
    showToast('Nova ordem dos blocos salva e sincronizada com os participantes!');
  };

  const handleMoveKeyPoint = (index: number, direction: 'prev' | 'next') => {
    const target = direction === 'prev' ? index - 1 : index + 1;
    if (!currentModule || target < 0 || target >= currentModule.keyPoints.length) return;
    handleReorderKeyPoints(index, target);
  };

  const handleStartTimer = () => {
    setTimerRunning(true);
    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(modules, activeModuleId, secondsElapsed, true, modifiedModules),
        0
      );
    }
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
    if (!isStudentView) {
      publishLiveSync(
        buildSyncPayload(modules, activeModuleId, secondsElapsed, false, modifiedModules),
        0
      );
    }
  };

  const handleEnterInstructorMode = () => {
    if (isInstructorAuthenticated) {
      setIsStudentView(false);
      showToast('Modo Instrutor ativado.');
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleInstructorAuthSuccess = () => {
    setIsInstructorAuthenticated(true);
    setIsStudentView(false);
    showToast('Modo Instrutor desbloqueado com sucesso!');
    // Trigger immediate state broadcast so participants get any pending changes
    publishLiveSync(
      buildSyncPayload(modules, activeModuleId, secondsElapsed, timerRunning, modifiedModules),
      0
    );
  };

  const handleDeleteCustomModule = (id: string) => {
    if (modules.length <= 1) return;
    setModules((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (activeModuleId === id && next[0]) {
        setActiveModuleId(next[0].id);
      }
      if (!isStudentView) {
        publishLiveSync(
          buildSyncPayload(next, activeModuleId === id && next[0] ? next[0].id : activeModuleId, secondsElapsed, timerRunning, modifiedModules),
          0
        );
      }
      return next;
    });
    showToast('Tópico removido do roteiro.');
  };

  const handleSaveModule = (saved: TrainingModule, isNew: boolean) => {
    if (isNew) {
      setModules((prev) => {
        const next = [...prev, saved];
        if (!isStudentView) {
          publishLiveSync(
            buildSyncPayload(next, saved.id, secondsElapsed, timerRunning, modifiedModules),
            0
          );
        }
        return next;
      });
      setActiveModuleId(saved.id);
      setActiveNav('roteiro');
      if (convertingIdeaId) {
        setIdeas((prev) =>
          prev.map((i) =>
            i.id === convertingIdeaId ? { ...i, status: 'incorporado' } : i
          )
        );
        setConvertingIdeaId(null);
      }
      showToast(`Novo tópico "${saved.shortTitle}" adicionado ao roteiro.`);
    } else {
      const nextModules = modules.map((m) => (m.id === saved.id ? saved : m));
      setModules(nextModules);
      const nextModified = {
        ...modifiedModules,
        [saved.id]: {
          ...modifiedModules[saved.id],
          title: saved.title,
          shortTitle: saved.shortTitle,
          conceptSummary: saved.conceptSummary,
          durationMinutes: saved.durationMinutes,
          category: saved.category,
          keyPoints: saved.keyPoints,
          ddlScript: saved.ddlScript,
          dmlScript: saved.dmlScript,
          usageExample: saved.usageExample,
          exercise: saved.exercise,
          instructorTips: saved.instructorTips,
        },
      };
      setModifiedModules(nextModified);
      if (!isStudentView) {
        publishLiveSync(
          buildSyncPayload(nextModules, activeModuleId, secondsElapsed, timerRunning, nextModified),
          0
        );
      }
      showToast(`Módulo "${saved.shortTitle}" atualizado.`);
    }
  };

  const handleAddBridgeSuggestion = (suggestion: BridgeSuggestion) => {
    const exists = modules.some((m) => m.id === suggestion.moduleData.id);
    if (exists) return;

    const newMod: TrainingModule = {
      ...suggestion.moduleData,
      completed: false,
    };

    setModules((prev) => {
      const afterIdx = prev.findIndex(
        (m) => m.id === suggestion.recommendedAfterModuleId
      );
      if (afterIdx === -1) return [...prev, newMod];
      const copy = [...prev];
      copy.splice(afterIdx + 1, 0, newMod);
      return copy;
    });

    showToast(`Tema "${newMod.shortTitle}" incorporado na sequência ideal!`);
  };

  const handleAddIdea = (text: string, targetModuleId: string) => {
    const item: BrainstormIdea = {
      id: `idea-${Date.now()}`,
      text,
      targetModuleId,
      status: 'pendente',
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };
    setIdeas((prev) => [item, ...prev]);
    showToast('Lembrete salvo no painel de Brainstorm.');
  };

  const handleToggleIdeaStatus = (id: string) => {
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: i.status === 'pendente' ? 'incorporado' : 'pendente' }
          : i
      )
    );
  };

  const handleDeleteIdea = (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  };

  const handleConvertIdeaToModule = (idea: BrainstormIdea) => {
    setEditingModule(null);
    setPrefillIdeaTitle(idea.text);
    setConvertingIdeaId(idea.id);
    setEditorOpen(true);
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      targetDate: '2026-11-06',
      modules,
      ideas,
      scratchpad,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roteiro_treinamento_oracle18xe_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup completo (.json) exportado com sucesso.');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
          setModules(parsed.modules);
          setActiveModuleId(parsed.modules[0].id);
        }
        if (Array.isArray(parsed.ideas)) {
          setIdeas(parsed.ideas);
        }
        if (typeof parsed.scratchpad === 'string') {
          setScratchpad(parsed.scratchpad);
        }
        showToast('Backup restaurado com sucesso!');
      } catch {
        showToast('Arquivo JSON inválido para restauração.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    setModules(INITIAL_MODULES);
    setActiveModuleId(INITIAL_MODULES[0].id);
    setIdeas(INITIAL_BRAINSTORM_IDEAS);
    setScratchpad(DEFAULT_SCRATCHPAD_TEXT);
    showToast('Roteiro e anotações restaurados para a base original.');
  };

  const toggleSolution = (moduleId: string) => {
    setRevealedSolutions((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const pendingIdeasCount = ideas.filter((i) => i.status === 'pendente').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100">
      {/* Top Bar Contract: Strictly 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur border-b border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#roteiro"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('roteiro');
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          Oracle 18c XE Workbench
        </a>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          {(isStudentView
            ? ([
                { id: 'roteiro', label: 'Roteiro de Treinamento' },
                { id: 'scripts', label: 'Scripts SQL (DDL & DML)' },
              ] as const)
            : ([
                { id: 'roteiro', label: 'Roteiro' },
                { id: 'simulador', label: 'Simulador' },
                { id: 'scripts', label: 'Scripts SQL' },
                { id: 'conexoes', label: 'Temas de Conexão' },
                {
                  id: 'brainstorm',
                  label: pendingIdeasCount > 0 ? `Brainstorm (${pendingIdeasCount})` : 'Brainstorm',
                },
              ] as const)
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeNav === item.id
                  ? 'text-white border-rose-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 border-transparent hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Mode Switcher & Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isStudentView ? (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Visão do Participante
              </span>

              <button
                type="button"
                onClick={handleEnterInstructorMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                title="Acessar painel do instrutor com senha"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Modo Instrutor</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsStudentView(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0"
                title="Visualizar exatamente o que os participantes veem"
              >
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Visão do Participante</span>
                <span className="sm:hidden">Participante</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingModule(null);
                  setPrefillIdeaTitle(undefined);
                  setConvertingIdeaId(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Tópico</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Nav Switcher (visible only below md) */}
      <div className="md:hidden px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {(isStudentView
          ? ([
              { id: 'roteiro', label: 'Roteiro' },
              { id: 'scripts', label: 'Scripts SQL' },
            ] as const)
          : ([
              { id: 'roteiro', label: 'Roteiro' },
              { id: 'simulador', label: 'Simulador' },
              { id: 'scripts', label: 'Scripts SQL' },
              { id: 'conexoes', label: 'Conexões' },
              { id: 'brainstorm', label: 'Brainstorm' },
            ] as const)
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveNav(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeNav === item.id
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Workspace Context & Live Presentation Pacing Toolbar (Below Header) */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <span>SQL &amp; PL/SQL Oracle 18c XE</span>
              <span className="text-[11px] font-normal text-slate-400">· PL/SQL Developer</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium tabular-nums ${durationBudgetStatus.tone}`}>
              {durationBudgetStatus.label}
            </span>
            <span aria-hidden="true">·</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-medium text-slate-200">
                Progresso: {completedCount}/{modules.length} ({Math.round((completedCount / (modules.length || 1)) * 100)}%)
              </span>
              <div className="w-20 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((completedCount / (modules.length || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            {!isStudentView && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">Edições abertas até 06/11</span>
              </>
            )}
          </div>

          {/* Live Presentation Stopwatch */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Tempo de Aula:</span>
              <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                {formatClock(secondsElapsed)}
              </span>
              {timerRunning && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>

            {/* Stopwatch Controls: ONLY rendered in Modo Instrutor */}
            {!isStudentView ? (
              <div className="flex items-center gap-1.5">
                {!timerRunning ? (
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors whitespace-nowrap shrink-0"
                    title="Iniciar cronômetro para todos os participantes"
                  >
                    <Play className="w-3 h-3" />
                    <span>{secondsElapsed > 0 ? 'Retomar' : 'Iniciar'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseTimer}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors whitespace-nowrap shrink-0"
                    title="Pausar cronômetro para todos os participantes"
                  >
                    <Pause className="w-3 h-3" />
                    <span>Pausar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors whitespace-nowrap shrink-0 border border-slate-700"
                  title="Zerar cronômetro da aula, percentual de progresso e status de todas as etapas"
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>Zerar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sincronizado</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {activeNav === 'roteiro' && currentModule && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Chronological Curriculum Sidebar (3.5 / 4 cols) */}
            <aside className="lg:col-span-4 xl:col-span-3 rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Sequência do Treinamento ({modules.length} etapas)
                </span>
                <span className="text-xs text-slate-400 tabular-nums">
                  Total: {totalMinutes}m
                </span>
              </div>

              <div className="divide-y divide-slate-800/70">
                {modules.map((mod, idx) => {
                  const isSelected = mod.id === currentModule.id;
                  const isEmAula = isStudentView
                    ? mod.id === instructorActiveModuleId
                    : isSelected;

                  return (
                    <div
                      key={mod.id}
                      className={`group flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                        isSelected
                          ? 'bg-slate-800/90 text-white'
                          : 'hover:bg-slate-900/90 text-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectModule(mod.id)}
                        className="flex-1 min-w-0 text-left flex items-start gap-2.5 focus-visible:outline-none"
                      >
                        <span
                          className={`text-xs font-mono tabular-nums mt-0.5 shrink-0 ${
                            mod.completed
                              ? 'text-emerald-400 font-semibold'
                              : isSelected
                              ? 'text-rose-400 font-semibold'
                              : 'text-slate-500'
                          }`}
                        >
                          {mod.completed ? '✓' : `${String(idx + 1).padStart(2, '0')}.`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">
                              {mod.shortTitle}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {mod.durationMinutes} min · {mod.category}
                            </span>
                            {/* Live Status Tag */}
                            {mod.completed ? (
                              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 whitespace-nowrap">
                                Concluído{mod.completedDurationSeconds ? ` · ${formatDurationBadge(mod.completedDurationSeconds)}` : ''}
                              </span>
                            ) : isEmAula ? (
                              <span className="text-[10px] font-semibold text-rose-300 bg-rose-500/15 px-1.5 py-0.2 rounded border border-rose-500/30 whitespace-nowrap inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                Em Aula
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.2 rounded whitespace-nowrap">
                                A seguir
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Reorder Controls (Instructor Dev Mode Only) */}
                      {!isStudentView && (
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveModule(idx, 'up')}
                            aria-label="Mover módulo para cima"
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-25 rounded"
                            title="Subir na ordem do treinamento"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === modules.length - 1}
                            onClick={() => handleMoveModule(idx, 'down')}
                            aria-label="Mover módulo para baixo"
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-25 rounded"
                            title="Descer na ordem do treinamento"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isStudentView ? (
                <div className="p-3 border-t border-slate-800 bg-[#0B0F19]/50">
                  <button
                    type="button"
                    onClick={() => setActiveNav('conexoes')}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
                  >
                    + Ver Temas Sugeridos de Ligação
                  </button>
                </div>
              ) : (
                <div className="p-3 border-t border-slate-800 bg-[#0B0F19]/50 text-center">
                  <span className="text-[11px] text-slate-500">
                    Navegue livremente pelas etapas clicando na lista acima
                  </span>
                </div>
              )}
            </aside>

            {/* Right Active Module Detail Workbench (8 / 9 cols) */}
            <main className="lg:col-span-8 xl:col-span-9 space-y-8">
              {/* Module Header */}
              <div className="pb-6 border-b border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Unboxed clean metadata with middle dot separators */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-rose-400 font-semibold tabular-nums">
                      Etapa {String(activeModuleIndex + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Duração sugerida: {currentModule.durationMinutes} minutos
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentModule.category}</span>
                  </div>

                  {/* Actions Header: Distinct Student Mode vs Instructor Mode */}
                  {isStudentView ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {currentModule.completed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Módulo Concluído no Treinamento{currentModule.completedDurationSeconds ? ` · ${formatDurationBadge(currentModule.completedDurationSeconds)}` : ''}</span>
                        </span>
                      ) : currentModule.id === instructorActiveModuleId ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                          <span>Módulo Atual em Aula</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-400 bg-slate-800/70 border border-slate-700">
                            Navegação Livre
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectModule(instructorActiveModuleId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition-colors"
                            title="Ir para o módulo que o instrutor está apresentando agora"
                          >
                            <span>Ir para etapa do instrutor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {(currentModule.id === 'mod-ddl-dml' ||
                        currentModule.id === 'mod-triggers' ||
                        currentModule.id === 'mod-plsqldev') && (
                        <button
                          type="button"
                          onClick={() => setActiveNav('simulador')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-200 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/50 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Abrir no Simulador Visual</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingModule(currentModule);
                          setPrefillIdeaTitle(undefined);
                          setEditorOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Conteúdo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleModuleCompleted(currentModule.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          currentModule.completed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {currentModule.completed
                            ? `Módulo Apresentado${currentModule.completedDurationSeconds ? ` · ${formatDurationBadge(currentModule.completedDurationSeconds)}` : ''}`
                            : 'Marcar Apresentado'}
                        </span>
                      </button>

                      {currentModule.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomModule(currentModule.id)}
                          aria-label="Remover tópico customizado"
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded-md transition-colors"
                          title="Remover tópico adicionado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {String(activeModuleIndex + 1).padStart(2, '0')}. {currentModule.title}
                </h1>
              </div>

              {/* Section 1: Concept Summary & Key Points */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  Conceito por Trás do Estudo
                </h2>
                <p className="text-[15px] text-slate-200 leading-relaxed max-w-[75ch]">
                  {currentModule.conceptSummary}
                </p>

                {currentModule.keyPoints.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>Clique em qualquer bloco abaixo para ver a explicação detalhada com regras e comandos:</span>
                      {!isStudentView ? (
                        <span className="text-[11px] text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Modo Instrutor · Arraste para reordenar os blocos (ordem salva para os participantes)
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-300 font-medium">Interativo · Clique para expandir</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentModule.keyPoints.map((kp, i) => (
                        <div
                          key={`${currentModule.id}-kp-${kp.title}-${i}`}
                          draggable={!isStudentView}
                          onDragStart={(e) => {
                            if (!isStudentView) {
                              e.dataTransfer.setData('text/plain', String(i));
                              setDraggedKeyPointIndex(i);
                            }
                          }}
                          onDragOver={(e) => {
                            if (!isStudentView) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={(e) => {
                            if (!isStudentView) {
                              e.preventDefault();
                              if (draggedKeyPointIndex !== null && draggedKeyPointIndex !== i) {
                                handleReorderKeyPoints(draggedKeyPointIndex, i);
                              }
                              setDraggedKeyPointIndex(null);
                            }
                          }}
                          onDragEnd={() => setDraggedKeyPointIndex(null)}
                          onClick={() => setSelectedKeyPoint(kp)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedKeyPoint(kp);
                            }
                          }}
                          className={`group text-left rounded-lg border bg-slate-900/40 hover:bg-slate-900/80 p-4 space-y-2.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-sm hover:shadow-md ${
                            draggedKeyPointIndex === i
                              ? 'opacity-40 border-dashed border-rose-500 scale-[0.98]'
                              : 'border-slate-800 hover:border-rose-500/70'
                          }`}
                        >
                          {/* Instructor Drag Bar & Position Controls */}
                          {!isStudentView && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="pb-2 mb-1 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400"
                            >
                              <div
                                className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-200"
                                title="Clique e arraste este bloco para mudar sua posição"
                              >
                                <GripVertical className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-mono text-[10px] bg-slate-800/90 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                                  Bloco {i + 1} de {currentModule.keyPoints.length}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={i === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveKeyPoint(i, 'prev');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none"
                                  title="Mover para esquerda/cima"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={i === currentModule.keyPoints.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveKeyPoint(i, 'next');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none"
                                  title="Mover para direita/baixo"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-white group-hover:text-rose-200 transition-colors">
                              {kp.title}
                            </h3>
                            <span className="text-[11px] font-medium text-slate-400 group-hover:text-rose-300 shrink-0 inline-flex items-center gap-1">
                              <span>Explicar</span>
                              <span aria-hidden="true">→</span>
                            </span>
                          </div>

                          {kp.pathOrSyntax && (
                            <p className="text-xs font-mono text-rose-300/90 group-hover:text-rose-300 break-words">
                              {kp.pathOrSyntax}
                            </p>
                          )}

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {kp.detail}
                          </p>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-slate-200">
                            <span className="text-rose-300/90 font-medium">
                              Ver finalidade &amp; regras de produção
                            </span>
                            <span className="font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                              + Detalhes
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Section 2: Separated DDL and DML Scripts (when applicable) */}
              {(currentModule.ddlScript || currentModule.dmlScript) && (
                <section className="pt-6 border-t border-slate-800 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Scripts de Ambiente Separados (DDL &amp; DML)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Separados entre criação de estrutura/objetos (DDL — commit automático) e população de dados para teste (DML).
                    </p>
                  </div>

                  <div className="space-y-4">
                    {currentModule.ddlScript && (
                      <CodeBlock
                        title="Script 1 · Estrutura e Objetos (DDL)"
                        subtitle="Executa COMMIT implícito antes e depois"
                        code={currentModule.ddlScript}
                        filename={`${currentModule.id}_ddl.sql`}
                        editable={!isStudentView}
                        onSaveCode={(newCode) => handleSaveScript('ddl', newCode)}
                        onCopySuccess={showToast}
                      />
                    )}

                    {currentModule.dmlScript && (
                      <CodeBlock
                        title="Script 2 · População de Dados (DML)"
                        subtitle="Carga inicial e massa de validação"
                        code={currentModule.dmlScript}
                        filename={`${currentModule.id}_dml.sql`}
                        editable={!isStudentView}
                        onSaveCode={(newCode) => handleSaveScript('dml', newCode)}
                        onCopySuccess={showToast}
                      />
                    )}
                  </div>
                </section>
              )}

              {/* Section 3: Practical Usage Example */}
              <section className="pt-6 border-t border-slate-800 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Exemplo Prático de Uso: {currentModule.usageExample.title}
                  </h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-[75ch]">
                    {currentModule.usageExample.explanation}
                  </p>
                </div>

                <CodeBlock
                  title={currentModule.usageExample.title}
                  subtitle="Demonstração comentada pelo instrutor"
                  code={currentModule.usageExample.sql}
                  filename={`${currentModule.id}_exemplo.sql`}
                  editable={!isStudentView}
                  onSaveCode={(newCode) => handleSaveScript('usageExample', newCode)}
                  onCopySuccess={showToast}
                />
              </section>

              {/* Section 4: Classroom Suggested Exercise + Collapsible Gabarito */}
              <section className="pt-6 border-t border-slate-800 space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-xs text-rose-300 font-medium">
                      Atividade Sugerida para Apresentação · Prática Guiada
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      {currentModule.exercise.title}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {currentModule.exercise.scenario}
                    </p>
                  </div>

                  <ol className="space-y-2 list-decimal list-inside text-sm text-slate-200 pt-2 border-t border-slate-800/80">
                    {currentModule.exercise.tasks.map((task, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {task}
                      </li>
                    ))}
                  </ol>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => toggleSolution(currentModule.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>
                        {revealedSolutions[currentModule.id]
                          ? 'Ocultar Gabarito da Atividade'
                          : 'Exibir Gabarito da Atividade'}
                      </span>
                      {revealedSolutions[currentModule.id] ? (
                        <ChevronUp className="w-4 h-4 text-rose-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                  </div>

                  {revealedSolutions[currentModule.id] && (
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <CodeBlock
                        title={`Gabarito Oficial · ${currentModule.exercise.title}`}
                        code={currentModule.exercise.solutionSql}
                        filename={`${currentModule.id}_gabarito.sql`}
                        editable={!isStudentView}
                        onSaveCode={(newCode) => handleSaveScript('gabarito', newCode)}
                        onCopySuccess={showToast}
                      />
                      {currentModule.exercise.notes && (
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <strong className="text-white">Observação didática:</strong>{' '}
                          {currentModule.exercise.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Section 5: Best Practices / Instructor Notes & Brainstorm */}
              {isStudentView ? (
                currentModule.instructorTips.length > 0 && (
                  <section className="pt-6 border-t border-slate-800 space-y-2">
                    <h3 className="text-sm font-semibold text-emerald-300">
                      Boas Práticas e Recomendações em Produção
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                      {currentModule.instructorTips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              ) : (
                (currentModule.instructorTips.length > 0 ||
                  moduleLinkedIdeas.length > 0) && (
                  <section className="pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentModule.instructorTips.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-white">
                          Pontos de Atenção para o Apresentador
                        </h3>
                        <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                          {currentModule.instructorTips.map((tip, idx) => (
                            <li key={idx}>• {tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {moduleLinkedIdeas.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-amber-300">
                            Lembretes do Seu Brainstorm para Este Módulo
                          </h3>
                          <button
                            type="button"
                            onClick={() => setActiveNav('brainstorm')}
                            className="text-xs text-slate-400 hover:text-white underline"
                          >
                            Gerenciar
                          </button>
                        </div>
                        <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
                          {moduleLinkedIdeas.map((idea) => (
                            <li key={idea.id} className="flex items-start justify-between gap-2">
                              <span>• {idea.text}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleIdeaStatus(idea.id)}
                                className="text-emerald-400 hover:underline shrink-0"
                              >
                                Concluir
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )
              )}

              {/* Bottom Chronological Stepper */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={activeModuleIndex === 0}
                  onClick={() =>
                    handleSelectModule(modules[activeModuleIndex - 1].id)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>
                    {activeModuleIndex > 0
                      ? `Anterior: ${modules[activeModuleIndex - 1].shortTitle}`
                      : 'Início do Roteiro'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={activeModuleIndex === modules.length - 1}
                  onClick={() =>
                    handleSelectModule(modules[activeModuleIndex + 1].id)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <span>
                    {activeModuleIndex < modules.length - 1
                      ? `Próximo: ${modules[activeModuleIndex + 1].shortTitle}`
                      : 'Fim do Roteiro'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </main>
          </div>
        )}

        {/* Development Environment Only Views */}
        {!isStudentView && activeNav === 'simulador' && <TransactionSimulator />}

        {activeNav === 'scripts' && (
          <MasterScriptsView modules={modules} onCopySuccess={showToast} />
        )}

        {!isStudentView && activeNav === 'conexoes' && (
          <BridgeTopicsView
            suggestions={BRIDGE_SUGGESTIONS}
            modules={modules}
            onAddSuggestion={handleAddBridgeSuggestion}
            onRemoveModule={handleDeleteCustomModule}
            onCopySuccess={showToast}
          />
        )}

        {!isStudentView && activeNav === 'brainstorm' && (
          <BrainstormView
            ideas={ideas}
            modules={modules}
            scratchpad={scratchpad}
            lastSavedAt={lastSavedAt}
            onScratchpadChange={setScratchpad}
            onAddIdea={handleAddIdea}
            onToggleIdeaStatus={handleToggleIdeaStatus}
            onDeleteIdea={handleDeleteIdea}
            onConvertIdeaToModule={handleConvertIdeaToModule}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetDefaults={handleResetDefaults}
          />
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="mt-12 border-t border-slate-800/80 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>
            {isStudentView
              ? 'Roteiro de Treinamento · Oracle Database 18c Express Edition & PL/SQL Developer'
              : 'Bancada do Instrutor · Oracle Database 18c Express Edition & PL/SQL Developer (Ambiente de Desenvolvimento)'}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveNav('scripts')}
              className="hover:text-slate-300 transition-colors"
            >
              Central de Scripts (.sql)
            </button>
            {!isStudentView ? (
              <button
                type="button"
                onClick={handleExportBackup}
                className="hover:text-slate-300 transition-colors"
              >
                Salvar Backup JSON
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnterInstructorMode}
                className="hover:text-slate-300 transition-colors underline"
              >
                Acessar Modo Instrutor
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modal de Confirmação: Zerar Treinamento */}
      {resetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Zerar Treinamento?</h3>
                <p className="text-xs text-slate-400">Esta ação afeta a sala inteira</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Todos os módulos concluídos serão desmarcados, os tempos de cada etapa serão limpos, a barra de progresso voltará para 0% e o cronômetro será zerado para você e todos os participantes.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeResetTraining}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-lg shadow-rose-950/50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sim, Zerar Treinamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructor Password Protection Modal */}
      <InstructorAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleInstructorAuthSuccess}
      />

      {/* Module Editor Modal */}
      <ModuleEditorModal
        isOpen={editorOpen}
        initialModule={editingModule}
        prefillTitle={prefillIdeaTitle}
        onClose={() => {
          setEditorOpen(false);
          setConvertingIdeaId(null);
        }}
        onSave={handleSaveModule}
      />

      {/* KeyPoint Deep-Dive Explanation Modal */}
      <KeyPointDetailModal
        isOpen={Boolean(selectedKeyPoint)}
        item={selectedKeyPoint}
        moduleTitle={currentModule?.title}
        isInstructor={!isStudentView}
        onClose={() => setSelectedKeyPoint(null)}
        onCopySuccess={showToast}
        onSaveItem={handleSaveKeyPointItem}
      />

      {/* Copy / Action Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium px-4 py-2.5 rounded-md shadow-xl flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
