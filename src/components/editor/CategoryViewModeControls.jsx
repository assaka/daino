import React from 'react';
import PropTypes from 'prop-types';
import { Grid, List } from 'lucide-react';

// View modes defined inline - these are structural, not data from DB
const categoryViews = [
  { id: 'grid', label: 'Grid', icon: Grid },
  { id: 'list', label: 'List', icon: List }
];

const CategoryViewModeControls = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 space-x-1">
      {categoryViews.map((view) => {
        const IconComponent = view.icon;
        return (
          <button
            key={view.id}
            onClick={() => onViewModeChange(view.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              viewMode === view.id
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <IconComponent className="w-4 h-4" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
};

CategoryViewModeControls.propTypes = {
  viewMode: PropTypes.string.isRequired,
  onViewModeChange: PropTypes.func.isRequired
};

export default CategoryViewModeControls;