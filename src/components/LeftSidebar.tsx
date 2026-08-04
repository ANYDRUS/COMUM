import React, { useMemo } from 'react';
import { ComunidadeProcessed } from '../types';
import { Search, CheckSquare, Square, Filter, Users, MapPin, Calendar, RotateCcw, MapPinOff } from 'lucide-react';
import { hasValidCoordinates } from '../utils/geoUtils';

interface LeftSidebarProps {
  comunidades: ComunidadeProcessed[];
  selectedIds: Set<string>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedMunicipio: string;
  onMunicipioChange: (mun: string) => void;
  selectedEventType: string;
  onEventTypeChange: (type: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  totalCount: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  comunidades,
  selectedIds,
  searchTerm,
  onSearchChange,
  selectedMunicipio,
  onMunicipioChange,
  selectedEventType,
  onEventTypeChange,
  onToggleSelect,
  onSelectAll,
  totalCount,
}) => {
  // Unique Municipalities
  const municipios = useMemo(() => {
    const set = new Set<string>();
    comunidades.forEach((c) => {
      if (c.MUNICIPIO) set.add(c.MUNICIPIO);
    });
    return Array.from(set).sort();
  }, [comunidades]);

  // Unique Event Types
  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    comunidades.forEach((c) => {
      (c.eventos || []).forEach((e) => {
        if (e.TIPO_EVENTO) set.add(e.TIPO_EVENTO);
      });
    });
    return Array.from(set).sort();
  }, [comunidades]);

  // Filtered & Sorted comunidades (selected ones ALWAYS at the top!)
  const filteredList = useMemo(() => {
    const norm = (str: string) =>
      (str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const normSearch = norm(searchTerm);
    const normSelMun = norm(selectedMunicipio);

    const list = comunidades.filter((c) => {
      const normNom = norm(c.NOM_COMUNIDADE);
      const normMun = norm(c.MUNICIPIO);

      const matchSearch = normNom.includes(normSearch) || normMun.includes(normSearch);
      const matchMun = selectedMunicipio === 'all' || normMun === normSelMun;

      let matchEvt = selectedEventType === 'all';
      if (selectedEventType !== 'all') {
        matchEvt = (c.eventos || []).some((e) => e.TIPO_EVENTO === selectedEventType);
      }
      return matchSearch && matchMun && matchEvt;
    });

    // Sort selected items to the top
    return list.sort((a, b) => {
      const aSel = selectedIds.has(String(a.ID_COMUNIDADE));
      const bSel = selectedIds.has(String(b.ID_COMUNIDADE));
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.NOM_COMUNIDADE.localeCompare(b.NOM_COMUNIDADE, 'pt-BR');
    });
  }, [comunidades, searchTerm, selectedMunicipio, selectedEventType, selectedIds]);

  const hasActiveFilters = selectedMunicipio !== 'all' || selectedEventType !== 'all' || searchTerm !== '';

  return (
    <aside className="w-80 min-w-[280px] sm:min-w-[320px] flex-none bg-white border-r border-slate-200 flex flex-col z-20 shadow-xs text-slate-800">
      {/* Top Filter Controls */}
      <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-slate-50/50">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtros & Navegação</p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                onSearchChange('');
                onMunicipioChange('all');
                onEventTypeChange('all');
              }}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              Resetar
            </button>
          )}
        </div>
        
        {/* Search Input */}
        <div className="relative group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar comunidade ou município..."
            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 pl-9 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </div>

        {/* Municipality Filter Dropdown */}
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg shadow-2xs">
          <Filter className="w-3.5 h-3.5 text-blue-600 flex-none" />
          <select
            value={selectedMunicipio}
            onChange={(e) => onMunicipioChange(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-700 outline-none w-full cursor-pointer py-0.5 truncate"
          >
            <option value="all" className="bg-white text-slate-800">
              Todos os Municípios ({municipios.length})
            </option>
            {municipios.map((m, idx) => (
              <option key={`${m}_${idx}`} value={m} className="bg-white text-slate-800">
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Event Type Filter Dropdown - Positioned directly below Municipality filter */}
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-none" />
          <select
            value={selectedEventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-700 outline-none w-full cursor-pointer py-0.5 truncate"
          >
            <option value="all" className="bg-white text-slate-800">
              Todos os Tipos de Evento ({eventTypes.length})
            </option>
            {eventTypes.map((et, idx) => (
              <option key={`${et}_${idx}`} value={et} className="bg-white text-slate-800">
                {et}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => onSelectAll(true)}
            className="flex-1 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1 shadow-2xs"
          >
            <CheckSquare className="w-3 h-3 text-blue-600" />
            Selecionar Todos
          </button>
          <button
            onClick={() => onSelectAll(false)}
            className="flex-1 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1 shadow-2xs"
          >
            <Square className="w-3 h-3 text-slate-400" />
            Limpar
          </button>
        </div>
      </div>

      {/* Community Items List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar bg-slate-50/30">
        {filteredList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Nenhuma comunidade encontrada para este filtro.
          </div>
        ) : (
          filteredList.map((item, index) => {
            const idStr = String(item.ID_COMUNIDADE);
            const isSelected = selectedIds.has(idStr);
            const eventCount = item.eventos ? item.eventos.length : 0;
            const hasCoords = hasValidCoordinates(item);

            // Header separator between selected and unselected items if there are selected items
            const showUnselectedHeader =
              !isSelected &&
              index > 0 &&
              selectedIds.has(String(filteredList[index - 1].ID_COMUNIDADE));

            return (
              <React.Fragment key={`${idStr}_${index}`}>
                {showUnselectedHeader && (
                  <div className="pt-2 pb-1 px-1 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-200 mt-2">
                    <span>Outras Comunidades</span>
                    <span className="h-px bg-slate-200 flex-1"></span>
                  </div>
                )}
                <div
                  onClick={() => onToggleSelect(idStr)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none flex items-start gap-2.5 group ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 shadow-2xs ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {/* Custom Checkbox */}
                  <div className="mt-0.5 flex-none">
                    {isSelected ? (
                      <div className="w-4 h-4 rounded bg-blue-600 border border-blue-600 flex items-center justify-center shadow-2xs">
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded bg-white border border-slate-300 group-hover:border-slate-400 transition-colors"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <h3 className={`text-xs font-semibold truncate transition-colors ${isSelected ? 'text-blue-950 font-bold' : 'text-slate-800 group-hover:text-blue-700'}`}>
                          {item.NOM_COMUNIDADE}
                        </h3>
                        {!hasCoords && (
                          <span
                            title="Sem coordenadas geográficas (não exibida no mapa)"
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1 py-0.2 rounded shrink-0"
                          >
                            <MapPinOff className="w-2.5 h-2.5 text-amber-600" />
                            <span>Sem coords</span>
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full flex-none">
                          Topo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1 truncate font-medium text-slate-500">
                        {hasCoords ? (
                          <MapPin className="w-2.5 h-2.5 text-blue-600 flex-none" />
                        ) : (
                          <span title="Sem localização georreferenciada" className="inline-flex items-center">
                            <MapPinOff className="w-2.5 h-2.5 text-amber-500 flex-none" />
                          </span>
                        )}
                        {item.MUNICIPIO} {!hasCoords && <span className="text-amber-700 font-semibold">(Sem Lat/Lon)</span>}
                      </span>

                      <div className="flex items-center gap-1.5 flex-none">
                        {item.FAMILIAS_ESTIMADAS ? (
                          <span className="flex items-center gap-0.5 text-slate-500 font-medium" title="Famílias estimadas">
                            <Users className="w-2.5 h-2.5 text-slate-400" />
                            {item.FAMILIAS_ESTIMADAS}
                          </span>
                        ) : null}

                        <span
                          className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium text-[9px]"
                          title={`${eventCount} evento(s) cadastrado(s)`}
                        >
                          {eventCount} evt
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-200 text-[11px] font-medium text-slate-500 flex justify-between px-4 bg-slate-50/80">
        <span>Exibindo {filteredList.length} de {totalCount}</span>
        <span className="font-bold text-blue-700">{selectedIds.size} selecionado(s)</span>
      </div>
    </aside>
  );
};
