export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: 'free' | 'pro' | 'enterprise';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          usage_count: number;
          usage_reset_at: string;
          last_analysis_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          usage_count?: number;
          usage_reset_at?: string;
          last_analysis_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          usage_count?: number;
          usage_reset_at?: string;
          last_analysis_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          input: string;
          input_type: 'text' | 'url' | 'keyword';
          result: Json;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          input: string;
          input_type: 'text' | 'url' | 'keyword';
          result: Json;
          tokens_used: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          input?: string;
          input_type?: 'text' | 'url' | 'keyword';
          result?: Json;
          tokens_used?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analyses_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_usage: {
        Args: {
          user_id: string;
          count: number;
        };
        Returns: number;
      };
    };
    Enums: {
      subscription_tier: 'free' | 'pro' | 'enterprise';
      input_type: 'text' | 'url' | 'keyword';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Analysis = Database['public']['Tables']['analyses']['Row'];
export type AnalysisInsert = Database['public']['Tables']['analyses']['Insert'];
export type AnalysisUpdate = Database['public']['Tables']['analyses']['Update'];
