import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Check, Copy, HelpCircle, Layers, Terminal, X } from 'lucide-react';
import { KeyPointItem } from '../types/training';

interface KeyPointDetailModalProps {
  isOpen: boolean;
  item: KeyPointItem | null;
  moduleTitle?: string;
  onClose: () => void;
  onCopySuccess?: (msg: string) => void;
}

export const KeyPointDetailModal: React.FC<KeyPointDetailModalProps> = ({
  isOpen,
  item,
  moduleTitle,
  onClose,
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-rose-400 font-medium">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Explicação Detalhada do Conceito</span>
              {moduleTitle && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400">{moduleTitle}</span>
                </>
              )}
            </div>
            <h2 id="modal-keypoint-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {item.title}
            </h2>
            {item.pathOrSyntax && (
              <p className="text-xs font-mono text-emerald-400 bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded inline-block mt-1">
                {item.pathOrSyntax}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scroll text-slate-200 text-sm leading-relaxed">
          {/* Section 1: Finalidade / Para que serve */}
          <div className="space-y-2.5 rounded-lg border border-slate-800/90 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-rose-400" />
              <span>Qual a Finalidade &amp; O que há por trás</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {deep?.purpose || item.detail}
            </p>
          </div>

          {/* Section 2: Detalhamento Item a Item (Ex: cada GRANT, cada tipo de cota, etc) */}
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
                    <p className="text-xs text-slate-300 leading-relaxed">
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
                <span>Atenção em Produção &amp; Erros Típicos (Gotchas)</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-200/90 list-disc list-inside leading-relaxed">
                {deep.productionGotchas.map((gotcha, idx) => (
                  <li key={idx}>{gotcha}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/70 text-xs text-slate-400">
          <span>Dica: Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">ESC</kbd> para fechar</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
