import { cn } from '@/utils/cn';

/**
 * Ambient decorative background: a few softly-blurred, slowly-floating gradient
 * blobs behind the page content. Fixed, non-interactive, and sits below all
 * content (`-z-10`), so it never affects layout, scrolling, or readability.
 * Motion is disabled automatically for users who prefer reduced motion (see
 * globals.css). Purely presentational.
 */
export function DecorativeBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 -z-10 overflow-hidden bg-background',
        className,
      )}
    >
      {/* Subtle top-lit wash so the blobs feel grounded. */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
      <div className="bg-blob left-[-6rem] top-[-4rem] h-72 w-72 animate-float bg-primary/20 dark:bg-primary/10" />
      <div className="bg-blob right-[-5rem] top-24 h-80 w-80 animate-float-slow bg-sky-400/20 dark:bg-sky-500/10" />
      <div className="bg-blob bottom-[-6rem] left-1/3 h-80 w-80 animate-float bg-indigo-400/20 dark:bg-indigo-500/10" />
    </div>
  );
}
