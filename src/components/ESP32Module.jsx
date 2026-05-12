import { PIN_SPACING, ESP32_HEIGHT } from '../constants';

const ESP32Module = ({ x, y, pinsTop, pinsBottom, width }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* PCB Body */}
      <rect width={width} height={ESP32_HEIGHT} fill="#1e1e1e" rx="4" stroke="#444" strokeWidth="2" />
      
      {/* Top Pins */}
      {pinsTop.map((pin, i) => (
        <g key={`t-${i}`} transform={`translate(${50 + i * PIN_SPACING}, 10)`}>
          <circle r="6" fill="#ffd700" stroke="#b8860b" strokeWidth="1" />
          <text y="-12" fill="#aaa" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(-45)">{pin}</text>
        </g>
      ))}

      {/* Bottom Pins */}
      {pinsBottom.map((pin, i) => (
        <g key={`b-${i}`} transform={`translate(${50 + i * PIN_SPACING}, ${ESP32_HEIGHT - 10})`}>
          <circle r="6" fill="#ffd700" stroke="#b8860b" strokeWidth="1" />
          <text y="20" fill="#aaa" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(45)">{pin}</text>
        </g>
      ))}
      
      {/* Chip/Label */}
      <rect x={width - 140} y={40} width="120" height="100" fill="#222" rx="2" stroke="#444" />
      <text x={width/2} y={ESP32_HEIGHT/2 + 5} fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">ESP32 Controller</text>
    </g>
  );
};

export default ESP32Module;
