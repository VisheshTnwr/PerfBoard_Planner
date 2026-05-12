import { HOLE_SPACING } from '../constants';

const ComponentRenderer = ({ comp, tool, onDelete, onContextMenu }) => {
  if (comp.type === 'resistor') {
    const dx = comp.end.x - comp.start.x;
    const dy = comp.end.y - comp.start.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    const bodyWidth = 40;
    const bodyX = comp.start.x + dx * comp.bodyPos;
    const bodyY = comp.start.y + dy * comp.bodyPos;

    return (
      <g className={tool === 'delete' ? 'hover:opacity-50 cursor-pointer' : ''} onClick={() => tool === 'delete' && onDelete()}>
        <line x1={comp.start.x} y1={comp.start.y} x2={comp.end.x} y2={comp.end.y} stroke="#aaa" strokeWidth="2" />
        <g 
          transform={`translate(${bodyX}, ${bodyY}) rotate(${angle})`}
          className={tool === 'edit' ? 'cursor-move' : ''}
        >
          <rect x={-bodyWidth/2} y="-8" width={bodyWidth} height="16" fill="#d2b48c" rx="4" stroke="#8b4513" strokeWidth="0.5" />
          <rect x="-10" y="-8" width="4" height="16" fill="#8b4513" />
          <rect x="-2" y="-8" width="4" height="16" fill="#ff0000" />
          <rect x="6" y="-8" width="4" height="16" fill="#ffd700" />
        </g>
        {tool === 'edit' && (
          <>
            <circle cx={comp.start.x} cy={comp.start.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
            <circle cx={comp.end.x} cy={comp.end.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
          </>
        )}
      </g>
    );
  }

  if (comp.type === 'capacitor') {
    const dx = comp.end.x - comp.start.x;
    const dy = comp.end.y - comp.start.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate perpendicular offset for labels
    const ux = dx / (len || 1);
    const uy = dy / (len || 1);
    const px = -uy;
    const py = ux;
    const labelOffset = 12;

    const bodyWidth = 30;
    const bodyX = comp.start.x + dx * comp.bodyPos;
    const bodyY = comp.start.y + dy * comp.bodyPos;

    return (
      <g className={tool === 'delete' ? 'hover:opacity-50 cursor-pointer' : ''} onClick={() => tool === 'delete' && onDelete()}>
        <line x1={comp.start.x} y1={comp.start.y} x2={comp.end.x} y2={comp.end.y} stroke="#aaa" strokeWidth="2" />
        
        {/* Polarity Labels */}
        <text 
          x={comp.start.x + px * labelOffset} 
          y={comp.start.y + py * labelOffset} 
          fill="#4ade80" 
          fontSize="14" 
          fontWeight="black" 
          textAnchor="middle" 
          dominantBaseline="middle"
          style={{ pointerEvents: 'none', textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
        >
          +
        </text>
        <text 
          x={comp.end.x + px * labelOffset} 
          y={comp.end.y + py * labelOffset} 
          fill="#f87171" 
          fontSize="16" 
          fontWeight="black" 
          textAnchor="middle" 
          dominantBaseline="middle"
          style={{ pointerEvents: 'none', textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
        >
          -
        </text>

        <g 
          transform={`translate(${bodyX}, ${bodyY}) rotate(${angle})`}
          className={tool === 'edit' ? 'cursor-move' : ''}
        >
          {/* Electrolytic Body */}
          <rect x={-bodyWidth/2} y="-10" width={bodyWidth} height="20" fill="#0066cc" rx="2" stroke="#004488" strokeWidth="0.5" />
          <rect x={bodyWidth/2 - 8} y="-10" width="6" height="20" fill="#ddd" opacity="0.3" />
          <text y="3" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>10μF</text>
        </g>
        
        {tool === 'edit' && (
          <>
            <circle cx={comp.start.x} cy={comp.start.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
            <circle cx={comp.end.x} cy={comp.end.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
          </>
        )}
      </g>
    );
  }

  if (comp.type === 'button') {
    const width = 2 * HOLE_SPACING;
    const height = 6 * HOLE_SPACING;
    const pinOffsets = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height }
    ];

    return (
      <g 
        className={`${tool === 'delete' ? 'hover:opacity-50 cursor-pointer' : ''} ${tool === 'edit' ? 'cursor-move' : ''}`}
        onClick={() => tool === 'delete' && onDelete()}
      >
        {/* Button Leads/Pins */}
        {pinOffsets.map((off, i) => (
          <line 
            key={i}
            x1={comp.pos.x + off.x} 
            y1={comp.pos.y + off.y} 
            x2={comp.pos.x + (off.x === 0 ? 5 : -5) + off.x}
            y2={comp.pos.y + off.y}
            stroke="#ccc" 
            strokeWidth="2" 
          />
        ))}

        {/* Button Body */}
        <rect 
          x={comp.pos.x - 5} 
          y={comp.pos.y - 5} 
          width={width + 10} 
          height={height + 10} 
          fill="#333" 
          rx="4" 
          stroke="#555" 
          strokeWidth="1" 
        />
        
        {/* Push Part */}
        <circle 
          cx={comp.pos.x + width/2} 
          cy={comp.pos.y + height/2} 
          r={Math.min(width, height) / 3} 
          fill="#444" 
          stroke="#666" 
          strokeWidth="1" 
        />
        <circle 
          cx={comp.pos.x + width/2} 
          cy={comp.pos.y + height/2} 
          r={Math.min(width, height) / 4} 
          fill="#cc0000" 
        />

        {tool === 'edit' && (
          <circle cx={comp.pos.x} cy={comp.pos.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
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
          <circle cx={comp.pos.x} cy={comp.pos.y} r="8" fill="white" fillOpacity="0.4" stroke="white" className="cursor-move" />
        )}
      </g>
    );
  }

  return null;
};

export default ComponentRenderer;
