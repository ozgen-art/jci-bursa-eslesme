import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Bu dosya şu an `ENABLE_AI_REFINEMENT=false` olduğu için çağrılmıyor
 * (bkz. src/app/api/members/route.ts + src/lib/naive-matches.ts).
 * .env'de ENABLE_AI_REFINEMENT=true yapıp ANTHROPIC_API_KEY doldurunca
 * hiçbir kod değişikliği gerekmeden tekrar devreye girer.
 */
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { assertNoNameLeak } from "@/lib/kvkk-guard";
import type { AnonymizedMember, CandidateRow, Member, RefinedMatch } from "@/types/db";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let cachedClient: Anthropic | null = null;

function getAnthropic() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY .env dosyasında tanımlı değil.");
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/** Member satırından `name` alanını KASITLI OLARAK çıkarır. */
function toAnonymized(member: Pick<Member, "registry_no" | "sector" | "expertise" | "offers" | "needs" | "bio">): AnonymizedMember {
  return {
    registry_no: member.registry_no,
    sector: member.sector,
    expertise: member.expertise,
    offers: member.offers,
    needs: member.needs,
    bio: member.bio,
  };
}

const SYSTEM_PROMPT = `Sen JCI Bursa üyeleri arasında networking eşleştirmesi yapan bir asistansın.
Aşağıda bir "hedef üye" ve pgvector ile önceden filtrelenmiş 15-20 "aday üye" var.
Sadece isim yerine sicil numarası (registry_no) kullan.

Görev: En anlamlı 3-5 eşleşmeyi seç. Her biri için:
- strength (1-5)
- a_offers_b: hedef üyenin bu adaya sunabileceği somut destek (max 20 kelime)
- b_offers_a: bu adayın hedef üyeye sunabileceği somut destek (max 20 kelime)
- topics: ortak 1-3 konu

SADECE geçerli JSON array döndür, başka metin ekleme. Format:
[{"registry_no": "...", "strength": 1-5, "a_offers_b": "...", "b_offers_a": "...", "topics": ["..."]}]`;

/**
 * Brief bölüm 3 / adım 4 ve bölüm 5:
 * Sadece pgvector ile bulunan kısa liste + yeni üye Claude'a gönderilir.
 * Payload'da `registry_no` kullanılır, `name` ASLA gönderilmez.
 */
export async function refineMatches(
  newMemberId: string,
  candidates: CandidateRow[]
): Promise<RefinedMatch[]> {
  if (candidates.length === 0) return [];

  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("members")
    .select("id, registry_no, sector, expertise, offers, needs, bio")
    .in("id", [newMemberId, ...candidates.map((c) => c.id)]);

  if (error) {
    throw new Error(`Üye detayları alınamadı: ${error.message}`);
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const targetRow = byId.get(newMemberId);
  if (!targetRow) {
    throw new Error("Hedef üye bulunamadı.");
  }

  const target = toAnonymized(targetRow);
  const candidateMembers: AnonymizedMember[] = candidates
    .map((c) => byId.get(c.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map(toAnonymized);

  const payload = { target, candidates: candidateMembers };

  // KVKK guard: bu payload'da name alanı olmadığından emin ol.
  assertNoNameLeak(payload, "refine-matches request");

  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Hedef üye: ${JSON.stringify(target)}\nAdaylar: ${JSON.stringify(candidateMembers)}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude yanıtında metin bulunamadı.");
  }

  let parsed: RefinedMatch[];
  try {
    parsed = JSON.parse(extractJsonArray(textBlock.text));
  } catch (e) {
    throw new Error(`Claude yanıtı geçerli JSON değil: ${(e as Error).message}\nYanıt: ${textBlock.text}`);
  }

  return parsed;
}

/** Claude bazen JSON'un etrafına açıklama ekleyebilir; ilk [ ... son ] arasını çıkarır. */
function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Yanıtta JSON array bulunamadı.");
  }
  return text.slice(start, end + 1);
}
