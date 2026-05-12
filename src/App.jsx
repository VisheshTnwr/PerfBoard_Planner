import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  Minus, 
  Lightbulb, 
  Trash2, 
  Zap, 
  Maximize, 
  Minimize,
  MousePointer2,
  Undo2,
  Redo2,
  Settings,
  Plus,
  X,
  Scissors
} from 'lucide-react';

import ToolButton from './components/ToolButton';
import ESP32Module from './components/ESP32Module';
import PowerAdapter from './components/PowerAdapter';
import ComponentRenderer from './components/ComponentRenderer';
import { 
  ROWS, 
  COLS, 
  HOLE_SPACING, 
  HOLE_RADIUS, 
  BOARD_PADDING, 
  ESP32_HEIGHT, 
  PIN_SPACING,
  ESP32_PINS_TOP,
  ESP32_PINS_BOTTOM,
  ADAPTER_WIDTH,
  ADAPTER_HEIGHT
} from './constants';

const snapToPoint = (x, y, snapPoints, currentCutPath, tool) => {
  let minDist = Infinity;
  let snappedPoint = { x, y, id: null };
  
  // 1. Aggressive snapping to existing cut points when in cut mode
  if (tool === 'cut') {
    for (let i = 0; i < currentCutPath.length; i++) {
      const p = currentCutPath[i];
      const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      if (dist < 35) { // Highly aggressive snapping to existing points
        return { x: p.x, y: p.y, id: `cut-point-${i}` };
      }
    }
  }

  // 2. Regular snapping to holes/pins
  for (const p of snapPoints) {
    const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
    if (dist < minDist && dist < 15) {
      minDist = dist;
      snappedPoint = { x: p.x, y: p.y, id: p.id };
    }
  }
  return snappedPoint;
};

const isPointInPolygon = (point, vs) => {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const App = () => {
  const [boardRows, setBoardRows] = useState(() => {
    const saved = localStorage.getItem('perfboard_rows');
    return saved ? parseInt(saved) : ROWS;
  });
  const [boardCols, setBoardCols] = useState(() => {
    const saved = localStorage.getItem('perfboard_cols');
    return saved ? parseInt(saved) : COLS;
  });
  const [deletedHoles, setDeletedHoles] = useState(() => {
    const saved = localStorage.getItem('perfboard_deleted_holes');
    return saved ? JSON.parse(saved) : [];
  });
  const [espPinsTop, setEspPinsTop] = useState(() => {
    const saved = localStorage.getItem('perfboard_pins_top');
    return saved ? JSON.parse(saved) : [...ESP32_PINS_TOP];
  });
  const [espPinsBottom, setEspPinsBottom] = useState(() => {
    const saved = localStorage.getItem('perfboard_pins_bottom');
    return saved ? JSON.parse(saved) : [...ESP32_PINS_BOTTOM];
  });
  const [tool, setTool] = useState('wire');
  const [wireColor, setWireColor] = useState('#ff0000');
  const [customColors, setCustomColors] = useState(() => {
    const saved = localStorage.getItem('perfboard_custom_colors');
    return saved ? JSON.parse(saved) : [];
  });
  const colorPresets = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ffffff', '#000000', '#8b4513', '#ffa500', '#808080', '#444444'
  ];

  const addCustomColor = () => {
    if (!customColors.includes(wireColor)) {
      const newColors = [wireColor, ...customColors].slice(0, 10);
      setCustomColors(newColors);
      localStorage.setItem('perfboard_custom_colors', JSON.stringify(newColors));
    }
  };

  const removeCustomColor = (color) => {
    const newColors = customColors.filter(c => c !== color);
    setCustomColors(newColors);
    localStorage.setItem('perfboard_custom_colors', JSON.stringify(newColors));
  };
  
  const [ledColor] = useState('red');
  const [components, setComponents] = useState(() => {
    const saved = localStorage.getItem('perfboard_components');
    return saved ? JSON.parse(saved) : [];
  });
  const [wires, setWires] = useState(() => {
    const saved = localStorage.getItem('perfboard_wires');
    return saved ? JSON.parse(saved) : [];
  });
  const [history, setHistory] = useState(() => [{ components, wires, deletedHoles }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cutPath, setCutPath] = useState([]);
  const [isCutFinalized, setIsCutFinalized] = useState(false);
  const canvasRef = useRef(null);

  const maxPins = Math.max(espPinsTop.length, espPinsBottom.length);
  const dynamicEspWidth = Math.max(200, (maxPins * PIN_SPACING) + 100);
  const espStartX = BOARD_PADDING + 3 * HOLE_SPACING - 50;
  const adapterX = espStartX + dynamicEspWidth + 40;
  const adapterY = BOARD_PADDING + (ESP32_HEIGHT / 2) - (ADAPTER_HEIGHT / 2);
  const baseWidth = Math.max(adapterX + 200, boardCols * HOLE_SPACING + BOARD_PADDING * 2);
  const baseHeight = boardRows * HOLE_SPACING + ESP32_HEIGHT + 300;

  useEffect(() => {
    localStorage.setItem('perfboard_rows', boardRows);
    localStorage.setItem('perfboard_cols', boardCols);
    localStorage.setItem('perfboard_pins_top', JSON.stringify(espPinsTop));
    localStorage.setItem('perfboard_pins_bottom', JSON.stringify(espPinsBottom));
    localStorage.setItem('perfboard_components', JSON.stringify(components));
    localStorage.setItem('perfboard_wires', JSON.stringify(wires));
    localStorage.setItem('perfboard_deleted_holes', JSON.stringify(deletedHoles));
  }, [boardRows, boardCols, espPinsTop, espPinsBottom, components, wires, deletedHoles]);

  const saveToHistory = useCallback((newComps, newWires, newDeleted = deletedHoles) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ components: JSON.parse(JSON.stringify(newComps)), wires: JSON.parse(JSON.stringify(newWires)), deletedHoles: [...newDeleted] });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, deletedHoles]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      setComponents(state.components); setWires(state.wires); setDeletedHoles(state.deletedHoles || []); setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      setComponents(state.components); setWires(state.wires); setDeletedHoles(state.deletedHoles || []); setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  const snapPoints = useMemo(() => {
    const points = [];
    const deletedSet = new Set(deletedHoles);
    for (let r = 0; r < boardRows; r++) {
      for (let c = 0; c < boardCols; c++) {
        if (!deletedSet.has(`${r}-${c}`)) points.push({ x: BOARD_PADDING + c * HOLE_SPACING, y: BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING, id: `hole-${r}-${c}` });
      }
    }
    espPinsTop.forEach((pin, i) => points.push({ x: espStartX + 50 + i * PIN_SPACING, y: BOARD_PADDING + 10, id: `pin-t-${i}` }));
    espPinsBottom.forEach((pin, i) => points.push({ x: espStartX + 50 + i * PIN_SPACING, y: BOARD_PADDING + ESP32_HEIGHT - 10, id: `pin-b-${i}` }));
    points.push({ x: adapterX + ADAPTER_WIDTH / 2, y: adapterY + 15, id: 'adapter-pos' });
    points.push({ x: adapterX + ADAPTER_WIDTH / 2, y: adapterY + 45, id: 'adapter-neg' });
    return points;
  }, [boardRows, boardCols, espStartX, espPinsTop, espPinsBottom, adapterX, adapterY, deletedHoles]);

  const [drawingWire, setDrawingWire] = useState(null);
  const [drawingPreview, setDrawingPreview] = useState(null);
  const [placingResistor, setPlacingResistor] = useState(null);
  const [placingCapacitor, setPlacingCapacitor] = useState(null);
  const [dragGroup, setDragGroup] = useState(null);  const [mouseDownPos, setMouseDownPos] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (tool === 'wire' && drawingWire) {
          if (drawingWire.points.length > 1) { const newWires = [...wires, { ...drawingWire, id: Date.now() }]; setWires(newWires); saveToHistory(components, newWires); }
          setDrawingWire(null); setDrawingPreview(null);
        } else if (tool === 'cut' && drawingPreview) {
          setDrawingPreview(null); setIsCutFinalized(true);
        }
      }
      if (e.key === 'Escape') { setDrawingWire(null); setDrawingPreview(null); setPlacingResistor(null); setPlacingCapacitor(null); setCutPath([]); setIsCutFinalized(false); }    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, drawingWire, wires, components, saveToHistory, tool, drawingPreview, cutPath, isCutFinalized]);
  const getOrthogonalPoint = (start, end) => {
    const dx = Math.abs(end.x - start.x), dy = Math.abs(end.y - start.y);
    return dx > dy ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  };

  const getBondedItems = (point) => {
    const bondedWires = []; const bondedComps = [];
    wires.forEach(w => w.points.forEach((p, idx) => { if (p.x === point.x && p.y === point.y) bondedWires.push({ id: w.id, index: idx }); }));
    components.forEach(c => {
      if (c.type === 'resistor' || c.type === 'capacitor') {
        if (c.start.x === point.x && c.start.y === point.y) bondedComps.push({ id: c.id, part: 'start' });
        if (c.end.x === point.x && c.end.y === point.y) bondedComps.push({ id: c.id, part: 'end' });
      } else if (c.type === 'button') {
        const pinOffsets = [
          { x: 0, y: 0 },
          { x: 2 * HOLE_SPACING, y: 0 },
          { x: 0, y: 6 * HOLE_SPACING },
          { x: 2 * HOLE_SPACING, y: 6 * HOLE_SPACING }
        ];
        for (let i = 0; i < pinOffsets.length; i++) {
          if (c.pos.x + pinOffsets[i].x === point.x && c.pos.y + pinOffsets[i].y === point.y) {
            bondedComps.push({ id: c.id, part: 'pos' });
            break;
          }
        }
      } else if (c.type === 'led') {
        for (let i=0; i<4; i++) {
          const px = c.pos.x + i * HOLE_SPACING;
          if (px === point.x && c.pos.y === point.y) { bondedComps.push({ id: c.id, part: 'pos' }); break; }
        }
      }
    });
    return { bondedWires, bondedComps };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setContextMenu(null);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom, y = (e.clientY - rect.top) / zoom;
    const snapped = snapToPoint(x, y, snapPoints, cutPath, tool);
    setMouseDownPos({ x, y, snapped });

    if (tool === 'wire') {
      if (!drawingWire) setDrawingWire({ points: [snapped], color: wireColor });
      else {
        const last = drawingWire.points[drawingWire.points.length - 1];
        const ortho = getOrthogonalPoint(last, snapped);
        const snappedOrtho = snapToPoint(ortho.x, ortho.y, snapPoints, cutPath, tool);
        if (snappedOrtho.x !== last.x || snappedOrtho.y !== last.y) setDrawingWire({ ...drawingWire, points: [...drawingWire.points, snappedOrtho] });
      }
    } else if (tool === 'cut') {
      // If we snapped to an existing point in the path, finalize
      if (snapped.id?.startsWith('cut-point-')) {
        const idx = parseInt(snapped.id.split('-')[2]);
        if (cutPath.length > 1 && idx !== cutPath.length - 1) {
          setIsCutFinalized(true);
          setDrawingPreview(null);
          return;
        }
      }
      
      setIsCutFinalized(false);
      const last = cutPath[cutPath.length - 1];
      if (!last || snapped.x !== last.x || snapped.y !== last.y) {
        setCutPath([...cutPath, snapped]);
      }
    } else if (tool === 'resistor') {
      if (!placingResistor) setPlacingResistor({ start: snapped, end: snapped });
      else {
        const newComps = [...components, { id: Date.now(), type: 'resistor', start: placingResistor.start, end: snapped, bodyPos: 0.5 }];
        setComponents(newComps); saveToHistory(newComps, wires); setPlacingResistor(null);
      }
    } else if (tool === 'capacitor') {
      if (!placingCapacitor) setPlacingCapacitor({ start: snapped, end: snapped });
      else {
        const newComps = [...components, { id: Date.now(), type: 'capacitor', start: placingCapacitor.start, end: snapped, bodyPos: 0.5 }];
        setComponents(newComps); saveToHistory(newComps, wires); setPlacingCapacitor(null);
      }
    } else if (tool === 'button') {
      const newComps = [...components, { id: Date.now(), type: 'button', pos: snapped }];
      setComponents(newComps); saveToHistory(newComps, wires);
    } else if (tool === 'led') {
      const newComps = [...components, { id: Date.now(), type: 'led', pos: snapped, color: ledColor }];
      setComponents(newComps); saveToHistory(newComps, wires);
    } else if (tool === 'edit') {
      for (const w of wires) { for (let i = 0; i < w.points.length; i++) { if (Math.sqrt((x - w.points[i].x)**2 + (y - w.points[i].y)**2) < 12) { setDragGroup({ type: 'joint', primary: { type: 'wire', id: w.id, index: i }, ...getBondedItems(w.points[i]), hasMoved: false }); return; } } }
      for (const c of components) {
        if (c.type === 'resistor' || c.type === 'capacitor') {
          if (Math.sqrt((x - c.start.x)**2 + (y - c.start.y)**2) < 12) { setDragGroup({ type: 'joint', primary: { type: 'comp', id: c.id, part: 'start' }, ...getBondedItems(c.start), hasMoved: false }); return; }
          if (Math.sqrt((x - c.end.x)**2 + (y - c.end.y)**2) < 12) { setDragGroup({ type: 'joint', primary: { type: 'comp', id: c.id, part: 'end' }, ...getBondedItems(c.end), hasMoved: false }); return; }
        } else if (c.type === 'button') {
          const pinOffsets = [{ x: 0, y: 0 }, { x: 2 * HOLE_SPACING, y: 0 }, { x: 0, y: 6 * HOLE_SPACING }, { x: 2 * HOLE_SPACING, y: 6 * HOLE_SPACING }];
          for (const off of pinOffsets) {
            if (Math.sqrt((x - (c.pos.x + off.x))**2 + (y - (c.pos.y + off.y))**2) < 12) { setDragGroup({ type: 'joint', primary: { type: 'comp', id: c.id, part: 'pos' }, ...getBondedItems({ x: c.pos.x + off.x, y: c.pos.y + off.y }), hasMoved: false }); return; }
          }
        } else if (c.type === 'led') {
          for (let i=0; i<4; i++) {
            const px = c.pos.x + i * HOLE_SPACING;
            if (Math.sqrt((x - px)**2 + (y - c.pos.y)**2) < 12) { setDragGroup({ type: 'joint', primary: { type: 'comp', id: c.id, part: 'pos' }, ...getBondedItems({ x: px, y: c.pos.y }), hasMoved: false }); return; }
          }
        }
      }
      for (const c of components) {
        if (c.type === 'resistor' || c.type === 'capacitor') {
          const bodyX = c.start.x + (c.end.x - c.start.x) * c.bodyPos, bodyY = c.start.y + (c.end.y - c.start.y) * c.bodyPos;
          if (Math.sqrt((x - bodyX)**2 + (y - bodyY)**2) < 20) { setDragGroup({ type: 'component', id: c.id, startState: JSON.parse(JSON.stringify(c)), bondedStart: getBondedItems(c.start), bondedEnd: getBondedItems(c.end), hasMoved: false }); return; }
        } else if (c.type === 'button') {
          const bodyX = c.pos.x + HOLE_SPACING, bodyY = c.pos.y + 3 * HOLE_SPACING;
          if (Math.sqrt((x - bodyX)**2 + (y - bodyY)**2) < 30) { 
            const pinOffsets = [{ x: 0, y: 0 }, { x: 2 * HOLE_SPACING, y: 0 }, { x: 0, y: 6 * HOLE_SPACING }, { x: 2 * HOLE_SPACING, y: 6 * HOLE_SPACING }];
            const bondedPins = pinOffsets.map(off => getBondedItems({ x: c.pos.x + off.x, y: c.pos.y + off.y }));
            setDragGroup({ type: 'button_body', id: c.id, startState: JSON.parse(JSON.stringify(c)), bondedPins, hasMoved: false }); 
            return; 
          }
        } else if (c.type === 'led') {
          const bodyX = c.pos.x + (1.5 * HOLE_SPACING), bodyY = c.pos.y - 25;
          if (Math.sqrt((x - bodyX)**2 + (y - bodyY)**2) < 25) { const bondedPins = [0,1,2,3].map(i => getBondedItems({ x: c.pos.x + i * HOLE_SPACING, y: c.pos.y })); setDragGroup({ type: 'led_body', id: c.id, startState: JSON.parse(JSON.stringify(c)), bondedPins, hasMoved: false }); return; }
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom, y = (e.clientY - rect.top) / zoom;
    const snapped = snapToPoint(x, y, snapPoints, cutPath, tool);
    if (tool === 'wire' && drawingWire) {
      const last = drawingWire.points[drawingWire.points.length - 1];
      const ortho = getOrthogonalPoint(last, snapped);
      setDrawingPreview(snapToPoint(ortho.x, ortho.y, snapPoints, cutPath, tool));
    } else if (tool === 'cut' && cutPath.length > 0) {
      setDrawingPreview(snapped);
    } else if (tool === 'resistor' && placingResistor) {
      setPlacingResistor({ ...placingResistor, end: snapped });
    } else if (tool === 'capacitor' && placingCapacitor) {
      setPlacingCapacitor({ ...placingCapacitor, end: snapped });
    } else if (dragGroup) {
      const dist = Math.sqrt((x - mouseDownPos.x)**2 + (y - mouseDownPos.y)**2);
      if (dist > 3) setDragGroup(prev => ({ ...prev, hasMoved: true }));
      let nC = [...components], nW = [...wires];
      if (dragGroup.type === 'joint') {
        dragGroup.bondedComps.forEach(bg => {
          nC = nC.map(c => {
            if (c.id === bg.id) {
              if (bg.part === 'start') return { ...c, start: snapped };
              if (bg.part === 'pos') return { ...c, pos: snapped };
              if (bg.part === 'end') return { ...c, end: snapped };
            }
            return c;
          });
        });
        dragGroup.bondedWires.forEach(bw => {
          nW = nW.map(w => {
            if (w.id === bw.id) {
              const pts = [...w.points]; let fP = snapped;
              if (bw.index === 0 && w.points.length > 1) fP = snapToPoint(getOrthogonalPoint(w.points[1], snapped).x, getOrthogonalPoint(w.points[1], snapped).y, snapPoints, cutPath, tool);
              else if (bw.index === w.points.length - 1 && w.points.length > 1) fP = snapToPoint(getOrthogonalPoint(w.points[w.points.length - 2], snapped).x, getOrthogonalPoint(w.points[w.points.length - 2], snapped).y, snapPoints, cutPath, tool);
              pts[bw.index] = fP; return { ...w, points: pts };
            }
            return w;
          });
        });
      } else if (dragGroup.type === 'component') {
        const dx = snapped.x - mouseDownPos.snapped.x, dy = snapped.y - mouseDownPos.snapped.y;
        nC = nC.map(c => c.id === dragGroup.id ? { ...c, start: { x: dragGroup.startState.start.x + dx, y: dragGroup.startState.start.y + dy }, end: { x: dragGroup.startState.end.x + dx, y: dragGroup.startState.end.y + dy } } : c);
        dragGroup.bondedStart.bondedWires.forEach(bw => nW = nW.map(w => w.id === bw.id ? { ...w, points: w.points.map((p, i) => i === bw.index ? { x: dragGroup.startState.start.x + dx, y: dragGroup.startState.start.y + dy } : p) } : w));
        dragGroup.bondedEnd.bondedWires.forEach(bw => nW = nW.map(w => w.id === bw.id ? { ...w, points: w.points.map((p, i) => i === bw.index ? { x: dragGroup.startState.end.x + dx, y: dragGroup.startState.end.y + dy } : p) } : w));
      } else if (dragGroup.type === 'led_body') {
        const dx = snapped.x - mouseDownPos.snapped.x, dy = snapped.y - mouseDownPos.snapped.y;
        nC = nC.map(c => c.id === dragGroup.id ? { ...c, pos: { x: dragGroup.startState.pos.x + dx, y: dragGroup.startState.pos.y + dy } } : c);
        dragGroup.bondedPins.forEach((bp, i) => {
          const pinPos = { x: dragGroup.startState.pos.x + i * HOLE_SPACING + dx, y: dragGroup.startState.pos.y + dy };
          bp.bondedWires.forEach(bw => nW = nW.map(w => w.id === bw.id ? { ...w, points: w.points.map((p, idx) => idx === bw.index ? pinPos : p) } : w));
        });
      } else if (dragGroup.type === 'button_body') {
        const dx = snapped.x - mouseDownPos.snapped.x, dy = snapped.y - mouseDownPos.snapped.y;
        nC = nC.map(c => c.id === dragGroup.id ? { ...c, pos: { x: dragGroup.startState.pos.x + dx, y: dragGroup.startState.pos.y + dy } } : c);
        const pinOffsets = [{ x: 0, y: 0 }, { x: 2 * HOLE_SPACING, y: 0 }, { x: 0, y: 6 * HOLE_SPACING }, { x: 2 * HOLE_SPACING, y: 6 * HOLE_SPACING }];
        dragGroup.bondedPins.forEach((bp, i) => {
          const pinPos = { x: dragGroup.startState.pos.x + pinOffsets[i].x + dx, y: dragGroup.startState.pos.y + pinOffsets[i].y + dy };
          bp.bondedWires.forEach(bw => nW = nW.map(w => w.id === bw.id ? { ...w, points: w.points.map((p, idx) => idx === bw.index ? pinPos : p) } : w));
        });
      }
      setComponents(nC); setWires(nW);
    }
  };

  const handleMouseUp = () => {
    if (dragGroup && !dragGroup.hasMoved) {
      const primary = dragGroup.primary; let wE = null, pts = null;
      if (primary && primary.type === 'wire') { const wire = wires.find(w => w.id === primary.id); if (wire && (primary.index === 0 || primary.index === wire.points.length - 1)) { wE = wire; pts = primary.index === 0 ? [...wire.points].reverse() : [...wire.points]; } }
      else if (primary && primary.type === 'comp' && (primary.part === 'start' || primary.part === 'end' || primary.part === 'pos')) {
        const comp = components.find(c => c.id === primary.id);
        if (comp) { 
          const p = mouseDownPos.snapped;
          wE = { points: [p], color: wireColor }; 
          pts = [p]; 
        }
      }
      if (wE) { setTool('wire'); setDrawingWire({ ...wE, points: pts }); if (primary.type === 'wire') setWires(wires.filter(w => w.id !== wE.id)); }
    }
    if (dragGroup && dragGroup.hasMoved) saveToHistory(components, wires);
    setDragGroup(null); setMouseDownPos(null);
  };

  const clearProject = () => { if (window.confirm('Clear entire project?')) { setComponents([]); setWires([]); setDeletedHoles([]); saveToHistory([], [], []); } };
  const handleLedContextMenu = (e, id) => setContextMenu({ x: e.clientX, y: e.clientY, id });
  const changeLedColor = (color) => { if (contextMenu) { const newComps = components.map(c => c.id === contextMenu.id ? { ...c, color } : c); setComponents(newComps); saveToHistory(newComps, wires); setContextMenu(null); } };
  const deleteItem = (type, id) => { let nC = components, nW = wires; if (type === 'wire') nW = wires.filter(w => w.id !== id); else nC = components.filter(c => c.id !== id); setComponents(nC); setWires(nW); saveToHistory(nC, nW); };

  const getBoardPath = () => {
    let d = ''; const activeHoles = new Set(deletedHoles);
    for (let r = 0; r < boardRows; r++) { for (let c = 0; c < boardCols; c++) { if (!activeHoles.has(`${r}-${c}`)) { const x = BOARD_PADDING + c * HOLE_SPACING - 10, y = BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING - 10; d += `M ${x} ${y} h 20 v 20 h -20 z `; } } }
    return d;
  };

  const confirmCut = (keepInside) => {
    if (cutPath.length < 3) return;
    const newDeleted = new Set(deletedHoles);
    for (let r = 0; r < boardRows; r++) { for (let c = 0; c < boardCols; c++) { const pt = { x: BOARD_PADDING + c * HOLE_SPACING, y: BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING }; if (keepInside ? !isPointInPolygon(pt, cutPath) : isPointInPolygon(pt, cutPath)) newDeleted.add(`${r}-${c}`); } }
    const finalDeleted = Array.from(newDeleted); setDeletedHoles(finalDeleted); saveToHistory(components, wires, finalDeleted); setCutPath([]); setIsCutFinalized(false); setTool('edit');
  };

  const sliceBoard = () => {
    if (cutPath.length < 2) return;
    const newDeleted = new Set(deletedHoles);
    for (let i = 0; i < cutPath.length - 1; i++) {
      const p1 = cutPath[i], p2 = cutPath[i+1];
      for (let r = 0; r < boardRows; r++) { for (let c = 0; c < boardCols; c++) {
        const pt = { x: BOARD_PADDING + c * HOLE_SPACING, y: BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING };
        const dx = p2.x - p1.x, dy = p2.y - p1.y; const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / (dx * dx + dy * dy)));
        const dist = Math.sqrt((pt.x - (p1.x + t * dx))**2 + (pt.y - (p1.y + t * dy))**2); if (dist < 10) newDeleted.add(`${r}-${c}`);
      } }
    }
    const remainingHoles = []; for (let r = 0; r < boardRows; r++) { for (let c = 0; c < boardCols; c++) { if (!newDeleted.has(`${r}-${c}`)) remainingHoles.push({r, c}); } }
    const visited = new Set(); const islands = [];
    remainingHoles.forEach(h => {
      const key = `${h.r}-${h.c}`;
      if (!visited.has(key)) {
        const island = []; const queue = [h]; visited.add(key);
        while (queue.length > 0) {
          const curr = queue.shift(); island.push(curr);
          [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
            const nr = curr.r + dr, nc = curr.c + dc; const nKey = `${nr}-${nc}`;
            if (nr >= 0 && nr < boardRows && nc >= 0 && nc < boardCols && !newDeleted.has(nKey) && !visited.has(nKey)) { visited.add(nKey); queue.push({r: nr, c: nc}); }
          });
        } islands.push(island);
      }
    });
    const pinsToKeep = new Set(); wires.forEach(w => w.points.forEach(p => pinsToKeep.add(`${p.x},${p.y}`)));
    components.forEach(c => { 
      if (c.type === 'resistor' || c.type === 'capacitor') { 
        pinsToKeep.add(`${c.start.x},${c.start.y}`); pinsToKeep.add(`${c.end.x},${c.end.y}`); 
      } else if (c.type === 'button') {
        const pinOffsets = [{ x: 0, y: 0 }, { x: 2 * HOLE_SPACING, y: 0 }, { x: 0, y: 6 * HOLE_SPACING }, { x: 2 * HOLE_SPACING, y: 6 * HOLE_SPACING }];
        pinOffsets.forEach(off => pinsToKeep.add(`${c.pos.x + off.x},${c.pos.y + off.y}`));
      } else if (c.type === 'led') { 
        for(let i=0; i<4; i++) pinsToKeep.add(`${c.pos.x + i*HOLE_SPACING},${c.pos.y}`); 
      } 
    });
    snapPoints.forEach(p => { if (p.id?.startsWith('pin') || p.id?.startsWith('adapter')) pinsToKeep.add(`${p.x},${p.y}`); });
    const finalDeletedHoles = new Set(newDeleted);
    islands.forEach(island => {
      const hasContent = island.some(h => { const x = BOARD_PADDING + h.c * HOLE_SPACING, y = BOARD_PADDING + ESP32_HEIGHT + 60 + h.r * HOLE_SPACING; return pinsToKeep.has(`${x},${y}`); });
      if (!hasContent && island.length > 0) island.forEach(h => finalDeletedHoles.add(`${h.r}-${h.c}`));
    });
    const finalArr = Array.from(finalDeletedHoles); setDeletedHoles(finalArr); saveToHistory(components, wires, finalArr); setCutPath([]); setIsCutFinalized(false); setTool('edit');
  };

  const activeHolesSet = new Set(deletedHoles);
  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
        <h1 className="text-xl font-bold flex items-center gap-2"><Zap className="text-yellow-400" /> Perfboard</h1>
        
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Components</p>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton active={tool === 'wire'} onClick={() => { setTool('wire'); setCutPath([]); setIsCutFinalized(false); }} icon={<Minus />} label="Wire" />
              <ToolButton active={tool === 'resistor'} onClick={() => { setTool('resistor'); setCutPath([]); setIsCutFinalized(false); }} icon={<div className="w-5 h-2 bg-amber-700 rounded-full" />} label="Resistor" />
              <ToolButton active={tool === 'capacitor'} onClick={() => { setTool('capacitor'); setCutPath([]); setIsCutFinalized(false); }} icon={<div className="w-4 h-4 bg-yellow-600 rounded-full border border-yellow-400" />} label="Capacitor" />
              <ToolButton active={tool === 'led'} onClick={() => { setTool('led'); setCutPath([]); setIsCutFinalized(false); }} icon={<Lightbulb />} label="LED" />
              <ToolButton active={tool === 'button'} onClick={() => { setTool('button'); setCutPath([]); setIsCutFinalized(false); }} icon={<div className="w-4 h-4 bg-gray-600 rounded-sm border-2 border-gray-400" />} label="Button" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tools</p>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton active={tool === 'cut'} onClick={() => { setTool('cut'); setCutPath([]); setIsCutFinalized(false); }} icon={<Scissors />} label="Cut" />
              <ToolButton active={tool === 'edit'} onClick={() => { setTool('edit'); setCutPath([]); setIsCutFinalized(false); }} icon={<MousePointer2 />} label="Edit" />
              <ToolButton active={tool === 'delete'} onClick={() => { setTool('delete'); setCutPath([]); setIsCutFinalized(false); }} icon={<Trash2 />} label="Delete" />
              <ToolButton active={false} onClick={() => setShowSettings(true)} icon={<Settings />} label="Controller" />
            </div>
          </div>
        </div>

        {tool === 'wire' && (
          <div className="space-y-4 border-t border-gray-700 pt-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Wire Color</p>
              <div className="flex gap-2 mb-3">
                <input 
                  type="color" 
                  value={wireColor} 
                  onChange={(e) => setWireColor(e.target.value)} 
                  className="w-12 h-10 rounded cursor-pointer bg-transparent border border-gray-600 p-1" 
                />
                <button 
                  onClick={addCustomColor}
                  className="flex-1 h-10 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-1 text-xs"
                  title="Add to palette"
                >
                  <Plus size={16} /> Save
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase mb-1">Standard</p>
                  <div className="grid grid-cols-6 gap-1">
                    {colorPresets.map(c => (
                      <button 
                        key={c} 
                        onClick={() => setWireColor(c)}
                        className={`w-full aspect-square rounded-sm border ${wireColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {customColors.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase mb-1">Recent</p>
                    <div className="grid grid-cols-6 gap-1">
                      {customColors.map((c, i) => (
                        <div key={`${c}-${i}`} className="relative group">
                          <button 
                            onClick={() => setWireColor(c)}
                            className={`w-full aspect-square rounded-sm border ${wireColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeCustomColor(c); }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-2 border-t border-gray-700 pt-4">
          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"><Undo2 size={20}/></button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"><Redo2 size={20}/></button>
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <div className="flex gap-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:text-white"><Minimize size={16} /></button>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:text-white"><Maximize size={16} /></button>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-700 pt-4 mt-2">
            <button onClick={clearProject} className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white py-2 rounded text-xs font-medium transition-all">Clear Project</button>
            <button className="bg-blue-600 hover:bg-blue-700 py-2 rounded text-xs font-medium transition-colors">Export Project</button>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-auto bg-gray-950 p-8 min-w-0">
        <div style={{ width: baseWidth * zoom, height: baseHeight * zoom }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="transition-transform duration-75">
            <svg ref={canvasRef} width={baseWidth} height={baseHeight} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="bg-gray-900 rounded-lg shadow-2xl cursor-crosshair select-none">
              <path d={getBoardPath()} fill="#2c4c3b" stroke="#1a3327" strokeWidth="2" strokeLinejoin="round" />
              {Array.from({ length: boardCols }).map((_, c) => <text key={c} x={BOARD_PADDING + c * HOLE_SPACING} y={BOARD_PADDING + ESP32_HEIGHT + 40} fill="#888" fontSize="8" textAnchor="middle">{String.fromCharCode(65 + (c % 26))}</text>)}
              {Array.from({ length: boardRows }).map((_, r) => <text key={r} x={BOARD_PADDING - 25} y={BOARD_PADDING + ESP32_HEIGHT + 63 + r * HOLE_SPACING} fill="#888" fontSize="8" textAnchor="end">{r + 1}</text>)}
              {Array.from({ length: boardRows }).map((_, r) => Array.from({ length: boardCols }).map((_, c) => (!activeHolesSet.has(`${r}-${c}`) && <circle key={`${r}-${c}`} cx={BOARD_PADDING + c * HOLE_SPACING} cy={BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING} r={HOLE_RADIUS} fill="#1a1a1a" />)))}
              <ESP32Module x={espStartX} y={BOARD_PADDING} pinsTop={espPinsTop} pinsBottom={espPinsBottom} width={dynamicEspWidth} />
              <PowerAdapter x={adapterX} y={adapterY} />
              {cutPath.length > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  <polyline points={cutPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="3" />
                  {drawingPreview && tool === 'cut' && !isCutFinalized && (
                    <>
                      <line x1={cutPath[cutPath.length-1].x} y1={cutPath[cutPath.length-1].y} x2={drawingPreview.x} y2={drawingPreview.y} stroke="#ef4444" strokeWidth="3" opacity="0.5" strokeDasharray="5,5" />
                      {drawingPreview.id?.startsWith('cut-point-') && (
                        <circle cx={drawingPreview.x} cy={drawingPreview.y} r="12" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
                      )}
                    </>
                  )}
                  {cutPath.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#ef4444" />)}
                </g>
              )}
              {placingResistor && <ComponentRenderer comp={{ type: 'resistor', start: placingResistor.start, end: placingResistor.end, bodyPos: 0.5 }} tool="preview" />}
              {placingCapacitor && <ComponentRenderer comp={{ type: 'capacitor', start: placingCapacitor.start, end: placingCapacitor.end, bodyPos: 0.5 }} tool="preview" />}
              {components.map(c => <ComponentRenderer key={c.id} comp={c} tool={tool} onDelete={() => deleteItem('comp', c.id)} onContextMenu={handleLedContextMenu} />)}
              {wires.map(w => (
                <g key={w.id} onClick={() => tool === 'delete' && deleteItem('wire', w.id)}>
                  <polyline points={w.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={w.color} strokeWidth="4" strokeLinecap="round" strokeJoin="round" />
                  {tool === 'edit' && w.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="6" fill="white" opacity="0.4" className="cursor-move" />)}
                </g>
              ))}
              {drawingWire && (
                <g>
                  <polyline points={drawingWire.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={drawingWire.color} strokeWidth="4" opacity="0.8" strokeLinecap="round" strokeJoin="round" />
                  {drawingPreview && tool === 'wire' && <line x1={drawingWire.points[drawingWire.points.length-1].x} y1={drawingWire.points[drawingWire.points.length-1].y} x2={drawingPreview.x} y2={drawingPreview.y} stroke={drawingWire.color} strokeWidth="4" opacity="0.3" strokeDasharray="5,5" />}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
      {cutPath.length > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-gray-800 border border-gray-700 p-4 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4">
          <p className="text-xs font-bold text-gray-400 uppercase flex items-center mr-4 border-r border-gray-700 pr-4">Cut Region Selected</p>
          <button onClick={sliceBoard} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-lg shadow-orange-900/20">Slice & Clean</button>
          {cutPath.length > 2 && (
            <>
              <button onClick={() => confirmCut(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-lg shadow-green-900/20">Keep Inside</button>
              <button onClick={() => confirmCut(false)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-lg shadow-red-900/20">Delete Inside</button>
            </>
          )}
          <button onClick={() => { setCutPath([]); setIsCutFinalized(false); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-xs font-bold transition-all">Cancel</button>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="text-blue-400" /> Controller Pin Configuration</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-700 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">
              <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-700">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Board Dimensions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500 uppercase">Rows</label>
                      <input type="number" value={boardRows} onChange={(e) => setBoardRows(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500 uppercase">Columns</label>
                      <input type="number" value={boardCols} onChange={(e) => setBoardCols(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div className="col-span-2 pt-2">
                      <button onClick={() => { if (window.confirm('Reset all board cuts?')) { setDeletedHoles([]); saveToHistory(components, wires, []); } }} className="w-full bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white py-2 rounded text-xs font-bold transition-all border border-orange-600/30">Reset Board Shape (Clear Cuts)</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest">Top Row Pins</h3>
                    <button onClick={() => setEspPinsTop([...espPinsTop, 'NEW'])} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs transition-colors"><Plus size={14} /> Add</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {espPinsTop.map((pin, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <input value={pin} onChange={(e) => { const n = [...espPinsTop]; n[i] = e.target.value; setEspPinsTop(n); }} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none" />
                        <button onClick={() => setEspPinsTop(espPinsTop.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest">Bottom Row Pins</h3>
                    <button onClick={() => setEspPinsBottom([...espPinsBottom, 'NEW'])} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs transition-colors"><Plus size={14} /> Add</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {espPinsBottom.map((pin, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <input value={pin} onChange={(e) => { const n = [...espPinsBottom]; n[i] = e.target.value; setEspPinsBottom(n); }} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none" />
                        <button onClick={() => setEspPinsBottom(espPinsBottom.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 bg-gray-900/30 flex justify-between items-center text-xs text-gray-400 italic">
               <p>* Changes are saved automatically and affect the physical layout instantly.</p>
               <button onClick={() => setShowSettings(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold transition-all shadow-lg shadow-blue-900/20">Done</button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <div className="fixed bg-gray-800 border border-gray-700 shadow-xl rounded-lg p-3 flex flex-col gap-2 z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <p className="text-[10px] text-gray-400 uppercase font-bold text-center">Color</p>
          <div className="flex gap-2">
            {['red', 'green', 'blue'].map(c => (
              <button key={c} onClick={() => changeLedColor(c)} className="w-8 h-8 rounded-full border-2 border-transparent hover:border-white transition-all shadow-lg" style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
