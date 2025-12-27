import React, { useState, useMemo } from 'react';
import { Check, ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TIMEZONES, TIMEZONE_GROUPS, getCurrentTimeInTimezone } from '@/utils/timezones';

export function TimezoneSelect({ value, onChange, placeholder = "Select timezone...", className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Find the selected timezone
  const selectedTimezone = TIMEZONES.find(tz => tz.value === value);

  // Filter timezones based on search
  const filteredTimezones = useMemo(() => {
    if (!search) return TIMEZONE_GROUPS;
    
    const filtered = TIMEZONES.filter(tz => 
      tz.label.toLowerCase().includes(search.toLowerCase()) ||
      tz.value.toLowerCase().includes(search.toLowerCase())
    );
    
    // Group filtered results
    const groupedFiltered = {};
    filtered.forEach(tz => {
      for (const [groupName, groupTimezones] of Object.entries(TIMEZONE_GROUPS)) {
        if (groupTimezones.includes(tz)) {
          if (!groupedFiltered[groupName]) {
            groupedFiltered[groupName] = [];
          }
          groupedFiltered[groupName].push(tz);
          break;
        }
      }
    });
    
    return groupedFiltered;
  }, [search]);

  const handleSelect = (timezoneValue) => {
    onChange(timezoneValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-4 w-4 opacity-50 shrink-0" />
            {selectedTimezone ? (
              <div className="flex flex-col items-start min-w-0">
                {/* Show short label on mobile, full label on desktop */}
                <span className="font-medium md:hidden truncate">{selectedTimezone.short}</span>
                <span className="font-medium hidden md:block truncate">{selectedTimezone.label}</span>
                <span className="text-xs text-muted-foreground hidden md:block">
                  {getCurrentTimeInTimezone(selectedTimezone.value)} • {selectedTimezone.offset}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search timezones..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {Object.entries(filteredTimezones).map(([groupName, timezones]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {timezones.map((timezone) => (
                  <CommandItem
                    key={timezone.value}
                    value={timezone.value}
                    onSelect={() => handleSelect(timezone.value)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{timezone.label}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getCurrentTimeInTimezone(timezone.value)}</span>
                        <span>•</span>
                        <span>{timezone.offset}</span>
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        value === timezone.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}