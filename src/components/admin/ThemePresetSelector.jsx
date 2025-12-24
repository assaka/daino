import React, { useState, useEffect, useRef } from 'react';
import { Check, Palette, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * ThemePresetSelector - Displays available theme presets for selection
 *
 * Usage:
 * - In onboarding: full card view with previews
 * - In store cards: compact dropdown/badge view
 */
export function ThemePresetSelector({
  value,
  onChange,
  variant = 'cards', // 'cards' | 'compact' | 'dropdown'
  className = '',
  storeId = null // Pass storeId to show store-specific custom themes
}) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scroll state for cards variant - must be declared before any returns
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, [storeId]);

  useEffect(() => {
    if (variant === 'cards' && !loading && presets.length > 0) {
      checkScrollButtons();
      const container = scrollContainerRef.current;
      if (container) {
        container.addEventListener('scroll', checkScrollButtons);
        window.addEventListener('resize', checkScrollButtons);
        return () => {
          container.removeEventListener('scroll', checkScrollButtons);
          window.removeEventListener('resize', checkScrollButtons);
        };
      }
    }
  }, [presets, loading, variant]);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      // Pass storeId to get store-specific custom themes along with system themes
      const url = storeId
        ? `/api/public/theme-defaults/presets?storeId=${storeId}`
        : '/api/public/theme-defaults/presets';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data) {
        setPresets(data.data);
        // Auto-select system default if no value set OR if current value doesn't match any preset
        const valueMatchesPreset = value && data.data.some(p => p.preset_name === value);
        if (!valueMatchesPreset) {
          const systemDefault = data.data.find(p => p.is_system_default);
          if (systemDefault && onChange) {
            onChange(systemDefault.preset_name);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch theme presets:', err);
      setError('Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading themes...</span>
      </div>
    );
  }

  if (error || presets.length === 0) {
    return null; // Silently fail - theme defaults will be applied automatically
  }

  // Compact variant - just show current theme name with color dots
  if (variant === 'compact') {
    const selectedPreset = presets.find(p => p.preset_name === value) || presets.find(p => p.is_system_default);
    const theme = selectedPreset?.theme_settings || {};

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex gap-1">
          <div
            className="w-3 h-3 rounded-full border border-gray-200"
            style={{ backgroundColor: theme.primary_button_color || '#007bff' }}
            title="Primary"
          />
          <div
            className="w-3 h-3 rounded-full border border-gray-200"
            style={{ backgroundColor: theme.add_to_cart_button_color || '#28a745' }}
            title="Add to Cart"
          />
        </div>
        <span className="text-xs text-gray-600">{selectedPreset?.display_name || 'Default'}</span>
      </div>
    );
  }

  // Cards variant - full visual selection with horizontal scrolling

  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 220; // Approximate card width + gap
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Left Arrow - Always visible, disabled when can't scroll */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "flex-shrink-0 bg-white shadow-md hover:bg-gray-50 w-10 h-10 rounded-full border-2 transition-all",
          canScrollLeft
            ? "border-gray-300 hover:border-gray-400 opacity-100"
            : "border-gray-200 opacity-40 cursor-not-allowed"
        )}
        onClick={() => scroll('left')}
        disabled={!canScrollLeft}
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>

      {/* Scrollable Container with overflow hidden wrapper */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
        {presets.map((preset) => {
          const theme = preset.theme_settings || {};
          const isSelected = value === preset.preset_name || (!value && preset.is_system_default);

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange?.(preset.preset_name)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all text-left flex-shrink-0 w-[165px]",
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}

              {/* Theme name */}
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900 truncate">{preset.display_name}</span>
                {preset.is_system_default && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">Default</span>
                )}
              </div>

              {/* Color preview */}
              <div className="flex gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-md shadow-sm border border-gray-200"
                  style={{ backgroundColor: theme.primary_button_color || '#007bff' }}
                  title="Primary Button"
                />
                <div
                  className="w-8 h-8 rounded-md shadow-sm border border-gray-200"
                  style={{ backgroundColor: theme.add_to_cart_button_color || '#28a745' }}
                  title="Add to Cart"
                />
                <div
                  className="w-8 h-8 rounded-md shadow-sm border border-gray-200"
                  style={{ backgroundColor: theme.checkout_button_color || '#007bff' }}
                  title="Checkout"
                />
                <div
                  className="w-8 h-8 rounded-md shadow-sm border border-gray-200"
                  style={{ backgroundColor: theme.secondary_button_color || '#6c757d' }}
                  title="Secondary"
                />
              </div>

              {/* Description */}
              {preset.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{preset.description}</p>
              )}
            </button>
          );
        })}
        </div>
      </div>

      {/* Right Arrow - Always visible, disabled when can't scroll */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "flex-shrink-0 bg-white shadow-md hover:bg-gray-50 w-10 h-10 rounded-full border-2 transition-all",
          canScrollRight
            ? "border-gray-300 hover:border-gray-400 opacity-100"
            : "border-gray-200 opacity-40 cursor-not-allowed"
        )}
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
}

/**
 * ThemePresetBadge - Small badge showing current theme with optional change button
 */
export function ThemePresetBadge({
  presetName,
  showName = true,
  size = 'sm', // 'sm' | 'md'
  className = ''
}) {
  const [preset, setPreset] = useState(null);

  useEffect(() => {
    if (presetName) {
      fetch(`/api/public/theme-defaults/preset/${presetName}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setPreset(data.data);
          }
        })
        .catch(console.error);
    }
  }, [presetName]);

  const theme = preset?.theme || {};
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex gap-0.5">
        <div
          className={cn(dotSize, "rounded-full border border-white/50")}
          style={{ backgroundColor: theme.primary_button_color || '#007bff' }}
        />
        <div
          className={cn(dotSize, "rounded-full border border-white/50")}
          style={{ backgroundColor: theme.add_to_cart_button_color || '#28a745' }}
        />
      </div>
      {showName && (
        <span className={cn(
          "text-gray-600",
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {preset?.display_name || presetName || 'Default'}
        </span>
      )}
    </div>
  );
}

export default ThemePresetSelector;
