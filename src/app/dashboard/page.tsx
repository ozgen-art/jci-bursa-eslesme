import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import FeedbackButton from "./FeedbackButton";

export const dynamic = "force-dynamic";

async function loadMatchesFor(memberId: string) {
  const supabase = getSupabaseAdmin();

  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .or(`member_a.eq.${memberId},member_b.eq.${memberId}`)
    .order("strength", { ascending: false });

  if (error) throw new Error(error.message);
  if (!matches || matches.length === 0) return [];

  const otherIds = matches.map((m) => (m.member_a === memberId ? m.member_b : m.member_a));
  const { data: others } = await supabase
    .from("members")
    .select("id, registry_no, name, sector")
    .in("id", otherIds);
  const byId = new Map((others ?? []).map((m) => [m.id, m]));

  return matches.map((m) => {
    const isA = m.member_a === memberId;
    return {
      ...m,
      other: byId.get(isA ? m.member_b : m.member_a) ?? null,
      // Yön'e göre doğru gerekçe metnini seç: ben A isem a_offers_b benim verdiğim,
      // b_offers_a benim aldığım demektir.
      iOffer: isA ? m.a_offers_b : m.b_offers_a,
      iReceive: isA ? m.b_offers_a : m.a_offers_b,
    };
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member: memberId } = await searchParams;

  if (!memberId) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Üye seçilmedi</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Dashboard&apos;u görmek için <code>?member=&lt;id&gt;</code> parametresiyle gel, ya da{" "}
          <Link href="/basvuru" className="underline">
            başvuru
          </Link>{" "}
          yap.
        </p>
      </main>
    );
  }

  const matches = await loadMatchesFor(memberId);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Eşleşmelerin</h1>
      <p className="mt-2 text-sm text-neutral-500">{matches.length} eşleşme bulundu.</p>

      <ul className="mt-8 space-y-4">
        {matches.map((m) => (
          <li key={m.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.other?.name ?? "Bilinmeyen üye"}</span>
              <span className="text-sm text-neutral-500">güç: {m.strength}/5</span>
            </div>
            <p className="mt-2 text-sm">
              <span className="font-medium">Sen ona verebilirsin:</span> {m.iOffer}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Sen ondan alabilirsin:</span> {m.iReceive}
            </p>
            {m.topics && m.topics.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-2">
                {m.topics.map((t: string) => (
                  <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                    {t}
                  </span>
                ))}
              </p>
            )}
            <div className="mt-3">
              <FeedbackButton matchId={m.id} ratedBy={memberId} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
