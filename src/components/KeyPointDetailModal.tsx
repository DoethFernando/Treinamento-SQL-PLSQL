import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Edit3,
  HelpCircle,
  Layers,
  Plus,
  Save,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { KeyPointItem } from '../types/training';

interface KeyPointDetailModalProps {
  isOpen: boolean;
  item: KeyPointItem | null;
  moduleTitle?: string;
  isInstructor?: boolean;
  onClose: () => void;
  onCopySuccess?: (msg: string) => void;
  onSaveItem?: (updatedItem: KeyPointItem) => void;
}

export const KeyPointDetailModal: React.FC<KeyPointDetailModalProps> = ({
  isOpen,
  item,
  moduleTitle,
  isInstructor = false,
  onClose,
  onCopySuccess,
  onSaveItem,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable Form State
  const [editTitle, setEditTitle] = useState('');
  const [editSyntax, setEditSyntax] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editBreakdownTitle, setEditBreakdownTitle] = useState('');
  const [editBreakdownItems, setEditBreakdownItems] = useState<
    Array<{ label: string; description: string; code?: string }>
  >([]);
  const [editCodeExample, setEditCodeExample] = useState('');
  const [editGotchasText, setEditGotchasText] = useState('');

  // Sync state whenever selected item changes or opens
  useEffect(() => {
    if (item) {
      setEditTitle(item.title || '');
      setEditSyntax(item.pathOrSyntax || '');
      setEditPurpose(item.deepDive?.purpose || item.detail || '');
      setEditBreakdownTitle(item.deepDive?.breakdownTitle || 'Detalhamento dos Elementos e Variações');
      setEditBreakdownItems(item.deepDive?.breakdownItems ? [...item.deepDive.breakdownItems] : []);
      setEditCodeExample(item.deepDive?.codeExample || item.pathOrSyntax || '');
      setEditGotchasText(item.deepDive?.productionGotchas?.join('\n') || '');
      setIsEditing(false);
    }
  }, [item, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing, onClose]);

  if (!isOpen || !item) return null;

  const deep = item.deepDive;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopySuccess?.('Comando copiado para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      onCopySuccess?.('Comando copiado para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    const parsedGotchas = editGotchasText
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean);

    const updated: KeyPointItem = {
      title: editTitle.trim() || item.title,
      pathOrSyntax: editSyntax.trim(),
      detail: editPurpose.trim() || item.detail,
      deepDive: {
        purpose: editPurpose.trim(),
        breakdownTitle: editBreakdownTitle.trim(),
        breakdownItems: editBreakdownItems.filter((bi) => bi.label.trim() || bi.description.trim()),
        codeExample: editCodeExample.trim(),
        productionGotchas: parsedGotchas,
      },
    };

    onSaveItem?.(updated);
    setIsEditing(false);
  };

  const handleAddBreakdownItem = () => {
    setEditBreakdownItems((prev) => [
      ...prev,
      { label: 'Novo Elemento / Privilégio', description: 'Explicação detalhada deste item...', code: '' },
    ]);
  };

  const handleRemoveBreakdownItem = (idx: number) => {
    setEditBreakdownItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateBreakdownItem = (
    idx: number,
    field: 'label' | 'description' | 'code',
    value: string
  ) => {
    setEditBreakdownItems((prev) =>
      prev.map((bi, i) => (i === idx ? { ...bi, [field]: value } : bi))
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-keypoint-title"
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-700/80 bg-[#0E1424] shadow-2xl overflow-hidden my-6 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-rose-400 font-medium">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Editando Bloco Didático' : 'Explicação Detalhada do Conceito'}</span>
              {moduleTitle && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400 truncate">{moduleTitle}</span>
                </>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Título do Bloco
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white font-semibold focus:outline-none focus:border-rose-500"
                    placeholder="Ex: Configuração e Para Que Serve o TNSNAMES.ORA"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Caminho ou Sintaxe em Destaque
                  </label>
                  <input
                    type="text"
                    value={editSyntax}
                    onChange={(e) => setEditSyntax(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1 text-xs text-emerald-400 font-mono focus:outline-none focus:border-rose-500"
                    placeholder="Ex: %ORACLE_HOME%\network\admin\tnsnames.ora"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 id="modal-keypoint-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {item.title}
                </h2>
                {item.pathOrSyntax && (
                  <p className="text-xs font-mono text-emerald-400 bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded inline-block mt-1">
                    {item.pathOrSyntax}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstructor && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-md transition-colors whitespace-nowrap"
                title="Editar textos, comandos e explicações deste bloco"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Detalhes</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scroll text-slate-200 text-sm leading-relaxed">
          {isEditing ? (
            /* ================= EDIT MODE ================= */
            <div className="space-y-6">
              {/* Field 1: Finalidade & Conceito */}
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-rose-300 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4 text-rose-400" />
                  <span>Finalidade &amp; O que há por trás</span>
                </label>
                <textarea
                  rows={4}
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-sm text-slate-100 focus:outline-none focus:border-rose-500 leading-relaxed custom-scroll"
                  placeholder="Explique a finalidade didática e o motivo deste recurso..."
                />
              </div>

              {/* Field 2: Breakdown Items */}
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span>Itens de Detalhamento / Funcionamento</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddBreakdownItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Item</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Título da Seção de Detalhamento</label>
                  <input
                    type="text"
                    value={editBreakdownTitle}
                    onChange={(e) => setEditBreakdownTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    placeholder="Ex: Detalhamento dos Elementos e Variações"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {editBreakdownItems.map((bi, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-slate-700/80 bg-[#0B0F19] space-y-2 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Item #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakdownItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          title="Remover este item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase">Nome / Rótulo</label>
                          <input
                            type="text"
                            value={bi.label}
                            onChange={(e) => handleUpdateBreakdownItem(idx, 'label', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-500"
                            placeholder="Ex: GRANT CONNECT"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase">Comando / Código (opcional)</label>
                          <input
                            type="text"
                            value={bi.code || ''}
                            onChange={(e) => handleUpdateBreakdownItem(idx, 'code', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-emerald-400 focus:outline-none focus:border-rose-500"
                            placeholder="Ex: GRANT CONNECT TO user;"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase">Explicação / Descrição</label>
                        <textarea
                          rows={2}
                          value={bi.description}
                          onChange={(e) => handleUpdateBreakdownItem(idx, 'description', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                          placeholder="Explicação didática deste item..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Field 3: Exemplo Prático de Código / Sintaxe */}
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span>Exemplo Prático de Código / Scripts SQL</span>
                </label>
                <textarea
                  rows={6}
                  value={editCodeExample}
                  onChange={(e) => setEditCodeExample(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-rose-500 leading-relaxed custom-scroll"
                  placeholder="Cole aqui o script SQL ou comandos de exemplo..."
                />
              </div>

              {/* Field 4: Pontos de Atenção / Boas Práticas (Gotchas) */}
              <div className="space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Pontos de Atenção, Boas Práticas &amp; Riscos (1 por linha)</span>
                </label>
                <textarea
                  rows={3}
                  value={editGotchasText}
                  onChange={(e) => setEditGotchasText(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-900/60 rounded-md p-3 text-xs text-amber-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                  placeholder="Digite cada alerta ou dica de produção em uma linha separada..."
                />
              </div>
            </div>
          ) : (
            /* ================= VIEW MODE ================= */
            <>
              {/* Section 1: Finalidade / Para que serve */}
              <div className="space-y-2.5 rounded-lg border border-slate-800/90 bg-slate-900/50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4 text-rose-400" />
                  <span>Qual a Finalidade &amp; O que há por trás</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {deep?.purpose || item.detail}
                </p>
              </div>

              {/* Section 2: Detalhamento Item a Item */}
              {deep?.breakdownItems && deep.breakdownItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span>{deep.breakdownTitle || 'Detalhamento dos Elementos e Variações'}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {deep.breakdownItems.map((bi, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F19] space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-white text-xs sm:text-sm">
                            {bi.label}
                          </span>
                          {bi.code && (
                            <code className="text-[11px] font-mono text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {bi.code}
                            </code>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                          {bi.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Exemplo Prático de Código / Sintaxe */}
              {(deep?.codeExample || item.pathOrSyntax) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <Terminal className="w-4 h-4 text-slate-400" />
                      <span>Comandos Recomendados no Oracle</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(deep?.codeExample || item.pathOrSyntax || '')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar Sintaxe</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed custom-scroll">
                    <code>{deep?.codeExample || item.pathOrSyntax}</code>
                  </pre>
                </div>
              )}

              {/* Section 4: Erros Comuns & Cuidados em Produção */}
              {deep?.productionGotchas && deep.productionGotchas.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Atenção em Produção &amp; Práticas Recomendadas</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-200/90 list-disc list-inside leading-relaxed">
                    {deep.productionGotchas.map((gotcha, idx) => (
                      <li key={idx}>{gotcha}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/70 text-xs text-slate-400">
          {isEditing ? (
            <>
              <span className="text-slate-400 text-xs">
                As alterações serão salvas e sincronizadas imediatamente.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <span>Dica: Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">ESC</kbd> para fechar</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
              >
                Entendido
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
