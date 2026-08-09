"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MatchResult = {
  strength: number;
  a_offers_b: string;
  b_offers_a: string;
  topics: string[] | null;
  other_member: { id: string; registry_no: string; name: string } | null;
};

const initialForm = {
  name: "",
  sector: "",
  expertise: "",
  offers: "",
  needs: "",
  bio: "",
};

export default function BasvuruPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [registryNo, setRegistryNo] = useState<string | null>(null);

  function update<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMatches(null);

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Bir hata oluştu.");
      }

      setMemberId(data.member.id);
      setRegistryNo(data.member.registry_no);
      setMatches(data.matches ?? []);
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (matches) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Kayıt tamamlandı 🎉</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Sicildeki en uygun {matches.length} eşleşme bulundu.
          {registryNo && <> Sicil numaran: <span className="font-medium">{registryNo}</span>.</>}
        </p>
        {error && <p className="mt-4 text-sm text-amber-600">{error}</p>}

        <ul className="mt-8 space-y-4">
          {matches.map((m, i) => (
            <li key={i} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.other_member?.name ?? "Bilinmeyen üye"}</span>
                <span className="text-sm text-neutral-500">güç: {m.strength}/5</span>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-medium">Sen ona verebilirsin:</span> {m.a_offers_b}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-medium">O sana verebilir:</span> {m.b_offers_a}
              </p>
              {m.topics && m.topics.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-2">
                  {m.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800"
                    >
                      {t}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>

        {memberId && (
          <button
            onClick={() => router.push(`/dashboard?member=${memberId}`)}
            className="mt-8 rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Dashboard&apos;a git
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">JCI Bursa Networking Eşleşmesi</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Bilgilerin, sicildeki en uygun kişilerle seni eşleştirmek için kullanılır.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Ad Soyad" value={form.name} onChange={(v) => update("name", v)} required />
        <Field label="Sektör" placeholder="Yazılım, İnşaat, Finans..." value={form.sector} onChange={(v) => update("sector", v)} required />
        <Field label="Uzmanlık Alanın" value={form.expertise} onChange={(v) => update("expertise", v)} textarea />
        <Field label="Sunabileceğin Destek" value={form.offers} onChange={(v) => update("offers", v)} textarea />
        <Field label="Aradığın Destek" value={form.needs} onChange={(v) => update("needs", v)} textarea />
        <Field label="Kısa Biyografi" value={form.bio} onChange={(v) => update("bio", v)} textarea />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Eşleşmeler hesaplanıyor..." : "Başvuruyu Gönder"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder,
    required,
    className:
      "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900",
  };
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {textarea ? <textarea rows={2} {...commonProps} /> : <input type="text" {...commonProps} />}
    </label>
  );
}
