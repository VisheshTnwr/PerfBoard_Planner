import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  Minus, 
  Lightbulb, 
  Trash2, 
  Zap, 
  Download, 
  Maximize,
  Minimize,
  MousePointer2,
  Undo2,
  Redo2
} from 'lucide-react';

import ToolButton from './components/ToolButton';
import ESP32Module from './components/ESP32Module';
import ComponentRenderer from './components/ComponentRenderer';
import { 
  ROWS, 
  COLS, 
  HOLE_SPACING, 
  HOLE_RADIUS, 
  BOARD_PADDING, 
  ESP32_WIDTH, 
  ESP32_HEIGHT, 
  PIN_SPACING,
  ESP32_PINS_TOP,
  ESP32_PINS_BOTTOM
} from './constants';

const snapToPoint = (x, y, snapPoints) => {
  let minDist = Infinity;
  let snappedPoint = { x, y, id: null };
  for (const p of snapPoints) {
    const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
    if (dist < minDist && dist < 15) {
      minDist = dist;
      snappedPoint = { x: p.x, y: p.y, id: p.id };
    }
  }
  return snappedPoint;
};

const App = () => {
  const [boardRows, setBoardRows] = useState(ROWS);
  const [boardCols, setBoardCols] = useState(COLS);
  const [tool, setTool] = useState('wire');
  const [wireColor, setWireColor] = useState('#ff0000');
  const [ledColor, setLedColor] = useState('red');
  const [components, setComponents] = useState([]);
  const [wires, setWires] = useState([]);
  const [history, setHistory] = useState([{ components: [], wires: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [drawingWire, setDrawingWire] = useState(null);
  const [drawingPreview, setDrawingPreview] = useState(null);
  const [draggingComp, setDraggingComp] = useState(null);
  const [draggingWire, setDraggingWire] = useState(null);
  const [mouseDownPos, setMouseDownPos] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);

  const espStartX = BOARD_PADDING + 3 * HOLE_SPACING - 50;

  const snapPoints = useMemo(() => {
    const points = [];
    for (let r = 0; r < boardRows; r++) {
      for (let c = 0; c < boardCols; c++) {
        points.push({ x: BOARD_PADDING + c * HOLE_SPACING, y: BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING, id: `hole-${r}-${c}` });
      }
    }
    ESP32_PINS_TOP.forEach((pin, i) => points.push({ x: espStartX + 50 + i * PIN_SPACING, y: BOARD_PADDING + 10, id: `pin-t-${i}` }));
    ESP32_PINS_BOTTOM.forEach((pin, i) => points.push({ x: espStartX + 50 + i * PIN_SPACING, y: BOARD_PADDING + ESP32_HEIGHT - 10, id: `pin-b-${i}` }));
    return points;
  }, [boardRows, boardCols, espStartX]);

  const saveToHistory = useCallback((newComps, newWires) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ components: JSON.parse(JSON.stringify(newComps)), wires: JSON.parse(JSON.stringify(newWires)) });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      setComponents(state.components);
      setWires(state.wires);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      setComponents(state.components);
      setWires(state.wires);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (e.key === 'Enter' && drawingWire) {
        e.preventDefault();
        if (drawingWire.points.length > 1) {
          const finalPoints = [...drawingWire.points];
          if (drawingPreview) finalPoints.push(drawingPreview);
          const newWires = [...wires, { ...drawingWire, points: finalPoints, id: drawingWire.id || Date.now() }];
          setWires(newWires);
          saveToHistory(components, newWires);
        }
        setDrawingWire(null);
        setDrawingPreview(null);
      }
      if (e.key === 'Escape' && drawingWire) {
        setDrawingWire(null);
        setDrawingPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, drawingWire, drawingPreview, wires, components, saveToHistory]);

  const getOrthogonalPoint = (start, end) => {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    return dx > dy ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setContextMenu(null);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const snapped = snapToPoint(x, y, snapPoints);
    setMouseDownPos({ x, y });

    if (tool === 'wire') {
      if (!drawingWire) {
        setDrawingWire({ points: [snapped], color: wireColor });
      } else {
        const lastPoint = drawingWire.points[drawingWire.points.length - 1];
        const orthoPoint = getOrthogonalPoint(lastPoint, snapped);
        const snappedOrtho = snapToPoint(orthoPoint.x, orthoPoint.y, snapPoints);
        if (snappedOrtho.x !== lastPoint.x || snappedOrtho.y !== lastPoint.y) {
           setDrawingWire({ ...drawingWire, points: [...drawingWire.points, snappedOrtho] });
        }
      }
    } else if (tool === 'resistor') {
      const newComps = [...components, { id: Date.now(), type: 'resistor', start: snapped, end: { x: snapped.x + HOLE_SPACING * 3, y: snapped.y, id: null }, bodyPos: 0.5 }];
      setComponents(newComps);
      saveToHistory(newComps, wires);
      setDraggingComp({ id: newComps[newComps.length - 1].id, part: 'end' });
    } else if (tool === 'led') {
      const newComps = [...components, { id: Date.now(), type: 'led', pos: snapped, color: ledColor }];
      setComponents(newComps);
      saveToHistory(newComps, wires);
    } else if (tool === 'edit') {
      for (const w of wires) {
        for (let i = 0; i < w.points.length; i++) {
          if (Math.sqrt((x - w.points[i].x)**2 + (y - w.points[i].y)**2) < 12) {
            setDraggingWire({ id: w.id, index: i, hasMoved: false }); 
            return;
          }
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const snapped = snapToPoint(x, y, snapPoints);

    if (drawingWire) {
      const lastPoint = drawingWire.points[drawingWire.points.length - 1];
      const orthoPoint = getOrthogonalPoint(lastPoint, snapped);
      setDrawingPreview(snapToPoint(orthoPoint.x, orthoPoint.y, snapPoints));
    } else if (draggingComp) {
      setComponents(components.map(c => {
        if (c.id === draggingComp.id) {
          if (draggingComp.part === 'start') return { ...c, start: snapped };
          if (draggingComp.part === 'pos') return { ...c, pos: snapped };
          if (draggingComp.part === 'end') {
            const isHorizontal = Math.abs(snapped.x - c.start.x) > Math.abs(snapped.y - c.start.y);
            const endX = isHorizontal ? snapped.x : c.start.x;
            const endY = isHorizontal ? c.start.y : snapped.y;
            return { ...c, end: snapToPoint(endX, endY, snapPoints) };
          }
          if (draggingComp.part === 'body') {
            const dx = c.end.x - c.start.x, dy = c.end.y - c.start.y, lenSq = dx*dx + dy*dy;
            if (lenSq === 0) return c;
            const t = ((x - c.start.x) * dx + (y - c.start.y) * dy) / lenSq;
            return { ...c, bodyPos: Math.max(0.1, Math.min(0.9, t)) };
          }
        }
        return c;
      }));
    } else if (draggingWire) {
      const dist = Math.sqrt((x - mouseDownPos.x)**2 + (y - mouseDownPos.y)**2);
      if (dist > 5) setDraggingWire(prev => ({ ...prev, hasMoved: true }));

      setWires(wires.map(w => {
        if (w.id === draggingWire.id) {
          const newPoints = [...w.points];
          let finalPos = snapped;

          if (draggingWire.index === 0 && w.points.length > 1) {
            const next = w.points[1];
            const ortho = getOrthogonalPoint(next, snapped);
            finalPos = snapToPoint(ortho.x, ortho.y, snapPoints);
          } else if (draggingWire.index === w.points.length - 1 && w.points.length > 1) {
            const prev = w.points[w.points.length - 2];
            const ortho = getOrthogonalPoint(prev, snapped);
            finalPos = snapToPoint(ortho.x, ortho.y, snapPoints);
          } else if (w.points.length > 2) {
             // Middle point: try to maintain orthogonality with neighbors
             // This is complex, simplest is just snap for now
             finalPos = snapped;
          }

          newPoints[draggingWire.index] = finalPos;
          return { ...w, points: newPoints };
        }
        return w;
      }));
    }
  };

  const handleMouseUp = (e) => {
    if (draggingWire && !draggingWire.hasMoved) {
      const wire = wires.find(w => w.id === draggingWire.id);
      if (wire && (draggingWire.index === 0 || draggingWire.index === wire.points.length - 1)) {
        setTool('wire');
        const points = [...wire.points];
        if (draggingWire.index === 0) points.reverse();
        setDrawingWire({ ...wire, points: points });
        setWires(wires.filter(w => w.id !== wire.id));
      }
    }

    if (draggingComp || (draggingWire && draggingWire.hasMoved)) {
      saveToHistory(components, wires);
    }
    setDraggingComp(null);
    setDraggingWire(null);
    setMouseDownPos(null);
  };

  const handleLedContextMenu = (e, id) => {
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  const changeLedColor = (color) => {
    if (contextMenu) {
      const newComps = components.map(c => c.id === contextMenu.id ? { ...c, color } : c);
      setComponents(newComps);
      saveToHistory(newComps, wires);
      setContextMenu(null);
    }
  };

  const deleteItem = (type, id) => {
    let newComps = components, newWires = wires;
    if (type === 'wire') newWires = wires.filter(w => w.id !== id);
    else newComps = components.filter(c => c.id !== id);
    setComponents(newComps); setWires(newWires);
    saveToHistory(newComps, newWires);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
        <h1 className="text-xl font-bold flex items-center gap-2"><Zap className="text-yellow-400" /> Perfboard</h1>
        
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Board Size</p>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={boardRows} 
              onChange={(e) => setBoardRows(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              placeholder="Rows"
            />
            <span className="text-gray-500">×</span>
            <input 
              type="number" 
              value={boardCols} 
              onChange={(e) => setBoardCols(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              placeholder="Cols"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ToolButton active={tool === 'wire'} onClick={() => setTool('wire')} icon={<Minus />} label="Wire" />
          <ToolButton active={tool === 'resistor'} onClick={() => setTool('resistor')} icon={<div className="w-5 h-2 bg-amber-700 rounded-full" />} label="Resistor" />
          <ToolButton active={tool === 'led'} onClick={() => setTool('led')} icon={<Lightbulb />} label="LED" />
          <ToolButton active={tool === 'edit'} onClick={() => setTool('edit')} icon={<MousePointer2 />} label="Edit" />
          <ToolButton active={tool === 'delete'} onClick={() => setTool('delete')} icon={<Trash2 />} label="Delete" />
        </div>

        {tool === 'wire' && (
          <div className="space-y-2 border-t border-gray-700 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wire Color</p>
            <input 
              type="color" 
              value={wireColor} 
              onChange={(e) => setWireColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer bg-transparent border border-gray-600 p-1"
            />
          </div>
        )}

        <div className="flex gap-2 border-t border-gray-700 pt-4">
          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"><Undo2 size={20}/></button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"><Redo2 size={20}/></button>
        </div>

        <div className="mt-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-[10px] text-gray-500 bg-gray-900/50 p-2 rounded border border-gray-700">
             <p className="text-gray-400 font-bold mb-1">CONTROLS</p>
             <p>Wire: Click segments, Enter to finish.</p>
             <p>Edit: Click end point to extend.</p>
             <p>LED: 4-pin RGB. Right-click to switch color.</p>
             <p>Undo: Ctrl+Z | Redo: Ctrl+Shift+Z</p>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <div className="flex gap-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:text-white"><Minimize size={16} /></button>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:text-white"><Maximize size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto bg-gray-950 p-8">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="transition-transform duration-75">
          <svg ref={canvasRef} width={boardCols * HOLE_SPACING + BOARD_PADDING * 2 + 100} height={boardRows * HOLE_SPACING + ESP32_HEIGHT + 300} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="bg-gray-900 rounded-lg shadow-2xl cursor-crosshair select-none">
            <rect x={BOARD_PADDING - 10} y={BOARD_PADDING + ESP32_HEIGHT + 50} width={boardCols * HOLE_SPACING + 20} height={boardRows * HOLE_SPACING + 20} fill="#2c4c3b" rx="10" stroke="#1a3327" strokeWidth="4" />
            
            {Array.from({ length: boardCols }).map((_, c) => (
              <text key={`col-label-${c}`} x={BOARD_PADDING + c * HOLE_SPACING} y={BOARD_PADDING + ESP32_HEIGHT + 40} fill="#888" fontSize="8" fontWeight="bold" textAnchor="middle">
                {String.fromCharCode(65 + (c % 26))}
              </text>
            ))}

            {Array.from({ length: boardRows }).map((_, r) => (
              <text key={`row-label-${r}`} x={BOARD_PADDING - 25} y={BOARD_PADDING + ESP32_HEIGHT + 63 + r * HOLE_SPACING} fill="#888" fontSize="8" fontWeight="bold" textAnchor="end">
                {r + 1}
              </text>
            ))}

            {Array.from({ length: boardRows }).map((_, r) => Array.from({ length: boardCols }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={BOARD_PADDING + c * HOLE_SPACING} cy={BOARD_PADDING + ESP32_HEIGHT + 60 + r * HOLE_SPACING} r={HOLE_RADIUS} fill="#1a1a1a" />
            )))}
            
            <ESP32Module x={espStartX} y={BOARD_PADDING} />
            
            {wires.map(w => (
              <g key={w.id} onClick={() => tool === 'delete' && deleteItem('wire', w.id)}>
                <polyline points={w.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={w.color} strokeWidth="4" strokeLinecap="round" strokeJoin="round" />
                {tool === 'edit' && w.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="6" fill="white" opacity="0.4" className="cursor-move" />)}
              </g>
            ))}

            {drawingWire && (
              <g>
                <polyline points={drawingWire.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={drawingWire.color} strokeWidth="4" opacity="0.6" strokeLinecap="round" strokeJoin="round" />
                {drawingPreview && (
                  <line 
                    x1={drawingWire.points[drawingWire.points.length-1].x} 
                    y1={drawingWire.points[drawingWire.points.length-1].y} 
                    x2={drawingPreview.x} 
                    y2={drawingPreview.y} 
                    stroke={drawingWire.color} 
                    strokeWidth="4" 
                    opacity="0.3" 
                  />
                )}
              </g>
            )}

            {components.map(c => (
              <ComponentRenderer key={c.id} comp={c} tool={tool} onDelete={() => deleteItem('comp', c.id)} onDrag={(part) => setDraggingComp({ id: c.id, part })} onContextMenu={handleLedContextMenu} />
            ))}
          </svg>
        </div>
      </div>

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
