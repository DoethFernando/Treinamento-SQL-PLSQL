import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { TrainingModule } from '../types/training';

interface ModuleEditorModalProps {
  isOpen: boolean;
  initialModule?: TrainingModule | null;
  prefillTitle?: string;
  onClose: () => void;
  onSave: (mod: TrainingModule, isNew: boolean) => void;
}

export const ModuleEditorModal: React.FC<ModuleEditorModalProps> = ({
  isOpen,
  initialModule,
  prefillTitle,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialModule);

  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [category, setCategory] = useState('Complemento Prático');
  const [conceptSummary, setConceptSummary] = useState('');
  const [keyPointsRaw, setKeyPointsRaw] = useState('');
  const [exampleTitle, setExampleTitle] = useState('');
  const [exampleExplanation, setExampleExplanation] = useState('');
  const [exampleSql, setExampleSql] = useState('');
  const [ddlScript, setDdlScript] = useState('');
  const [dmlScript, setDmlScript] = useState('');
  const [exerciseTitle, setExerciseTitle] = useState('');
  const [exerciseScenario, setExerciseScenario] = useState('');
  const [exerciseTasksRaw, setExerciseTasksRaw] = useState('');
  const [solutionSql, setSolutionSql] = useState('');
  const [tipsRaw, setTipsRaw] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (initialModule) {
      setTitle(initialModule.title);
      setShortTitle(initialModule.shortTitle);
      setDurationMinutes(initialModule.durationMinutes);
      setCategory(initialModule.category);
      setConceptSummary(initialModule.conceptSummary);
      setKeyPointsRaw(
        initialModule.keyPoints
          .map((kp) => `${kp.title} | ${kp.pathOrSyntax || ''} | ${kp.detail}`)
          .join('\n')
      );
      setExampleTitle(initialModule.usageExample.title);
      setExampleExplanation(initialModule.usageExample.explanation);
      setExampleSql(initialModule.usageExample.sql);
      setDdlScript(initialModule.ddlScript || '');
      setDmlScript(initialModule.dmlScript || '');
      setExerciseTitle(initialModule.exercise.title);
      setExerciseScenario(initialModule.exercise.scenario);
      setExerciseTasksRaw(initialModule.exercise.tasks.join('\n'));
      setSolutionSql(initialModule.exercise.solutionSql);
      setTipsRaw(initialModule.instructorTips.join('\n'));
    } else {
      setTitle(prefillTitle || '');
      setShortTitle(prefillTitle ? prefillTitle.slice(0, 26) : '');
      setDurationMinutes(10);
      setCategory('Complemento SQL / PL/SQL');
      setConceptSummary('');
      setKeyPointsRaw('Ponto Principal | Sintaxe ou Atalho | Explicação resumida para iniciantes');
      setExampleTitle('Exemplo Prático no Oracle 18c XE');
      setExampleExplanation('Demonstração direta do comando aplicado às tabelas do treinamento.');
      setExampleSql('-- Escreva aqui o SQL ou bloco PL/SQL de exemplo:\nSELECT * FROM clientes;');
      setDdlScript('');
      setDmlScript('');
      setExerciseTitle('Desafio Rápido em Sala');
      setExerciseScenario('Aplique o conceito estudado utilizando as tabelas clientes ou pedidos.');
      setExerciseTasksRaw('Executar a consulta ou rotina proposta\nConferir o resultado no Grid');
      setSolutionSql('-- Gabarito da atividade:\nSELECT * FROM pedidos;');
      setTipsRaw('Reserve 2 minutos para tirar dúvidas da turma após rodar o exemplo.');
    }
  }, [isOpen, initialModule, prefillTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedKeyPoints = keyPointsRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const existingKp = initialModule?.keyPoints.find((k) => k.title.toLowerCase() === parts[0].toLowerCase());
        if (parts.length >= 3) {
          return {
            title: parts[0],
            pathOrSyntax: parts[1] || undefined,
            detail: parts.slice(2).join(' | '),
            deepDive: existingKp?.deepDive,
          };
        }
        if (parts.length === 2) {
          return {
            title: parts[0],
            detail: parts[1],
            deepDive: existingKp?.deepDive,
          };
        }
        return {
          title: 'Ponto-Chave',
          detail: parts[0],
          deepDive: existingKp?.deepDive,
        };
      });

    const parsedTasks = exerciseTasksRaw
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const parsedTips = tipsRaw
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const savedModule: TrainingModule = {
      id: initialModule?.id || `mod-custom-${Date.now()}`,
      title: title.trim(),
      shortTitle: (shortTitle.trim() || title.trim()).slice(0, 32),
      durationMinutes: Math.max(5, Number(durationMinutes) || 10),
      category: category.trim() || 'Módulo Customizado',
      completed: initialModule?.completed ?? false,
      isCustom: initialModule?.isCustom ?? !isEditing,
      conceptSummary: conceptSummary.trim() || 'Conceito adicionado ao roteiro de treinamento.',
      keyPoints: parsedKeyPoints,
      usageExample: {
        title: exampleTitle.trim() || 'Exemplo Prático',
        explanation: exampleExplanation.trim(),
        sql: exampleSql,
      },
      ddlScript: ddlScript.trim() || undefined,
      dmlScript: dmlScript.trim() || undefined,
      exercise: {
        title: exerciseTitle.trim() || 'Atividade Prática',
        scenario: exerciseScenario.trim(),
        tasks: parsedTasks.length > 0 ? parsedTasks : ['Executar o exercício proposto em sala.'],
        solutionSql: solutionSql,
        notes: initialModule?.exercise.notes,
      },
      instructorTips: parsedTips,
    };

    onSave(savedModule, !isEditing);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-editor-title"
    >
      <div className="w-full max-w-3xl rounded-lg border border-slate-800 bg-[#0E1424] shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <h2 id="modal-editor-title" className="text-lg font-semibold text-white">
            {isEditing ? 'Editar Módulo do Roteiro' : 'Adicionar Novo Tópico ao Roteiro'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[78vh] overflow-y-auto custom-scroll"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título completo do módulo *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome curto (Menu lateral)
              </label>
              <input
                type="text"
                value={shortTitle}
                onChange={(e) => setShortTitle(e.target.value)}
                placeholder="Ex: Cursores & Loops"
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Minutos
              </label>
              <input
                type="number"
                min={5}
                max={90}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 tabular-nums focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Categoria temática
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título do Exemplo de Uso
              </label>
              <input
                type="text"
                value={exampleTitle}
                onChange={(e) => setExampleTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Conceito resumido por trás do estudo *
            </label>
            <textarea
              rows={3}
              required
              value={conceptSummary}
              onChange={(e) => setConceptSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Pontos-chave (1 por linha no formato: Título | Caminho ou Sintaxe | Explicação)
            </label>
            <textarea
              rows={3}
              value={keyPointsRaw}
              onChange={(e) => setKeyPointsRaw(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0B0F19] border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">
                Script DDL Separado (Opcional — Tabelas, Views, Triggers)
              </label>
              <textarea
                rows={5}
                value={ddlScript}
                onChange={(e) => setDdlScript(e.target.value)}
                placeholder="-- CREATE TABLE / CREATE VIEW / CREATE TRIGGER..."
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0F19] border border-slate-800 rounded-md text-emerald-300 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-emerald-300 mb-1">
                Script DML Separado (Opcional — INSERT / UPDATE de Carga)
              </label>
              <textarea
                rows={5}
                value={dmlScript}
                onChange={(e) => setDmlScript(e.target.value)}
                placeholder="-- INSERT INTO ... COMMIT;"
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0F19] border border-slate-800 rounded-md text-emerald-300 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Código SQL / PL/SQL do Exemplo de Uso
            </label>
            <textarea
              rows={4}
              value={exampleSql}
              onChange={(e) => setExampleSql(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0B0F19] border border-slate-800 rounded-md text-emerald-300 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Título da Atividade em Sala
                </label>
                <input
                  type="text"
                  value={exerciseTitle}
                  onChange={(e) => setExerciseTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Cenário da Atividade
                </label>
                <input
                  type="text"
                  value={exerciseScenario}
                  onChange={(e) => setExerciseScenario(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Passos da Atividade (1 tarefa por linha)
              </label>
              <textarea
                rows={3}
                value={exerciseTasksRaw}
                onChange={(e) => setExerciseTasksRaw(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Gabarito Comentado (SQL / PL/SQL)
              </label>
              <textarea
                rows={5}
                value={solutionSql}
                onChange={(e) => setSolutionSql(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0F19] border border-slate-800 rounded-md text-emerald-300 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Dicas de Apresentação para o Instrutor (1 por linha)
              </label>
              <textarea
                rows={2}
                value={tipsRaw}
                onChange={(e) => setTipsRaw(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0F19] border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap"
            >
              {isEditing ? 'Salvar Alterações' : 'Adicionar ao Roteiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
