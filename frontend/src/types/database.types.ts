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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_leverage_cards: {
        Row: {
          block_id: string
          card: Json
          created_at: string | null
          id: string
          session_id: string
          svg_schema: string | null
          tool_id: string
        }
        Insert: {
          block_id: string
          card: Json
          created_at?: string | null
          id?: string
          session_id: string
          svg_schema?: string | null
          tool_id: string
        }
        Update: {
          block_id?: string
          card?: Json
          created_at?: string | null
          id?: string
          session_id?: string
          svg_schema?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_leverage_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blind_spot_unlocks: {
        Row: {
          id: string
          spot_index: number
          trend_id: string
          unlock_method: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          spot_index?: number
          trend_id: string
          unlock_method?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          spot_index?: number
          trend_id?: string
          unlock_method?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      block_decisions: {
        Row: {
          block_id: string
          created_at: string | null
          decision: Json
          id: string
          raw_output: Json
          session_id: string
          translated_output: Json | null
        }
        Insert: {
          block_id: string
          created_at?: string | null
          decision: Json
          id?: string
          raw_output: Json
          session_id: string
          translated_output?: Json | null
        }
        Update: {
          block_id?: string
          created_at?: string | null
          decision?: Json
          id?: string
          raw_output?: Json
          session_id?: string
          translated_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "block_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      block_interpretations: {
        Row: {
          block_id: string
          data_sufficiency: string | null
          decision_impact: string
          generated_at: string
          headline: string
          id: string
          key_facts: Json
          main_insight: string
          model_used: string | null
          trend_id: string
        }
        Insert: {
          block_id: string
          data_sufficiency?: string | null
          decision_impact: string
          generated_at?: string
          headline: string
          id?: string
          key_facts?: Json
          main_insight: string
          model_used?: string | null
          trend_id: string
        }
        Update: {
          block_id?: string
          data_sufficiency?: string | null
          decision_impact?: string
          generated_at?: string
          headline?: string
          id?: string
          key_facts?: Json
          main_insight?: string
          model_used?: string | null
          trend_id?: string
        }
        Relationships: []
      }
      block_results: {
        Row: {
          block_context: Json | null
          block_number: number
          block_type: string
          conflict_weight: number
          created_at: string | null
          diagnosis: string
          id: string
          intelligence_output: Json | null
          intelligence_updated_at: string | null
          key_factors: string[] | null
          key_metric: string | null
          raw_data: Json | null
          score: number
          trend_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          block_context?: Json | null
          block_number: number
          block_type: string
          conflict_weight?: number
          created_at?: string | null
          diagnosis: string
          id?: string
          intelligence_output?: Json | null
          intelligence_updated_at?: string | null
          key_factors?: string[] | null
          key_metric?: string | null
          raw_data?: Json | null
          score: number
          trend_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          block_context?: Json | null
          block_number?: number
          block_type?: string
          conflict_weight?: number
          created_at?: string | null
          diagnosis?: string
          id?: string
          intelligence_output?: Json | null
          intelligence_updated_at?: string | null
          key_factors?: string[] | null
          key_metric?: string | null
          raw_data?: Json | null
          score?: number
          trend_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      context_objects: {
        Row: {
          confidence_score: number | null
          context_object: Json
          created_at: string | null
          expires_at: string
          hit_count: number | null
          id: string
          last_used_at: string | null
          niche_canonical: string
          niche_hash: string
          niche_input: string
          prompt_version: string
        }
        Insert: {
          confidence_score?: number | null
          context_object: Json
          created_at?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          niche_canonical: string
          niche_hash: string
          niche_input: string
          prompt_version?: string
        }
        Update: {
          confidence_score?: number | null
          context_object?: Json
          created_at?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          niche_canonical?: string
          niche_hash?: string
          niche_input?: string
          prompt_version?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          trend_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          trend_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          trend_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_niche_research: {
        Row: {
          analysis: Json
          created_at: string | null
          description: string | null
          id: string
          niche: string
          product_spec: Json | null
          sources: Json | null
          trend_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis: Json
          created_at?: string | null
          description?: string | null
          id?: string
          niche: string
          product_spec?: Json | null
          sources?: Json | null
          trend_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          niche?: string
          product_spec?: Json | null
          sources?: Json | null
          trend_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_trends: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          score: number | null
          source: string | null
          title: string
          trend_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          score?: number | null
          source?: string | null
          title: string
          trend_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          score?: number | null
          source?: string | null
          title?: string
          trend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          id: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          category: string | null
          created_at: string | null
          data: Json | null
          id: string
          title: string
          trend_id: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          title: string
          trend_id?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          title?: string
          trend_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          data: Json | null
          description: string | null
          id: string
          idea_id: string | null
          name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          description?: string | null
          id?: string
          idea_id?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          description?: string | null
          id?: string
          idea_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_access: {
        Row: {
          created_at: string | null
          discount_window_until: string | null
          id: string
          paid_until: string | null
          status: string
          strategy_session_id: string
          trend_id: string
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discount_window_until?: string | null
          id?: string
          paid_until?: string | null
          status?: string
          strategy_session_id: string
          trend_id: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          discount_window_until?: string | null
          id?: string
          paid_until?: string | null
          status?: string
          strategy_session_id?: string
          trend_id?: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_access_strategy_session_id_fkey"
            columns: ["strategy_session_id"]
            isOneToOne: false
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_chat_messages: {
        Row: {
          ai_role: string | null
          content: string | null
          cost_usd: number | null
          created_at: string | null
          id: string
          roadmap_id: string | null
          role: string | null
          session_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          ai_role?: string | null
          content?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          roadmap_id?: string | null
          role?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          ai_role?: string | null
          content?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          roadmap_id?: string | null
          role?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_chat_summaries: {
        Row: {
          active_topic: string | null
          covers_from_message_id: string | null
          covers_messages_count: number | null
          covers_to_message_id: string | null
          created_at: string | null
          id: string
          no_new_facts: boolean | null
          roadmap_id: string | null
          session_id: string | null
          summary_content: string
          user_id: string | null
        }
        Insert: {
          active_topic?: string | null
          covers_from_message_id?: string | null
          covers_messages_count?: number | null
          covers_to_message_id?: string | null
          created_at?: string | null
          id?: string
          no_new_facts?: boolean | null
          roadmap_id?: string | null
          session_id?: string | null
          summary_content: string
          user_id?: string | null
        }
        Update: {
          active_topic?: string | null
          covers_from_message_id?: string | null
          covers_messages_count?: number | null
          covers_to_message_id?: string | null
          created_at?: string | null
          id?: string
          no_new_facts?: boolean | null
          roadmap_id?: string | null
          session_id?: string | null
          summary_content?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_chat_summaries_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_chat_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_conversations: {
        Row: {
          channel: string
          channel_other: string | null
          created_at: string | null
          first_contact_at: string | null
          id: string
          last_message_at: string | null
          last_user_action_at: string | null
          lead_handle: string | null
          lead_name: string
          message_history: Json | null
          next_action: string | null
          next_action_done: boolean | null
          next_action_due: string | null
          notes: string | null
          outcome_reason: string | null
          outcome_reason_detail: string | null
          post_adjust: boolean | null
          pre_adjust: boolean | null
          promoted_to_personal: boolean | null
          related_experiment_ids: string[] | null
          roadmap_id: string
          status: string
          trajectory: string | null
          updated_at: string | null
          used_templates: string[] | null
          user_id: string
        }
        Insert: {
          channel: string
          channel_other?: string | null
          created_at?: string | null
          first_contact_at?: string | null
          id?: string
          last_message_at?: string | null
          last_user_action_at?: string | null
          lead_handle?: string | null
          lead_name: string
          message_history?: Json | null
          next_action?: string | null
          next_action_done?: boolean | null
          next_action_due?: string | null
          notes?: string | null
          outcome_reason?: string | null
          outcome_reason_detail?: string | null
          post_adjust?: boolean | null
          pre_adjust?: boolean | null
          promoted_to_personal?: boolean | null
          related_experiment_ids?: string[] | null
          roadmap_id: string
          status?: string
          trajectory?: string | null
          updated_at?: string | null
          used_templates?: string[] | null
          user_id: string
        }
        Update: {
          channel?: string
          channel_other?: string | null
          created_at?: string | null
          first_contact_at?: string | null
          id?: string
          last_message_at?: string | null
          last_user_action_at?: string | null
          lead_handle?: string | null
          lead_name?: string
          message_history?: Json | null
          next_action?: string | null
          next_action_done?: boolean | null
          next_action_due?: string | null
          notes?: string | null
          outcome_reason?: string | null
          outcome_reason_detail?: string | null
          post_adjust?: boolean | null
          pre_adjust?: boolean | null
          promoted_to_personal?: boolean | null
          related_experiment_ids?: string[] | null
          roadmap_id?: string
          status?: string
          trajectory?: string | null
          updated_at?: string | null
          used_templates?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_conversations_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_daily_actions: {
        Row: {
          action_text: string
          context: Json | null
          date: string
          generated_at: string | null
          generated_by_role: string | null
          id: string
          session_id: string
        }
        Insert: {
          action_text: string
          context?: Json | null
          date: string
          generated_at?: string | null
          generated_by_role?: string | null
          id?: string
          session_id: string
        }
        Update: {
          action_text?: string
          context?: Json | null
          date?: string
          generated_at?: string | null
          generated_by_role?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_daily_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_daily_logs: {
        Row: {
          blocking_to_discuss_with_max: boolean | null
          created_at: string | null
          date: string
          decision: Json | null
          energy: number | null
          has_significant_decision: boolean | null
          id: string
          knowledge_id: string | null
          promoted_to_knowledge: boolean | null
          roadmap_id: string
          small_win: string | null
          updated_at: string | null
          user_id: string
          what_blocking: string | null
          what_done: string | null
          what_learned: string | null
        }
        Insert: {
          blocking_to_discuss_with_max?: boolean | null
          created_at?: string | null
          date: string
          decision?: Json | null
          energy?: number | null
          has_significant_decision?: boolean | null
          id?: string
          knowledge_id?: string | null
          promoted_to_knowledge?: boolean | null
          roadmap_id: string
          small_win?: string | null
          updated_at?: string | null
          user_id: string
          what_blocking?: string | null
          what_done?: string | null
          what_learned?: string | null
        }
        Update: {
          blocking_to_discuss_with_max?: boolean | null
          created_at?: string | null
          date?: string
          decision?: Json | null
          energy?: number | null
          has_significant_decision?: boolean | null
          id?: string
          knowledge_id?: string | null
          promoted_to_knowledge?: boolean | null
          roadmap_id?: string
          small_win?: string | null
          updated_at?: string | null
          user_id?: string
          what_blocking?: string | null
          what_done?: string | null
          what_learned?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_daily_logs_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_email_notifications: {
        Row: {
          clicked_at: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          session_id: string | null
          trigger_type: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          session_id?: string | null
          trigger_type: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          session_id?: string | null
          trigger_type?: string
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_email_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_experiments: {
        Row: {
          category: string
          completed_at: string | null
          confidence: string | null
          cost_hours_actual: number | null
          cost_hours_estimated: number | null
          cost_money_actual: number | null
          cost_money_estimated: number | null
          created_at: string | null
          current_value: number | null
          duration_days: number | null
          ends_at: string | null
          evidence_snapshots: Json | null
          hypothesis: string
          id: string
          lesson: string | null
          metric: string
          metric_custom: string | null
          min_sample_size: number | null
          related_conversation_ids: string[] | null
          result_summary: string | null
          roadmap_id: string
          started_at: string | null
          status: string
          target_value: number | null
          updated_at: string | null
          user_id: string
          why_rejected: string | null
          why_validated: string | null
        }
        Insert: {
          category: string
          completed_at?: string | null
          confidence?: string | null
          cost_hours_actual?: number | null
          cost_hours_estimated?: number | null
          cost_money_actual?: number | null
          cost_money_estimated?: number | null
          created_at?: string | null
          current_value?: number | null
          duration_days?: number | null
          ends_at?: string | null
          evidence_snapshots?: Json | null
          hypothesis: string
          id?: string
          lesson?: string | null
          metric: string
          metric_custom?: string | null
          min_sample_size?: number | null
          related_conversation_ids?: string[] | null
          result_summary?: string | null
          roadmap_id: string
          started_at?: string | null
          status?: string
          target_value?: number | null
          updated_at?: string | null
          user_id: string
          why_rejected?: string | null
          why_validated?: string | null
        }
        Update: {
          category?: string
          completed_at?: string | null
          confidence?: string | null
          cost_hours_actual?: number | null
          cost_hours_estimated?: number | null
          cost_money_actual?: number | null
          cost_money_estimated?: number | null
          created_at?: string | null
          current_value?: number | null
          duration_days?: number | null
          ends_at?: string | null
          evidence_snapshots?: Json | null
          hypothesis?: string
          id?: string
          lesson?: string | null
          metric?: string
          metric_custom?: string | null
          min_sample_size?: number | null
          related_conversation_ids?: string[] | null
          result_summary?: string | null
          roadmap_id?: string
          started_at?: string | null
          status?: string
          target_value?: number | null
          updated_at?: string | null
          user_id?: string
          why_rejected?: string | null
          why_validated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_experiments_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_in_app_banners: {
        Row: {
          banner_type: string
          clicked_at: string | null
          content: string
          created_at: string | null
          dismissed_at: string | null
          id: string
          session_id: string
          shown_at: string | null
        }
        Insert: {
          banner_type: string
          clicked_at?: string | null
          content: string
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          session_id: string
          shown_at?: string | null
        }
        Update: {
          banner_type?: string
          clicked_at?: string | null
          content?: string
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          session_id?: string
          shown_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_in_app_banners_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_kill_switch_history: {
        Row: {
          created_at: string | null
          decision: string | null
          decision_context: string | null
          id: string
          metrics_snapshot: Json | null
          pipeline_data: Json | null
          review_date: string | null
          review_iteration: number | null
          roadmap_id: string
          scenario: string | null
          trajectory_data: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          decision?: string | null
          decision_context?: string | null
          id?: string
          metrics_snapshot?: Json | null
          pipeline_data?: Json | null
          review_date?: string | null
          review_iteration?: number | null
          roadmap_id: string
          scenario?: string | null
          trajectory_data?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          decision?: string | null
          decision_context?: string | null
          id?: string
          metrics_snapshot?: Json | null
          pipeline_data?: Json | null
          review_date?: string | null
          review_iteration?: number | null
          roadmap_id?: string
          scenario?: string | null
          trajectory_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_kill_switch_history_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_sessions: {
        Row: {
          access_id: string | null
          active_role: string | null
          channel_type: string | null
          created_at: string | null
          day_number: number | null
          first_action_completed: boolean | null
          id: string
          kill_switch_date: string
          kill_switch_metric: string | null
          last_active_at: string | null
          message_count: number | null
          niche: string | null
          paid_until: string | null
          status: string | null
          strategy_summary: string | null
          trend_id: string
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_id?: string | null
          active_role?: string | null
          channel_type?: string | null
          created_at?: string | null
          day_number?: number | null
          first_action_completed?: boolean | null
          id?: string
          kill_switch_date: string
          kill_switch_metric?: string | null
          last_active_at?: string | null
          message_count?: number | null
          niche?: string | null
          paid_until?: string | null
          status?: string | null
          strategy_summary?: string | null
          trend_id: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_id?: string | null
          active_role?: string | null
          channel_type?: string | null
          created_at?: string | null
          day_number?: number | null
          first_action_completed?: boolean | null
          id?: string
          kill_switch_date?: string
          kill_switch_metric?: string | null
          last_active_at?: string | null
          message_count?: number | null
          niche?: string | null
          paid_until?: string | null
          status?: string | null
          strategy_summary?: string | null
          trend_id?: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_sessions_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "roadmap_access"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_templates: {
        Row: {
          asset_data: Json | null
          category: string
          created_at: string | null
          created_with_marcus: boolean | null
          id: string
          last_used_at: string | null
          name: string
          parent_id: string | null
          performance: Json | null
          previous_versions: Json | null
          roadmap_id: string
          tags: string[] | null
          template_data: Json | null
          type: string
          updated_at: string | null
          usage_count: number | null
          used_in_conversations: string[] | null
          user_id: string
          version: number | null
        }
        Insert: {
          asset_data?: Json | null
          category: string
          created_at?: string | null
          created_with_marcus?: boolean | null
          id?: string
          last_used_at?: string | null
          name: string
          parent_id?: string | null
          performance?: Json | null
          previous_versions?: Json | null
          roadmap_id: string
          tags?: string[] | null
          template_data?: Json | null
          type: string
          updated_at?: string | null
          usage_count?: number | null
          used_in_conversations?: string[] | null
          user_id: string
          version?: number | null
        }
        Update: {
          asset_data?: Json | null
          category?: string
          created_at?: string | null
          created_with_marcus?: boolean | null
          id?: string
          last_used_at?: string | null
          name?: string
          parent_id?: string | null
          performance?: Json | null
          previous_versions?: Json | null
          roadmap_id?: string
          tags?: string[] | null
          template_data?: Json | null
          type?: string
          updated_at?: string | null
          usage_count?: number | null
          used_in_conversations?: string[] | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_templates_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_trigger_history: {
        Row: {
          clicked: boolean | null
          clicked_at: string | null
          confidence: string | null
          content: string | null
          id: string
          ignored: boolean | null
          opened: boolean | null
          opened_at: string | null
          replied: boolean | null
          replied_at: string | null
          roadmap_id: string | null
          sent_at: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          clicked?: boolean | null
          clicked_at?: string | null
          confidence?: string | null
          content?: string | null
          id?: string
          ignored?: boolean | null
          opened?: boolean | null
          opened_at?: string | null
          replied?: boolean | null
          replied_at?: string | null
          roadmap_id?: string | null
          sent_at?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          clicked?: boolean | null
          clicked_at?: string | null
          confidence?: string | null
          content?: string | null
          id?: string
          ignored?: boolean | null
          opened?: boolean | null
          opened_at?: string | null
          replied?: boolean | null
          replied_at?: string | null
          roadmap_id?: string | null
          sent_at?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_trigger_history_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_trigger_locks: {
        Row: {
          category: string
          locked_until: string
          triggered_by: string | null
          user_id: string
        }
        Insert: {
          category: string
          locked_until: string
          triggered_by?: string | null
          user_id: string
        }
        Update: {
          category?: string
          locked_until?: string
          triggered_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roadmap_triggers: {
        Row: {
          acted_upon: boolean | null
          actionable_text: string
          context: Json | null
          generated_at: string | null
          id: string
          raw_content: string | null
          seen_by_user: boolean | null
          session_id: string
          source_url: string | null
          suggested_action: string | null
          trigger_type: string
        }
        Insert: {
          acted_upon?: boolean | null
          actionable_text: string
          context?: Json | null
          generated_at?: string | null
          id?: string
          raw_content?: string | null
          seen_by_user?: boolean | null
          session_id: string
          source_url?: string | null
          suggested_action?: string | null
          trigger_type: string
        }
        Update: {
          acted_upon?: boolean | null
          actionable_text?: string
          context?: Json | null
          generated_at?: string | null
          id?: string
          raw_content?: string | null
          seen_by_user?: boolean | null
          session_id?: string
          source_url?: string | null
          suggested_action?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_triggers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_user_memory: {
        Row: {
          actions_taken: Json | null
          decisions_made: Json | null
          emotional_context: Json | null
          fears: Json | null
          hypotheses_tested: Json | null
          id: string
          last_updated: string | null
          leo_calculations: Json | null
          marcus_state: Json | null
          milestones: Json | null
          open_questions: Json | null
          resolved_fears: Json | null
          roadmap_id: string
          user_id: string
        }
        Insert: {
          actions_taken?: Json | null
          decisions_made?: Json | null
          emotional_context?: Json | null
          fears?: Json | null
          hypotheses_tested?: Json | null
          id?: string
          last_updated?: string | null
          leo_calculations?: Json | null
          marcus_state?: Json | null
          milestones?: Json | null
          open_questions?: Json | null
          resolved_fears?: Json | null
          roadmap_id: string
          user_id: string
        }
        Update: {
          actions_taken?: Json | null
          decisions_made?: Json | null
          emotional_context?: Json | null
          fears?: Json | null
          hypotheses_tested?: Json | null
          id?: string
          last_updated?: string | null
          leo_calculations?: Json | null
          marcus_state?: Json | null
          milestones?: Json | null
          open_questions?: Json | null
          resolved_fears?: Json | null
          roadmap_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_user_memory_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_user_metrics: {
        Row: {
          id: string
          metric_name: string
          session_id: string
          updated_at: string | null
          updated_via: string | null
          value: number
        }
        Insert: {
          id?: string
          metric_name: string
          session_id: string
          updated_at?: string | null
          updated_via?: string | null
          value?: number
        }
        Update: {
          id?: string
          metric_name?: string
          session_id?: string
          updated_at?: string | null
          updated_via?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_user_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_user_states: {
        Row: {
          consecutive_ignores: number | null
          last_active_at: string | null
          opted_out: boolean | null
          state: string | null
          state_changed_at: string | null
          suspended_until: string | null
          user_id: string
        }
        Insert: {
          consecutive_ignores?: number | null
          last_active_at?: string | null
          opted_out?: boolean | null
          state?: string | null
          state_changed_at?: string | null
          suspended_until?: string | null
          user_id: string
        }
        Update: {
          consecutive_ignores?: number | null
          last_active_at?: string | null
          opted_out?: boolean | null
          state?: string | null
          state_changed_at?: string | null
          suspended_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roadmap_weekly_snapshots: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          id: string
          roadmap_id: string
          snapshot_data: Json
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          id?: string
          roadmap_id: string
          snapshot_data: Json
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          id?: string
          roadmap_id?: string
          snapshot_data?: Json
          user_id?: string
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_weekly_snapshots_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmap_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_block_interpretations: {
        Row: {
          block_id: string
          created_at: string | null
          id: string
          interpretation: Json
          session_id: string
        }
        Insert: {
          block_id: string
          created_at?: string | null
          id?: string
          interpretation: Json
          session_id: string
        }
        Update: {
          block_id?: string
          created_at?: string | null
          id?: string
          interpretation?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_block_interpretations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_reruns: {
        Row: {
          created_at: string | null
          id: string
          new_params: Json | null
          rerun_number: number
          rule_violated: string | null
          session_id: string
          user_choice: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_params?: Json | null
          rerun_number?: number
          rule_violated?: string | null
          session_id: string
          user_choice?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          new_params?: Json | null
          rerun_number?: number
          rule_violated?: string | null
          session_id?: string
          user_choice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_reruns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_sessions: {
        Row: {
          context: Json
          created_at: string | null
          id: string
          kill_switch_date: string | null
          research_snapshot: Json
          status: string | null
          trend_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context: Json
          created_at?: string | null
          id?: string
          kill_switch_date?: string | null
          research_snapshot: Json
          status?: string | null
          trend_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string | null
          id?: string
          kill_switch_date?: string | null
          research_snapshot?: Json
          status?: string | null
          trend_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strategy_summary_cards: {
        Row: {
          card: Json
          created_at: string | null
          id: string
          session_id: string
          trend_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card: Json
          created_at?: string | null
          id?: string
          session_id: string
          trend_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card?: Json
          created_at?: string | null
          id?: string
          session_id?: string
          trend_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_summary_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "strategy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      synthesis_results: {
        Row: {
          arbitrator: Json | null
          bridge_text: string | null
          conflicts: Json | null
          created_at: string | null
          id: string
          is_blind_spot: boolean | null
          niche: string | null
          optimist: Json | null
          sales_text: string | null
          skeptic: Json | null
          strategic_delta: Json | null
          trend_id: string
          user_id: string
        }
        Insert: {
          arbitrator?: Json | null
          bridge_text?: string | null
          conflicts?: Json | null
          created_at?: string | null
          id?: string
          is_blind_spot?: boolean | null
          niche?: string | null
          optimist?: Json | null
          sales_text?: string | null
          skeptic?: Json | null
          strategic_delta?: Json | null
          trend_id: string
          user_id: string
        }
        Update: {
          arbitrator?: Json | null
          bridge_text?: string | null
          conflicts?: Json | null
          created_at?: string | null
          id?: string
          is_blind_spot?: boolean | null
          niche?: string | null
          optimist?: Json | null
          sales_text?: string | null
          skeptic?: Json | null
          strategic_delta?: Json | null
          trend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          analyses_run: number | null
          created_at: string | null
          date: string
          id: string
          ideas_generated: number | null
          projects_created: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analyses_run?: number | null
          created_at?: string | null
          date?: string
          id?: string
          ideas_generated?: number | null
          projects_created?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analyses_run?: number | null
          created_at?: string | null
          date?: string
          id?: string
          ideas_generated?: number | null
          projects_created?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          github_username: string | null
          id: string
          is_admin: boolean | null
          last_login_at: string | null
          name: string | null
          provider: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          github_username?: string | null
          id?: string
          is_admin?: boolean | null
          last_login_at?: string | null
          name?: string | null
          provider: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          github_username?: string | null
          id?: string
          is_admin?: boolean | null
          last_login_at?: string | null
          name?: string | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_daily_stats: {
        Row: {
          active_users: number | null
          date: string | null
          total_analyses: number | null
          total_ideas: number | null
          total_projects: number | null
        }
        Relationships: []
      }
      admin_user_stats: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          days_active: number | null
          email: string | null
          github_username: string | null
          id: string | null
          is_admin: boolean | null
          last_login_at: string | null
          name: string | null
          provider: string | null
          total_analyses: number | null
          total_ideas: number | null
          total_projects: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_leo_calculation: {
        Args: { p_calculation: Json; p_roadmap_id: string; p_user_id: string }
        Returns: undefined
      }
      get_user_stats: {
        Args: { p_user_id: string }
        Returns: {
          days_active: number
          ideas_today: number
          total_analyses: number
          total_ideas: number
          total_projects: number
        }[]
      }
      increment_distress_context: {
        Args: { p_roadmap_id: string; p_user_id: string }
        Returns: undefined
      }
      increment_message_count: {
        Args: { p_roadmap_id: string; p_user_id: string }
        Returns: number
      }
      increment_usage: {
        Args: { p_amount?: number; p_field: string; p_user_id: string }
        Returns: undefined
      }
      update_leo_calculation_outcome: {
        Args: {
          p_actual_outcome: string
          p_calc_id: string
          p_roadmap_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_marcus_state: {
        Args: { p_roadmap_id: string; p_state: Json; p_user_id: string }
        Returns: undefined
      }
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
