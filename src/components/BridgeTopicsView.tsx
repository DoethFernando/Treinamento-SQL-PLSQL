import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { BridgeSuggestion, TrainingModule } from '../types/training';
import { CodeBlock } from './CodeBlock';

interface BridgeTopicsViewProps {
  suggestions: BridgeSuggestion[];
  modules: TrainingModule[];
  onAddSuggestion: (suggestion: BridgeSuggestion) => void;
  onRemoveModule: (moduleId: string) => void;
  onCopySuccess: (msg: string) => void;
}

export const BridgeTopicsView: React.FC<BridgeTopicsViewProps> = ({
  suggestions,
  modules,
  onAddSuggestion,
  onRemoveModule,
  onCopySuccess,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(suggestions[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-800">
        <p className="text-xs text-slate-400">
          Sugestões Didáticas Opcionais · Conectam um Módulo ao Seguinte com 1 Clique
        </p>
        <h2 className="text-2xl font-semibold text-white mt-1">
          Temas de Ligação Sugeridos para o Roteiro
        </h2>
        <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Cada sugestão abaixo já possui resumo conceitual, exemplo prático, scripts separados e exercício com gabarito. Ao clicar em{' '}
          <strong className="text-white">Incorporar ao Roteiro</strong>, o tópico entra automaticamente na posição ideal da barra lateral e recalcula a carga horária total.
        </p>
      </div>

      <div className="space-y-4">
        {suggestions.map((sug) => {
          const isAlreadyAdded = modules.some((m) => m.id === sug.moduleData.id);
          const isExpanded = expandedId === sug.id;

          return (
            <div
              key={sug.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden"
            >
              <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="text-rose-300 font-medium">{sug.connectsLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">+{sug.moduleData.durationMinutes} min</span>
                    <span aria-hidden="true">·</span>
                    <span>{sug.moduleData.category}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {sug.moduleData.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{sug.rationale}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : sug.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{isExpanded ? 'Ocultar Prévia' : 'Espiar Conteúdo'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isAlreadyAdded ? (
                    <button
                      type="button"
                      onClick={() => onRemoveModule(sug.moduleData.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-rose-950/60 hover:text-rose-200 border border-emerald-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Incorporado (Remover)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddSuggestion(sug)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Incorporar ao Roteiro</span>
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-4 border-t border-slate-800 space-y-4 bg-[#0B0F19]/60">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-300">
                      Conceito Resumido
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {sug.moduleData.conceptSummary}
                    </p>
                  </div>

                  <CodeBlock
                    title={`Exemplo: ${sug.moduleData.usageExample.title}`}
                    subtitle={sug.moduleData.usageExample.explanation}
                    code={sug.moduleData.usageExample.sql}
                    onCopySuccess={onCopySuccess}
                  />

                  <CodeBlock
                    title={`Atividade & Gabarito: ${sug.moduleData.exercise.title}`}
                    subtitle={sug.moduleData.exercise.scenario}
                    code={sug.moduleData.exercise.solutionSql}
                    onCopySuccess={onCopySuccess}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
