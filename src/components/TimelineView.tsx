import React, { useState, useMemo } from 'react';
import { FullDataset } from '../types';
import { Calendar, Filter, Search, Building2, Tag, ChevronRight, ChevronDown, CheckCircle, MapPinOff } from 'lucide-react';
import { hasValidCoordinates } from '../utils/geoUtils';

interface TimelineViewProps {
  dataset: FullDataset;
  selectedIds: Set<string>;
  onToggleSelectCommunity: (id: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  dataset,
  selectedIds,
  onToggleSelectCommunity,
}) => {
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('all');
  const [selectedTipoEvento, setSelectedTipoEvento] = useState<string>('all');
  const [selectedPj, setSelectedPj] = useState<string>('all');
  const [selectedTipoMov, setSelectedTipoMov] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Formatting date helper
  const formatDateBR = (dateInput: string) => {
    if (!dateInput) return 'Data N/A';
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateInput;
  };

  // Filter options lists
  const municipios = useMemo(() => {
    const set = new Set<string>();
    dataset.comunidades.forEach((c) => {
      if (c.MUNICIPIO) set.add(c.MUNICIPIO);
    });
    return Array.from(set).sort();
  }, [dataset.comunidades]);

  const tiposEvento = useMemo(() => {
    const set = new Set<string>();
    dataset.eventos.forEach((e) => {
      if (e.TIPO_EVENTO) set.add(e.TIPO_EVENTO);
    });
    return Array.from(set).sort();
  }, [dataset.eventos]);

  const pjsList = useMemo(() => {
    return dataset.pjs;
  }, [dataset.pjs]);

  const tiposMovimento = useMemo(() => {
    const set = new Set<string>();
    dataset.movimentos.forEach((m) => {
      if (m.TIPO_MOV) set.add(m.TIPO_MOV);
    });
    return Array.from(set).sort();
  }, [dataset.movimentos]);

  // Prepared Event List with relational properties
  const fullTimelineEvents = useMemo(() => {
    return dataset.eventos.map((ev) => {
      const com = dataset.comunidades.find((c) => String(c.ID_COMUNIDADE) === String(ev.ID_COMUNIDADE));
      const pj = dataset.pjs.find((p) => String(p.ID_PJ) === String(ev.ID_PJ));
      const movs = dataset.movimentos.filter((m) => String(m.ID_EVENTO) === String(ev.ID_EVENTO));
      return {
        ...ev,
        comunidade: com,
        pj,
        movimentos: movs,
      };
    });
  }, [dataset]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return fullTimelineEvents
      .filter((ev) => {
        // Selection filter
        if (selectedIds.size > 0 && !selectedIds.has(String(ev.ID_COMUNIDADE))) {
          return false;
        }

        // Municipality filter
        if (selectedMunicipio !== 'all' && ev.comunidade?.MUNICIPIO !== selectedMunicipio) {
          return false;
        }

        // Tipo Evento filter
        if (selectedTipoEvento !== 'all' && ev.TIPO_EVENTO !== selectedTipoEvento) {
          return false;
        }

        // PJ filter
        if (selectedPj !== 'all' && String(ev.ID_PJ) !== selectedPj) {
          return false;
        }

        // Movimento filter
        if (selectedTipoMov !== 'all') {
          const hasMovType = ev.movimentos.some((m) => m.TIPO_MOV === selectedTipoMov);
          if (!hasMovType) return false;
        }

        // Search term
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchTitle = ev.NOM_EVENTO.toLowerCase().includes(term);
          const matchDes = (ev.DES_EVENTO || '').toLowerCase().includes(term);
          const matchCom = (ev.comunidade?.NOM_COMUNIDADE || '').toLowerCase().includes(term);
          const matchMov = ev.movimentos.some(
            (m) => m.NOM_MOV.toLowerCase().includes(term) || (m.DESC_MOV || '').toLowerCase().includes(term)
          );
          if (!matchTitle && !matchDes && !matchCom && !matchMov) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.DATA_EVENTO).getTime() - new Date(a.DATA_EVENTO).getTime());
  }, [fullTimelineEvents, selectedIds, selectedMunicipio, selectedTipoEvento, selectedPj, selectedTipoMov, searchTerm]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedEvents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEvents(next);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex flex-wrap gap-2.5 items-center shadow-2xs z-10">
        <div className="flex items-center gap-1.5 text-blue-700 mr-2 text-xs font-bold uppercase tracking-wider">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Linha do Tempo:</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar histórico..."
            className="bg-white border border-slate-200 text-xs text-slate-800 rounded-lg py-1.5 px-3 pl-8 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-40 sm:w-52 shadow-2xs"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
        </div>

        {/* Municipality Filter */}
        <select
          value={selectedMunicipio}
          onChange={(e) => setSelectedMunicipio(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[150px] shadow-2xs"
        >
          <option value="all">Todos Municípios</option>
          {municipios.map((m, idx) => (
            <option key={`m_${m}_${idx}`} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Tipo Evento Filter */}
        <select
          value={selectedTipoEvento}
          onChange={(e) => setSelectedTipoEvento(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[150px] shadow-2xs"
        >
          <option value="all">Todos Eventos ({tiposEvento.length})</option>
          {tiposEvento.map((t, idx) => (
            <option key={`t_${t}_${idx}`} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Responsável PJ Filter */}
        <select
          value={selectedPj}
          onChange={(e) => setSelectedPj(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[180px] shadow-2xs"
        >
          <option value="all">Todas Entidades (PJs)</option>
          {pjsList.map((p, idx) => (
            <option key={`pj_${p.ID_PJ}_${idx}`} value={String(p.ID_PJ)}>
              {p.NOM_PJ}
            </option>
          ))}
        </select>

        {/* Tipo Movimento Filter */}
        <select
          value={selectedTipoMov}
          onChange={(e) => setSelectedTipoMov(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[160px] shadow-2xs"
        >
          <option value="all">Todos Movimentos ({tiposMovimento.length})</option>
          {tiposMovimento.map((tm, idx) => (
            <option key={`tm_${tm}_${idx}`} value={tm}>
              {tm}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        <button
          onClick={() => {
            setSelectedMunicipio('all');
            setSelectedTipoEvento('all');
            setSelectedPj('all');
            setSelectedTipoMov('all');
            setSearchTerm('');
          }}
          className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors ml-auto shadow-2xs"
        >
          Resetar Filtros
        </button>
      </div>

      {/* Main Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 italic space-y-2">
            <Calendar className="w-8 h-8 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">Nenhum evento histórico encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const evIdStr = String(ev.ID_EVENTO);
            const isExpanded = expandedEvents.has(evIdStr);
            const comIdStr = ev.comunidade ? String(ev.comunidade.ID_COMUNIDADE) : '';
            const isComSelected = selectedIds.has(comIdStr);

            return (
              <div
                key={`evt_${evIdStr}_${index}`}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs transition-all"
              >
                {/* Event Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-start gap-3">
                    {/* Date Badge */}
                    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-lg text-center flex-none">
                      <span className="text-[10px] text-blue-600 block uppercase font-bold tracking-wider">DATA</span>
                      <span className="text-xs font-bold whitespace-nowrap">{formatDateBR(ev.DATA_EVENTO)}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{ev.NOM_EVENTO}</h3>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                          {ev.TIPO_EVENTO}
                        </span>
                        {ev.STATUS_EVENTO && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-200">
                            {ev.STATUS_EVENTO}
                          </span>
                        )}
                      </div>

                      {/* Community & Municipality Badges */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        {ev.comunidade && (
                          <button
                            onClick={() => comIdStr && onToggleSelectCommunity(comIdStr)}
                            className={`font-semibold flex items-center gap-1 hover:underline text-[11px] ${
                              isComSelected ? 'text-red-600 font-bold' : 'text-blue-600'
                            }`}
                          >
                            {hasValidCoordinates(ev.comunidade) ? '📍' : '🚫📍'} {ev.comunidade.NOM_COMUNIDADE} ({ev.comunidade.MUNICIPIO})
                            {!hasValidCoordinates(ev.comunidade) && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 px-1 rounded border border-amber-200 font-bold">
                                Sem coords
                              </span>
                            )}
                            {isComSelected && <span className="text-[9px] bg-red-50 text-red-700 px-1 rounded border border-red-200">Selecionada</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Responsible Entity Badge */}
                  {ev.pj && (
                    <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] text-slate-700 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 flex-none" />
                      <div className="truncate max-w-[200px]">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Responsável</span>
                        <span className="font-semibold text-slate-800 truncate">{ev.pj.NOM_PJ}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Event Description */}
                <p className="text-xs text-slate-600 leading-relaxed mb-3 font-normal">{ev.DES_EVENTO}</p>

                {/* Movimentos List */}
                {ev.movimentos.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => toggleExpand(evIdStr)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mb-2"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>
                        {ev.movimentos.length} Movimento(s) / Encaminhamento(s) Cadastrado(s)
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 pl-3 border-l-2 border-blue-500/30 mt-2">
                        {ev.movimentos.map((mov, movIdx) => (
                          <div key={`mov_${mov.ID_MOVIMENTO}_${movIdx}`} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-800">{mov.NOM_MOV}</span>
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {formatDateBR(mov.DATA_MOV)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                              <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium text-slate-700">{mov.TIPO_MOV}</span>
                              {mov.RESPONSAVEL_MOV && (
                                <span className="text-slate-500 italic">Resp: {mov.RESPONSAVEL_MOV}</span>
                              )}
                            </div>

                            {mov.DESC_MOV && <p className="text-[11px] text-slate-600 mt-1">{mov.DESC_MOV}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
