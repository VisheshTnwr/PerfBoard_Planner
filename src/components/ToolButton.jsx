import React from 'react';

const ToolButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
      active 
        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50' 
        : 'bg-gray-700 border-transparent text-gray-400 hover:bg-gray-600'
    }`}
  >
    {icon}
    <span className="text-[10px] mt-1 font-medium">{label}</span>
  </button>
);

export default ToolButton;
