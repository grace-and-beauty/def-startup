/**
 * Database types, written by hand to mirror supabase/migrations (same shape as
 * `supabase gen types typescript` output, but with literal unions for the
 * text "enums" guarded by CHECK constraints).
 *
 * Keep in sync with the migrations. If a Supabase project is linked, the file
 * can be regenerated and the literal unions re-applied.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StoredPlanValue = "trial" | "basic" | "plus" | "pro";
export type BillingStatus = "active" | "past_due" | "canceled";
export type WalletType = "web" | "google" | "apple";
export type StampEventType = "stamp" | "reward_redeemed";
export type MessageKind = "broadcast" | "reminder";
export type MessageTarget = "all" | "at_risk" | "card";
export type ProgramType = "stamps";

export type ApplyStampStatus = "ok" | "not_found" | "staff_inactive" | "cooldown";
export type RedeemRewardStatus = "ok" | "not_found" | "staff_inactive" | "no_reward";
export type OnboardBusinessStatus = "ok" | "already_done";
export type BeginStaffLoginStatus = "ok" | "locked" | "locked_business";
export type IssueCardStatus = "ok" | "not_found" | "limit_reached";
export type SendBroadcastStatus = "ok" | "quota_exhausted" | "no_recipients";

type Rel<Name extends string, Cols extends string[], Ref extends string, RefCols extends string[]> = {
  foreignKeyName: Name;
  columns: Cols;
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: RefCols;
};

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          niche_slug: string;
          logo_url: string | null;
          bg_color: string;
          fg_color: string;
          label_color: string;
          timezone: string;
          avg_check: number | null;
          plan: StoredPlanValue;
          trial_ends_at: string;
          plan_renews_at: string | null;
          billing_status: BillingStatus;
          canceled_at: string | null;
          enabled_modules: Json;
          onboarding_done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          niche_slug: string;
          logo_url?: string | null;
          bg_color?: string;
          fg_color?: string;
          label_color?: string;
          timezone?: string;
          avg_check?: number | null;
          /** Forced to defaults for end users by protect_billing_fields. */
          plan?: StoredPlanValue;
          trial_ends_at?: string;
          plan_renews_at?: string | null;
          billing_status?: BillingStatus;
          canceled_at?: string | null;
          enabled_modules?: Json;
          onboarding_done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          niche_slug?: string;
          logo_url?: string | null;
          bg_color?: string;
          fg_color?: string;
          label_color?: string;
          timezone?: string;
          avg_check?: number | null;
          plan?: StoredPlanValue;
          trial_ends_at?: string;
          plan_renews_at?: string | null;
          billing_status?: BillingStatus;
          canceled_at?: string | null;
          enabled_modules?: Json;
          onboarding_done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          business_id: string;
          type: ProgramType;
          stamps_required: number;
          reward_text: string;
          terms_text: string | null;
          reminders_enabled: boolean;
          reminder_days: number | null;
          reminder_text: string | null;
          google_class_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type?: ProgramType;
          stamps_required: number;
          reward_text: string;
          terms_text?: string | null;
          reminders_enabled?: boolean;
          reminder_days?: number | null;
          reminder_text?: string | null;
          google_class_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: ProgramType;
          stamps_required?: number;
          reward_text?: string;
          terms_text?: string | null;
          reminders_enabled?: boolean;
          reminder_days?: number | null;
          reminder_text?: string | null;
          google_class_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [Rel<"programs_business_id_fkey", ["business_id"], "businesses", ["id"]>];
      };
      staff: {
        /** pin_hash is NOT selectable by owners (column grant); only the service role reads it. */
        Row: {
          id: string;
          business_id: string;
          name: string;
          pin_hash: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          pin_hash: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          pin_hash?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [Rel<"staff_business_id_fkey", ["business_id"], "businesses", ["id"]>];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Relationships: [Rel<"customers_business_id_fkey", ["business_id"], "businesses", ["id"]>];
      };
      cards: {
        Row: {
          id: string;
          business_id: string;
          program_id: string;
          customer_id: string;
          qr_token: string;
          stamps_count: number;
          rewards_available: number;
          rewards_redeemed: number;
          total_visits: number;
          first_visit_at: string | null;
          last_visit_at: string | null;
          last_reminder_at: string | null;
          wallet_type: WalletType;
          google_object_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          program_id: string;
          customer_id: string;
          qr_token: string;
          stamps_count?: number;
          rewards_available?: number;
          rewards_redeemed?: number;
          total_visits?: number;
          first_visit_at?: string | null;
          last_visit_at?: string | null;
          last_reminder_at?: string | null;
          wallet_type?: WalletType;
          google_object_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          program_id?: string;
          customer_id?: string;
          qr_token?: string;
          stamps_count?: number;
          rewards_available?: number;
          rewards_redeemed?: number;
          total_visits?: number;
          first_visit_at?: string | null;
          last_visit_at?: string | null;
          last_reminder_at?: string | null;
          wallet_type?: WalletType;
          google_object_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          Rel<"cards_business_id_fkey", ["business_id"], "businesses", ["id"]>,
          Rel<"cards_customer_id_business_id_fkey", ["customer_id", "business_id"], "customers", ["id", "business_id"]>,
          Rel<"cards_program_id_business_id_fkey", ["program_id", "business_id"], "programs", ["id", "business_id"]>,
        ];
      };
      stamp_events: {
        Row: {
          id: number;
          business_id: string;
          card_id: string;
          staff_id: string | null;
          type: StampEventType;
          created_at: string;
        };
        Insert: {
          business_id: string;
          card_id: string;
          staff_id?: string | null;
          type: StampEventType;
          created_at?: string;
        };
        Update: {
          business_id?: string;
          card_id?: string;
          staff_id?: string | null;
          type?: StampEventType;
          created_at?: string;
        };
        Relationships: [
          Rel<"stamp_events_business_id_fkey", ["business_id"], "businesses", ["id"]>,
          Rel<"stamp_events_card_id_business_id_fkey", ["card_id", "business_id"], "cards", ["id", "business_id"]>,
          Rel<"stamp_events_staff_id_business_id_fkey", ["staff_id", "business_id"], "staff", ["id", "business_id"]>,
        ];
      };
      messages: {
        Row: {
          id: string;
          business_id: string;
          kind: MessageKind;
          target: MessageTarget;
          card_id: string | null;
          text: string;
          recipients_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          kind: MessageKind;
          target: MessageTarget;
          card_id?: string | null;
          text: string;
          recipients_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          kind?: MessageKind;
          target?: MessageTarget;
          card_id?: string | null;
          text?: string;
          recipients_count?: number;
          created_at?: string;
        };
        Relationships: [
          Rel<"messages_business_id_fkey", ["business_id"], "businesses", ["id"]>,
          Rel<"messages_card_id_business_id_fkey", ["card_id", "business_id"], "cards", ["id", "business_id"]>,
        ];
      };
      message_recipients: {
        Row: {
          message_id: string;
          card_id: string;
          business_id: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          card_id: string;
          business_id: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          card_id?: string;
          business_id?: string;
          created_at?: string;
        };
        Relationships: [
          Rel<"message_recipients_message_id_fkey", ["message_id"], "messages", ["id"]>,
          Rel<"message_recipients_business_id_fkey", ["business_id"], "businesses", ["id"]>,
          Rel<"message_recipients_card_id_business_id_fkey", ["card_id", "business_id"], "cards", ["id", "business_id"]>,
        ];
      };
      staff_login_attempts: {
        Row: {
          id: number;
          business_id: string;
          ip_hash: string;
          success: boolean;
          created_at: string;
        };
        Insert: {
          business_id: string;
          ip_hash: string;
          success: boolean;
          created_at?: string;
        };
        Update: {
          business_id?: string;
          ip_hash?: string;
          success?: boolean;
          created_at?: string;
        };
        Relationships: [Rel<"staff_login_attempts_business_id_fkey", ["business_id"], "businesses", ["id"]>];
      };
      rate_limit_events: {
        Row: {
          id: number;
          scope: string;
          business_id: string;
          key_hash: string;
          created_at: string;
        };
        Insert: {
          scope: string;
          business_id: string;
          key_hash: string;
          created_at?: string;
        };
        Update: {
          scope?: string;
          business_id?: string;
          key_hash?: string;
          created_at?: string;
        };
        Relationships: [Rel<"rate_limit_events_business_id_fkey", ["business_id"], "businesses", ["id"]>];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      hit_rate_limit: {
        Args: {
          p_scope: string;
          p_business_id: string;
          p_key_hash: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      begin_staff_login: {
        Args: {
          p_business_id: string;
          p_ip_hash: string;
          p_window_minutes: number;
          p_max_ip_failures: number;
          p_max_business_failures: number;
        };
        Returns: {
          status: BeginStaffLoginStatus;
          attempt_id: number | null;
          failures: number;
        }[];
      };
      issue_card: {
        Args: {
          p_business_id: string;
          p_name: string | null;
          p_phone: string | null;
          p_qr_token: string;
          p_max_customers: number | null;
        };
        Returns: {
          status: IssueCardStatus;
          card_id: string | null;
        }[];
      };
      send_broadcast: {
        Args: {
          p_business_id: string;
          p_target: "all" | "at_risk";
          p_text: string;
          p_card_ids: string[] | null;
          p_max_per_month: number | null;
        };
        Returns: {
          status: SendBroadcastStatus;
          message_id: string | null;
          recipients_count: number;
          used: number;
        }[];
      };
      record_reminder: {
        Args: { p_business_id: string; p_text: string; p_card_ids: string[] };
        Returns: { message_id: string; card_id: string }[];
      };
      is_business_owner: {
        Args: { bid: string };
        Returns: boolean;
      };
      apply_stamp: {
        Args: {
          p_business_id: string;
          p_card_id: string;
          p_staff_id?: string | null;
          p_cooldown_minutes?: number;
        };
        Returns: {
          status: ApplyStampStatus;
          card_id: string;
          stamps_count: number | null;
          stamps_required: number | null;
          rewards_available: number | null;
          rewards_redeemed: number | null;
          total_visits: number | null;
          last_visit_at: string | null;
          rewards_earned: number;
          retry_after: string | null;
        }[];
      };
      redeem_reward: {
        Args: {
          p_business_id: string;
          p_card_id: string;
          p_staff_id?: string | null;
        };
        Returns: {
          status: RedeemRewardStatus;
          card_id: string;
          stamps_count: number | null;
          stamps_required: number | null;
          rewards_available: number | null;
          rewards_redeemed: number | null;
          total_visits: number | null;
          last_visit_at: string | null;
        }[];
      };
      onboard_business: {
        Args: {
          p_name: string;
          p_slug: string;
          p_niche_slug: string;
          p_bg_color: string;
          p_fg_color: string;
          p_label_color: string;
          p_stamps_required: number;
          p_reward_text: string;
          p_terms_text: string | null;
          p_reminder_days: number | null;
          p_reminder_text: string | null;
          p_staff_name: string;
          p_staff_pin_hash: string;
        };
        Returns: {
          business_id: string;
          status: OnboardBusinessStatus;
        }[];
      };
      analytics_business_tz: {
        Args: { bid: string };
        Returns: string;
      };
      analytics_daily: {
        Args: { bid: string; p_from: string; p_to: string };
        Returns: {
          day: string;
          stamps: number;
          first_visits: number;
          repeat_visits: number;
          rewards: number;
          unique_cards: number;
          new_cards: number;
        }[];
      };
      analytics_heatmap: {
        Args: { bid: string; p_from: string; p_to: string };
        Returns: {
          dow: number;
          hour: number;
          stamps: number;
        }[];
      };
      analytics_card_stats: {
        Args: { bid: string };
        Returns: {
          card_id: string;
          customer_id: string;
          customer_name: string | null;
          card_created_at: string;
          visits: number;
          rewards_redeemed: number;
          first_visit_at: string | null;
          last_visit_at: string | null;
          last_reminder_at: string | null;
          stamps_count: number;
          rewards_available: number;
          wallet_type: WalletType;
          second_visit_at: string | null;
        }[];
      };
      analytics_staff: {
        Args: { bid: string; p_from: string; p_to: string };
        Returns: {
          staff_id: string | null;
          staff_name: string | null;
          is_active: boolean | null;
          stamps: number;
          rewards: number;
          unique_cards: number;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type RpcReturns<F extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][F]["Returns"];
export type RpcArgs<F extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][F]["Args"];

export type Business = Tables<"businesses">;
export type Program = Tables<"programs">;
/** Staff row as visible to owners / the browser — never contains pin_hash. */
export type Staff = Omit<Tables<"staff">, "pin_hash">;
export type StaffWithPinHash = Tables<"staff">;
export type Customer = Tables<"customers">;
export type Card = Tables<"cards">;
export type StampEvent = Tables<"stamp_events">;
export type Message = Tables<"messages">;
export type StaffLoginAttempt = Tables<"staff_login_attempts">;
export type MessageRecipient = Tables<"message_recipients">;

export type ApplyStampResult = RpcReturns<"apply_stamp">[number];
export type RedeemRewardResult = RpcReturns<"redeem_reward">[number];
export type OnboardBusinessResult = RpcReturns<"onboard_business">[number];
export type BeginStaffLoginResult = RpcReturns<"begin_staff_login">[number];
export type IssueCardResult = RpcReturns<"issue_card">[number];
export type SendBroadcastResult = RpcReturns<"send_broadcast">[number];
export type AnalyticsDailyRow = RpcReturns<"analytics_daily">[number];
export type AnalyticsHeatmapRow = RpcReturns<"analytics_heatmap">[number];
export type AnalyticsCardStatsRow = RpcReturns<"analytics_card_stats">[number];
export type AnalyticsStaffRow = RpcReturns<"analytics_staff">[number];
