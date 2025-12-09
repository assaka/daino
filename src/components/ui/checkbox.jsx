import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, style, checked, ...props }, ref) => {
  // Extract accentColor from style to apply as custom checkbox color
  const accentColor = style?.accentColor;

  // For Radix UI Checkbox (custom div-based component), we need to apply
  // the color as both border and background, since accent-color CSS property
  // only works on native form controls.
  // We apply borderColor, borderWidth, and borderStyle to ensure the border shows correctly.
  const customColorStyles = accentColor ? {
    ...style,
    // Apply border color with explicit border properties to override Tailwind
    borderColor: accentColor,
    borderWidth: '1px',
    borderStyle: 'solid',
  } : style;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        // Only use default primary colors if no custom accentColor is provided
        !accentColor && "border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        // When accentColor is provided, use white text on checked state
        accentColor && "data-[state=checked]:text-white",
        className
      )}
      style={{
        ...customColorStyles,
        // Apply background color when checked using the accent color
        ...(accentColor && checked ? { backgroundColor: accentColor } : {}),
      }}
      {...props}>
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
