import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = getSupabaseAdmin();

  const [membersRes, matchCountRes, feedbackRes] = await Promise.all([
    supabase.from("members").select("*").order("joined_at", { ascending: false }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("match_feedback").select("useful"),
  ]);

  const members = membersRes.data ?? [];
  const matchCount = matchCountRes.count ?? 0;
  const feedbackRows = feedbackRes.data ?? [];
  const usefulCount = feedbackRows.filter((f) => f.useful === true).length;
  const totalFeedback = feedbackRows.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Paneli</h1>
          <p className="mt-1 text-sm text-neutral-500">JCI Bursa Networking Eşleşmesi — kayıtlar</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Üye" value={members.length} />
        <StatCard label="Toplam Eşleşme" value={matchCount} />
        <StatCard
          label="Faydalı Bulunan Geri Bildirim"
          value={totalFeedback > 0 ? `${usefulCount} / ${totalFeedback}` : "—"}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        {members.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz kayıt yok.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-2 pr-4 font-medium">Sicil No</th>
                <th className="py-2 pr-4 font-medium">Ad Soyad</th>
                <th className="py-2 pr-4 font-medium">Sektör</th>
                <th className="py-2 pr-4 font-medium">Sunduğu</th>
                <th className="py-2 pr-4 font-medium">Aradığı</th>
                <th className="py-2 pr-4 font-medium">Katılım</th>
                <th className="py-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4 whitespace-nowrap">{m.registry_no}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{m.name}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{m.sector}</td>
                  <td className="max-w-xs truncate py-2 pr-4">{m.offers}</td>
                  <td className="max-w-xs truncate py-2 pr-4">{m.needs}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(m.joined_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Link href={`/dashboard?member=${m.id}`} className="underline">
                      eşleşmeleri gör
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
