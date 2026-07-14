/**
 * Category icon lookup (Phase 4). Categories themselves are a seeded database
 * table read via lib/queries/categories.ts; this maps each row's `icon` slug
 * (see migration 0002 §6) to a lucide icon component so the expense list and
 * detail views can render a consistent glyph. Unknown slugs fall back to a
 * neutral tag icon rather than breaking the render.
 */
import {
  Car,
  Clapperboard,
  MoreHorizontal,
  Plane,
  Receipt,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/** Icon slug (categories.icon) → lucide component. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  clapperboard: Clapperboard,
  plane: Plane,
  ellipsis: MoreHorizontal,
};

/** Resolve a category icon slug to its component, with a safe fallback. */
export function categoryIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return Tag;
  return CATEGORY_ICONS[slug] ?? Tag;
}
