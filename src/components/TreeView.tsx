import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FullDataset } from '../types';
import { Filter, RotateCcw, X, Info, Maximize2, Minimize2 } from 'lucide-react';
import { hasValidCoordinates } from '../utils/geoUtils';

interface TreeViewProps {
  dataset: FullDataset;
  selectedIds?: Set<string>;
  selectedMunicipio?: string;
  searchTerm?: string;
}

interface TreeNodeData {
  name: string;
  level: number;
  type: string;
  id?: string | number;
  dataDate?: string;
  resp?: string;
  desc?: string;
  rawName?: string;
  isExpandMore?: boolean;
  isExpandLess?: boolean;
  parentKey?: string;
  children?: TreeNodeData[];
  _children?: TreeNodeData[];
}

export const TreeView: React.FC<TreeViewProps> = ({
  dataset,
  selectedIds,
  selectedMunicipio,
  searchTerm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<d3.HierarchyNode<TreeNodeData> | null>(null);
  const updateTreeRef = useRef<((source: any) => void) | null>(null);

  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);
  const [expandedParentKeys, setExpandedParentKeys] = useState<Set<string>>(new Set());

  // Local Filters
  const [filterMun, setFilterMun] = useState<string>('all');
  const [filterCom, setFilterCom] = useState<string>('all');
  const [filterEvt, setFilterEvt] = useState<string>('all');

  // Sync selectedMunicipio from app when it changes
  useEffect(() => {
    if (selectedMunicipio && selectedMunicipio !== filterMun) {
      setFilterMun(selectedMunicipio);
    }
  }, [selectedMunicipio]);

  // Format date BR
  const formatDateBR = (dStr?: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

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

  // Build root hierarchy
  const buildHierarchy = React.useCallback(() => {
    const root: TreeNodeData = {
      name: 'Paraná',
      level: 1,
      type: 'Estado',
      children: [],
    };

    const municipiosMap = new Map<string, TreeNodeData>();

    dataset.comunidades.forEach((com) => {
      const munName = com.MUNICIPIO || 'Indefinido';
      if (!municipiosMap.has(munName)) {
        const munNode: TreeNodeData = {
          name: munName,
          level: 2,
          type: 'Município',
          children: [],
        };
        municipiosMap.set(munName, munNode);
        root.children!.push(munNode);
      }

      const munNode = municipiosMap.get(munName)!;
      const comEvents = dataset.eventos
        .filter((e) => String(e.ID_COMUNIDADE) === String(com.ID_COMUNIDADE))
        .sort((a, b) => parseDateTimestamp(a.DATA_EVENTO) - parseDateTimestamp(b.DATA_EVENTO));
      const hasCoords = hasValidCoordinates(com);

      const comNode: TreeNodeData = {
        name: hasCoords ? com.NOM_COMUNIDADE : `${com.NOM_COMUNIDADE} (Sem Coordenadas)`,
        id: com.ID_COMUNIDADE,
        level: 3,
        type: 'Comunidade',
        desc: hasCoords ? undefined : 'Esta comunidade não possui latitude/longitude cadastradas.',
        children: [],
      };

      comEvents.forEach((ev) => {
        const pj = dataset.pjs.find((p) => String(p.ID_PJ) === String(ev.ID_PJ));
        const evMovs = dataset.movimentos
          .filter((m) => String(m.ID_EVENTO) === String(ev.ID_EVENTO))
          .sort((a, b) => parseDateTimestamp(a.DATA_MOV) - parseDateTimestamp(b.DATA_MOV));

        const evNode: TreeNodeData = {
          name: `[#${ev.ID_EVENTO}] ${formatDateBR(ev.DATA_EVENTO)} - ${ev.NOM_EVENTO}`,
          rawName: ev.NOM_EVENTO,
          level: 4,
          type: 'Evento',
          id: ev.ID_EVENTO,
          dataDate: formatDateBR(ev.DATA_EVENTO),
          resp: pj ? pj.NOM_PJ : 'N/A',
          desc: ev.DES_EVENTO,
          children: [],
        };

        evMovs.forEach((mov) => {
          evNode.children!.push({
            name: `${formatDateBR(mov.DATA_MOV)} - ${mov.NOM_MOV}`,
            level: 5,
            type: 'Movimento',
            id: mov.ID_MOVIMENTO,
            desc: mov.DESC_MOV,
            dataDate: formatDateBR(mov.DATA_MOV),
            resp: mov.RESPONSAVEL_MOV,
          });
        });

        comNode.children!.push(evNode);
      });

      munNode.children!.push(comNode);
    });

    return root;
  }, [dataset]);

  // Dropdown lists
  const municipios = React.useMemo(() => {
    const set = new Set<string>();
    dataset.comunidades.forEach((c) => {
      if (c.MUNICIPIO) set.add(c.MUNICIPIO);
    });
    return Array.from(set).sort();
  }, [dataset]);

  const comunidadesList = React.useMemo(() => {
    const set = new Set<string>();
    dataset.comunidades.forEach((c) => {
      if (filterMun === 'all' || c.MUNICIPIO === filterMun) {
        if (c.NOM_COMUNIDADE) set.add(c.NOM_COMUNIDADE);
      }
    });
    return Array.from(set).sort();
  }, [dataset, filterMun]);

  const tiposEvento = React.useMemo(() => {
    const set = new Set<string>();
    dataset.eventos.forEach((e) => {
      if (filterMun !== 'all' || filterCom !== 'all') {
        const com = dataset.comunidades.find((c) => String(c.ID_COMUNIDADE) === String(e.ID_COMUNIDADE));
        if (com) {
          if (filterMun !== 'all' && com.MUNICIPIO !== filterMun) return;
          if (filterCom !== 'all' && com.NOM_COMUNIDADE !== filterCom) return;
        }
      }
      if (e.NOM_EVENTO) set.add(e.NOM_EVENTO);
    });
    return Array.from(set).sort();
  }, [dataset, filterMun, filterCom]);

  // Filter tree according to global & local criteria
  const filterTree = React.useCallback(
    (node: TreeNodeData): TreeNodeData | null => {
      // Level 2: Municipality
      if (node.level === 2 && filterMun !== 'all' && node.name !== filterMun) return null;

      // Level 3: Community
      if (node.level === 3) {
        if (filterCom !== 'all' && node.name !== filterCom) return null;
        if (searchTerm && searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchName = node.name.toLowerCase().includes(q);
          const matchEvt = (node.children || []).some((e) => e.name.toLowerCase().includes(q));
          if (!matchName && !matchEvt) return null;
        }
      }

      // Level 4: Event
      if (node.level === 4 && filterEvt !== 'all' && node.rawName !== filterEvt) return null;

      let validChildren: TreeNodeData[] = [];
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          const res = filterTree(child);
          if (res) validChildren.push(res);
        });
      }

      const isLeaf = !node.children || node.children.length === 0;

      if (!isLeaf) {
        if (validChildren.length > 0) {
          return {
            ...node,
            children: validChildren,
          };
        } else {
          return null;
        }
      }

      return {
        ...node,
        children: undefined,
      };
    },
    [filterMun, filterCom, filterEvt, searchTerm]
  );

  // Helper to cap children to 5 items unless parentKey is in expandedParentKeys
  const capTreeChildren = React.useCallback(
    (node: TreeNodeData): TreeNodeData => {
      if (!node.children || node.children.length === 0) {
        return node;
      }

      // First recursively cap children's children
      const processedChildren = node.children.map((c) => capTreeChildren(c));

      // Check if this parent node has > 5 children
      if (processedChildren.length > 5) {
        const parentKey = node.id ? `id_${node.id}` : `${node.type}_${node.name}`;
        
        // Auto-expand if any child is selected in global selection
        let isExpanded = expandedParentKeys.has(parentKey);
        if (selectedIds && selectedIds.size > 0 && !isExpanded) {
          const hasSelected = processedChildren.some(
            (c) => c.id && selectedIds.has(String(c.id))
          );
          if (hasSelected) {
            isExpanded = true;
          }
        }

        const childTypeLabel = processedChildren[0]?.type?.toLowerCase() || 'item';

        if (isExpanded) {
          const showLessNode: TreeNodeData = {
            name: `▲ Recolher (${childTypeLabel}s)`,
            level: node.level + 1,
            type: 'Ação',
            isExpandLess: true,
            parentKey: parentKey,
          };
          return {
            ...node,
            children: [...processedChildren, showLessNode],
          };
        } else {
          const firstFive = processedChildren.slice(0, 5);
          const extraCount = processedChildren.length - 5;
          const showMoreNode: TreeNodeData = {
            name: `▼ Ver mais (+${extraCount} ${childTypeLabel}${extraCount > 1 ? 's' : ''})`,
            level: node.level + 1,
            type: 'Ação',
            isExpandMore: true,
            parentKey: parentKey,
          };
          return {
            ...node,
            children: [...firstFive, showMoreNode],
          };
        }
      }

      return {
        ...node,
        children: processedChildren,
      };
    },
    [expandedParentKeys, selectedIds]
  );

  // Render collapsible D3 Tree
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const width = containerRef.current.offsetWidth || 1000;
    const height = containerRef.current.offsetHeight || 600;

    const rawHierarchy = buildHierarchy();
    const filteredHierarchy = filterTree(rawHierarchy) || {
      name: 'Nenhuma comunidade para os filtros aplicados',
      level: 1,
      type: 'Estado',
    };
    const cappedHierarchy = capTreeChildren(filteredHierarchy);

    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#f8fafc');

    const g = svg.append('g');

    // Zoom setup
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', (e) => {
        g.attr('transform', e.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(80, height / 2));

    const treeLayout = d3.tree<TreeNodeData>().nodeSize([44, 250]);
    const root = d3.hierarchy<TreeNodeData>(cappedHierarchy, (d) => d.children);

    rootRef.current = root;

    // --- EXPANSION LOGIC ---
    // 1. Initial State (No communities selected): ONLY "Paraná" (root) is visible.
    // 2. Selection State (1+ communities selected): Expand down to the selected communities level!
    if (!selectedIds || selectedIds.size === 0) {
      if (root.children) {
        (root as any)._children = root.children;
        root.children = null;
      }
    } else {
      // Expand root
      if (root.children) {
        root.children.forEach((munNode: any) => {
          // Check if this municipio has any selected community
          const hasSelectedChild =
            munNode.children &&
            munNode.children.some(
              (comNode: any) => comNode.data.id && selectedIds.has(String(comNode.data.id))
            );

          if (hasSelectedChild) {
            // Keep municipio open!
            if (munNode.children) {
              munNode.children.forEach((comNode: any) => {
                // Collapse events under community so view expands exactly to community level
                if (comNode.children) {
                  comNode._children = comNode.children;
                  comNode.children = null;
                }
              });
            }
          } else {
            // Collapse municipalities without selected communities
            if (munNode.children) {
              munNode._children = munNode.children;
              munNode.children = null;
            }
          }
        });
      }
    }

    const colors = ['#dc2626', '#ea580c', '#16a34a', '#9333ea', '#db2777'];

    // Smooth bezier path generator
    function diagonal(s: { x: number; y: number }, t: { x: number; y: number }) {
      return `M ${s.y} ${s.x}
              C ${(s.y + t.y) / 2} ${s.x},
                ${(s.y + t.y) / 2} ${t.x},
                ${t.y} ${t.x}`;
    }

    function update(source: any) {
      treeLayout(root);

      const nodes = root.descendants();
      const links = root.links();

      nodes.forEach((d) => {
        d.y = d.depth * 230;
      });

      // --- NODES ---
      const node = g
        .selectAll<SVGGElement, d3.HierarchyNode<TreeNodeData>>('g.node')
        .data(nodes, (d: any, idx: number) => (d.data.id ? `${d.data.id}_${d.depth}_${idx}` : `${d.data.name}_${d.depth}_${idx}`));

      // Enter nodes
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', () => `translate(${source.y0 || source.y || 0},${source.x0 || source.x || 0})`)
        .style('cursor', 'pointer')
        .on('click', (event, d: any) => {
          if (d.data.isExpandMore) {
            event.stopPropagation();
            setExpandedParentKeys((prev) => {
              const next = new Set(prev);
              if (d.data.parentKey) next.add(d.data.parentKey);
              return next;
            });
            return;
          }
          if (d.data.isExpandLess) {
            event.stopPropagation();
            setExpandedParentKeys((prev) => {
              const next = new Set(prev);
              if (d.data.parentKey) next.delete(d.data.parentKey);
              return next;
            });
            return;
          }

          // Toggle children on click (expands / collapses next phase)
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else if (d._children) {
            d.children = d._children;
            d._children = null;
          }
          setSelectedNode(d.data);
          update(d);
        });

      // Base Circle
      nodeEnter
        .append('circle')
        .attr('r', (d: any) => (d.data.level === 3 ? 9 : 7))
        .style('stroke-width', '2.5px');

      // Expand / Collapse + or - symbol inside circle
      nodeEnter
        .append('text')
        .attr('class', 'toggle-symbol')
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none');

      // Node Label
      nodeEnter
        .append('text')
        .attr('class', 'node-title')
        .attr('dy', '-0.3em')
        .attr('x', (d: any) => (d.children || d._children ? -14 : 14))
        .attr('text-anchor', (d: any) => (d.children || d._children ? 'end' : 'start'))
        .text((d: any) => (d.data.name.length > 46 ? d.data.name.slice(0, 44) + '...' : d.data.name))
        .style('fill', '#0f172a')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('font-family', 'sans-serif');

      // Subtitle / Expand indicator
      nodeEnter
        .append('text')
        .attr('class', 'node-sub')
        .attr('dy', '1.2em')
        .attr('x', (d: any) => (d.children || d._children ? -14 : 14))
        .attr('text-anchor', (d: any) => (d.children || d._children ? 'end' : 'start'))
        .style('fill', '#64748b')
        .style('font-size', '9px');

      // UPDATE merged nodes
      const nodeUpdate = nodeEnter.merge(node as any);

      nodeUpdate
        .transition()
        .duration(350)
        .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

      nodeUpdate
        .select('circle')
        .style('fill', (d: any) => {
          if (d.data.isExpandMore || d.data.isExpandLess) return '#0284c7';
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom) return '#2563eb';
          return d._children ? colors[(d.data.level || 1) - 1] : '#ffffff';
        })
        .style('stroke', (d: any) => {
          if (d.data.isExpandMore || d.data.isExpandLess) return '#0369a1';
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom) return '#1d4ed8';
          return colors[(d.data.level || 1) - 1];
        })
        .attr('r', (d: any) => {
          if (d.data.isExpandMore || d.data.isExpandLess) return 8;
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom) return 11;
          return d._children ? 9 : d.data.level === 3 ? 8 : 6;
        });

      nodeUpdate
        .select('.toggle-symbol')
        .text((d: any) => {
          if (d.data.isExpandMore) return '▼';
          if (d.data.isExpandLess) return '▲';
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom && !d._children && !d.children) return '✓';
          return d._children ? '+' : d.children ? '-' : '';
        })
        .style('fill', (d: any) => {
          if (d.data.isExpandMore || d.data.isExpandLess) return '#ffffff';
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom) return '#ffffff';
          return d._children ? '#ffffff' : colors[(d.data.level || 1) - 1];
        })
        .style('font-size', (d: any) => (d.data.isExpandMore || d.data.isExpandLess ? '8px' : '10px'));

      nodeUpdate
        .select('.node-title')
        .style('fill', (d: any) => (d.data.isExpandMore || d.data.isExpandLess ? '#0284c7' : '#0f172a'))
        .style('font-weight', (d: any) => (d.data.isExpandMore || d.data.isExpandLess ? '700' : '600'));

      nodeUpdate
        .select('.node-sub')
        .text((d: any) => {
          if (d.data.isExpandMore || d.data.isExpandLess) return '(clique para alternar exibição)';
          const isSelectedCom = d.data.id && selectedIds && selectedIds.has(String(d.data.id));
          if (isSelectedCom) return '★ Comunidade Selecionada';
          if (d._children) return `(${d._children.length} sub-itens • clique p/ expandir)`;
          if (d.children) return `(${d.children.length} abertos)`;
          return '';
        });

      // EXIT nodes
      const nodeExit = node
        .exit()
        .transition()
        .duration(350)
        .attr('transform', () => `translate(${source.y},${source.x})`)
        .remove();

      nodeExit.select('circle').attr('r', 1e-6);
      nodeExit.select('text').style('fill-opacity', 1e-6);

      // --- LINKS ---
      const link = g
        .selectAll<SVGPathElement, d3.HierarchyLink<TreeNodeData>>('path.link')
        .data(links, (d: any) => `${d.source.data.name}-${d.target.data.name}`);

      const linkEnter = link
        .enter()
        .insert('path', 'g')
        .attr('class', 'link')
        .attr('d', () => {
          const o = { x: source.x0 || source.x, y: source.y0 || source.y };
          return diagonal(o, o);
        })
        .style('fill', 'none')
        .style('stroke', (d: any) => colors[(d.target.data.level || 1) - 1])
        .style('stroke-opacity', 0.45)
        .style('stroke-width', '1.5px');

      const linkUpdate = linkEnter.merge(link as any);

      linkUpdate
        .transition()
        .duration(350)
        .attr('d', (d: any) => diagonal(d.source, d.target));

      link
        .exit()
        .transition()
        .duration(350)
        .attr('d', () => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      nodes.forEach((d: any) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    updateTreeRef.current = update;

    (root as any).x0 = height / 2;
    (root as any).y0 = 0;
    update(root);
  }, [dataset, filterTree, buildHierarchy, capTreeChildren, selectedIds]);

  // Expand all nodes handler
  const handleExpandAll = () => {
    if (!rootRef.current || !updateTreeRef.current) return;
    const expand = (d: any) => {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      if (d.children) {
        d.children.forEach(expand);
      }
    };
    expand(rootRef.current);
    updateTreeRef.current(rootRef.current);
  };

  // Collapse all nodes handler
  const handleCollapseAll = () => {
    setExpandedParentKeys(new Set());
    if (!rootRef.current || !updateTreeRef.current) return;
    const collapse = (d: any) => {
      if (d.children) {
        d._children = d.children;
        d.children = null;
        if (d._children) d._children.forEach(collapse);
      }
    };
    if (rootRef.current.children) {
      rootRef.current.children.forEach(collapse);
    }
    updateTreeRef.current(rootRef.current);
  };

  return (
    <div className="flex-1 relative w-full h-full bg-slate-50 overflow-hidden">
      {/* Top Filter & Control Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center gap-2 p-3.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm text-xs text-slate-800">
        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Filtros da Árvore comum
          </span>
          <span className="text-[10px] text-blue-600 font-medium">
            💡 Clique nos nós (+) para expandir sequencialmente a fase seguinte
          </span>
        </div>

        {/* Global Active Badge if any */}
        {((selectedIds && selectedIds.size > 0) || (searchTerm && searchTerm.trim() !== '')) && (
          <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Filtro ativo da aplicação:{' '}
              {selectedIds && selectedIds.size > 0 && `${selectedIds.size} comunidade(s) selecionada(s)`}
              {selectedIds && selectedIds.size > 0 && searchTerm && ' • '}
              {searchTerm && `Busca por "${searchTerm}"`}
            </span>
          </div>
        )}

        {/* Select Dropdowns */}
        <select
          value={filterMun}
          onChange={(e) => setFilterMun(e.target.value)}
          className="bg-white text-slate-800 font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 shadow-2xs"
        >
          <option value="all">Todos Municípios ({municipios.length})</option>
          {municipios.map((m, idx) => (
            <option key={`tm_${m}_${idx}`} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={filterCom}
          onChange={(e) => setFilterCom(e.target.value)}
          className="bg-white text-slate-800 font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[200px] shadow-2xs"
        >
          <option value="all">Todas Comunidades ({comunidadesList.length})</option>
          {comunidadesList.map((c, idx) => (
            <option key={`tc_${c}_${idx}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filterEvt}
          onChange={(e) => setFilterEvt(e.target.value)}
          className="bg-white text-slate-800 font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 max-w-[200px] shadow-2xs"
        >
          <option value="all">Todos Tipos Eventos ({tiposEvento.length})</option>
          {tiposEvento.map((e, idx) => (
            <option key={`te_${e}_${idx}`} value={e}>
              {e}
            </option>
          ))}
        </select>

        {/* Expand / Collapse Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={handleExpandAll}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition-colors border border-slate-200 shadow-2xs"
            title="Expandir todas as fases da árvore"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            Expandir Tudo
          </button>

          <button
            onClick={handleCollapseAll}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition-colors border border-slate-200 shadow-2xs"
            title="Recolher árvore"
          >
            <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
            Recolher Tudo
          </button>

          <button
            onClick={() => {
              setFilterMun('all');
              setFilterCom('all');
              setFilterEvt('all');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors shadow-2xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar
          </button>
        </div>
      </div>

      {/* SVG Tree Container */}
      <div ref={containerRef} className="w-full h-full"></div>

      {/* Detail Side Panel */}
      {selectedNode && (
        <div className="absolute top-24 right-5 w-80 bg-white/95 backdrop-blur-md p-5 rounded-xl border border-slate-200 shadow-xl z-30 text-xs text-slate-800">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  {selectedNode.type} (Nível {selectedNode.level})
                </span>
                {selectedNode.id !== undefined && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded border border-blue-200">
                    {selectedNode.type === 'Evento' ? `ID_EVENTO: #${selectedNode.id}` : `ID: #${selectedNode.id}`}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">{selectedNode.name}</h2>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 text-slate-700">
            {selectedNode.id !== undefined && (
              <p>
                <strong className="text-slate-500">
                  {selectedNode.type === 'Evento' ? 'ID do Evento:' : selectedNode.type === 'Movimento' ? 'ID do Movimento:' : 'ID:'}
                </strong>{' '}
                <span className="font-bold text-blue-700">#{selectedNode.id}</span>
              </p>
            )}
            {selectedNode.dataDate && (
              <p>
                <strong className="text-slate-500">Data:</strong> {selectedNode.dataDate}
              </p>
            )}
            {selectedNode.resp && (
              <p>
                <strong className="text-slate-500">Responsável:</strong> {selectedNode.resp}
              </p>
            )}
            {selectedNode.desc && (
              <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600 leading-relaxed">
                {selectedNode.desc}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Level Color Legend */}
      <div className="absolute bottom-5 left-5 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 flex gap-4 text-[10px] font-medium text-slate-700 z-20 pointer-events-none shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Estado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span> Município
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Comunidade
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Evento
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-600"></span> Movimento
        </div>
      </div>
    </div>
  );
};
