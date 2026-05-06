import React from 'react';
import { HOLE_SPACING } from '../constants';

const ComponentRenderer = ({ comp, tool, onDelete, onDrag, onContextMenu }) => {
  if (comp.type === 'resistor') {
    const isHorizontal = Math.abs(comp.end.x - comp.start.x) > Math.abs(comp.end.y - comp.start.y);
    const endX = isHorizontal ? comp.end.x : comp.start.x;
    const endY = isHorizontal ? comp.start.y : comp.end.y;

    const angle = isHorizontal ? 0 : 90;
    const bodyWidth = 40;
    const bodyX = comp.start.x + (endX - comp.start.x) * comp.bodyPos;
    const bodyY = comp.start.y + (endY - comp.start.y) * comp.bodyPos;

    return (
      <g className={tool === 'delete' ? 'hover:opacity-50 cursor-pointer' : ''} onClick={() => tool === 'delete' && onDelete()}>
        <line x1={comp.start.x} y1={comp.start.y} x2={endX} y2={endY} stroke="#aaa" strokeWidth="2" />
        <g 
          transform={`translate(${bodyX}, ${bodyY}) rotate(${angle})`}
          onMouseDown={(e) => { if (tool === 'edit') { e.stopPropagation(); onDrag('body'); } }}
          className={tool === 'edit' ? 'cursor-move' : ''}
        >
          <rect x={-bodyWidth/2} y="-8" width={bodyWidth} height="16" fill="#d2b48c" rx="4" stroke="#8b4513" strokeWidth="0.5" />
          <rect x="-10" y="-8" width="4" height="16" fill="#8b4513" />
          <rect x="-2" y="-8" width="4" height="16" fill="#ff0000" />
          <rect x="6" y="-8" width="4" height="16" fill="#ffd700" />
        </g>
        {tool === 'edit' && (
          <>
            <circle cx={comp.start.x} cy={comp.start.y} r="8" fill="white" fillOpacity="0.4" stroke="white" onMouseDown={(e) => { e.stopPropagation(); onDrag('start'); }} className="cursor-move" />
            <circle cx={endX} cy={endY} r="8" fill="white" fillOpacity="0.4" stroke="white" onMouseDown={(e) => { e.stopPropagation(); onDrag('end'); }} className="cursor-move" />
          </>
        )}
      </g>
    );
  }

  if (comp.type === 'led') {
    // RGB LED with 4 pins: R, Common (GND), G, B
    const pinLabels = ['R', '-', 'G', 'B'];
    const labelColors = ['#ff4444', '#ffffff', '#44ff44', '#4444ff'];
    const pins = [0, 1, 2, 3].map(i => ({
      x: comp.pos.x + i * HOLE_SPACING,
      y: comp.pos.y,
      label: pinLabels[i],
      color: labelColors[i]
    }));

    const bodyX = comp.pos.x + (1.5 * HOLE_SPACING);
    const bodyY = comp.pos.y - 25;

    return (
      <g 
        className={`${tool === 'delete' ? 'hover:opacity-50 cursor-pointer' : ''} ${tool === 'edit' ? 'cursor-move' : ''}`}
        onClick={() => tool === 'delete' && onDelete()}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, comp.id); }}
      >
        <defs>
          <filter id={`glow-${comp.id}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 4 Leads */}
        {pins.map((p, i) => (
          <g key={i}>
            <path 
              d={`M ${bodyX + (i - 1.5) * 8} ${bodyY + 5} L ${p.x} ${p.y}`} 
              stroke="#ccc" 
              strokeWidth="1.5" 
              fill="none" 
            />
            
            {/* High-Readability Label Badge */}
            <circle 
              cx={p.x} 
              cy={p.y + 15} 
              r="7" 
              fill="#111" 
              stroke="#444" 
              strokeWidth="0.5" 
            />
            <text 
              x={p.x} 
              y={p.y + 18} 
              fill={p.color} 
              fontSize="10" 
              fontWeight="black" 
              textAnchor="middle"
              style={{ pointerEvents: 'none', textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* LED Body */}
        <g transform={`translate(${bodyX}, ${bodyY})`}>
          <path 
            d="M -12 10 L 12 10 Q 12 -15 0 -15 Q -12 -15 -12 10" 
            fill={comp.color} 
            filter={`url(#glow-${comp.id})`} 
            opacity="0.9" 
          />
          <path 
            d="M -12 10 L 12 10 Q 12 -15 0 -15 Q -12 -15 -12 10" 
            fill="none" 
            stroke="white" 
            strokeWidth="1" 
          />
          <rect x="-14" y="8" width="28" height="4" fill="#888" rx="1" />
        </g>

        {tool === 'edit' && (
          <circle cx={comp.pos.x} cy={comp.pos.y} r="8" fill="white" fillOpacity="0.4" stroke="white" onMouseDown={(e) => { e.stopPropagation(); onDrag('pos'); }} className="cursor-move" />
        )}
      </g>
    );
  }

  return null;
};

export default ComponentRenderer;
