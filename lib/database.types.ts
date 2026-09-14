export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: { key: string; value: Json };
        Insert: { key: string; value: Json };
        Update: { key?: string; value?: Json };
        Relationships: [];
      };
      plants: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          prefix: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          prefix: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          prefix?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          acting_as_role: Database["public"]["Enums"]["user_role"] | null;
          active: boolean;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string | null;
          id: string;
          plant_id: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
        };
        Insert: {
          acting_as_role?: Database["public"]["Enums"]["user_role"] | null;
          active?: boolean;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          plant_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Update: {
          acting_as_role?: Database["public"]["Enums"]["user_role"] | null;
          active?: boolean;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          plant_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [];
      };
      projects: {
        Row: { active: boolean; created_at: string; id: string; name: string };
        Insert: { active?: boolean; created_at?: string; id?: string; name: string };
        Update: { active?: boolean; created_at?: string; id?: string; name?: string };
        Relationships: [];
      };
      notification_reads: {
        Row: { profile_id: string; read_at: string; sic_id: string };
        Insert: { profile_id: string; read_at?: string; sic_id: string };
        Update: { profile_id?: string; read_at?: string; sic_id?: string };
        Relationships: [];
      };
      user_provisioning: {
        Row: {
          active: boolean;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string | null;
          id: string;
          plant_id: string | null;
          role: Database["public"]["Enums"]["user_role"];
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name?: string | null;
          id?: string;
          plant_id?: string | null;
          role: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          active?: boolean;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          plant_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [];
      };
      sic_counters: {
        Row: { last_seq: number; plant_id: string; year: number };
        Insert: { last_seq?: number; plant_id: string; year: number };
        Update: { last_seq?: number; plant_id?: string; year?: number };
        Relationships: [];
      };
      sic_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["sic_status"] | null;
          id: string;
          note: string | null;
          sic_id: string;
          to_status: Database["public"]["Enums"]["sic_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["sic_status"] | null;
          id?: string;
          note?: string | null;
          sic_id: string;
          to_status: Database["public"]["Enums"]["sic_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["sic_status"] | null;
          id?: string;
          note?: string | null;
          sic_id?: string;
          to_status?: Database["public"]["Enums"]["sic_status"];
        };
        Relationships: [];
      };
      sic_files: {
        Row: {
          created_at: string;
          file_name: string;
          file_type: Database["public"]["Enums"]["sic_file_type"];
          id: string;
          item_id: string | null;
          sic_id: string;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_type: Database["public"]["Enums"]["sic_file_type"];
          id?: string;
          item_id?: string | null;
          sic_id: string;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_type?: Database["public"]["Enums"]["sic_file_type"];
          id?: string;
          item_id?: string | null;
          sic_id?: string;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      sic_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          position: number;
          quantity: number;
          received_quantity: number;
          reference_link: string | null;
          sic_id: string;
          specs: string | null;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          position: number;
          quantity: number;
          received_quantity?: number;
          reference_link?: string | null;
          sic_id: string;
          specs?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          quantity?: number;
          received_quantity?: number;
          reference_link?: string | null;
          sic_id?: string;
          specs?: string | null;
        };
        Relationships: [];
      };
      sics: {
        Row: {
          code: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          department: string | null;
          description: string | null;
          estimated_amount: number | null;
          final_amount: number | null;
          id: string;
          needed_by_date: string | null;
          plant_id: string;
          po_number: string | null;
          project_id: string | null;
          requester_id: string;
          sequence: number;
          status: Database["public"]["Enums"]["sic_status"];
          subject: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          department?: string | null;
          description?: string | null;
          estimated_amount?: number | null;
          final_amount?: number | null;
          id?: string;
          needed_by_date?: string | null;
          plant_id: string;
          po_number?: string | null;
          project_id?: string | null;
          requester_id: string;
          sequence: number;
          status?: Database["public"]["Enums"]["sic_status"];
          subject: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          department?: string | null;
          description?: string | null;
          estimated_amount?: number | null;
          final_amount?: number | null;
          id?: string;
          needed_by_date?: string | null;
          plant_id?: string;
          po_number?: string | null;
          project_id?: string | null;
          requester_id?: string;
          sequence?: number;
          status?: Database["public"]["Enums"]["sic_status"];
          subject?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cancel_sic: {
        Args: { p_note: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      get_pending_notifications: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          code: string;
          subject: string;
          status: Database["public"]["Enums"]["sic_status"];
          updated_at: string;
        }[];
      };
      attach_file: {
        Args: {
          p_file_name: string;
          p_file_type: Database["public"]["Enums"]["sic_file_type"];
          p_item_id?: string;
          p_sic_id: string;
          p_storage_path: string;
        };
        Returns: Database["public"]["Tables"]["sic_files"]["Row"];
      };
      close_sic: {
        Args: { p_note?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      compras_review_sic: {
        Args: {
          p_decision: Database["public"]["Enums"]["compras_decision"];
          p_note?: string;
          p_sic_id: string;
        };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      create_sic: {
        Args: {
          p_currency?: Database["public"]["Enums"]["currency_code"];
          p_items?: Json;
          p_needed_by_date: string;
          p_plant_id?: string;
          p_project_id: string;
          p_subject: string;
        };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      delete_sic_file: { Args: { p_file_id: string }; Returns: undefined };
      effective_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      gerencia_decision: {
        Args: { p_aprobar: boolean; p_note?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      issue_po: {
        Args: { p_note?: string; p_po_number?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      record_delivery: {
        Args: { p_deliveries: Json; p_note?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      submit_quotes: {
        Args: { p_final_amount: number; p_note?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      technical_review: {
        Args: { p_aprobar: boolean; p_note?: string; p_sic_id: string };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
      update_sic_details: {
        Args: {
          p_items: Json;
          p_needed_by_date: string;
          p_project_id: string;
          p_sic_id: string;
          p_subject: string;
        };
        Returns: Database["public"]["Tables"]["sics"]["Row"];
      };
    };
    Enums: {
      compras_decision: "aceptar" | "rechazar" | "observar";
      currency_code: "ARS" | "USD";
      sic_file_type:
        | "cotizacion"
        | "comparacion"
        | "orden_compra"
        | "remito"
        | "factura"
        | "otro"
        | "referencia";
      sic_status:
        | "enviada"
        | "en_observacion"
        | "rechazada_compras"
        | "cotizando"
        | "pendiente_validacion_tecnica"
        | "pendiente_aprobacion_gerencia"
        | "rechazada_gerencia"
        | "aprobada"
        | "orden_emitida"
        | "recibida"
        | "cerrada"
        | "anulada";
      user_role: "admin" | "gerencia" | "compras" | "panol" | "area";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
