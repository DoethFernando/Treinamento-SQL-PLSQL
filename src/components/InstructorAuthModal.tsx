import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, X } from 'lucide-react';

interface InstructorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InstructorAuthModal({
  isOpen,
  onClose,
  onSuccess,
}: InstructorAuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === '20261107') {
      try {
        sessionStorage.setItem('oracle_instructor_auth_v2', 'true');
      } catch {
        // ignore
      }
      setError(null);
      onSuccess();
      onClose();
    } else {
      setError('Senha incorreta. Acesso restrito apenas ao instrutor.');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-base font-bold text-white tracking-tight"
              >
                Acesso ao Modo Instrutor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Área reservada para gerenciamento do treinamento
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="instructor-pwd"
              className="block text-xs font-medium text-slate-200"
            >
              Senha do Instrutor
            </label>
            <div className="relative">
              <input
                id="instructor-pwd"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Digite a senha de acesso"
                autoComplete="current-password"
                className="w-full pl-3 pr-10 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/60 focus:border-rose-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 font-medium mt-1 animate-in fade-in duration-150">
                {error}
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            A senha permite alternar da <strong>Visão do Participante</strong> para o painel completo do apresentador (com edição de módulos, reordenação de blocos, simulador de transações e ideias de brainstorm).
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar (Continuar como Participante)
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-md shadow-rose-900/20"
            >
              Desbloquear Modo Instrutor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
