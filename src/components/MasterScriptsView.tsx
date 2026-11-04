import React, { useMemo, useState } from 'react';
import { TrainingModule } from '../types/training';
import { CodeBlock } from './CodeBlock';

interface MasterScriptsViewProps {
  modules: TrainingModule[];
  onCopySuccess: (msg: string) => void;
}

export const MasterScriptsView: React.FC<MasterScriptsViewProps> = ({
  modules,
  onCopySuccess,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'ddl' | 'dml' | 'gabarito'>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('todos');

  const filteredModules = useMemo(() => {
    if (selectedModuleId === 'todos') return modules;
    return modules.filter((m) => m.id === selectedModuleId);
  }, [modules, selectedModuleId]);

  const consolidatedDdl = useMemo(() => {
    return filteredModules
      .filter((m) => m.ddlScript && m.ddlScript.trim().length > 0)
      .map(
        (m, i) =>
          `-- =====================================================================\n-- [${String(i).padStart(2, '0')}] ${m.title.toUpperCase()} (DDL)\n-- =====================================================================\n${m.ddlScript}`
      )
      .join('\n\n');
  }, [filteredModules]);

  const consolidatedDml = useMemo(() => {
    return filteredModules
      .filter((m) => m.dmlScript && m.dmlScript.trim().length > 0)
      .map(
        (m, i) =>
          `-- =====================================================================\n-- [${String(i).padStart(2, '0')}] ${m.title.toUpperCase()} (DML - POPULAÇÃO)\n-- =====================================================================\n${m.dmlScript}`
      )
      .join('\n\n');
  }, [filteredModules]);

  const consolidatedGabaritos = useMemo(() => {
    return filteredModules
      .map(
        (m, i) =>
          `-- =====================================================================\n-- [${String(i).padStart(2, '0')}] GABARITO: ${m.exercise.title.toUpperCase()}\n-- =====================================================================\n${m.exercise.solutionSql}`
      )
      .join('\n\n');
  }, [filteredModules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <p className="text-xs text-slate-400">
            Repositório Separado por Camada · Pronto para Execução no Oracle 18c XE
          </p>
          <h2 className="text-2xl font-semibold text-white mt-1">
            Scripts DDL, DML e Gabaritos Consolidados
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            aria-label="Filtrar por módulo"
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="todos">Todos os Módulos ({modules.length})</option>
            {modules.map((m, idx) => (
              <option key={m.id} value={m.id}>
                {String(idx).padStart(2, '0')}. {m.shortTitle}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Visão Geral' },
                { id: 'ddl', label: 'Somente DDL' },
                { id: 'dml', label: 'Somente DML' },
                { id: 'gabarito', label: 'Gabaritos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterType === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(filterType === 'all' || filterType === 'ddl') && consolidatedDdl && (
        <CodeBlock
          title="Script Consolidado DDL ( Criação de Usuários, Tabelas, Views, Rotinas e Triggers )"
          subtitle="Atenção: todo comando DDL executa COMMIT implícito"
          code={consolidatedDdl}
          filename="01_oracle18xe_estrutura_ddl.sql"
          onCopySuccess={onCopySuccess}
        />
      )}

      {(filterType === 'all' || filterType === 'dml') && consolidatedDml && (
        <CodeBlock
          title="Script Consolidado DML ( População Inicial e Massas de Teste )"
          subtitle="Inserções e atualizações acompanhadas de COMMIT explícito"
          code={consolidatedDml}
          filename="02_oracle18xe_populacao_dml.sql"
          onCopySuccess={onCopySuccess}
        />
      )}

      {(filterType === 'all' || filterType === 'gabarito') && consolidatedGabaritos && (
        <CodeBlock
          title="Caderno de Gabaritos das Atividades em Sala"
          subtitle="Soluções comentadas na ordem cronológica da apresentação"
          code={consolidatedGabaritos}
          filename="03_oracle18xe_gabaritos_aula.sql"
          onCopySuccess={onCopySuccess}
        />
      )}
    </div>
  );
};
