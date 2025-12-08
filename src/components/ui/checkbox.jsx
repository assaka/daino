import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, style, checked, ...props }, ref) => {
  // Extract accentColor from style to apply as custom checkbox color
  const accentColor = style?.accentColor;
  const restStyle = accentColor ? { ...style, accentColor: undefined } : style;

  // Build dynamic styles for custom color support
  // When accentColor is provided, use it for border (always) and background (when checked)
  const customColorStyles = accentColor ? {
    ...restStyle,
    borderColor: accentColor,
    backgroundColor: checked ? accentColor : 'transparent',
  } : restStyle;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        // Only use default primary colors if no custom accentColor is provided
        !accentColor && "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        // When accentColor is provided, use white text on checked state and override border color
        accentColor && "data-[state=checked]:text-white !border",
        className
      )}
      style={customColorStyles}
      {...props}>
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
