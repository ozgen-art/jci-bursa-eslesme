"use client";

import { useState } from "react";

export default function FeedbackButton({
  matchId,
  ratedBy,
}: {
  matchId: string;
  ratedBy: string;
}) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function send(useful: boolean) {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, rated_by: ratedBy, useful }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-xs text-neutral-500">Teşekkürler, geri bildirimin kaydedildi ✅</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">Faydalı mıydı?</span>
      <button
        onClick={() => send(true)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
      >
        👍 Evet
      </button>
      <button
        onClick={() => send(false)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
      >
        👎 Hayır
      </button>
      {state === "error" && <span className="text-xs text-red-600">Gönderilemedi, tekrar dene.</span>}
    </div>
  );
}
