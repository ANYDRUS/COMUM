import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { ComunidadeProcessed } from '../types';
import { hasValidCoordinates } from '../utils/geoUtils';
import { MapPinOff } from 'lucide-react';

interface MapViewProps {
  comunidades: ComunidadeProcessed[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  selectedMunicipio: string;
  selectedEventType?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  comunidades,
  selectedIds,
  onToggleSelect,
  selectedMunicipio,
  selectedEventType = 'all',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const markersGroupRef = useRef<{ [key: string]: L.CircleMarker }>({});
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('streets');

  // Filtered comunidades on Map based on left sidebar filters
  const mapFilteredComunidades = React.useMemo(() => {
    return comunidades.filter((c) => {
      const matchMun = selectedMunicipio === 'all' || c.MUNICIPIO === selectedMunicipio;
      let matchEvt = selectedEventType === 'all';
      if (selectedEventType !== 'all') {
        matchEvt = (c.eventos || []).some((e) => e.TIPO_EVENTO === selectedEventType);
      }
      return matchMun && matchEvt;
    });
  }, [comunidades, selectedMunicipio, selectedEventType]);

  // Communities with valid coordinates for plotting on map
  const comunidadesComCoords = React.useMemo(() => {
    return mapFilteredComunidades.filter((c) => hasValidCoordinates(c));
  }, [mapFilteredComunidades]);

  const semCoordsCount = mapFilteredComunidades.length - comunidadesComCoords.length;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([-25.4284, -49.2733], 10);

      // Tile Layer Setup
      if (mapStyle === 'satellite') {
        const esriSat = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 18,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA, USGS, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
          }
        );
        const esriLabels = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 18,
          }
        );
        esriSat.addTo(map);
        esriLabels.addTo(map);
      } else {
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
        osm.addTo(map);
      }

      // Initialize Cluster Layer
      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const childMarkers = cluster.getAllChildMarkers();
          const count = childMarkers.length;
          const hasSelected = childMarkers.some((m: any) => m.options && m.options.isSelected);

          return L.divIcon({
            html: `<div class="flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shadow-md border-2 cursor-pointer transition-transform hover:scale-110 ${
              hasSelected
                ? 'bg-red-600 text-white border-white ring-2 ring-red-400/50 animate-pulse'
                : 'bg-blue-600 text-white border-blue-200 ring-2 ring-blue-400/30'
            }"><span>${count}</span></div>`,
            className: 'custom-cluster-marker',
            iconSize: L.point(32, 32),
          });
        },
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Trigger immediate & delayed invalidateSize to handle layout transitions
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

    // Watch for container resizes (e.g., sidebars toggle or window resize)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        clusterGroupRef.current = null;
      }
    };
  }, []);

  // Update Layer on Style change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapStyle === 'satellite') {
      const esriSat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA, USGS, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
        }
      );
      const esriLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          maxNativeZoom: 18,
        }
      );
      esriSat.addTo(map);
      esriLabels.addTo(map);
    } else {
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      osm.addTo(map);
    }
  }, [mapStyle]);

  // Render & Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    // Clear old markers from cluster group
    clusterGroup.clearLayers();
    markersGroupRef.current = {};

    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    mapFilteredComunidades.forEach((item) => {
      const idStr = String(item.ID_COMUNIDADE);
      
      // Strict check for valid coordinates
      if (!hasValidCoordinates(item)) {
        return;
      }

      let lat = typeof item.LAT === 'string' ? parseFloat(item.LAT.replace(',', '.')) : Number(item.LAT);
      let lon = typeof item.LON === 'string' ? parseFloat(item.LON.replace(',', '.')) : Number(item.LON);

      const isSelected = selectedIds.has(idStr);
      const eventCount = item.eventos ? item.eventos.length : 0;

      const marker = L.circleMarker([lat, lon], ({
        radius: isSelected ? 11 : 7,
        fillColor: isSelected ? '#ef4444' : '#3b82f6',
        color: isSelected ? '#ffffff' : '#1e3a8a',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        fillOpacity: isSelected ? 0.95 : 0.75,
        isSelected: isSelected,
      } as any));

      // Hover Tooltip: Appears when hovering over point
      marker.bindTooltip(
        `<div class="px-2 py-1 text-xs font-sans text-slate-800">
          <div class="font-bold text-blue-900 leading-tight">${item.NOM_COMUNIDADE}</div>
          <div class="text-[11px] font-semibold text-slate-600 mt-0.5">${eventCount} evento(s) registrado(s)</div>
        </div>`,
        {
          direction: 'top',
          offset: L.point(0, -8),
          opacity: 0.95,
        }
      );

      // Click Popup
      const popupDiv = document.createElement('div');
      popupDiv.className = 'font-sans p-2 min-w-[190px] text-slate-800 bg-white rounded-lg border border-slate-200 shadow-sm';
      popupDiv.innerHTML = `
        <div class="text-[10px] text-slate-400 font-semibold mb-1">COD: ${item.COD_COMUNIDADE || item.ID_COMUNIDADE}</div>
        <strong class="text-sm text-blue-700 block font-bold leading-tight mb-1">${item.NOM_COMUNIDADE}</strong>
        <div class="text-xs text-slate-600 flex items-center justify-between gap-2 mt-1.5 p-1.5 bg-slate-50 rounded border border-slate-200">
          <span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-200">${item.MUNICIPIO}</span>
          <span class="font-bold text-slate-800 text-[11px]">${eventCount} evento(s) registrado(s)</span>
        </div>
        ${item.SITUACAO_URBANISTICA ? `<p class="text-[10px] text-slate-500 mt-1.5 italic">${item.SITUACAO_URBANISTICA}</p>` : ''}
        <button id="btn-select-${idStr}" class="mt-2.5 w-full py-1 text-[11px] font-bold rounded-lg transition-colors shadow-2xs ${
          isSelected ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
        }">
          ${isSelected ? 'Desmarcar Comunidade' : 'Selecionar Comunidade'}
        </button>
      `;

      // Handle button click inside Leaflet Popup
      marker.bindPopup(popupDiv, { closeButton: false, offset: L.point(0, -6) });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-${idStr}`);
        if (btn) {
          btn.onclick = () => {
            onToggleSelect(idStr);
            marker.closePopup();
          };
        }
      });

      marker.on('click', () => {
        onToggleSelect(idStr);
      });

      clusterGroup.addLayer(marker);
      markersGroupRef.current[idStr] = marker;

      bounds.extend([lat, lon]);
      hasPoints = true;
    });

    // Auto fit bounds if points exist
    if (hasPoints && selectedIds.size === 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [mapFilteredComunidades, selectedIds]);

  // Zoom to selected communities
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || selectedIds.size === 0) return;

    const bounds = L.latLngBounds([]);
    let hasSelectedPoints = false;

    comunidades.forEach((c) => {
      if (selectedIds.has(String(c.ID_COMUNIDADE)) && hasValidCoordinates(c)) {
        let lat = typeof c.LAT === 'string' ? parseFloat(c.LAT.replace(',', '.')) : Number(c.LAT);
        let lon = typeof c.LON === 'string' ? parseFloat(c.LON.replace(',', '.')) : Number(c.LON);
        bounds.extend([lat, lon]);
        hasSelectedPoints = true;
      }
    });

    if (hasSelectedPoints) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
    }
  }, [selectedIds, comunidades]);

  return (
    <div className="flex-1 relative w-full h-full bg-slate-100 overflow-hidden">
      {/* Top Map Base Style Toggle Only */}
      <div className="absolute top-4 right-4 z-[400] flex items-center">
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200 flex items-center gap-1 text-xs text-slate-800">
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mapStyle === 'satellite' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Satélite
          </button>
          <button
            onClick={() => setMapStyle('streets')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mapStyle === 'streets' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Rua / Mapa
          </button>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100"></div>

      {/* Map Legend */}
      <div className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 text-[11px] font-medium text-slate-700 z-[400] shadow-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-200 shadow-2xs"></span>
          <span>Comunidade Mapeada</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold border border-blue-200 shadow-2xs">
            12
          </span>
          <span>Agrupamento (Cluster ao afastar)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600 border border-white shadow-2xs animate-pulse"></span>
          <span className="font-bold text-slate-900">Comunidade Selecionada</span>
        </div>
        {semCoordsCount > 0 && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200 text-[10px] text-amber-700 font-bold">
            <MapPinOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{semCoordsCount} comunidade(s) sem coordenadas (apenas na lista)</span>
          </div>
        )}
      </div>
    </div>
  );
};
