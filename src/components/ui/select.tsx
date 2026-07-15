import * as React from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/utils/cn';

/**
 * Native `<select>` styled to match the Input primitive. The project does not
 * ship `@radix-ui/react-select`, so this keeps the accessible native element
 * (labels, keyboard, mobile pickers) while matching the neon look.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="group relative">
        <select
          ref={ref}
          className={cn(
            'flex h-11 w-full appearance-none rounded-lg border border-input bg-background/60 px-3.5 py-2 pr-9 text-sm shadow-inner-top ring-offset-background backdrop-blur-sm transition-all duration-200 hover:border-primary/40 focus-visible:border-primary/60 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform duration-200 group-focus-within:rotate-180" />
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
