import React from 'react';

// Simple label badge - positioning handled by container
export default function ProductLabel({ label, style = {} }) {
  if (!label) return null;

  // Backend returns translated text in label.text (based on X-Language header)
  const labelText = label.text || label;

  if (!labelText) return null;

  const labelStyle = {
    backgroundColor: label.background_color || '#FF0000',
    color: label.color || label.text_color || '#FFFFFF',
    ...style
  };

  return (
    <span
      className="px-2 py-1 text-xs font-bold rounded shadow-sm"
      style={labelStyle}
    >
      {labelText}
    </span>
  );
}

// Wrapper component for rendering multiple labels in a flex container
export function ProductLabelsContainer({ children, position = 'top-left' }) {
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  return (
    <div className={`absolute z-10 flex flex-wrap gap-1 ${positionClasses[position] || positionClasses['top-left']}`}>
      {children}
    </div>
  );
}
