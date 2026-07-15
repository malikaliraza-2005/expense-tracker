import { cn } from '@/utils/cn';

/**
 * Ambient decorative background: neon gradient blobs and a faint grid behind the
 * page content. Fixed, non-interactive, and below all content (`-z-10`), so it
 * never affects layout, scrolling, or readability. Motion is disabled for users
 * who prefer reduced motion (see globals.css). Purely presentational.
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
      {/* Faint blueprint grid, masked to fade toward the edges. */}
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      {/* Top-lit wash so the blobs feel grounded. */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background" />
      <div className="bg-blob left-[-8rem] top-[-6rem] h-80 w-80 animate-float bg-primary/20 opacity-70 dark:bg-primary/25" />
      <div className="bg-blob right-[-6rem] top-16 h-96 w-96 animate-float-slow bg-cyan/20 opacity-60 dark:bg-cyan/20" />
      <div className="bg-blob bottom-[-8rem] left-1/3 h-96 w-96 animate-float bg-purple/20 opacity-60 dark:bg-purple/20" />
    </div>
  );
}
