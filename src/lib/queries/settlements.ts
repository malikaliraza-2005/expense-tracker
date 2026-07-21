import { createClient } from '@/lib/supabase/server';
import type { SettlementListItem } from '@/types/dto';
import type { Member, Settlement } from '@/types/db';

/**
 * Settlement reads. Typed data-access over the owner-scoped `settlements` table,
 * joined to the payer and receiver members. RLS scopes everything to the owner.
 */

/** Fetch member rows for a set of ids, keyed by id. */
async function fetchMembersById(ids: string[]): Promise<Map<string, Member>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('members').select('*').in('id', ids);
  return new Map((data ?? []).map((member) => [member.id, member]));
}

/**
 * The owner's recorded settlements, most recent first, each resolved to its
 * payer and receiver members. Rows whose members can't be resolved are skipped.
 */
export async function listSettlements(): Promise<SettlementListItem[]> {
  const supabase = createClient();

  const { data: settlements } = await supabase
    .from('settlements')
    .select('*')
    .order('settled_at', { ascending: false });

  if (!settlements || settlements.length === 0) return [];

  const membersById = await fetchMembersById([
    ...new Set(
      settlements.flatMap((s) => [s.payer_id, s.receiver_id]),
    ),
  ]);

  const items: SettlementListItem[] = [];
  for (const settlement of settlements as Settlement[]) {
    const payer = membersById.get(settlement.payer_id);
    const receiver = membersById.get(settlement.receiver_id);
    if (!payer || !receiver) continue;
    items.push({ settlement, payer, receiver });
  }
  return items;
}
