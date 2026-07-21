import Link from 'next/link';

import {
  ArrowLeftRight,
  ChevronRight,
  MessageCircle,
  Receipt,
  Scale,
  UserPlus,
  Users2,
  type LucideIcon,
} from 'lucide-react';

import { LocalDate } from '@/components/common/local-date';
import { Card, CardContent } from '@/components/ui/card';
import {
  activityCategory,
  activityHref,
  describeActivity,
  type ActivityCategory,
} from '@/lib/activity';
import type { ActivityItem } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * The Activity feed body. Presentational: every event is already resolved to
 * denormalized display strings server-side, so this just renders each into a
 * viewer-relative sentence (via {@link describeActivity}) with an icon and a
 * timestamp. Unread events get a subtle accent; newest-first ordering is set by the
 * query.
 *
 * Each row deep-links to what it's about (the expense, the group, …) via
 * {@link activityHref}, so a notification never leaves the reader searching. Rows
 * whose target no longer exists (deleted entity) stay as plain, non-clickable history.
 */
export function ActivityView({
  items,
  meId,
}: {
  items: ActivityItem[];
  meId: string;
}) {
  return (
    <Card>
      <CardContent>
        <ul className="divide-y divide-border/50">
          {items.map((item) => {
            const unread = item.readAt === null;
            const category = activityCategory(item.type);
            const Icon = ICONS[category];
            const href = activityHref(item);

            const body = (
              <>
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4',
                    ACCENT[category],
                  )}
                >
                  <Icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    {describeActivity(item, meId)}
                  </span>
                  <LocalDate
                    value={item.createdAt}
                    className="text-xs text-muted-foreground"
                  />
                </span>
                {unread ? (
                  <span
                    aria-label="Unread"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                ) : null}
                {href ? (
                  <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                ) : null}
              </>
            );

            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    href={href}
                    className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const ICONS: Record<ActivityCategory, LucideIcon> = {
  expense: Receipt,
  group: Users2,
  settlement: ArrowLeftRight,
  friend: UserPlus,
  chat: MessageCircle,
  balance: Scale,
};

// Every tint is one of the scheme's approved accents; the distinct per-category
// icon carries identity where a hue is reused.
const ACCENT: Record<ActivityCategory, string> = {
  expense: 'bg-primary/12 text-primary',
  group: 'bg-info/12 text-info',
  settlement: 'bg-income/12 text-income',
  friend: 'bg-primary/12 text-primary',
  chat: 'bg-info/12 text-info',
  balance: 'bg-warning/12 text-warning',
};
