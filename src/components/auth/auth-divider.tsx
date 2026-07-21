/**
 * "or" rule separating the email/password form from the social buttons.
 *
 * Uses two flex-grown rules either side of the label rather than the usual
 * centered-label-over-a-full-rule pattern, which needs an opaque background to
 * mask the line behind the text — the auth cards are glassmorphic, so there is
 * no solid color to mask it with.
 */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
