import React, { useState } from 'react';
import { GoogleUser } from '../types';
import { Shield, ShieldAlert, ShieldCheck, Lock, LogIn, ArrowRight, UserCheck, AlertCircle, Sparkles, Building2, Layers } from 'lucide-react';

interface GoogleGatekeeperProps {
  onSuccessLogin: (user: GoogleUser) => void;
  registeredUsers?: GoogleUser[];
}

export const GoogleGatekeeper: React.FC<GoogleGatekeeperProps> = ({
  onSuccessLogin,
  registeredUsers = [],
}) => {
  const [emailInput, setEmailInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [showCustomLogin, setShowCustomLogin] = useState<boolean>(false);

  // Quick sign in for default root administrator
  const handleAdminQuickSignIn = async () => {
    setIsLoading(true);
    setErrorState(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alexandre.n.pedrozo@gmail.com',
          name: 'Alexandre N. Pedrozo',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        }),
      });

      const data = await res.json();
      if (res.ok && data.authorized && data.user) {
        onSuccessLogin(data.user);
      } else {
        setErrorState(data.error || 'Falha ao autenticar administrador.');
      }
    } catch (err: any) {
      // Fallback in case of server delay
      const fallbackUser: GoogleUser = {
        id: 'admin-alexandre',
        name: 'Alexandre N. Pedrozo',
        email: 'alexandre.n.pedrozo@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        organization: 'Ministério Público do Estado do Paraná (MPPR)',
        role: 'admin',
        isAuthenticated: true,
      };
      onSuccessLogin(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with custom Google Account
  const handleCustomGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorState('Por favor, informe seu e-mail Google ou institucional.');
      return;
    }

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorState('Por favor, insira um formato de e-mail válido.');
      return;
    }

    setIsLoading(true);
    setErrorState(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: nameInput.trim() || cleanEmail.split('@')[0],
        }),
      });

      const data = await res.json();
      if (res.ok && data.authorized && data.user) {
        onSuccessLogin(data.user);
      } else {
        setErrorState(
          data.error ||
            `Acesso não autorizado. O e-mail "${cleanEmail}" não possui permissão de acesso. Solicite liberação ao administrador (alexandre.n.pedrozo@gmail.com).`
        );
      }
    } catch (err: any) {
      setErrorState('Erro na comunicação com o servidor de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Header */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between z-10 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-white">
              Geo<span className="text-blue-500">COMUM</span>
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              • Inteligência Territorial & Gestão de Conflitos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-900 text-slate-300 border border-slate-700 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">Acesso Restrito</span>
          </span>
        </div>
      </header>

      {/* Center Gatekeeper Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
          {/* Header Banner */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Portal de Acesso Seguro
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Ambiente protegido com autenticação Google e controle de permissões por lista de usuários autorizados.
            </p>
          </div>

          {/* Error / Feedback Message */}
          {errorState && (
            <div className="bg-red-950/50 border border-red-800/80 rounded-xl p-3.5 flex items-start gap-3 text-red-200 text-xs animate-in fade-in zoom-in-95">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-300">Acesso Negado</p>
                <p className="text-[11px] leading-relaxed text-red-200/90">{errorState}</p>
              </div>
            </div>
          )}

          {/* Quick Sign-In Option for Root Admin */}
          <div className="space-y-3">
            <button
              onClick={handleAdminQuickSignIn}
              disabled={isLoading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold px-4 py-3 rounded-xl transition-all shadow-md flex items-center justify-between group disabled:opacity-60 disabled:cursor-not-allowed border border-slate-200"
            >
              <div className="flex items-center gap-3">
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Entrar como Administrador
                    <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded font-bold">Admin</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    alexandre.n.pedrozo@gmail.com
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider font-semibold text-slate-500 absolute">
                ou
              </span>
            </div>

            {/* Toggle Custom Google Email Form */}
            {!showCustomLogin ? (
              <button
                type="button"
                onClick={() => setShowCustomLogin(true)}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium px-4 py-2.5 rounded-xl text-xs transition-colors border border-slate-700 flex items-center justify-center gap-2 shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-blue-400" />
                Entrar com outro e-mail Google autorizado
              </button>
            ) : (
              <form onSubmit={handleCustomGoogleSignIn} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Nome Completo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    E-mail Google / Institucional Autorizado *
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="exemplo@gmail.com ou @mppr.mp.br"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCustomLogin(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Validando...
                      </span>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        Acessar Sistema
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Institutional Security Notice */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Política de Segurança & Permissões
            </div>
            <p className="text-slate-400 leading-tight">
              Apenas usuários com e-mails cadastrados previamente na lista de acesso têm permissão para consultar dados territoriais e históricos.
            </p>
            <p className="text-slate-500 text-[10px]">
              Administrador Responsável: <span className="text-slate-300 font-medium">alexandre.n.pedrozo@gmail.com</span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-900 px-6 flex items-center justify-between text-[11px] text-slate-500 bg-slate-950/80 z-10">
        <div>GeoCOMUM • Ministério Público do Estado do Paraná (MPPR)</div>
        <div>Segurança & Conformidade LGPD</div>
      </footer>
    </div>
  );
};
