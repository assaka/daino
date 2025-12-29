import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Container Section - controls for filter panel background
 */
const ContainerSection = ({ styles, onStyleChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Filter Panel Background</Label>
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
    </div>
  );
};

export default ContainerSection;
