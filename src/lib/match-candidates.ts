import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CandidateRow } from "@/types/db";

const DEFAULT_LIMIT = 20;

/**
 * Brief bölüm 3 / adım 3 ve bölüm 4:
 * Yeni üyenin need_embedding'i ile mevcut herkesin profile_embedding'i
 * pgvector cosine similarity ile karşılaştırılır. LLM YOK, milisaniyeler
 * sürer. supabase/migrations/0002_match_candidates_fn.sql'deki
 * `match_candidates` RPC fonksiyonunu çağırır.
 */
export async function findCandidateMembers(
  newMemberId: string,
  needEmbedding: number[],
  limit: number = DEFAULT_LIMIT
): Promise<CandidateRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_candidates", {
    p_new_member_id: newMemberId,
    p_need_embedding: needEmbedding,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`pgvector ön filtreleme hatası: ${error.message}`);
  }

  return (data ?? []) as CandidateRow[];
}
