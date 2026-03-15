export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          analysis_type: string
          completed_at: string | null
          created_at: string
          data_quality_score: number | null
          error_message: string | null
          expires_at: string | null
          id: string
          match_id: string
          model_version: string | null
          prediction: Json | null
          raw_response: string | null
          report: Json | null
          requested_at: string
          source_count: number | null
          status: string
          uncertainty_score: number | null
          updated_at: string
        }
        Insert: {
          analysis_type?: string
          completed_at?: string | null
          created_at?: string
          data_quality_score?: number | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          match_id: string
          model_version?: string | null
          prediction?: Json | null
          raw_response?: string | null
          report?: Json | null
          requested_at?: string
          source_count?: number | null
          status?: string
          uncertainty_score?: number | null
          updated_at?: string
        }
        Update: {
          analysis_type?: string
          completed_at?: string | null
          created_at?: string
          data_quality_score?: number | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          match_id?: string
          model_version?: string | null
          prediction?: Json | null
          raw_response?: string | null
          report?: Json | null
          requested_at?: string
          source_count?: number | null
          status?: string
          uncertainty_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_fixture_id: number
          away_score: number | null
          away_score_ht: number | null
          away_team_id: number
          away_team_logo: string | null
          away_team_name: string
          created_at: string
          fetched_at: string
          home_score: number | null
          home_score_ht: number | null
          home_team_id: number
          home_team_logo: string | null
          home_team_name: string
          id: string
          kickoff: string
          league_country: string
          league_flag: string | null
          league_id: number
          league_logo: string | null
          league_name: string
          league_round: string | null
          status_long: string
          status_short: string
          updated_at: string
          venue_city: string | null
          venue_name: string | null
        }
        Insert: {
          api_fixture_id: number
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id: number
          away_team_logo?: string | null
          away_team_name: string
          created_at?: string
          fetched_at?: string
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id: number
          home_team_logo?: string | null
          home_team_name: string
          id?: string
          kickoff: string
          league_country: string
          league_flag?: string | null
          league_id: number
          league_logo?: string | null
          league_name: string
          league_round?: string | null
          status_long?: string
          status_short?: string
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Update: {
          api_fixture_id?: number
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id?: number
          away_team_logo?: string | null
          away_team_name?: string
          created_at?: string
          fetched_at?: string
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id?: number
          home_team_logo?: string | null
          home_team_name?: string
          id?: string
          kickoff?: string
          league_country?: string
          league_flag?: string | null
          league_id?: number
          league_logo?: string | null
          league_name?: string
          league_round?: string | null
          status_long?: string
          status_short?: string
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
