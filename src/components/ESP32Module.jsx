import React from 'react';
import { 
  ESP32_WIDTH, 
  ESP32_HEIGHT, 
  ESP32_PINS_TOP, 
  ESP32_PINS_BOTTOM, 
  PIN_SPACING 
} from '../constants';

const ESP32Module = ({ x, y }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* PCB Body */}
      <rect width={ESP32_WIDTH} height={ESP32_HEIGHT} fill="#1e1e1e" rx="4" stroke="#444" strokeWidth="2" />
      
      {/* Top Pins */}
      {ESP32_PINS_TOP.map((pin, i) => (
        <g key={`t-${i}`} transform={`translate(${50 + i * PIN_SPACING}, 10)`}>
          <circle r="6" fill="#ffd700" stroke="#b8860b" strokeWidth="1" />
          <text y="-12" fill="#aaa" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(-45)">{pin}</text>
        </g>
      ))}

      {/* Bottom Pins */}
      {ESP32_PINS_BOTTOM.map((pin, i) => (
        <g key={`b-${i}`} transform={`translate(${50 + i * PIN_SPACING}, ${ESP32_HEIGHT - 10})`}>
          <circle r="6" fill="#ffd700" stroke="#b8860b" strokeWidth="1" />
          <text y="20" fill="#aaa" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(45)">{pin}</text>
        </g>
      ))}
      
      {/* ESP32 Chip & Label */}
      <rect x={ESP32_WIDTH - 140} y={40} width="120" height="100" fill="#222" rx="2" stroke="#444" />
      <text x={ESP32_WIDTH/2} y={ESP32_HEIGHT/2 + 5} fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">NodeMCU-32S (Landscape)</text>
    </g>
  );
};

export default ESP32Module;
