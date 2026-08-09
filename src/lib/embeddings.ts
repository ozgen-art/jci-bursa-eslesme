import "server-only";
import OpenAI from "openai";
import type { NewMember } from "@/types/db";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 boyut, ucuz

let cachedClient: OpenAI | null = null;

function getOpenAI() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY .env dosyasında tanımlı değil.");
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const trimmed = text.trim() || "-"; // boş string embedding API'de hataya sebep olabilir
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  });
  return res.data[0].embedding;
}

/**
 * Brief bölüm 3 / adım 2:
 * - profile_embedding: "expertise + offers + bio" birleşik metni
 * - need_embedding: sadece "needs" metni
 */
export async function generateMemberEmbeddings(
  member: Pick<NewMember, "expertise" | "offers" | "bio" | "needs">
) {
  const profileText = [member.expertise, member.offers, member.bio]
    .filter(Boolean)
    .join("\n");
  const needText = member.needs ?? "";

  const [profile_embedding, need_embedding] = await Promise.all([
    embedText(profileText),
    embedText(needText),
  ]);

  return { profile_embedding, need_embedding };
}
