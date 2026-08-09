import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CandidateRow, RefinedMatch } from "@/types/db";

const DEFAULT_LIMIT = 5;

/**
 * `ENABLE_AI_REFINEMENT=false` iken kullanılan yol: Claude'a hiç gitmeden,
 * pgvector'ün bulduğu adayların (zaten benzerliğe göre sıralı) ilk 5'ini
 * doğrudan eşleşme olarak kaydeder. LLM çağrısı olmadığı için burada KVKK
 * guard'ına gerek yok — hiçbir payload dışarı gönderilmiyor.
 *
 * Not: `strength` kolonu 1-5 arası int olmak zorunda (bkz. migration'daki
 * check constraint), pgvector'ün ham cosine similarity'si (0-1 aralığında,
 * bazen negatif) doğrudan yazılamıyor. Bu yüzden similarity'yi 1-5'e
 * lineer olarak ölçekliyoruz (similarityToStrength).
 */
export async function buildNaiveMatches(
  newMemberId: string,
  candidates: CandidateRow[],
  limit: number = DEFAULT_LIMIT
): Promise<RefinedMatch[]> {
  const top = candidates.slice(0, limit);
  if (top.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, registry_no, offers")
    .in("id", [newMemberId, ...top.map((c) => c.id)]);

  if (error) {
    throw new Error(`Üye detayları alınamadı: ${error.message}`);
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const target = byId.get(newMemberId);
  if (!target) {
    throw new Error("Hedef üye bulunamadı.");
  }

  return top
    .map((c): RefinedMatch | null => {
      const candidate = byId.get(c.id);
      if (!candidate) return null;
      return {
        registry_no: candidate.registry_no,
        strength: similarityToStrength(c.similarity),
        // Ham metinler: her üyenin kendi "offers" alanı, o üyenin karşı
        // tarafa sunabileceği destek olarak kullanılıyor (gerekçe üretimi
        // yok, sadece profildeki veri).
        a_offers_b: target.offers ?? "",
        b_offers_a: candidate.offers ?? "",
        topics: [],
      };
    })
    .filter((m): m is RefinedMatch => m !== null);
}

/** pgvector cosine similarity'yi (genelde 0-1) 1-5 arası tam sayı skora çevirir. */
function similarityToStrength(similarity: number): number {
  const clamped = Math.max(0, Math.min(1, similarity));
  const strength = Math.round(clamped * 4) + 1; // 0 -> 1, 1 -> 5
  return Math.min(5, Math.max(1, strength));
}
