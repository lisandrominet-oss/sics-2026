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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          profile_id: string
          read_at: string
          sic_id: string
        }
        Insert: {
          profile_id: string
          read_at?: string
          sic_id: string
        }
        Update: {
          profile_id?: string
          read_at?: string
          sic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_sic_id_fkey"
            columns: ["sic_id"]
            isOneToOne: false
            referencedRelation: "sics"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          prefix: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          prefix: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          prefix?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acting_as_role: Database["public"]["Enums"]["user_role"] | null
          active: boolean
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          plant_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          acting_as_role?: Database["public"]["Enums"]["user_role"] | null
          active?: boolean
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          plant_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          acting_as_role?: Database["public"]["Enums"]["user_role"] | null
          active?: boolean
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          plant_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      provider_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      provider_category_links: {
        Row: {
          category_id: string
          provider_id: string
        }
        Insert: {
          category_id: string
          provider_id: string
        }
        Update: {
          category_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "provider_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_category_links_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_comments: {
        Row: {
          author_id: string | null
          comment: string
          created_at: string
          id: string
          provider_id: string
        }
        Insert: {
          author_id?: string | null
          comment: string
          created_at?: string
          id?: string
          provider_id: string
        }
        Update: {
          author_id?: string | null
          comment?: string
          created_at?: string
          id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_comments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          provider_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          provider_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          provider_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_files_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          favorite: boolean
          id: string
          name: string
          payment_terms: string | null
          phone: string | null
          tax_id: string | null
          tax_status: string | null
        }
        Insert: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          id?: string
          name: string
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_status?: string | null
        }
        Update: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          id?: string
          name?: string
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sic_counters: {
        Row: {
          last_seq: number
          plant_id: string
          year: number
        }
        Insert: {
          last_seq?: number
          plant_id: string
          year: number
        }
        Update: {
          last_seq?: number
          plant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sic_counters_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      sic_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["sic_status"] | null
          id: string
          note: string | null
          sic_id: string
          to_status: Database["public"]["Enums"]["sic_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["sic_status"] | null
          id?: string
          note?: string | null
          sic_id: string
          to_status: Database["public"]["Enums"]["sic_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["sic_status"] | null
          id?: string
          note?: string | null
          sic_id?: string
          to_status?: Database["public"]["Enums"]["sic_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sic_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sic_events_sic_id_fkey"
            columns: ["sic_id"]
            isOneToOne: false
            referencedRelation: "sics"
            referencedColumns: ["id"]
          },
        ]
      }
      sic_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: Database["public"]["Enums"]["sic_file_type"]
          id: string
          item_id: string | null
          sic_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: Database["public"]["Enums"]["sic_file_type"]
          id?: string
          item_id?: string | null
          sic_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: Database["public"]["Enums"]["sic_file_type"]
          id?: string
          item_id?: string | null
          sic_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sic_files_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sic_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sic_files_sic_id_fkey"
            columns: ["sic_id"]
            isOneToOne: false
            referencedRelation: "sics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sic_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sic_items: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          quantity: number
          received_quantity: number
          reference_link: string | null
          sic_id: string
          specs: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          position: number
          quantity: number
          received_quantity?: number
          reference_link?: string | null
          sic_id: string
          specs?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          received_quantity?: number
          reference_link?: string | null
          sic_id?: string
          specs?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sic_items_sic_id_fkey"
            columns: ["sic_id"]
            isOneToOne: false
            referencedRelation: "sics"
            referencedColumns: ["id"]
          },
        ]
      }
      sics: {
        Row: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          department?: string | null
          description?: string | null
          estimated_amount?: number | null
          final_amount?: number | null
          id?: string
          needed_by_date?: string | null
          plant_id: string
          po_number?: string | null
          project_id?: string | null
          requester_id: string
          sequence: number
          status?: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at?: string
          year: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          department?: string | null
          description?: string | null
          estimated_amount?: number | null
          final_amount?: number | null
          id?: string
          needed_by_date?: string | null
          plant_id?: string
          po_number?: string | null
          project_id?: string | null
          requester_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["sic_status"]
          subject?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sics_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sics_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_provisioning: {
        Row: {
          active: boolean
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          plant_id: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          plant_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          plant_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_provisioning_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_file: {
        Args: {
          p_file_name: string
          p_file_type: Database["public"]["Enums"]["sic_file_type"]
          p_item_id?: string
          p_sic_id: string
          p_storage_path: string
        }
        Returns: {
          created_at: string
          file_name: string
          file_type: Database["public"]["Enums"]["sic_file_type"]
          id: string
          item_id: string | null
          sic_id: string
          storage_path: string
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sic_files"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_sic: {
        Args: { p_note: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_sic: {
        Args: { p_note?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compras_review_sic: {
        Args: {
          p_decision: Database["public"]["Enums"]["compras_decision"]
          p_note?: string
          p_sic_id: string
        }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sic: {
        Args: {
          p_currency?: Database["public"]["Enums"]["currency_code"]
          p_items?: Json
          p_needed_by_date: string
          p_plant_id?: string
          p_project_id: string
          p_subject: string
        }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_sic_file: { Args: { p_file_id: string }; Returns: undefined }
      effective_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      gerencia_decision: {
        Args: { p_aprobar: boolean; p_note?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pending_notifications: {
        Args: { p_limit?: number }
        Returns: {
          code: string
          id: string
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
        }[]
      }
      issue_po: {
        Args: { p_note?: string; p_po_number?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      record_delivery: {
        Args: { p_deliveries: Json; p_note?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quotes: {
        Args: { p_final_amount: number; p_note?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      technical_review: {
        Args: { p_aprobar: boolean; p_note?: string; p_sic_id: string }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_sic_details: {
        Args: {
          p_items: Json
          p_needed_by_date: string
          p_project_id: string
          p_sic_id: string
          p_subject: string
        }
        Returns: {
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          department: string | null
          description: string | null
          estimated_amount: number | null
          final_amount: number | null
          id: string
          needed_by_date: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          requester_id: string
          sequence: number
          status: Database["public"]["Enums"]["sic_status"]
          subject: string
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "sics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      compras_decision: "aceptar" | "rechazar" | "observar"
      currency_code: "ARS" | "USD"
      sic_file_type:
        | "cotizacion"
        | "comparacion"
        | "orden_compra"
        | "remito"
        | "factura"
        | "otro"
        | "referencia"
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
        | "anulada"
      user_role: "admin" | "gerencia" | "compras" | "panol" | "area"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      compras_decision: ["aceptar", "rechazar", "observar"],
      currency_code: ["ARS", "USD"],
      sic_file_type: [
        "cotizacion",
        "comparacion",
        "orden_compra",
        "remito",
        "factura",
        "otro",
        "referencia",
      ],
      sic_status: [
        "enviada",
        "en_observacion",
        "rechazada_compras",
        "cotizando",
        "pendiente_validacion_tecnica",
        "pendiente_aprobacion_gerencia",
        "rechazada_gerencia",
        "aprobada",
        "orden_emitida",
        "recibida",
        "cerrada",
        "anulada",
      ],
      user_role: ["admin", "gerencia", "compras", "panol", "area"],
    },
  },
} as const
