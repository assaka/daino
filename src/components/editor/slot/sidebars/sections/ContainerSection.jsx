import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Container Section - controls for container background and padding
 */
const ContainerSection = ({ styles, onStyleChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Card Background</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.cardBgColor || '#FFFFFF'}
            onChange={(e) => onStyleChange('cardBgColor', e.target.value, 'filter_option_styles')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.cardBgColor || '#FFFFFF'}
            onChange={(e) => onStyleChange('cardBgColor', e.target.value, 'filter_option_styles')}
            className="text-xs h-7"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Container Background</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={styles.containerBg === 'transparent' ? '#FFFFFF' : (styles.containerBg || '#FFFFFF')}
            onChange={(e) => onStyleChange('containerBg', e.target.value, 'filters_container')}
            className="w-8 h-7 rounded border border-gray-300"
          />
          <Input
            value={styles.containerBg || 'transparent'}
            onChange={(e) => onStyleChange('containerBg', e.target.value, 'filters_container')}
            className="text-xs h-7"
            placeholder="transparent"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium">Padding</Label>
        <Input
          value={styles.containerPadding}
          onChange={(e) => onStyleChange('containerPadding', e.target.value, 'filters_container')}
          className="text-xs h-7 mt-1"
          placeholder="1rem"
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Border Radius</Label>
        <Input
          value={styles.containerBorderRadius}
          onChange={(e) => onStyleChange('containerBorderRadius', e.target.value, 'filters_container')}
          className="text-xs h-7 mt-1"
          placeholder="0.5rem"
        />
      </div>
    </div>
  );
};

export default ContainerSection;
