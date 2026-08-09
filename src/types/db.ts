// Veritabanı satır tipleri (supabase/migrations/0001_init.sql ile birebir eşleşir)

export interface Member {
  id: string;
  registry_no: string;
  name: string;
  sector: string;
  expertise: string | null;
  offers: string | null;
  needs: string | null;
  bio: string | null;
  joined_at: string;
}

export type NewMember = Omit<Member, "id" | "joined_at">;

export interface MemberEmbedding {
  member_id: string;
  profile_embedding: number[];
  need_embedding: number[];
  updated_at: string;
}

export interface Match {
  id: string;
  member_a: string;
  member_b: string;
  strength: number;
  a_offers_b: string | null;
  b_offers_a: string | null;
  topics: string[] | null;
  created_at: string;
}

export interface MatchFeedback {
  id: string;
  match_id: string;
  rated_by: string | null;
  useful: boolean | null;
  created_at: string;
}

/** match_candidates() RPC fonksiyonunun döndürdüğü satır. */
export interface CandidateRow {
  id: string;
  registry_no: string;
  similarity: number;
}

/** Claude ince eleme çıktısındaki tek bir eşleşme. Sadece registry_no taşır — isim asla. */
export interface RefinedMatch {
  registry_no: string;
  strength: number;
  a_offers_b: string;
  b_offers_a: string;
  topics: string[];
}

/** LLM'e gönderilen üye profili — `name` alanı KASITLI OLARAK yok. */
export interface AnonymizedMember {
  registry_no: string;
  sector: string;
  expertise: string | null;
  offers: string | null;
  needs: string | null;
  bio: string | null;
}
