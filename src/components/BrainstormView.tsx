import React, { useState } from 'react';
import { ArrowRight, Check, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { BrainstormIdea, TrainingModule } from '../types/training';

interface BrainstormViewProps {
  ideas: BrainstormIdea[];
  modules: TrainingModule[];
  scratchpad: string;
  lastSavedAt: string;
  onScratchpadChange: (val: string) => void;
  onAddIdea: (text: string, targetModuleId: string) => void;
  onToggleIdeaStatus: (id: string) => void;
  onDeleteIdea: (id: string) => void;
  onConvertIdeaToModule: (idea: BrainstormIdea) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onResetDefaults: () => void;
}

export const BrainstormView: React.FC<BrainstormViewProps> = ({
  ideas,
  modules,
  scratchpad,
  lastSavedAt,
  onScratchpadChange,
  onAddIdea,
  onToggleIdeaStatus,
  onDeleteIdea,
  onConvertIdeaToModule,
  onExportBackup,
  onImportBackup,
  onResetDefaults,
}) => {
  const [newIdeaText, setNewIdeaText] = useState('');
  const [targetMod, setTargetMod] = useState<string>(modules[0]?.id ?? 'geral');
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaText.trim()) return;
    onAddIdea(newIdeaText.trim(), targetMod);
    setNewIdeaText('');
  };

  const getModuleName = (id: string) => {
    if (id === 'geral') return 'Roteiro Geral';
    const found = modules.find((m) => m.id === id);
    return found ? found.shortTitle : 'Roteiro Geral';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <p className="text-xs text-slate-400">
            Edição Contínua Aberta até 06/11 · Salvamento Automático no Navegador
          </p>
          <h2 className="text-2xl font-semibold text-white mt-1">
            Bancada de Brainstorm e Evolução do Roteiro
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Roteiro (.json)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            <span>Importar (.json)</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportBackup(file);
                  e.target.value = '';
                }
              }}
            />
          </label>

          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onResetDefaults();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Confirmar Restauração
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-900 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Structured Backlog linked to modules (7 cols) */}
        <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              Fila de Lembretes e Tópicos por Módulo
            </h3>
            <p className="text-xs text-slate-400">
              Vincule ideias aos módulos existentes (elas aparecem direto na tela daquele módulo durante a aula!) ou transforme uma ideia em um novo módulo completo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="new-idea-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Nova ideia, exemplo ou observação para a aula
                </label>
                <input
                  id="new-idea-input"
                  type="text"
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  placeholder="Ex: Mostrar diferença entre UNION e UNION ALL..."
                  className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label htmlFor="idea-module-select" className="block text-xs font-medium text-slate-300 mb-1">
                  Módulo relacionado
                </label>
                <select
                  id="idea-module-select"
                  value={targetMod}
                  onChange={(e) => setTargetMod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="geral">Roteiro Geral</option>
                  {modules.map((m, idx) => (
                    <option key={m.id} value={m.id}>
                      {String(idx + 1).padStart(2, '0')}. {m.shortTitle}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Lembrete</span>
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-800 border-t border-slate-800">
            {ideas.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhuma ideia pendente cadastrada. Adicione acima conforme for lembrando de exemplos até 06/11.
              </div>
            ) : (
              ideas.map((idea) => (
                <div key={idea.id} className="py-3.5 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-slate-200 font-semibold">
                        {getModuleName(idea.targetModuleId)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{idea.createdAt}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          idea.status === 'incorporado'
                            ? 'text-emerald-400 font-medium'
                            : 'text-amber-300 font-medium'
                        }
                      >
                        {idea.status === 'incorporado' ? '✓ Incorporado no Roteiro' : 'Pendente'}
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        idea.status === 'incorporado'
                          ? 'text-slate-300'
                          : 'text-slate-100 font-medium'
                      }`}
                    >
                      {idea.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleIdeaStatus(idea.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                      title="Alternar status"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{idea.status === 'incorporado' ? 'Reabrir' : 'Concluir'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onConvertIdeaToModule(idea)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-200 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 rounded-md transition-colors whitespace-nowrap shrink-0"
                      title="Transformar esta ideia em um módulo completo do roteiro"
                    >
                      <span>Virar Módulo</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteIdea(idea.id)}
                      aria-label="Excluir ideia"
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Freeform Scratchpad (5 cols) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">
                Bloco Livre de Rascunhos (Scratchpad)
              </h3>
              <p className="text-xs text-slate-400">
                Para colar queries soltas, dúvidas da equipe ou anotações rápidas.
              </p>
            </div>
          </div>

          <textarea
            rows={15}
            value={scratchpad}
            onChange={(e) => onScratchpadChange(e.target.value)}
            placeholder="- Anote pontos de atenção, perguntas frequentes ou queries extras até 06/11..."
            className="w-full bg-[#0B0F19] border border-slate-800 rounded-md p-3.5 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-rose-500 resize-y"
          />

          <div className="flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>Salvo automaticamente ({lastSavedAt})</span>
            <span>Persistência local ativa</span>
          </div>
        </div>
      </div>
    </div>
  );
};
