import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Active Filters Section - controls for active filter badge styling
 * Saves to active_filter_styles slot
 */
const ActiveFiltersSection = ({ styles, onStyleChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Badge Background</Label>
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
        <Label className="text-xs font-medium">Badge Text Color</Label>
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
        <Label className="text-xs font-medium">Badge Font Size</Label>
        <Input
          value={styles.activeFilterFontSize || '0.75rem'}
          onChange={(e) => onStyleChange('fontSize', e.target.value, 'active_filter_styles')}
          className="text-xs h-7 mt-1"
          placeholder="0.75rem"
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Badge Font Weight</Label>
        <select
          value={styles.activeFilterFontWeight || '400'}
          onChange={(e) => onStyleChange('fontWeight', e.target.value, 'active_filter_styles')}
          className="w-full mt-1 h-7 text-xs border border-gray-300 rounded-md"
        >
          <option value="400">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semibold</option>
          <option value="700">Bold</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-medium">Badge Border Radius</Label>
        <select
          value={styles.activeFilterBorderRadius || 'full'}
          onChange={(e) => onStyleChange('borderRadius', e.target.value, 'active_filter_styles')}
          className="w-full mt-1 h-7 text-xs border border-gray-300 rounded-md"
        >
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="full">Full (Pill)</option>
        </select>
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
