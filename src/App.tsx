import React, { useState, useEffect, useCallback } from 'react';
import { FullDataset, ComunidadeProcessed, GoogleUser } from './types';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { MapView } from './components/MapView';
import { TimelineView } from './components/TimelineView';
import { TreeView } from './components/TreeView';
import { GeminiChatSidebar } from './components/GeminiChatSidebar';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { Map, Clock, GitFork, Sparkles } from 'lucide-react';

export default function App() {
  const [dataset, setDataset] = useState<FullDataset>({
    comunidades: [],
    eventos: [],
    movimentos: [],
    pjs: [],
    pfs: [],
  });

  const [activeTab, setActiveTab] = useState<'map' | 'history' | 'tree'>('map');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  // Modals / Drawers
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Initial default users
  const DEFAULT_USERS: GoogleUser[] = [
    {
      id: 'user-1',
      name: 'Adilson Pedrozo',
      email: 'adnpedrozo@mppr.mp.br',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      organization: 'Ministério Público do Estado do Paraná (MPPR)',
      role: 'admin',
      isAuthenticated: true,
    },
    {
      id: 'user-2',
      name: 'Alexandre N. Pedrozo',
      email: 'alexandre.n.pedrozo@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      organization: 'Ministério Público do Estado do Paraná (MPPR)',
      role: 'admin',
      isAuthenticated: true,
    },
    {
      id: 'user-3',
      name: 'Consulta Geral MPPR',
      email: 'consulta.comum@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      organization: 'Atendimento e Consulta Pública MPPR',
      role: 'viewer',
      isAuthenticated: true,
    },
  ];

  // Registered Users Management State with localStorage persistence
  const [registeredUsers, setRegisteredUsers] = useState<GoogleUser[]>(() => {
    try {
      const saved = localStorage.getItem('geocomum_registered_users');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load registered users from storage:', err);
    }
    return DEFAULT_USERS;
  });

  // Current Active User State with localStorage persistence
  const [user, setUser] = useState<GoogleUser>(() => {
    try {
      const savedUser = localStorage.getItem('geocomum_active_user');
      if (savedUser) return JSON.parse(savedUser);
    } catch (err) {
      console.error('Failed to load active user from storage:', err);
    }
    return DEFAULT_USERS[0];
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('geocomum_registered_users', JSON.stringify(registeredUsers));
    } catch (err) {
      console.error(err);
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      localStorage.setItem('geocomum_active_user', JSON.stringify(user));
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  const handleSelectUser = (selected: GoogleUser) => {
    setUser(selected);
  };

  const handleRegisterUser = (newUserObj: GoogleUser) => {
    setRegisteredUsers((prev) => {
      const existsIndex = prev.findIndex((u) => u.email.toLowerCase() === newUserObj.email.toLowerCase());
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], ...newUserObj };
        return updated;
      }
      return [...prev, newUserObj];
    });
  };

  const handleDeleteUser = (userId: string) => {
    setRegisteredUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleUpdateUserRole = (userId: string, newRole: 'admin' | 'viewer') => {
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    if (user.id === userId) {
      setUser((prev) => ({ ...prev, role: newRole }));
    }
  };

  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);

  // Fetch full dataset from server
  const fetchDataset = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        setDataset(data);
      }
    } catch (err) {
      console.error('Failed to load dataset:', err);
    }
  }, []);

  // Sync dataset directly from Google Sheets
  const handleSyncSheets = useCallback(async () => {
    setIsSyncingSheets(true);
    try {
      const res = await fetch('/api/data/sync-sheets', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.dataset) {
        setDataset(data.dataset);
      } else {
        alert('Erro ao sincronizar planilha: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err: any) {
      alert('Falha na comunicação ao sincronizar planilha.');
    } finally {
      setIsSyncingSheets(false);
    }
  }, []);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  // Safe date timestamp parser
  const parseDateTimestamp = (dateStr?: string): number => {
    if (!dateStr) return 0;
    const clean = dateStr.trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
      }
    }
    const timestamp = new Date(clean).getTime();
    return isNaN(timestamp) ? 0 : timestamp;
  };

  // Process comunidades with relational sub-entities
  const processedComunidades = React.useMemo<ComunidadeProcessed[]>(() => {
    return dataset.comunidades.map((com) => {
      const comEvents = dataset.eventos
        .filter((e) => String(e.ID_COMUNIDADE) === String(com.ID_COMUNIDADE))
        .map((ev) => {
          const pj = dataset.pjs.find((p) => String(p.ID_PJ) === String(ev.ID_PJ));
          const movs = dataset.movimentos
            .filter((m) => String(m.ID_EVENTO) === String(ev.ID_EVENTO))
            .sort((a, b) => parseDateTimestamp(a.DATA_MOV) - parseDateTimestamp(b.DATA_MOV));
          const pfs = dataset.pfs.filter((f) => pj && String(f.ID_PJ) === String(pj.ID_PJ));
          return {
            ...ev,
            pj,
            movimentos: movs,
            pfsEnvolvidas: pfs,
          };
        })
        .sort((a, b) => parseDateTimestamp(a.DATA_EVENTO) - parseDateTimestamp(b.DATA_EVENTO));

      return {
        ...com,
        eventos: comEvents,
      };
    });
  }, [dataset]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Select all or clear
  const handleSelectAll = (select: boolean) => {
    if (!select) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(processedComunidades.map((c) => String(c.ID_COMUNIDADE)));
      setSelectedIds(allIds);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 font-sans h-screen flex flex-col overflow-hidden select-none">
      {/* Top Navigation Header */}
      <Header
        selectionCount={selectedIds.size}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
        onSyncSheets={handleSyncSheets}
        isSyncingSheets={isSyncingSheets}
      />

      {/* Main App Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {/* Left Sidebar - Communities & Filters */}
        <LeftSidebar
          comunidades={processedComunidades}
          selectedIds={selectedIds}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedMunicipio={selectedMunicipio}
          onMunicipioChange={setSelectedMunicipio}
          selectedEventType={selectedEventType}
          onEventTypeChange={setSelectedEventType}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          totalCount={dataset.comunidades.length}
        />

        {/* Center Main Content Area */}
        <main className="flex-1 flex flex-col relative bg-slate-900 min-w-0">
          {/* Main View Navigation Tabs Bar */}
          <div className="h-11 bg-slate-900 border-b border-slate-800 flex px-3 items-end gap-1 flex-none z-10 shadow-sm text-xs font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'map'
                  ? 'border-blue-500 text-blue-400 bg-slate-950/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Mapa COMUM
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-400 bg-slate-950/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Linha do Tempo
            </button>

            <button
              onClick={() => setActiveTab('tree')}
              className={`px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'tree'
                  ? 'border-blue-500 text-blue-400 bg-slate-950/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              Árvore COMUM
            </button>
          </div>

          {/* Tab Views */}
          <div className="flex-1 relative w-full h-full overflow-hidden flex">
            {activeTab === 'map' && (
              <MapView
                comunidades={processedComunidades}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                selectedMunicipio={selectedMunicipio}
                selectedEventType={selectedEventType}
              />
            )}

            {activeTab === 'history' && (
              <TimelineView
                dataset={dataset}
                selectedIds={selectedIds}
                onToggleSelectCommunity={handleToggleSelect}
              />
            )}

            {activeTab === 'tree' && (
              <TreeView
                dataset={dataset}
                selectedIds={selectedIds}
                selectedMunicipio={selectedMunicipio}
                searchTerm={searchTerm}
              />
            )}
          </div>
        </main>

        {/* Right Sidebar - "Inteligência Comum" (Gemini AI Assistant) */}
        <GeminiChatSidebar
          dataset={dataset}
          selectedIds={selectedIds}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onOpen={() => setIsChatOpen(true)}
        />
      </div>

      {/* Modals */}
      {isAuthModalOpen && (
        <GoogleAuthModal
          user={user}
          registeredUsers={registeredUsers}
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSelectUser={handleSelectUser}
          onRegisterUser={handleRegisterUser}
          onDeleteUser={handleDeleteUser}
          onUpdateUserRole={handleUpdateUserRole}
        />
      )}
    </div>
  );
}
