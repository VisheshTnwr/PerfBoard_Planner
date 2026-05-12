import { ADAPTER_WIDTH, ADAPTER_HEIGHT } from '../constants';

const PowerAdapter = ({ x, y }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Body */}
      <rect 
        width={ADAPTER_WIDTH} 
        height={ADAPTER_HEIGHT} 
        fill="#222" 
        rx="4" 
        stroke="#444" 
        strokeWidth="2" 
      />
      <text x={ADAPTER_WIDTH/2} y="-10" fill="#aaa" fontSize="10" fontWeight="bold" textAnchor="middle">POWER</text>

      {/* Positive Terminal */}
      <g transform={`translate(${ADAPTER_WIDTH/2}, 15)`}>
        <circle r="6" fill="#ff4444" stroke="#8b0000" strokeWidth="1" />
        <text y="4" fill="white" fontSize="12" fontWeight="black" textAnchor="middle">+</text>
      </g>

      {/* Negative Terminal */}
      <g transform={`translate(${ADAPTER_WIDTH/2}, 45)`}>
        <circle r="6" fill="#ffffff" stroke="#444" strokeWidth="1" />
        <text y="4" fill="#222" fontSize="14" fontWeight="black" textAnchor="middle">-</text>
      </g>
    </g>
  );
};

export default PowerAdapter;
