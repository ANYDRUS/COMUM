import React, { useState } from 'react';
import { GoogleUser } from '../types';
import { User, Bot, Sparkles, FileSpreadsheet } from 'lucide-react';

interface HeaderProps {
  selectionCount: number;
  user: GoogleUser;
  onOpenAuth: () => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
  onSyncSheets?: () => void;
  isSyncingSheets?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectionCount,
  user,
  onOpenAuth,
  onToggleChat,
  isChatOpen,
  onSyncSheets,
  isSyncingSheets = false,
}) => {
  const isAdmin = !user.role || user.role === 'admin';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shadow-sm z-30 flex-none text-slate-900">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Geo<span className="text-blue-600">COMUM</span>
          </h1>
          <span className="hidden md:inline text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            v1.0 • Inteligência Territorial
          </span>
        </div>
      </div>

      {/* Badges & Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* Selection Counter */}
        {selectionCount > 0 ? (
          <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            {selectionCount} selecionada{selectionCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="hidden lg:inline text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            Nenhuma seleção
          </span>
        )}

        {/* Admin-Only Features: Google Sheets Sync */}
        {isAdmin && onSyncSheets && (
          <button
            onClick={onSyncSheets}
            disabled={isSyncingSheets}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs border ${
              isSyncingSheets
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse cursor-wait'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}
            title="Sincronizar e re-consumir dados das 5 abas da Planilha Google"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
            <span className="hidden sm:inline">
              {isSyncingSheets ? 'Sincronizando...' : 'Sincronizar Planilha'}
            </span>
          </button>
        )}

        {/* User Profile & Role Selector Button */}
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-3 py-1.5 rounded-full transition-colors text-xs text-slate-700 font-medium"
          title={`Perfil de Acesso: ${isAdmin ? 'Administrador' : 'Visualização Simples'} (${user.email})`}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover border border-slate-300" />
          ) : (
            <User className="w-3.5 h-3.5 text-blue-600" />
          )}
          <span className="hidden md:inline text-[11px] font-medium truncate max-w-[120px] text-slate-700">{user.email}</span>
          
          {isAdmin ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 hidden sm:inline">
              Admin
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 hidden sm:inline">
              Visualização
            </span>
          )}
        </button>

        {/* Inteligência Comum Drawer Toggle */}
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
            isChatOpen
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
          }`}
          title="Assistente de Inteligência Comum (Gemini IA)"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden lg:inline font-semibold">Inteligência Comum</span>
          <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
        </button>
      </div>
    </header>
  );
};
