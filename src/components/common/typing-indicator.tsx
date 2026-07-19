import { describeTyping } from '@/lib/typing';
import { cn } from '@/utils/cn';

/**
 * The "X is typing…" line shown just above a thread's composer, shared by DMs and
 * per-expense chat. `names` are already resolved to how the viewer knows each person
 * (roster-relative); {@link describeTyping} phrases them. Renders nothing when the list
 * is empty, so callers can mount it unconditionally.
 *
 * The three bouncing dots are staggered via inline `animationDelay` over Tailwind's
 * built-in `animate-bounce` — no bespoke keyframes needed.
 */
export function TypingIndicator({
  names,
  className,
}: {
  names: string[];
  className?: string;
}) {
  const label = describeTyping(names);
  if (!label) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
