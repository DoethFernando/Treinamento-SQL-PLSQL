export type NavSection =
  | 'roteiro'
  | 'simulador'
  | 'scripts'
  | 'conexoes'
  | 'brainstorm';

export interface KeyPointDeepDive {
  purpose: string; // Qual a finalidade daquilo
  breakdownTitle?: string;
  breakdownItems?: Array<{ label: string; description: string; code?: string }>;
  codeExample?: string;
  productionGotchas?: string[];
}

export interface KeyPointItem {
  title: string;
  pathOrSyntax?: string;
  detail: string;
  deepDive?: KeyPointDeepDive;
}

export interface UsageExample {
  title: string;
  explanation: string;
  sql: string;
}

export interface ClassroomExercise {
  title: string;
  scenario: string;
  tasks: string[];
  solutionSql: string;
  notes?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  shortTitle: string;
  durationMinutes: number;
  category: string;
  completed: boolean;
  completedDurationSeconds?: number;
  isCustom?: boolean;
  conceptSummary: string;
  keyPoints: KeyPointItem[];
  usageExample: UsageExample;
  ddlScript?: string;
  dmlScript?: string;
  exercise: ClassroomExercise;
  instructorTips: string[];
}

export interface BridgeSuggestion {
  id: string;
  recommendedAfterModuleId: string;
  connectsLabel: string;
  rationale: string;
  moduleData: Omit<TrainingModule, 'completed'>;
}

export interface BrainstormIdea {
  id: string;
  text: string;
  targetModuleId: string;
  status: 'pendente' | 'incorporado';
  createdAt: string;
}
