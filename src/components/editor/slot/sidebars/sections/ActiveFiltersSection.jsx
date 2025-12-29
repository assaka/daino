import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Active Filters Section - controls for active filter display styling
 * Saves to active_filter_styles slot
 */
const ActiveFiltersSection = ({ styles, onStyleChange, onTextChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Title Text</Label>
        <Input
          value={styles.activeFilterTitleText || 'Active Filters'}
          onChange={(e) => onTextChange && onTextChange('active_filters', e.target.value)}
          className="text-xs h-7 mt-1"
          placeholder="Active Filters"
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Title Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.activeFilterTitleColor || '#374151'}
            onChange={(e) => onStyleChange('titleColor', e.target.value, 'active_filter_styles')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.activeFilterTitleColor || '#374151'}
            onChange={(e) => onStyleChange('titleColor', e.target.value, 'active_filter_styles')}
            className="text-xs h-7"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Title Font Size</Label>
        <Input
          value={styles.activeFilterTitleFontSize || '0.875rem'}
          onChange={(e) => onStyleChange('titleFontSize', e.target.value, 'active_filter_styles')}
          className="text-xs h-7 mt-1"
          placeholder="0.875rem"
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Title Font Weight</Label>
        <select
          value={styles.activeFilterTitleFontWeight || '600'}
          onChange={(e) => onStyleChange('titleFontWeight', e.target.value, 'active_filter_styles')}
          className="w-full mt-1 h-7 text-xs border border-gray-300 rounded-md"
        >
          <option value="400">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semibold</option>
          <option value="700">Bold</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-medium">Filter Tag Background</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.activeFilterBgColor || '#DBEAFE'}
            onChange={(e) => onStyleChange('backgroundColor', e.target.value, 'active_filter_styles')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.activeFilterBgColor || '#DBEAFE'}
            onChange={(e) => onStyleChange('backgroundColor', e.target.value, 'active_filter_styles')}
            className="text-xs h-7"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Filter Tag Text Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.activeFilterTextColor || '#1E40AF'}
            onChange={(e) => onStyleChange('textColor', e.target.value, 'active_filter_styles')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.activeFilterTextColor || '#1E40AF'}
            onChange={(e) => onStyleChange('textColor', e.target.value, 'active_filter_styles')}
            className="text-xs h-7"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Clear All Button Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.activeFilterClearAllColor || '#DC2626'}
            onChange={(e) => onStyleChange('clearAllColor', e.target.value, 'active_filter_styles')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.activeFilterClearAllColor || '#DC2626'}
            onChange={(e) => onStyleChange('clearAllColor', e.target.value, 'active_filter_styles')}
            className="text-xs h-7"
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveFiltersSection;
