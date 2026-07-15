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
 * Neon accent palette for charts/glyphs. Categories have no colour column, so we
 * derive a stable colour from a string key (icon slug or name) — the same
 * category always maps to the same neon token, keeping charts and lists in sync.
 */
export const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--purple))',
  'hsl(var(--cyan))',
  'hsl(var(--income))',
  'hsl(var(--warning))',
  'hsl(var(--expense))',
] as const;

/** Deterministically map any key to one of the neon chart colours. */
export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CHART_COLORS[hash % CHART_COLORS.length];
}
