import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SectionHeader from './components/SectionHeader';
import FilterHeadingSection from './sections/FilterHeadingSection';
import FilterLabelsSection from './sections/FilterLabelsSection';
import FilterOptionsSection from './sections/FilterOptionsSection';
import ActiveFiltersSection from './sections/ActiveFiltersSection';
import ContainerSection from './sections/ContainerSection';
import UnifiedSlotRenderer from '../UnifiedSlotRenderer';

/**
 * Specialized sidebar for LayeredNavigation filter styling
 * Orchestrates individual section components
 */
const LayeredNavigationSidebar = ({
  slotId,
  slotConfig,
  allSlots = {},
  onClassChange,
  onTextChange,
  onClearSelection
}) => {
  const [expandedSections, setExpandedSections] = useState({
    filterHeading: true,
    filterLabels: true,
    filterOptions: true,
    activeFilters: true,
    container: true
  });

  // Track if user is actively editing text to prevent overwrites
  const isEditingTextRef = useRef(false);

  const [filterStyles, setFilterStyles] = useState({
    // Filter Heading
    headingText: 'Filter By',
    headingColor: '#111827',
    headingFontSize: '1.125rem',
    headingFontWeight: '600',

    // Attribute Filter Labels (also applies to Price filter)
    labelColor: '#374151',
    labelFontSize: '0.875rem',
    labelFontWeight: '500',

    // Filter Options (from filter_option_styles slot)
    optionTextColor: '#374151',
    optionHoverColor: '#1F2937',
    optionCountColor: '#9CA3AF',
    optionFontSize: '0.875rem',
    optionFontWeight: '400',
    checkboxColor: '#3B82F6',

    // Active Filter Badges (from active_filter_styles slot)
    activeFilterBgColor: '#DBEAFE',
    activeFilterTextColor: '#1E40AF',
    activeFilterFontSize: '0.75rem',
    activeFilterFontWeight: '400',
    activeFilterBorderRadius: 'full',
    activeFilterClearAllColor: '#DC2626',

    // Container & Card
    cardBgColor: '#FFFFFF'
  });

  // Load existing styles from child slots
  useEffect(() => {
    if (!allSlots) return;

    const updates = {};

    // Filter Heading (from filter_heading slot)
    const filterHeading = allSlots['filter_heading'];
    if (filterHeading) {
      // Only update headingText if user is not actively editing
      if (filterHeading.content && !isEditingTextRef.current) {
        updates.headingText = filterHeading.content;
      }
      if (filterHeading.styles?.color) updates.headingColor = filterHeading.styles.color;
      if (filterHeading.styles?.fontSize) updates.headingFontSize = filterHeading.styles.fontSize;
      if (filterHeading.styles?.fontWeight) updates.headingFontWeight = filterHeading.styles.fontWeight;
    }

    // Attribute Filter Label (also applies to Price filter)
    const attrLabel = allSlots['attribute_filter_label'];
    if (attrLabel) {
      if (attrLabel.styles?.color) updates.labelColor = attrLabel.styles.color;
      if (attrLabel.styles?.fontSize) updates.labelFontSize = attrLabel.styles.fontSize;
      if (attrLabel.styles?.fontWeight) updates.labelFontWeight = attrLabel.styles.fontWeight;
    }

    // Filter Options (from filter_option_styles slot)
    const filterOptionStyles = allSlots['filter_option_styles'];
    if (filterOptionStyles && filterOptionStyles.styles) {
      if (filterOptionStyles.styles.cardBgColor) updates.cardBgColor = filterOptionStyles.styles.cardBgColor;
      if (filterOptionStyles.styles.optionTextColor) updates.optionTextColor = filterOptionStyles.styles.optionTextColor;
      if (filterOptionStyles.styles.optionHoverColor) updates.optionHoverColor = filterOptionStyles.styles.optionHoverColor;
      if (filterOptionStyles.styles.optionCountColor) updates.optionCountColor = filterOptionStyles.styles.optionCountColor;
      if (filterOptionStyles.styles.optionFontSize) updates.optionFontSize = filterOptionStyles.styles.optionFontSize;
      if (filterOptionStyles.styles.optionFontWeight) updates.optionFontWeight = filterOptionStyles.styles.optionFontWeight;
      if (filterOptionStyles.styles.checkboxColor) updates.checkboxColor = filterOptionStyles.styles.checkboxColor;
      if (filterOptionStyles.styles.activeFilterBgColor) updates.activeFilterBgColor = filterOptionStyles.styles.activeFilterBgColor;
      if (filterOptionStyles.styles.activeFilterTextColor) updates.activeFilterTextColor = filterOptionStyles.styles.activeFilterTextColor;
    }

    // Active Filter Badges (from active_filter_styles slot)
    const activeFilterStylesSlot = allSlots['active_filter_styles'];
    if (activeFilterStylesSlot && activeFilterStylesSlot.styles) {
      if (activeFilterStylesSlot.styles.backgroundColor) updates.activeFilterBgColor = activeFilterStylesSlot.styles.backgroundColor;
      if (activeFilterStylesSlot.styles.textColor) updates.activeFilterTextColor = activeFilterStylesSlot.styles.textColor;
      if (activeFilterStylesSlot.styles.fontSize) updates.activeFilterFontSize = activeFilterStylesSlot.styles.fontSize;
      if (activeFilterStylesSlot.styles.fontWeight) updates.activeFilterFontWeight = activeFilterStylesSlot.styles.fontWeight;
      if (activeFilterStylesSlot.styles.borderRadius) updates.activeFilterBorderRadius = activeFilterStylesSlot.styles.borderRadius;
      if (activeFilterStylesSlot.styles.clearAllColor) updates.activeFilterClearAllColor = activeFilterStylesSlot.styles.clearAllColor;
    }

    if (Object.keys(updates).length > 0) {
      setFilterStyles(prev => ({ ...prev, ...updates }));
    }
  }, [allSlots]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStyleChange = (property, value, targetSlotId) => {
    // Update local state
    setFilterStyles(prev => ({ ...prev, [property]: value }));

    // Map property to CSS property for label slots
    const cssPropertyMap = {
      headingColor: 'color',
      headingFontSize: 'fontSize',
      headingFontWeight: 'fontWeight',
      labelColor: 'color',
      labelFontSize: 'fontSize',
      labelFontWeight: 'fontWeight'
    };

    // Determine CSS property name - use mapping for standard slots, direct property for style slots
    const isStyleSlot = targetSlotId === 'filter_option_styles' || targetSlotId === 'active_filter_styles';
    const cssProperty = isStyleSlot ? property : (cssPropertyMap[property] || property);

    // CRITICAL: If slot doesn't exist in allSlots, create it with proper parentId
    if (targetSlotId && !allSlots[targetSlotId]) {
      const newStyles = { [cssProperty]: value };

      // Determine parentId based on slot type
      let parentId = 'layered_navigation';
      if (targetSlotId === 'filters_container') {
        parentId = 'layered_navigation';
      }

      if (onClassChange) {
        // Pass full slot structure including parentId for proper slot creation
        onClassChange(targetSlotId, '', newStyles, {
          displayName: targetSlotId,
          parentId: parentId
        });
      }
      return;
    }

    if (targetSlotId && allSlots[targetSlotId]) {
      const targetSlot = allSlots[targetSlotId];
      const styles = { ...targetSlot.styles };

      // Set the CSS property
      styles[cssProperty] = value;

      // Call onClassChange to update database
      if (onClassChange) {
        onClassChange(targetSlotId, targetSlot.className || '', styles, targetSlot.metadata || {});
      }
    }
  };

  const handleTextChange = (targetSlotId, value) => {
    // Set editing flag to prevent useEffect from overwriting
    isEditingTextRef.current = true;

    // Update local state immediately
    if (targetSlotId === 'filter_heading') {
      setFilterStyles(prev => ({ ...prev, headingText: value }));
      // Update filter_heading content via onTextChange
      if (onTextChange) {
        onTextChange(targetSlotId, value);
      }
    } else if (targetSlotId === 'active_filters') {
      setFilterStyles(prev => ({ ...prev, activeFilterTitleText: value }));
      // For active_filters, store the text in active_filter_styles
      const activeFilterStylesSlot = allSlots['active_filter_styles'];
      if (activeFilterStylesSlot) {
        const styles = { ...activeFilterStylesSlot.styles, titleText: value };
        if (onClassChange) {
          onClassChange('active_filter_styles', activeFilterStylesSlot.className || '', styles, activeFilterStylesSlot.metadata || {});
        }
      }
    }

    // Clear editing flag after a short delay
    setTimeout(() => {
      isEditingTextRef.current = false;
    }, 500);
  };

  // Get slots for preview (filter labels, heading, and active filters)
  const previewSlots = {};
  if (allSlots) {
    Object.values(allSlots).forEach(slot => {
      // Include filter labels and filter heading from layered_navigation
      if (slot.parentId === 'layered_navigation' &&
          (slot.id.includes('filter_label') || slot.id === 'filter_by_label')) {
        previewSlots[slot.id] = slot;
      }
      // Include active_filters from filters_container
      if (slot.id === 'active_filters' && slot.parentId === 'filters_container') {
        previewSlots[slot.id] = slot;
      }
    });
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col editor-sidebar" style={{ zIndex: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Filter Styling
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
        {/* Filter Heading */}
        <SectionHeader
          title="Filter Heading"
          section="filterHeading"
          expanded={expandedSections.filterHeading}
          onToggle={toggleSection}
        >
          <FilterHeadingSection
            styles={filterStyles}
            onStyleChange={handleStyleChange}
            onTextChange={handleTextChange}
          />
        </SectionHeader>

        {/* Active Filters */}
        <SectionHeader
          title="Active Filters"
          section="activeFilters"
          expanded={expandedSections.activeFilters}
          onToggle={toggleSection}
        >
          <ActiveFiltersSection
            styles={filterStyles}
            onStyleChange={handleStyleChange}
          />
        </SectionHeader>

        {/* Attribute Filter Labels (also applies to Price filter) */}
        <SectionHeader
          title="Filter Labels (Brand, Price, etc.)"
          section="filterLabels"
          expanded={expandedSections.filterLabels}
          onToggle={toggleSection}
        >
          <FilterLabelsSection
            styles={filterStyles}
            onStyleChange={handleStyleChange}
          />
        </SectionHeader>

        {/* Filter Options */}
        <SectionHeader
          title="Filter Options"
          section="filterOptions"
          expanded={expandedSections.filterOptions}
          onToggle={toggleSection}
        >
          <FilterOptionsSection
            styles={filterStyles}
            onStyleChange={handleStyleChange}
          />
        </SectionHeader>

        {/* Container */}
        <SectionHeader
          title="Container"
          section="container"
          expanded={expandedSections.container}
          onToggle={toggleSection}
        >
          <ContainerSection
            styles={filterStyles}
            onStyleChange={handleStyleChange}
          />
        </SectionHeader>
      </div>
    </div>
  );
};

export default LayeredNavigationSidebar;
