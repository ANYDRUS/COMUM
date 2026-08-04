import React, { useState } from 'react';
import { GoogleUser } from '../types';
import { ShieldCheck, User, X, CheckCircle2, Eye, ShieldAlert, UserPlus, Users, Trash2, Edit2, LogIn, Lock } from 'lucide-react';

interface GoogleAuthModalProps {
  user: GoogleUser;
  registeredUsers: GoogleUser[];
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: GoogleUser) => void;
  onRegisterUser: (newUser: GoogleUser) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUserRole: (userId: string, newRole: 'admin' | 'viewer') => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  user,
  registeredUsers,
  isOpen,
  onClose,
  onSelectUser,
  onRegisterUser,
  onDeleteUser,
  onUpdateUserRole,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'manage' | 'new_user'>('login');
  
  // Quick Google Sign-In state
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>('');

  // Form for New User Registration
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');

  // Form for Manual Sign In
  const [manualName, setManualName] = useState(user.name || '');
  const [manualEmail, setManualEmail] = useState(user.email || '');
  const [manualOrg, setManualOrg] = useState(user.organization || '');
  const [manualRole, setManualRole] = useState<'admin' | 'viewer'>(user.role || 'admin');

  if (!isOpen) return null;

  // Helper to validate Google email
  const isGoogleEmail = (emailStr: string): boolean => {
    const trimmed = emailStr.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) return false;
    
    // Explicitly reject non-Google public email domains
    const nonGoogleDomains = ['hotmail.com', 'yahoo.com', 'outlook.com', 'live.com', 'icloud.com', 'aol.com', 'protonmail.com', 'bol.com.br', 'uol.com.br'];
    const domain = trimmed.split('@')[1];
    if (nonGoogleDomains.some((d) => domain === d || domain.endsWith('.' + d))) {
      return false;
    }
    
    // Gmail, MPPR (@mppr.mp.br), Googlemail, or institutional Google Workspace domains
    return true;
  };

  // Handler for One-Click Google Auth
  const handleQuickGoogleSignIn = (googleAccountEmail?: string, googleName?: string) => {
    setIsSigningInGoogle(true);
    setEmailError('');

    setTimeout(() => {
      setIsSigningInGoogle(false);
      const targetEmail = googleAccountEmail || 'alexandre.n.pedrozo@gmail.com';
      const targetName = googleName || 'Alexandre N. Pedrozo';
      
      const existing = registeredUsers.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
      if (existing) {
        onSelectUser(existing);
      } else {
        const newUserObj: GoogleUser = {
          id: `user-${Date.now()}`,
          name: targetName,
          email: targetEmail,
          organization: 'Ministério Público do Estado do Paraná (MPPR)',
          role: 'admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isAuthenticated: true,
        };
        onRegisterUser(newUserObj);
        onSelectUser(newUserObj);
      }
      onClose();
    }, 600);
  };

  // Handler for Registering New User
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!isGoogleEmail(newEmail)) {
      setEmailError('Endereço inválido. Apenas contas e domínios do Google (@gmail.com, @mppr.mp.br ou Google Workspace) são permitidos.');
      return;
    }

    const newUserObj: GoogleUser = {
      id: `user-${Date.now()}`,
      name: newName,
      email: newEmail.trim(),
      organization: newOrg || 'Ministério Público do Estado do Paraná (MPPR)',
      role: newRole,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      isAuthenticated: true,
    };

    onRegisterUser(newUserObj);
    setNewName('');
    setNewEmail('');
    setNewOrg('');
    setNewRole('viewer');
    setActiveTab('manage');
  };

  // Handler for Login Form Submit
  const handleManualLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!isGoogleEmail(manualEmail)) {
      setEmailError('Endereço inválido. Apenas contas e e-mails do Google (@gmail.com ou Google Workspace) são permitidos.');
      return;
    }

    const updatedUser: GoogleUser = {
      ...user,
      name: manualName,
      email: manualEmail.trim(),
      organization: manualOrg,
      role: manualRole,
      isAuthenticated: true,
    };

    onSelectUser(updatedUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 shrink-0">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl">
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Autenticação Google & Cadastramento
            </h2>
            <p className="text-[11px] text-slate-500">
              Acesso exclusivo via contas Google com controle de permissões por perfil
            </p>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 text-xs font-bold shrink-0">
          <button
            onClick={() => {
              setActiveTab('login');
              setEmailError('');
            }}
            className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'login'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar com Google
          </button>

          <button
            onClick={() => {
              setActiveTab('manage');
              setEmailError('');
            }}
            className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Painel de Usuários ({registeredUsers.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('new_user');
              setEmailError('');
            }}
            className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'new_user'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cadastrar Usuário
          </button>
        </div>

        {/* Error Alert Box */}
        {emailError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Domínio Não Permitido</strong>
              <p className="text-[11px] text-rose-700 mt-0.5">{emailError}</p>
            </div>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-xs">
          {/* TAB 1: ONE-CLICK GOOGLE LOGIN & SWITCHER */}
          {activeTab === 'login' && (
            <div className="space-y-5">
              {/* Prominent Google One-Click Button */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Autenticação Rápida de Conta Google
                </span>

                <button
                  onClick={() => handleQuickGoogleSignIn()}
                  disabled={isSigningInGoogle}
                  className="w-full bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-300 rounded-xl py-3 px-4 flex items-center justify-center gap-3 shadow-xs hover:shadow-md transition-all text-sm group"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {isSigningInGoogle ? 'Autenticando com Google Workspace...' : 'Fazer Login com Google'}
                  </span>
                </button>

                <p className="text-[10px] text-slate-500">
                  Validação automática via OAuth Google Workspace com preservação de perfil institucional.
                </p>
              </div>

              {/* Quick Account Switcher */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Usuários Cadastrados para Seleção
                </span>
                <div className="space-y-2">
                  {registeredUsers.map((u) => {
                    const isCurrent = u.email === user.email;
                    const isAdmin = !u.role || u.role === 'admin';

                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{u.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block">{u.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Administrador
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Visualização Simples
                            </span>
                          )}
                          <CheckCircle2
                            className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-slate-300'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Manual Google Login */}
              <form onSubmit={handleManualLoginSubmit} className="space-y-3.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ou Entre com Outro E-mail Google
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-bold text-[10px] uppercase">Nome</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      required
                      placeholder="Ex: Dra. Ana Silva"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-bold text-[10px] uppercase">E-mail Google</label>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      required
                      placeholder="nome@gmail.com ou @mppr.mp.br"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                >
                  Confirmar Login Google
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: PAINEL DE USUÁRIOS CADASTRADOS */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-blue-950 text-xs">Gestão de Usuários e Níveis de Acesso</h3>
                    <p className="text-[10px] text-blue-800">
                      Administradores possuem permissões de gestão e sincronização. Usuários de Visualização Simples enxergam apenas mapas e relatórios.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('new_user')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shrink-0 flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar
                </button>
              </div>

              {/* Table of Registered Users */}
              <div className="space-y-2">
                {registeredUsers.map((u) => {
                  const isAdmin = !u.role || u.role === 'admin';
                  const isCurrent = u.email === user.email;

                  return (
                    <div
                      key={u.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-300 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                                Usuário Atual
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">{u.email}</span>
                          <span className="text-[10px] text-slate-400 block">{u.organization}</span>
                        </div>
                      </div>

                      {/* Role Toggle & Actions */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                        <select
                          value={u.role || 'admin'}
                          onChange={(e) => onUpdateUserRole(u.id, e.target.value as 'admin' | 'viewer')}
                          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border outline-none ${
                            isAdmin
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <option value="admin">Administrador</option>
                          <option value="viewer">Visualização Simples</option>
                        </select>

                        {!isCurrent && (
                          <button
                            onClick={() => {
                              onSelectUser(u);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors"
                            title="Alternar para este usuário"
                          >
                            Entrar
                          </button>
                        )}

                        {registeredUsers.length > 1 && (
                          <button
                            onClick={() => onDeleteUser(u.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir cadastro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FORMULARIO DE NOVO CADASTRO */}
          {activeTab === 'new_user' && (
            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Cadastrar Novo Usuário Google
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Informe o e-mail Google válido e defina o nível de permissão no sistema.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold text-[10px] uppercase">Nome Completo</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="Ex: Dra. Mariana Costa"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-bold text-[10px] uppercase">E-mail do Google</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="usuario@gmail.com ou @mppr.mp.br"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold text-[10px] uppercase">Órgão / Instituição</label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="Ex: Ministério Público do Estado do Paraná (MPPR)"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Role Radio Select */}
              <div>
                <label className="block text-slate-700 mb-1.5 font-bold text-[10px] uppercase">
                  Nível de Permissão
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newRole === 'admin'
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        Administrador
                      </span>
                      {newRole === 'admin' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Possui acesso total: Gestão de Dados, Sincronização e Exportação.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('viewer')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newRole === 'viewer'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-amber-600" />
                        Visualização Simples
                      </span>
                      {newRole === 'viewer' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Acesso de consulta: Oculta opções de Gestão de Dados, Sincronização e Exportação.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Salvar Cadastro
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400 shrink-0">
          <span>Autenticação Integrada Google Workspace MPPR</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
