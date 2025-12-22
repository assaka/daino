import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, style, value, defaultValue, ...props }, ref) => {
  // Extract accentColor from style to apply as custom slider color
  const accentColor = style?.accentColor;

  // Determine number of thumbs based on value or defaultValue
  const thumbCount = Array.isArray(value) ? value.length : (Array.isArray(defaultValue) ? defaultValue.length : 1);

  const thumbStyle = accentColor ? { borderWidth: '1px', borderStyle: 'solid', borderColor: `${accentColor}80` } : undefined;
  const thumbClassName = cn(
    "block h-4 w-4 rounded-full bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    !accentColor && "border border-primary/50"
  );

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center h-4", className)}
      style={style}
      value={value}
      defaultValue={defaultValue}
      {...props}>
      <SliderPrimitive.Track
        className={cn(
          "relative h-1.5 w-full grow overflow-hidden rounded-full",
          !accentColor && "bg-primary/20"
        )}
        style={accentColor ? { backgroundColor: `${accentColor}33` } : undefined}
      >
        <SliderPrimitive.Range
          className={cn("absolute h-full", !accentColor && "bg-primary")}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={thumbClassName}
          style={thumbStyle}
          aria-label={index === 0 ? "Minimum" : "Maximum"}
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
