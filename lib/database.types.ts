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
      contract_alerts: {
        Row: {
          attended_at: string
          attended_by: string | null
          kind: string
          target_id: string
        }
        Insert: {
          attended_at?: string
          attended_by?: string | null
          kind: string
          target_id: string
        }
        Update: {
          attended_at?: string
          attended_by?: string | null
          kind?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_alerts_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["contract_document_type"]
          expires_at: string | null
          file_name: string
          id: string
          installment_id: string | null
          provider_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          doc_type: Database["public"]["Enums"]["contract_document_type"]
          expires_at?: string | null
          file_name: string
          id?: string
          installment_id?: string | null
          provider_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["contract_document_type"]
          expires_at?: string | null
          file_name?: string
          id?: string
          installment_id?: string | null
          provider_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "contract_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string
          event_type: string
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_installments: {
        Row: {
          contract_id: string
          created_at: string
          difference_accepted_amount: number | null
          difference_accepted_at: string | null
          difference_accepted_by: string | null
          difference_accepted_note: string | null
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["contract_installment_status"]
        }
        Insert: {
          contract_id: string
          created_at?: string
          difference_accepted_amount?: number | null
          difference_accepted_at?: string | null
          difference_accepted_by?: string | null
          difference_accepted_note?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["contract_installment_status"]
        }
        Update: {
          contract_id?: string
          created_at?: string
          difference_accepted_amount?: number | null
          difference_accepted_at?: string | null
          difference_accepted_by?: string | null
          difference_accepted_note?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["contract_installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_difference_accepted_by_fkey"
            columns: ["difference_accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_item_rates: {
        Row: {
          created_at: string
          created_by: string | null
          excess_rule: string
          id: string
          included_hours: number | null
          item_id: string
          monthly_rate_usd: number
          note: string | null
          overage_rate_usd: number | null
          valid_from: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          excess_rule?: string
          id?: string
          included_hours?: number | null
          item_id: string
          monthly_rate_usd: number
          note?: string | null
          overage_rate_usd?: number | null
          valid_from: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          excess_rule?: string
          id?: string
          included_hours?: number | null
          item_id?: string
          monthly_rate_usd?: number
          note?: string | null
          overage_rate_usd?: number | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_item_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_item_rates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "contract_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_items: {
        Row: {
          chassis_number: string | null
          contract_id: string
          created_at: string
          description: string
          domain: string | null
          engine_number: string | null
          id: string
          identifier: string | null
          internal_number: string | null
          type: Database["public"]["Enums"]["contract_item_type"]
        }
        Insert: {
          chassis_number?: string | null
          contract_id: string
          created_at?: string
          description: string
          domain?: string | null
          engine_number?: string | null
          id?: string
          identifier?: string | null
          internal_number?: string | null
          type: Database["public"]["Enums"]["contract_item_type"]
        }
        Update: {
          chassis_number?: string | null
          contract_id?: string
          created_at?: string
          description?: string
          domain?: string | null
          engine_number?: string | null
          id?: string
          identifier?: string | null
          internal_number?: string | null
          type?: Database["public"]["Enums"]["contract_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_usage: {
        Row: {
          created_at: string
          created_by: string | null
          hours: number
          id: string
          item_id: string
          manual_expected_usd: number | null
          manual_note: string | null
          period_end: string
          period_start: string
          report_file_name: string | null
          report_storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hours: number
          id?: string
          item_id: string
          manual_expected_usd?: number | null
          manual_note?: string | null
          period_end: string
          period_start: string
          report_file_name?: string | null
          report_storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          item_id?: string
          manual_expected_usd?: number | null
          manual_note?: string | null
          period_end?: string
          period_start?: string
          report_file_name?: string | null
          report_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_usage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "contract_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          notice_days: number
          owner_id: string
          plant_id: string | null
          project_id: string | null
          provider_id: string
          renewal_months: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note: string | null
          returned: boolean
          returned_at: string | null
          sic_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          notice_days?: number
          owner_id: string
          plant_id?: string | null
          project_id?: string | null
          provider_id: string
          renewal_months?: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note?: string | null
          returned?: boolean
          returned_at?: string | null
          sic_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          notice_days?: number
          owner_id?: string
          plant_id?: string | null
          project_id?: string | null
          provider_id?: string
          renewal_months?: number | null
          renewal_type?: Database["public"]["Enums"]["contract_renewal_type"]
          return_note?: string | null
          returned?: boolean
          returned_at?: string | null
          sic_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sic_id_fkey"
            columns: ["sic_id"]
            isOneToOne: false
            referencedRelation: "sics"
            referencedColumns: ["id"]
          },
        ]
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
      provider_invoice_lines: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          invoice_id: string
          item_id: string | null
          net_amount: number
          period_start: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          invoice_id: string
          item_id?: string | null
          net_amount: number
          period_start: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          item_id?: string | null
          net_amount?: number
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_invoice_lines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "provider_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "contract_items"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          fx_rate: number | null
          id: string
          issue_date: string
          kind: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount: number | null
          number: string | null
          paid_invoice_id: string | null
          provider_id: string
          status: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path: string | null
          total_amount: number
          vat_amount: number | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          fx_rate?: number | null
          id?: string
          issue_date: string
          kind: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount?: number | null
          number?: string | null
          paid_invoice_id?: string | null
          provider_id: string
          status?: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path?: string | null
          total_amount: number
          vat_amount?: number | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          fx_rate?: number | null
          id?: string
          issue_date?: string
          kind?: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount?: number | null
          number?: string | null
          paid_invoice_id?: string | null
          provider_id?: string
          status?: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path?: string | null
          total_amount?: number
          vat_amount?: number | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invoices_paid_invoice_id_fkey"
            columns: ["paid_invoice_id"]
            isOneToOne: false
            referencedRelation: "provider_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invoices_voided_by_fkey"
            columns: ["voided_by"]
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
          has_current_account: boolean
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
          has_current_account?: boolean
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
          has_current_account?: boolean
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
          requires_quality_cert: boolean
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
          requires_quality_cert?: boolean
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
          requires_quality_cert?: boolean
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of?: string | null
          plant_id: string
          po_number?: string | null
          project_id?: string | null
          provider_id?: string | null
          purchase_type?: string
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
          on_behalf_of?: string | null
          plant_id?: string
          po_number?: string | null
          project_id?: string | null
          provider_id?: string | null
          purchase_type?: string
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
            foreignKeyName: "sics_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
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
      accept_installment_difference: {
        Args: { p_amount: number; p_installment_id: string; p_note: string }
        Returns: {
          contract_id: string
          created_at: string
          difference_accepted_amount: number | null
          difference_accepted_at: string | null
          difference_accepted_by: string | null
          difference_accepted_note: string | null
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["contract_installment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "contract_installments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_contract_item_rate: {
        Args: {
          p_excess_rule: string
          p_included_hours: number
          p_item_id: string
          p_monthly_rate_usd: number
          p_note: string
          p_overage_rate_usd: number
          p_valid_from: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          excess_rule: string
          id: string
          included_hours: number | null
          item_id: string
          monthly_rate_usd: number
          note: string | null
          overage_rate_usd: number | null
          valid_from: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_item_rates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      classify_sic_current_account: {
        Args: { p_note?: string; p_provider_id: string; p_sic_id: string }
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      create_contract: {
        Args: {
          p_end_date: string
          p_items?: Json
          p_notes: string
          p_notice_days: number
          p_plant_id: string
          p_project_id: string
          p_provider_id: string
          p_renewal_months: number
          p_renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          p_sic_id: string
          p_start_date: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          notice_days: number
          owner_id: string
          plant_id: string | null
          project_id: string | null
          provider_id: string
          renewal_months: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note: string | null
          returned: boolean
          returned_at: string | null
          sic_id: string | null
          start_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sic: {
        Args: {
          p_currency?: Database["public"]["Enums"]["currency_code"]
          p_items?: Json
          p_needed_by_date: string
          p_on_behalf_of?: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      get_contract_debt_usd: {
        Args: never
        Returns: {
          contract_id: string
          remaining_usd: number
        }[]
      }
      get_contract_installment_expected_usd: {
        Args: { p_contract_id: string; p_period_start: string }
        Returns: number
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
      get_pending_quality_certificates: {
        Args: never
        Returns: {
          code: string
          item_description: string
          item_id: string
          sic_id: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      record_contract_usage: {
        Args: {
          p_hours: number
          p_item_id: string
          p_manual_expected_usd?: number
          p_manual_note?: string
          p_period_end: string
          p_period_start: string
          p_report_file_name: string
          p_report_storage_path: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          hours: number
          id: string
          item_id: string
          manual_expected_usd: number | null
          manual_note: string | null
          period_end: string
          period_start: string
          report_file_name: string | null
          report_storage_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "contract_usage"
          isOneToOne: true
          isSetofReturn: false
        }
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      record_provider_invoice: {
        Args: {
          p_file_name: string
          p_fx_rate: number
          p_issue_date: string
          p_kind: Database["public"]["Enums"]["provider_invoice_kind"]
          p_lines?: Json
          p_net_amount: number
          p_number: string
          p_paid_invoice_id: string
          p_provider_id: string
          p_storage_path: string
          p_total_amount: number
          p_vat_amount: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          file_name: string | null
          fx_rate: number | null
          id: string
          issue_date: string
          kind: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount: number | null
          number: string | null
          paid_invoice_id: string | null
          provider_id: string
          status: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path: string | null
          total_amount: number
          vat_amount: number | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "provider_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_contract: {
        Args: { p_contract_id: string; p_new_end_date: string; p_note?: string }
        Returns: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          notice_days: number
          owner_id: string
          plant_id: string | null
          project_id: string | null
          provider_id: string
          renewal_months: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note: string | null
          returned: boolean
          returned_at: string | null
          sic_id: string | null
          start_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      return_contract: {
        Args: {
          p_act_file_name: string
          p_act_storage_path: string
          p_contract_id: string
          p_note: string
          p_return_date: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          notice_days: number
          owner_id: string
          plant_id: string | null
          project_id: string | null
          provider_id: string
          renewal_months: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note: string | null
          returned: boolean
          returned_at: string | null
          sic_id: string | null
          start_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revert_sic_to_normal: {
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      set_contract_alert_attended: {
        Args: { p_attended: boolean; p_kind: string; p_target_id: string }
        Returns: undefined
      }
      set_contract_item_internal_number: {
        Args: { p_internal_number: string; p_item_id: string }
        Returns: {
          chassis_number: string | null
          contract_id: string
          created_at: string
          description: string
          domain: string | null
          engine_number: string | null
          id: string
          identifier: string | null
          internal_number: string | null
          type: Database["public"]["Enums"]["contract_item_type"]
        }
        SetofOptions: {
          from: "*"
          to: "contract_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_sic_current_account_amount: {
        Args: { p_amount: number; p_note?: string; p_sic_id: string }
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      update_contract: {
        Args: {
          p_contract_id: string
          p_end_date: string
          p_notes: string
          p_notice_days: number
          p_renewal_months: number
          p_renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          p_start_date: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          notice_days: number
          owner_id: string
          plant_id: string | null
          project_id: string | null
          provider_id: string
          renewal_months: number | null
          renewal_type: Database["public"]["Enums"]["contract_renewal_type"]
          return_note: string | null
          returned: boolean
          returned_at: string | null
          sic_id: string | null
          start_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_contract_item: {
        Args: {
          p_chassis_number: string
          p_description: string
          p_domain: string
          p_engine_number: string
          p_identifier: string
          p_item_id: string
        }
        Returns: {
          chassis_number: string | null
          contract_id: string
          created_at: string
          description: string
          domain: string | null
          engine_number: string | null
          id: string
          identifier: string | null
          internal_number: string | null
          type: Database["public"]["Enums"]["contract_item_type"]
        }
        SetofOptions: {
          from: "*"
          to: "contract_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_provider_invoice: {
        Args: {
          p_file_name: string
          p_fx_rate: number
          p_invoice_id: string
          p_issue_date: string
          p_net_amount: number
          p_number: string
          p_storage_path: string
          p_total_amount: number
          p_vat_amount: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          file_name: string | null
          fx_rate: number | null
          id: string
          issue_date: string
          kind: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount: number | null
          number: string | null
          paid_invoice_id: string | null
          provider_id: string
          status: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path: string | null
          total_amount: number
          vat_amount: number | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "provider_invoices"
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
          on_behalf_of: string | null
          plant_id: string
          po_number: string | null
          project_id: string | null
          provider_id: string | null
          purchase_type: string
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
      void_provider_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: {
          created_at: string
          created_by: string | null
          file_name: string | null
          fx_rate: number | null
          id: string
          issue_date: string
          kind: Database["public"]["Enums"]["provider_invoice_kind"]
          net_amount: number | null
          number: string | null
          paid_invoice_id: string | null
          provider_id: string
          status: Database["public"]["Enums"]["provider_invoice_status"]
          storage_path: string | null
          total_amount: number
          vat_amount: number | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "provider_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      compras_decision: "aceptar" | "rechazar" | "observar"
      contract_document_type:
        | "contrato"
        | "adenda"
        | "condiciones"
        | "seguro"
        | "acta_devolucion"
        | "informe_horas"
        | "otro"
      contract_installment_status:
        | "pendiente_de_factura"
        | "facturada"
        | "pagada"
        | "con_diferencia"
        | "diferencia_aceptada"
      contract_item_type: "maquina" | "camioneta" | "herramienta"
      contract_renewal_type: "automatica" | "expresa" | "sin_renovacion"
      currency_code: "ARS" | "USD"
      provider_invoice_kind: "factura" | "nota_credito" | "pago"
      provider_invoice_status: "vigente" | "anulado"
      sic_file_type:
        | "cotizacion"
        | "comparacion"
        | "orden_compra"
        | "remito"
        | "factura"
        | "otro"
        | "referencia"
        | "certificado_calidad"
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
      contract_document_type: [
        "contrato",
        "adenda",
        "condiciones",
        "seguro",
        "acta_devolucion",
        "informe_horas",
        "otro",
      ],
      contract_installment_status: [
        "pendiente_de_factura",
        "facturada",
        "pagada",
        "con_diferencia",
        "diferencia_aceptada",
      ],
      contract_item_type: ["maquina", "camioneta", "herramienta"],
      contract_renewal_type: ["automatica", "expresa", "sin_renovacion"],
      currency_code: ["ARS", "USD"],
      provider_invoice_kind: ["factura", "nota_credito", "pago"],
      provider_invoice_status: ["vigente", "anulado"],
      sic_file_type: [
        "cotizacion",
        "comparacion",
        "orden_compra",
        "remito",
        "factura",
        "otro",
        "referencia",
        "certificado_calidad",
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
