import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';

interface OrderRow {
  id: number;
  cliente: string;
  valor: number;
  origem: 'confirmado' | 'pendente';
}

const INITIAL_COMMITTED: OrderRow[] = [
  { id: 101, cliente: 'Empresa Alfa', valor: 1200, origem: 'confirmado' },
  { id: 102, cliente: 'Industria Gama', valor: 2550, origem: 'confirmado' },
];

export const TransactionSimulator: React.FC = () => {
  const [activeSim, setActiveSim] = useState<'transacao' | 'trigger'>('transacao');

  // Simulator 1: DDL vs DML Transaction State
  const [committedRows, setCommittedRows] = useState<OrderRow[]>(INITIAL_COMMITTED);
  const [workingRows, setWorkingRows] = useState<OrderRow[]>(INITIAL_COMMITTED);
  const [backupCreated, setBackupCreated] = useState(false);
  const [rollbackOnLogoff, setRollbackOnLogoff] = useState(true);
  const [txLog, setTxLog] = useState<
    { id: number; cmd: string; kind: 'DML' | 'DDL' | 'TCL' | 'IDE'; outcome: string }[]
  >([
    {
      id: 1,
      cmd: 'Sessão iniciada como USR_TREINAMENTO em XEPDB1',
      kind: 'IDE',
      outcome: 'Nenhuma transação pendente. Dados sincronizados com os datafiles.',
    },
  ]);

  const hasPendingDml = JSON.stringify(committedRows) !== JSON.stringify(workingRows);

  const appendLog = (cmd: string, kind: 'DML' | 'DDL' | 'TCL' | 'IDE', outcome: string) => {
    setTxLog((prev) => [{ id: Date.now() + Math.random(), cmd, kind, outcome }, ...prev.slice(0, 7)]);
  };

  const handleInsertDml = () => {
    const nextId = workingRows.length > 0 ? Math.max(...workingRows.map((r) => r.id)) + 1 : 101;
    const newRow: OrderRow = {
      id: nextId,
      cliente: `Cliente Novo #${nextId}`,
      valor: 890,
      origem: 'pendente',
    };
    setWorkingRows((prev) => [...prev, newRow]);
    appendLog(
      `INSERT INTO pedidos VALUES (${nextId}, 'Cliente Novo', 890);`,
      'DML',
      'Linha gravada apenas na sessão atual (Undo/Buffer). Outros usuários ainda NÃO enxergam.'
    );
  };

  const handleUpdateDml = () => {
    if (workingRows.length === 0) return;
    setWorkingRows((prev) =>
      prev.map((row, idx) =>
        idx === 0 ? { ...row, valor: row.valor + 300, origem: 'pendente' } : row
      )
    );
    appendLog(
      `UPDATE pedidos SET valor = valor + 300 WHERE id_pedido = ${workingRows[0].id};`,
      'DML',
      'Alteração pendente de COMMIT. Pode ser desfeita com ROLLBACK.'
    );
  };

  const handleDeleteAllDml = () => {
    if (workingRows.length === 0) return;
    setWorkingRows([]);
    appendLog(
      'DELETE FROM pedidos; -- (Sem WHERE por acidente!)',
      'DML',
      'Atenção: 0 linhas visíveis na sessão, mas os dados continuam salvos no Undo até COMMIT ou DDL!'
    );
  };

  const handleExplicitCommit = () => {
    const clean = workingRows.map((r) => ({ ...r, origem: 'confirmado' as const }));
    setCommittedRows(clean);
    setWorkingRows(clean);
    appendLog(
      'COMMIT;',
      'TCL',
      'Transação efetivada permanentemente no banco. ROLLBACK não surte mais efeito.'
    );
  };

  const handleExplicitRollback = () => {
    if (!hasPendingDml) {
      appendLog(
        'ROLLBACK;',
        'TCL',
        'Nada a desfazer! As alterações anteriores já haviam sofrido COMMIT explícito ou implícito.'
      );
      return;
    }
    setWorkingRows(committedRows);
    appendLog(
      'ROLLBACK;',
      'TCL',
      'Transação revertida! O estado da sessão voltou exatamente ao último ponto confirmado.'
    );
  };

  const handleRunDdlCtas = () => {
    const clean = workingRows.map((r) => ({ ...r, origem: 'confirmado' as const }));
    const hadPending = hasPendingDml;
    setCommittedRows(clean);
    setWorkingRows(clean);
    setBackupCreated(true);
    appendLog(
      'CREATE TABLE bkp_pedidos AS SELECT * FROM pedidos;',
      'DDL',
      hadPending
        ? 'COMMIT IMPLÍCITO DISPARADO! O comando DDL confirmou automaticamente todas as alterações DML pendentes antes de criar a tabela!'
        : 'Tabela bkp_pedidos criada via DDL (COMMIT implícito executado antes e depois).'
    );
  };

  const handleSimulateLogoff = () => {
    if (!hasPendingDml) {
      appendLog(
        'Fechar PL/SQL Developer (Logoff)',
        'IDE',
        'Sessão encerrada sem transações pendentes.'
      );
      return;
    }
    if (rollbackOnLogoff) {
      setWorkingRows(committedRows);
      appendLog(
        'Logoff no PL/SQL Developer (Preferência: Rollback ativa)',
        'IDE',
        'Salvo pela configuração! O PL/SQL Developer executou ROLLBACK automático ao desconectar.'
      );
    } else {
      const clean = workingRows.map((r) => ({ ...r, origem: 'confirmado' as const }));
      setCommittedRows(clean);
      setWorkingRows(clean);
      appendLog(
        'Logoff no PL/SQL Developer (Sem Rollback on Logoff!)',
        'IDE',
        'Prática Não Recomendada: As alterações pendentes sofreram COMMIT automático ao encerrar a sessão!'
      );
    }
  };

  const resetTransactionSim = () => {
    setCommittedRows(INITIAL_COMMITTED);
    setWorkingRows(INITIAL_COMMITTED);
    setBackupCreated(false);
    setTxLog([
      {
        id: 1,
        cmd: 'Ambiente reiniciado para nova demonstração',
        kind: 'IDE',
        outcome: 'Tabelas restauradas para os 2 pedidos originais.',
      },
    ]);
  };

  // Simulator 2: Trigger Timing (:OLD vs :NEW & Mutating Table)
  const [trgTiming, setTrgTiming] = useState<'BEFORE' | 'AFTER'>('BEFORE');
  const [trgEvent, setTrgEvent] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('UPDATE');
  const [trgRowLevel, setTrgRowLevel] = useState(true);
  const [queriesSameTable, setQueriesSameTable] = useState(false);

  const isMutatingError = trgRowLevel && queriesSameTable && (trgEvent === 'UPDATE' || trgEvent === 'DELETE');
  const oldVal = trgEvent === 'INSERT' ? 'NULL (não existia)' : '1200.00';
  const newVal = trgEvent === 'DELETE' ? 'NULL (será removido)' : trgEvent === 'INSERT' ? '1750.00' : '1990.00';
  const canEditNew = trgTiming === 'BEFORE' && trgRowLevel && trgEvent !== 'DELETE';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <p className="text-xs text-slate-400">
            Laboratório Visual para Projetor · Demonstração ao Vivo para Iniciantes
          </p>
          <h2 className="text-2xl font-semibold text-white mt-1">
            Simulador de Comportamento do Motor Oracle
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveSim('transacao')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSim === 'transacao'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Transações: DDL vs DML
          </button>
          <button
            type="button"
            onClick={() => setActiveSim('trigger')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSim === 'trigger'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Ciclo de Triggers &amp; ORA-04091
          </button>
        </div>
      </div>

      {activeSim === 'transacao' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Interactive Stage (7 cols) */}
          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Comparativo Visual: Sua Sessão vs Dados Confirmados no Disco
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Execute um DELETE sem querer, depois clique em DDL (CREATE TABLE) e tente dar ROLLBACK para provar o commit implícito.
                </p>
              </div>
              <button
                type="button"
                onClick={resetTransactionSim}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Bancada</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Working Session */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Visão da Sua Sessão (SQL Window)
                  </span>
                  <span className={hasPendingDml ? 'text-amber-300 font-medium' : 'text-emerald-400 font-medium'}>
                    {hasPendingDml ? 'Transação Aberta' : 'Sincronizado'}
                  </span>
                </div>
                <table className="w-full text-xs border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-3 text-left font-medium">ID</th>
                      <th className="py-2 px-3 text-left font-medium">Cliente</th>
                      <th className="py-2 px-3 text-right font-medium">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 tabular-nums">
                    {workingRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 px-3 text-center text-rose-300">
                          0 linhas visíveis na sessão (DELETE executado)
                        </td>
                      </tr>
                    ) : (
                      workingRows.map((row) => (
                        <tr key={row.id} className={row.origem === 'pendente' ? 'bg-amber-500/10' : ''}>
                          <td className="py-2 px-3 font-mono text-slate-200">{row.id}</td>
                          <td className="py-2 px-3 text-slate-200">
                            {row.cliente}
                            {row.origem === 'pendente' ? ' *' : ''}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-200">
                            {row.valor.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Committed Datafile */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Dados Efetivados (Outras Sessões)
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {committedRows.length} registro(s) · {backupCreated ? 'BKP criado' : 'Sem BKP'}
                  </span>
                </div>
                <table className="w-full text-xs border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-3 text-left font-medium">ID</th>
                      <th className="py-2 px-3 text-left font-medium">Cliente</th>
                      <th className="py-2 px-3 text-right font-medium">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 tabular-nums">
                    {committedRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 px-3 text-center text-rose-400 font-medium">
                          TABELA VAZIA DEFINITIVAMENTE (Commitada!)
                        </td>
                      </tr>
                    ) : (
                      committedRows.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 px-3 font-mono text-slate-300">{row.id}</td>
                          <td className="py-2 px-3 text-slate-300">{row.cliente}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-300">
                            {row.valor.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Event Log */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Histórico de Execução da Sessão
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto custom-scroll pr-1">
                {txLog.map((item) => (
                  <div
                    key={item.id}
                    className="py-2 px-3 rounded-md bg-[#0B0F19] border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-slate-100 font-mono truncate">{item.cmd}</code>
                      <span className="text-slate-400 shrink-0 font-mono">{item.kind}</span>
                    </div>
                    <p
                      className={
                        item.kind === 'DDL'
                          ? 'text-amber-300'
                          : item.outcome.includes('Prática Não Recomendada')
                          ? 'text-rose-300'
                          : 'text-slate-400'
                      }
                    >
                      {item.outcome}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Control Deck (5 cols) */}
          <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Passo 1 · Disparar Comandos DML (Transacionais)
              </h3>
              <p className="text-xs text-slate-400">
                Alteram apenas a visão da sua sessão até que ocorra um COMMIT ou ROLLBACK.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleInsertDml}
                  className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap"
                >
                  + INSERT Linha
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDml}
                  className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap"
                >
                  UPDATE +R$300
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAllDml}
                  className="px-3 py-2 text-xs font-medium bg-rose-950/70 hover:bg-rose-900/70 text-rose-200 border border-rose-800/60 rounded-md transition-colors whitespace-nowrap"
                >
                  DELETE Sem WHERE
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h3 className="text-sm font-semibold text-amber-300">
                Passo 2 · Testar DDL (Gera Commit Implícito!)
              </h3>
              <p className="text-xs text-slate-400">
                Qualquer CREATE, ALTER, DROP ou TRUNCATE executa um COMMIT invisível antes de criar o objeto.
              </p>
              <button
                type="button"
                onClick={handleRunDdlCtas}
                className="w-full px-4 py-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-md transition-colors whitespace-nowrap"
              >
                Executar DDL: CREATE TABLE bkp_pedidos AS SELECT...
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Passo 3 · Controle de Transação Explícito (TCL)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExplicitCommit}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap"
                >
                  Executar COMMIT
                </button>
                <button
                  type="button"
                  onClick={handleExplicitRollback}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap"
                >
                  Executar ROLLBACK
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Passo 4 · Simular Fechamento do PL/SQL Developer
                  </h3>
                  <p className="text-xs text-slate-400">
                    Demonstra a preferência Rollback on Logoff do Módulo 1.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={rollbackOnLogoff}
                    onChange={(e) => setRollbackOnLogoff(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                  />
                  <span>Rollback no Logoff</span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleSimulateLogoff}
                className="w-full px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                Simular Desconexão / Fechar IDE Agora
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Trigger Inspector Left Stage (7 cols) */}
          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-5">
            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                Matriz de Estado em Tempo de Execução (:OLD vs :NEW)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere os parâmetros ao lado para demonstrar à turma quais pseudo-registros estão preenchidos e quando o erro ORA-04091 estoura.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Valor de :OLD.valor</div>
                <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                  {trgRowLevel ? oldVal : 'Indisponível (Sem FOR EACH ROW)'}
                </div>
              </div>

              <div className="p-3.5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Valor de :NEW.valor</div>
                <div className="text-sm font-mono font-semibold text-emerald-300 tabular-nums">
                  {trgRowLevel ? newVal : 'Indisponível (Sem FOR EACH ROW)'}
                </div>
              </div>

              <div className="p-3.5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Permite alterar :NEW?</div>
                <div className="text-sm font-semibold">
                  {canEditNew ? (
                    <span className="text-emerald-400">Sim (Ideal p/ padronizar)</span>
                  ) : (
                    <span className="text-amber-300">
                      Não {trgTiming === 'AFTER' ? '(ORA-04084)' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isMutatingError ? (
              <div className="p-4 rounded-md bg-rose-950/40 border border-rose-800/70 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Erro Disparado: ORA-04091 (Tabela Mutante!)</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                  ORA-04091: table USR_TREINAMENTO.PEDIDOS is mutating, trigger/function may not see it
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Explicação para a turma:</strong> Como a trigger possui{' '}
                  <code>FOR EACH ROW</code>, a tabela <code>PEDIDOS</code> está no meio da alteração linha a linha. Fazer um <code>SELECT</code> nela mesma leria dados inconsistentes. Solução: remover <code>FOR EACH ROW</code> (nível de instrução) ou usar <code>COMPOUND TRIGGER</code>.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-md bg-emerald-950/30 border border-emerald-800/50 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Execução Válida no Motor Oracle</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {trgTiming === 'BEFORE'
                    ? 'Uso recomendado: validar regras de negócio (RAISE_APPLICATION_ERROR) e normalizar campos em :NEW antes de gravar no bloco.'
                    : 'Uso recomendado: gravar rastro de auditoria em uma tabela separada (ex: AUDITORIA_PEDIDOS) após confirmação de integridade da linha.'}
                </p>
              </div>
            )}

            <pre className="p-4 rounded-md bg-[#0B0F19] border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
              <code>{`CREATE OR REPLACE TRIGGER trg_pedidos_simulada
${trgTiming} ${trgEvent} ON pedidos
${trgRowLevel ? 'FOR EACH ROW\n' : ''}DECLARE
    v_qtd NUMBER;
BEGIN
${
  queriesSameTable
    ? '    -- Consulta à própria tabela que disparou o gatilho:\n    SELECT COUNT(1) INTO v_qtd FROM pedidos;\n'
    : trgTiming === 'BEFORE' && trgRowLevel && trgEvent !== 'DELETE'
    ? '    -- Manipulação direta antes de gravar:\n    :NEW.status_pedido := UPPER(TRIM(:NEW.status_pedido));\n'
    : '    -- Registro externo de auditoria:\n    INSERT INTO auditoria_pedidos (acao, data_evento) VALUES (\'' +
      trgEvent +
      '\', SYSDATE);\n'
}END;
/`}</code>
            </pre>
          </div>

          {/* Right Controls for Trigger Simulator (5 cols) */}
          <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                1. Momento do Disparo (Timing)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['BEFORE', 'AFTER'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrgTiming(t)}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      trgTiming === t
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                2. Operação DML Disparadora
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['INSERT', 'UPDATE', 'DELETE'] as const).map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => setTrgEvent(ev)}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      trgEvent === ev
                        ? 'bg-slate-700 text-white border border-slate-600'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trgRowLevel}
                  onChange={(e) => setTrgRowLevel(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-xs text-slate-200">
                  <strong>FOR EACH ROW (Nível de Linha)</strong>
                  <span className="block text-slate-400 mt-0.5">
                    Dispara uma vez para cada registro afetado e libera acesso a :OLD e :NEW.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={queriesSameTable}
                  onChange={(e) => setQueriesSameTable(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-xs text-slate-200">
                  <strong>Fazer SELECT na própria tabela PEDIDOS dentro da Trigger</strong>
                  <span className="block text-slate-400 mt-0.5">
                    Marque com UPDATE ou DELETE + FOR EACH ROW para simular o erro clássico de Tabela Mutante (ORA-04091).
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
