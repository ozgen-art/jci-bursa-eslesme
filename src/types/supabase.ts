// Elle yazılmış minimal Supabase Database tipi. `supabase gen types typescript`
// çalıştırıldığında bu dosyanın üzerine yazılabilir; şema
// supabase/migrations/000*.sql ile birebir eşleşir.

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          registry_no: string;
          name: string;
          sector: string;
          expertise: string | null;
          offers: string | null;
          needs: string | null;
          bio: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          registry_no: string;
          name: string;
          sector: string;
          expertise?: string | null;
          offers?: string | null;
          needs?: string | null;
          bio?: string | null;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      member_embeddings: {
        Row: {
          member_id: string;
          profile_embedding: number[] | null;
          need_embedding: number[] | null;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          profile_embedding?: number[] | null;
          need_embedding?: number[] | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_embeddings"]["Insert"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          member_a: string;
          member_b: string;
          strength: number;
          a_offers_b: string | null;
          b_offers_a: string | null;
          topics: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_a: string;
          member_b: string;
          strength: number;
          a_offers_b?: string | null;
          b_offers_a?: string | null;
          topics?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
        Relationships: [];
      };
      match_feedback: {
        Row: {
          id: string;
          match_id: string;
          rated_by: string | null;
          useful: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          rated_by?: string | null;
          useful?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["match_feedback"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_candidates: {
        Args: {
          p_new_member_id: string;
          p_need_embedding: number[];
          p_limit?: number;
        };
        Returns: {
          id: string;
          registry_no: string;
          similarity: number;
        }[];
      };
      generate_registry_no: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
