import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateMemberEmbeddings } from "@/lib/embeddings";
import { findCandidateMembers } from "@/lib/match-candidates";
import { refineMatches } from "@/lib/refine-matches";
import { buildNaiveMatches } from "@/lib/naive-matches";
import type { Match } from "@/types/db";

/**
 * true  → Aşama 4 Claude ile çalışır (ANTHROPIC_API_KEY gerekir).
 * false → Claude'a hiç gidilmez; pgvector'ün bulduğu ilk 5 aday, ham
 *         offers metinleriyle doğrudan matches'e yazılır (bkz. naive-matches.ts).
 * İleride tekrar açmak için .env'de ENABLE_AI_REFINEMENT=true yeterli,
 * refine-matches.ts'e dokunmaya gerek yok.
 */
const AI_REFINEMENT_ENABLED = process.env.ENABLE_AI_REFINEMENT === "true";

export const runtime = "nodejs";

// registry_no formda istenmiyor; backend'de generate_registry_no() ile
// otomatik üretiliyor (bkz. supabase/migrations/0004_registry_no_sequence.sql).
const memberSchema = z.object({
  name: z.string().min(1, "İsim zorunlu"),
  sector: z.string().min(1, "Sektör zorunlu"),
  expertise: z.string().optional().default(""),
  offers: z.string().optional().default(""),
  needs: z.string().optional().default(""),
  bio: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON body." }, { status: 400 });
  }

  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const supabase = getSupabaseAdmin();

  // Sicil numarasını backend üretir (sıralı, JCI-BUR-001 formatında).
  const { data: registryNo, error: registryError } = await supabase.rpc(
    "generate_registry_no"
  );
  if (registryError || !registryNo) {
    return NextResponse.json(
      { error: `Sicil numarası üretilemedi: ${registryError?.message ?? "bilinmeyen hata"}` },
      { status: 500 }
    );
  }

  // 1) Kayıt: members tablosuna INSERT
  const { data: member, error: insertError } = await supabase
    .from("members")
    .insert({ ...input, registry_no: registryNo })
    .select()
    .single();

  if (insertError || !member) {
    const status = insertError?.code === "23505" ? 409 : 500; // unique violation
    return NextResponse.json(
      { error: insertError?.message ?? "Üye oluşturulamadı." },
      { status }
    );
  }

  try {
    // 2) Embedding üret
    const { profile_embedding, need_embedding } = await generateMemberEmbeddings({
      expertise: input.expertise,
      offers: input.offers,
      bio: input.bio,
      needs: input.needs,
    });

    const { error: embedError } = await supabase.from("member_embeddings").upsert({
      member_id: member.id,
      profile_embedding,
      need_embedding,
    });
    if (embedError) throw new Error(`Embedding kaydedilemedi: ${embedError.message}`);

    // 3) Ön filtreleme (pgvector)
    const candidates = await findCandidateMembers(member.id, need_embedding, 20);

    // 4) İnce eleme: AI açıksa Claude (sadece registry_no ile), kapalıysa
    // pgvector sonuçlarının ilk 5'i ham metinlerle doğrudan kullanılır.
    const refined =
      candidates.length === 0
        ? []
        : AI_REFINEMENT_ENABLED
          ? await refineMatches(member.id, candidates)
          : await buildNaiveMatches(member.id, candidates);

    // registry_no -> member_id çözümü SADECE backend'de yapılır (LLM dışında)
    const { data: resolvedMembers } = await supabase
      .from("members")
      .select("id, registry_no, name")
      .in(
        "registry_no",
        refined.map((r) => r.registry_no)
      );
    const byRegistryNo = new Map((resolvedMembers ?? []).map((m) => [m.registry_no, m]));

    const matchRows = refined
      .map((r) => {
        const other = byRegistryNo.get(r.registry_no);
        if (!other) return null;
        return {
          member_a: member.id,
          member_b: other.id,
          strength: r.strength,
          a_offers_b: r.a_offers_b,
          b_offers_a: r.b_offers_a,
          topics: r.topics,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let savedMatches: Match[] = [];
    if (matchRows.length > 0) {
      // 5) matches tablosuna yazılır
      const { data, error: matchError } = await supabase
        .from("matches")
        .upsert(matchRows, { onConflict: "member_a,member_b" })
        .select();
      if (matchError) throw new Error(`Eşleşmeler kaydedilemedi: ${matchError.message}`);
      savedMatches = data ?? [];
    }

    // İsim çözümlemesi SADECE burada, backend'de yapılır — kullanıcıya
    // gösterim için. byMemberId, resolvedMembers üzerinden kurulur.
    const byMemberId = new Map((resolvedMembers ?? []).map((m) => [m.id, m]));

    return NextResponse.json(
      {
        member,
        match_mode: AI_REFINEMENT_ENABLED ? "ai" : "naive",
        matches: savedMatches.map((m) => ({
          ...m,
          other_member: byMemberId.get(m.member_b) ?? null,
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    // Üye kaydı başarılı oldu ama eşleştirme başarısız oldu; kullanıcıya
    // üyeliğinin oluştuğunu, eşleşmelerin gecikmeli hesaplanacağını bildir.
    return NextResponse.json(
      {
        member,
        matches: [],
        warning: `Üye kaydedildi fakat eşleştirme hesaplanamadı: ${(e as Error).message}`,
      },
      { status: 207 }
    );
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("id, registry_no, name, sector, joined_at")
    .order("joined_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}
