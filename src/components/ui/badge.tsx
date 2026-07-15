import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-primary/30 bg-primary/15 text-primary shadow-glow-sm',
        secondary: 'border-border/60 bg-secondary text-secondary-foreground',
        destructive:
          'border-expense/30 bg-expense/15 text-expense',
        success: 'border-income/30 bg-income/15 text-income',
        warning: 'border-warning/30 bg-warning/15 text-warning',
        purple: 'border-purple/30 bg-purple/15 text-purple',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
