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

/**
 * Categorical chart palette — an emerald-led, fixed hue order (defined as
 * --chart-1..6 in globals.css, one validated set per theme; see the dataviz
 * skill). Assign by index in the fixed order, never cycled: charts draw
 * segments/bars as CHART_COLORS[i]; list glyphs derive a stable per-category
 * tint from `colorForKey` (each glyph also carries an icon + text label, so the
 * tint is a secondary cue, not the sole identity channel).
 */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const;

/** Deterministically map any key to one of the categorical chart colours. */
export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CHART_COLORS[hash % CHART_COLORS.length];
}
