import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SectionHeader from './components/SectionHeader';

/**
 * Specialized sidebar for Pagination styling
 * Controls button colors for normal, hover, and active states
 */
const PaginationSidebar = ({
  slotId,
  slotConfig,
  allSlots = {},
  onClassChange,
  onClearSelection
}) => {
  const [expandedSections, setExpandedSections] = useState({
    normalState: true,
    hoverState: true,
    activeState: true
  });

  const [paginationStyles, setPaginationStyles] = useState({
    // Normal state
    buttonBgColor: '#FFFFFF',
    buttonTextColor: '#374151',
    buttonBorderColor: '#D1D5DB',
    // Hover state
    buttonHoverBgColor: '#F3F4F6',
    // Active state
    activeBgColor: '#3B82F6',
    activeTextColor: '#FFFFFF'
  });

  // Load existing styles from slot
  useEffect(() => {
    const paginationSlot = allSlots?.['pagination_container'] || slotConfig;
    if (paginationSlot?.styles) {
      const styles = paginationSlot.styles;
      setPaginationStyles(prev => ({
        ...prev,
        ...(styles.buttonBgColor && { buttonBgColor: styles.buttonBgColor }),
        ...(styles.buttonTextColor && { buttonTextColor: styles.buttonTextColor }),
        ...(styles.buttonBorderColor && { buttonBorderColor: styles.buttonBorderColor }),
        ...(styles.buttonHoverBgColor && { buttonHoverBgColor: styles.buttonHoverBgColor }),
        ...(styles.activeBgColor && { activeBgColor: styles.activeBgColor }),
        ...(styles.activeTextColor && { activeTextColor: styles.activeTextColor })
      }));
    }
  }, [allSlots, slotConfig]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStyleChange = (property, value) => {
    console.log('[PaginationSidebar] handleStyleChange:', { property, value });

    // Update local state
    setPaginationStyles(prev => ({ ...prev, [property]: value }));

    // Get current slot or create new one
    const targetSlotId = 'pagination_container';
    const targetSlot = allSlots?.[targetSlotId] || slotConfig || {};
    const currentStyles = targetSlot.styles || {};

    // Merge new style with existing styles
    const updatedStyles = {
      ...currentStyles,
      [property]: value
    };

    console.log('[PaginationSidebar] Calling onClassChange with:', { targetSlotId, updatedStyles });

    // Call onClassChange to update and save
    if (onClassChange) {
      onClassChange(
        targetSlotId,
        targetSlot.className || '',
        updatedStyles,
        targetSlot.metadata || {}
      );
    }
  };

  // Color input component for reuse
  const ColorInput = ({ label, value, property }) => (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={value}
          onChange={(e) => handleStyleChange(property, e.target.value)}
          className="w-8 h-7 rounded border border-gray-300 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => handleStyleChange(property, e.target.value)}
          className="text-xs h-7 font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  // Preview component showing button states
  const PaginationPreview = () => (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-center gap-1">
        {/* Previous button */}
        <button
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: paginationStyles.buttonBgColor,
            color: paginationStyles.buttonTextColor,
            border: `1px solid ${paginationStyles.buttonBorderColor}`
          }}
        >
          Prev
        </button>
        {/* Page numbers */}
        <button
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: paginationStyles.buttonBgColor,
            color: paginationStyles.buttonTextColor,
            border: `1px solid ${paginationStyles.buttonBorderColor}`
          }}
        >
          1
        </button>
        <button
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: paginationStyles.activeBgColor,
            color: paginationStyles.activeTextColor,
            border: `1px solid ${paginationStyles.activeBgColor}`
          }}
        >
          2
        </button>
        <button
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: paginationStyles.buttonBgColor,
            color: paginationStyles.buttonTextColor,
            border: `1px solid ${paginationStyles.buttonBorderColor}`
          }}
        >
          3
        </button>
        {/* Next button */}
        <button
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: paginationStyles.buttonBgColor,
            color: paginationStyles.buttonTextColor,
            border: `1px solid ${paginationStyles.buttonBorderColor}`
          }}
        >
          Next
        </button>
      </div>
      <p className="text-[10px] text-gray-500 text-center mt-2">Live Preview</p>
    </div>
  );

  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col editor-sidebar" style={{ zIndex: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Pagination Styling
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-0">
        {/* Preview */}
        <div className="p-4 border-b border-gray-200">
          <PaginationPreview />
        </div>

        {/* Normal State */}
        <SectionHeader
          title="Button (Normal)"
          section="normalState"
          expanded={expandedSections.normalState}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            <ColorInput
              label="Background"
              value={paginationStyles.buttonBgColor}
              property="buttonBgColor"
            />
            <ColorInput
              label="Text Color"
              value={paginationStyles.buttonTextColor}
              property="buttonTextColor"
            />
            <ColorInput
              label="Border Color"
              value={paginationStyles.buttonBorderColor}
              property="buttonBorderColor"
            />
          </div>
        </SectionHeader>

        {/* Hover State */}
        <SectionHeader
          title="Button (Hover)"
          section="hoverState"
          expanded={expandedSections.hoverState}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            <ColorInput
              label="Hover Background"
              value={paginationStyles.buttonHoverBgColor}
              property="buttonHoverBgColor"
            />
          </div>
        </SectionHeader>

        {/* Active State */}
        <SectionHeader
          title="Active Page"
          section="activeState"
          expanded={expandedSections.activeState}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            <ColorInput
              label="Background"
              value={paginationStyles.activeBgColor}
              property="activeBgColor"
            />
            <ColorInput
              label="Text Color"
              value={paginationStyles.activeTextColor}
              property="activeTextColor"
            />
          </div>
        </SectionHeader>
      </div>
    </div>
  );
};

export default PaginationSidebar;
