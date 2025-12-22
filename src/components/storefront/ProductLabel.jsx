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

// Wrapper component for rendering multiple labels in a flex container at a position
export function ProductLabelsContainer({ children, position = 'top-left' }) {
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'top-center': 'top-2 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-center': 'bottom-2 left-1/2 -translate-x-1/2',
  };

  return (
    <div className={`absolute z-10 flex flex-wrap gap-1 ${positionClasses[position] || positionClasses['top-left']}`}>
      {children}
    </div>
  );
}

// Render all labels grouped by their position
export function renderLabelsGroupedByPosition(labels) {
  if (!labels || labels.length === 0) return null;

  // Group labels by position
  const labelsByPosition = labels.reduce((acc, label) => {
    const position = label.position || 'top-left';
    if (!acc[position]) acc[position] = [];
    acc[position].push(label);
    return acc;
  }, {});

  // Render a container for each position with all its labels
  return Object.entries(labelsByPosition).map(([position, positionLabels]) => (
    <ProductLabelsContainer key={position} position={position}>
      {positionLabels.map(label => (
        <ProductLabel key={label.id} label={label} />
      ))}
    </ProductLabelsContainer>
  ));
}
