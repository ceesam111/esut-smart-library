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
      academic_calendar: {
        Row: {
          created_at: string
          created_by: string | null
          exam_one_end: string | null
          exam_one_start: string | null
          exam_two_end: string | null
          exam_two_start: string | null
          id: string
          public_holidays: Json
          semester_one_end: string | null
          semester_one_start: string | null
          semester_two_end: string | null
          semester_two_start: string | null
          session: string
          updated_at: string
          vacation_end: string | null
          vacation_start: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exam_one_end?: string | null
          exam_one_start?: string | null
          exam_two_end?: string | null
          exam_two_start?: string | null
          id?: string
          public_holidays?: Json
          semester_one_end?: string | null
          semester_one_start?: string | null
          semester_two_end?: string | null
          semester_two_start?: string | null
          session: string
          updated_at?: string
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exam_one_end?: string | null
          exam_one_start?: string | null
          exam_two_end?: string | null
          exam_two_start?: string | null
          id?: string
          public_holidays?: Json
          semester_one_end?: string | null
          semester_one_start?: string | null
          semester_two_end?: string | null
          semester_two_start?: string | null
          session?: string
          updated_at?: string
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Relationships: []
      }
      acquisition_budgets: {
        Row: {
          created_at: string
          currency: string
          faculty_code: string
          fiscal_year: string
          id: string
          notes: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          faculty_code: string
          fiscal_year: string
          id?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          faculty_code?: string
          fiscal_year?: string
          id?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      acquisition_suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_access_log: {
        Row: {
          action: string
          created_at: string
          id: string
          librarian_id: string | null
          patron_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          librarian_id?: string | null
          patron_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          librarian_id?: string | null
          patron_id?: string | null
        }
        Relationships: []
      }
      annotations: {
        Row: {
          comment: string | null
          created_at: string
          faculty_code: string | null
          highlighted_text: string
          id: string
          is_private: boolean
          page_number: number | null
          patron_name: string | null
          repo_item_id: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          faculty_code?: string | null
          highlighted_text: string
          id?: string
          is_private?: boolean
          page_number?: number | null
          patron_name?: string | null
          repo_item_id: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          faculty_code?: string | null
          highlighted_text?: string
          id?: string
          is_private?: boolean
          page_number?: number | null
          patron_name?: string | null
          repo_item_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          category: string | null
          content: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      authority_control: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          term: string
          term_type: string
          updated_at: string | null
          variants: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          term: string
          term_type: string
          updated_at?: string | null
          variants?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          term?: string
          term_type?: string
          updated_at?: string | null
          variants?: string[] | null
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          is_approved: boolean
          patron_id: string | null
          post_id: string
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean
          patron_id?: string | null
          post_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          patron_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string
          body: Json | null
          category: string | null
          comments_enabled: boolean
          content: string
          cover_image_url: string | null
          created_at: string
          department: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: Json | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          author_name: string
          body?: Json | null
          category?: string | null
          comments_enabled?: boolean
          content: string
          cover_image_url?: string | null
          created_at?: string
          department?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: Json | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: Json | null
          category?: string | null
          comments_enabled?: boolean
          content?: string
          cover_image_url?: string | null
          created_at?: string
          department?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: Json | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      book_clubs: {
        Row: {
          cover_image: string | null
          created_at: string
          created_by: string | null
          creator_name: string | null
          description: string | null
          faculty_code: string | null
          id: string
          is_public: boolean
          member_count: number
          name: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          description?: string | null
          faculty_code?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          description?: string | null
          faculty_code?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          event_type: string
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          recurrence_pattern: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          event_type: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          recurrence_pattern?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          event_type?: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          recurrence_pattern?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_copies: {
        Row: {
          barcode: string | null
          branch: string | null
          call_number: string | null
          created_at: string
          due_date: string | null
          faculty_code: string | null
          id: string
          item_id: string
          location: string | null
          shelf_location: string | null
          status: string
        }
        Insert: {
          barcode?: string | null
          branch?: string | null
          call_number?: string | null
          created_at?: string
          due_date?: string | null
          faculty_code?: string | null
          id?: string
          item_id: string
          location?: string | null
          shelf_location?: string | null
          status?: string
        }
        Update: {
          barcode?: string | null
          branch?: string | null
          call_number?: string | null
          created_at?: string
          due_date?: string | null
          faculty_code?: string | null
          id?: string
          item_id?: string
          location?: string | null
          shelf_location?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_copies_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_discussions: {
        Row: {
          body: string
          created_at: string
          id: string
          item_id: string
          parent_id: string | null
          patron_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          item_id: string
          parent_id?: string | null
          patron_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          parent_id?: string | null
          patron_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_discussions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalogue_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_items: {
        Row: {
          abstract: string | null
          authors: Json
          available_copies: number
          branch_origin: string | null
          call_number: string | null
          cover_image: string | null
          created_at: string
          download_count: number | null
          edition: string | null
          faculty_code: string | null
          format: string
          harvest_source: string | null
          id: string
          ill_eligible: boolean | null
          is_harvested: boolean
          isbn: string | null
          language: string | null
          library_code: string | null
          library_slug: string | null
          location_notes: string | null
          marc21: Json | null
          marc21_fields: Json | null
          marc21_leader: string | null
          notes: string | null
          physical_description: string | null
          place_of_publication: string | null
          publisher: string | null
          recency_badge: string | null
          series: string | null
          shelf_code: string | null
          subjects: Json | null
          subjects_text: string | null
          title: string
          total_copies: number
          updated_at: string
          view_count: number | null
          visibility: string
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: Json
          available_copies?: number
          branch_origin?: string | null
          call_number?: string | null
          cover_image?: string | null
          created_at?: string
          download_count?: number | null
          edition?: string | null
          faculty_code?: string | null
          format?: string
          harvest_source?: string | null
          id?: string
          ill_eligible?: boolean | null
          is_harvested?: boolean
          isbn?: string | null
          language?: string | null
          library_code?: string | null
          library_slug?: string | null
          location_notes?: string | null
          marc21?: Json | null
          marc21_fields?: Json | null
          marc21_leader?: string | null
          notes?: string | null
          physical_description?: string | null
          place_of_publication?: string | null
          publisher?: string | null
          recency_badge?: string | null
          series?: string | null
          shelf_code?: string | null
          subjects?: Json | null
          subjects_text?: string | null
          title: string
          total_copies?: number
          updated_at?: string
          view_count?: number | null
          visibility?: string
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: Json
          available_copies?: number
          branch_origin?: string | null
          call_number?: string | null
          cover_image?: string | null
          created_at?: string
          download_count?: number | null
          edition?: string | null
          faculty_code?: string | null
          format?: string
          harvest_source?: string | null
          id?: string
          ill_eligible?: boolean | null
          is_harvested?: boolean
          isbn?: string | null
          language?: string | null
          library_code?: string | null
          library_slug?: string | null
          location_notes?: string | null
          marc21?: Json | null
          marc21_fields?: Json | null
          marc21_leader?: string | null
          notes?: string | null
          physical_description?: string | null
          place_of_publication?: string | null
          publisher?: string | null
          recency_badge?: string | null
          series?: string | null
          shelf_code?: string | null
          subjects?: Json | null
          subjects_text?: string | null
          title?: string
          total_copies?: number
          updated_at?: string
          view_count?: number | null
          visibility?: string
          year?: number | null
        }
        Relationships: []
      }
      circulation_transactions: {
        Row: {
          catalogue_item_id: string | null
          copy_barcode: string | null
          id: string
          loan_id: string | null
          notes: string | null
          offline_id: string | null
          patron_id: string | null
          performed_at: string | null
          performed_by: string | null
          synced_at: string | null
          transaction_type: string
        }
        Insert: {
          catalogue_item_id?: string | null
          copy_barcode?: string | null
          id?: string
          loan_id?: string | null
          notes?: string | null
          offline_id?: string | null
          patron_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          synced_at?: string | null
          transaction_type: string
        }
        Update: {
          catalogue_item_id?: string | null
          copy_barcode?: string | null
          id?: string
          loan_id?: string | null
          notes?: string | null
          offline_id?: string | null
          patron_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          synced_at?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "circulation_transactions_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circulation_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circulation_transactions_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          patron_name: string | null
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          patron_name?: string | null
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          patron_name?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_posts: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          parent_id: string | null
          patron_name: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          patron_name?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          patron_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "club_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_banners: {
        Row: {
          button_text: string | null
          created_at: string
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          position: number | null
          start_date: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          button_text?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: number | null
          start_date?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          button_text?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          position?: number | null
          start_date?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_menu: {
        Row: {
          id: string
          items: Json
          nav_type: string
          updated_at: string
        }
        Insert: {
          id?: string
          items?: Json
          nav_type?: string
          updated_at?: string
        }
        Update: {
          id?: string
          items?: Json
          nav_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          blocks: Json
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consortium_access_logs: {
        Row: {
          accessed_at: string
          database_id: string | null
          id: string
          member_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          accessed_at?: string
          database_id?: string | null
          id?: string
          member_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          accessed_at?: string
          database_id?: string | null
          id?: string
          member_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_access_logs_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "consortium_databases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consortium_access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "consortium_members"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_databases: {
        Row: {
          access_type: string | null
          access_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          member_id: string | null
          name: string
          provider: string | null
          subjects: string[] | null
          updated_at: string
        }
        Insert: {
          access_type?: string | null
          access_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          name: string
          provider?: string | null
          subjects?: string[] | null
          updated_at?: string
        }
        Update: {
          access_type?: string | null
          access_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          name?: string
          provider?: string | null
          subjects?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consortium_databases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "consortium_members"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_members: {
        Row: {
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          institution_name: string
          is_founding_member: boolean
          notes: string | null
          onboarded_by: string | null
          phone: string | null
          short_code: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          institution_name: string
          is_founding_member?: boolean
          notes?: string | null
          onboarded_by?: string | null
          phone?: string | null
          short_code?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          institution_name?: string
          is_founding_member?: boolean
          notes?: string | null
          onboarded_by?: string | null
          phone?: string | null
          short_code?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      content_engine_config: {
        Row: {
          enabled: boolean
          id: string
          subject: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          subject: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_reading_list_items: {
        Row: {
          catalogue_item_id: string | null
          click_count: number
          created_at: string
          doi: string | null
          external_authors: string | null
          external_journal: string | null
          external_title: string | null
          external_url: string | null
          external_year: number | null
          id: string
          item_type: string
          list_id: string
          oa_pdf_url: string | null
          pdf_url: string | null
          reading_priority: string
        }
        Insert: {
          catalogue_item_id?: string | null
          click_count?: number
          created_at?: string
          doi?: string | null
          external_authors?: string | null
          external_journal?: string | null
          external_title?: string | null
          external_url?: string | null
          external_year?: number | null
          id?: string
          item_type: string
          list_id: string
          oa_pdf_url?: string | null
          pdf_url?: string | null
          reading_priority?: string
        }
        Update: {
          catalogue_item_id?: string | null
          click_count?: number
          created_at?: string
          doi?: string | null
          external_authors?: string | null
          external_journal?: string | null
          external_title?: string | null
          external_url?: string | null
          external_year?: number | null
          id?: string
          item_type?: string
          list_id?: string
          oa_pdf_url?: string | null
          pdf_url?: string | null
          reading_priority?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reading_list_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reading_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "course_reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reading_lists: {
        Row: {
          course_code: string
          course_title: string
          created_at: string
          department: string
          id: string
          is_active: boolean
          lecturer_id: string | null
          semester: string
          session: string
          updated_at: string
          view_count: number
        }
        Insert: {
          course_code: string
          course_title: string
          created_at?: string
          department: string
          id?: string
          is_active?: boolean
          lecturer_id?: string | null
          semester: string
          session: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          course_code?: string
          course_title?: string
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean
          lecturer_id?: string | null
          semester?: string
          session?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      course_reserve_items: {
        Row: {
          catalogue_item_id: string | null
          course_reserve_id: string
          created_at: string
          custom_author: string | null
          custom_title: string | null
          id: string
          note: string | null
        }
        Insert: {
          catalogue_item_id?: string | null
          course_reserve_id: string
          created_at?: string
          custom_author?: string | null
          custom_title?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          catalogue_item_id?: string | null
          course_reserve_id?: string
          created_at?: string
          custom_author?: string | null
          custom_title?: string | null
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_reserve_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reserve_items_course_reserve_id_fkey"
            columns: ["course_reserve_id"]
            isOneToOne: false
            referencedRelation: "course_reserves"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reserves: {
        Row: {
          course_code: string
          course_title: string
          created_at: string
          department: string | null
          id: string
          instructor: string
          semester: string
          session: string
          updated_at: string
        }
        Insert: {
          course_code: string
          course_title: string
          created_at?: string
          department?: string | null
          id?: string
          instructor: string
          semester: string
          session: string
          updated_at?: string
        }
        Update: {
          course_code?: string
          course_title?: string
          created_at?: string
          department?: string | null
          id?: string
          instructor?: string
          semester?: string
          session?: string
          updated_at?: string
        }
        Relationships: []
      }
      database_access_requests: {
        Row: {
          created_at: string
          database_id: string
          department: string | null
          id: string
          patron_email: string
          patron_name: string
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          database_id: string
          department?: string | null
          id?: string
          patron_email: string
          patron_name: string
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          database_id?: string
          department?: string | null
          id?: string
          patron_email?: string
          patron_name?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_access_requests_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
        ]
      }
      databases: {
        Row: {
          access_type: string
          content_type: string
          coverage: string | null
          created_at: string
          dept_availability: string[] | null
          description: string | null
          faculty_codes: Json | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          provider: string
          subject_tags: string[] | null
          subjects: Json | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          access_type?: string
          content_type?: string
          coverage?: string | null
          created_at?: string
          dept_availability?: string[] | null
          description?: string | null
          faculty_codes?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          provider: string
          subject_tags?: string[] | null
          subjects?: Json | null
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          access_type?: string
          content_type?: string
          coverage?: string | null
          created_at?: string
          dept_availability?: string[] | null
          description?: string | null
          faculty_codes?: Json | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          provider?: string
          subject_tags?: string[] | null
          subjects?: Json | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          faculty_code: string
          hod_name: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          faculty_code: string
          hod_name?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          faculty_code?: string
          hod_name?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      discussions: {
        Row: {
          body: string
          created_at: string
          id: string
          item_id: string
          item_type: string
          parent_id: string | null
          patron_name: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          parent_id?: string | null
          patron_name?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          parent_id?: string | null
          patron_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      doab_books_cache: {
        Row: {
          id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          id?: string
          payload: Json
          updated_at?: string
        }
        Update: {
          id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          attended: boolean | null
          event_id: string
          id: string
          patron_email: string | null
          patron_id: string
          patron_name: string | null
          registered_at: string
        }
        Insert: {
          attended?: boolean | null
          event_id: string
          id?: string
          patron_email?: string | null
          patron_id: string
          patron_name?: string | null
          registered_at?: string
        }
        Update: {
          attended?: boolean | null
          event_id?: string
          id?: string
          patron_email?: string | null
          patron_id?: string
          patron_name?: string | null
          registered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          end_at: string
          event_type: string
          id: string
          image_url: string | null
          is_virtual: boolean | null
          location: string | null
          max_attendees: number | null
          registration_required: boolean
          registrations_count: number
          start_at: string
          status: string
          title: string
          updated_at: string
          venue: string | null
          virtual_url: string | null
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          end_at: string
          event_type?: string
          id?: string
          image_url?: string | null
          is_virtual?: boolean | null
          location?: string | null
          max_attendees?: number | null
          registration_required?: boolean
          registrations_count?: number
          start_at: string
          status?: string
          title: string
          updated_at?: string
          venue?: string | null
          virtual_url?: string | null
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          end_at?: string
          event_type?: string
          id?: string
          image_url?: string | null
          is_virtual?: boolean | null
          location?: string | null
          max_attendees?: number | null
          registration_required?: boolean
          registrations_count?: number
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string | null
          virtual_url?: string | null
        }
        Relationships: []
      }
      feed_event_likes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_event_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_event_reports: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_event_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events: {
        Row: {
          created_at: string
          event_type: string
          faculty_code: string | null
          id: string
          is_removed: boolean
          likes_count: number
          patron_name: string | null
          payload: Json
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          faculty_code?: string | null
          id?: string
          is_removed?: boolean
          likes_count?: number
          patron_name?: string | null
          payload?: Json
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          faculty_code?: string | null
          id?: string
          is_removed?: boolean
          likes_count?: number
          patron_name?: string | null
          payload?: Json
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fines: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          patron_id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          patron_id: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          patron_id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fines_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_staff_only: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_staff_only?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_staff_only?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          author_name: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          thread_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          thread_id: string
          user_id?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_name: string
          body: string
          category_id: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          last_post_at: string
          reply_count: number
          title: string
          user_id: string
          views: number
        }
        Insert: {
          author_name?: string
          body: string
          category_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_post_at?: string
          reply_count?: number
          title: string
          user_id?: string
          views?: number
        }
        Update: {
          author_name?: string
          body?: string
          category_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_post_at?: string
          reply_count?: number
          title?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          items_added: number
          items_found: number
          items_skipped: number
          run_date: string
          source: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          items_added?: number
          items_found?: number
          items_skipped?: number
          run_date?: string
          source?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          items_added?: number
          items_found?: number
          items_skipped?: number
          run_date?: string
          source?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      ill_requests: {
        Row: {
          author: string | null
          created_at: string
          estimated_arrival: string | null
          id: string
          isbn: string | null
          lending_institution: string | null
          notes: string | null
          patron_id: string
          publisher: string | null
          request_type: string
          status: string
          title: string
          updated_at: string
          year: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          estimated_arrival?: string | null
          id?: string
          isbn?: string | null
          lending_institution?: string | null
          notes?: string | null
          patron_id: string
          publisher?: string | null
          request_type?: string
          status?: string
          title: string
          updated_at?: string
          year?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          estimated_arrival?: string | null
          id?: string
          isbn?: string | null
          lending_institution?: string | null
          notes?: string | null
          patron_id?: string
          publisher?: string | null
          request_type?: string
          status?: string
          title?: string
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ill_requests_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_scans: {
        Row: {
          ai_content_score: number | null
          citation_count: number
          citation_issues: Json
          citation_style: string | null
          created_at: string
          flagged_passages: Json
          id: string
          matched_sources: Json
          outdated_count: number
          repository_item_id: string | null
          scan_type: string
          similarity_score: number | null
          title: string | null
          updated_at: string
          user_id: string | null
          word_count: number
        }
        Insert: {
          ai_content_score?: number | null
          citation_count?: number
          citation_issues?: Json
          citation_style?: string | null
          created_at?: string
          flagged_passages?: Json
          id?: string
          matched_sources?: Json
          outdated_count?: number
          repository_item_id?: string | null
          scan_type?: string
          similarity_score?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          word_count?: number
        }
        Update: {
          ai_content_score?: number | null
          citation_count?: number
          citation_issues?: Json
          citation_style?: string | null
          created_at?: string
          flagged_passages?: Json
          id?: string
          matched_sources?: Json
          outdated_count?: number
          repository_item_id?: string | null
          scan_type?: string
          similarity_score?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "integrity_scans_repository_item_id_fkey"
            columns: ["repository_item_id"]
            isOneToOne: false
            referencedRelation: "repository_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_versions: {
        Row: {
          change_note: string | null
          created_at: string
          file_url: string | null
          id: string
          item_id: string
          version_number: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          item_id: string
          version_number?: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          item_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "repository_items"
            referencedColumns: ["id"]
          },
        ]
      }
      librarians: {
        Row: {
          created_at: string
          email: string
          faculty_code: string | null
          full_name: string
          id: string
          is_active: boolean | null
          marc21_mode: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          faculty_code?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          marc21_mode?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          faculty_code?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          marc21_mode?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_shelves: {
        Row: {
          bay: string
          capacity: number
          created_at: string
          description: string | null
          floor_room: string
          id: string
          library_code: string
          library_name: string
          library_slug: string
          shelf_code: string
          shelf_number: string
          status: string
          subject_range: string | null
          updated_at: string
        }
        Insert: {
          bay: string
          capacity?: number
          created_at?: string
          description?: string | null
          floor_room: string
          id?: string
          library_code: string
          library_name: string
          library_slug: string
          shelf_code: string
          shelf_number: string
          status?: string
          subject_range?: string | null
          updated_at?: string
        }
        Update: {
          bay?: string
          capacity?: number
          created_at?: string
          description?: string | null
          floor_room?: string
          id?: string
          library_code?: string
          library_name?: string
          library_slug?: string
          shelf_code?: string
          shelf_number?: string
          status?: string
          subject_range?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      loan_fines: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          paid_at: string | null
          reason: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          paid_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          paid_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_fines_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          catalogue_item_id: string
          checkout_date: string
          created_at: string
          due_date: string
          id: string
          patron_id: string
          renewed_count: number | null
          return_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          catalogue_item_id: string
          checkout_date?: string
          created_at?: string
          due_date: string
          id?: string
          patron_id: string
          renewed_count?: number | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          catalogue_item_id?: string
          checkout_date?: string
          created_at?: string
          due_date?: string
          id?: string
          patron_id?: string
          renewed_count?: number | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_history: {
        Row: {
          batch_name: string
          completed_at: string | null
          error_message: string | null
          id: string
          records_failed: number
          records_processed: number
          records_succeeded: number
          started_at: string
          status: string
        }
        Insert: {
          batch_name: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_failed?: number
          records_processed?: number
          records_succeeded?: number
          started_at?: string
          status?: string
        }
        Update: {
          batch_name?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_failed?: number
          records_processed?: number
          records_succeeded?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      migration_logs: {
        Row: {
          batch_id: string
          created_at: string
          error_message: string | null
          id: string
          imported_by: string | null
          items_count: number | null
          migration_type: string
          status: string | null
        }
        Insert: {
          batch_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          imported_by?: string | null
          items_count?: number | null
          migration_type: string
          status?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          imported_by?: string | null
          items_count?: number | null
          migration_type?: string
          status?: string | null
        }
        Relationships: []
      }
      newsletter_issues: {
        Row: {
          brevo_campaign_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          issue_number: number
          open_rate: number | null
          recipient_scope: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brevo_campaign_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_number: number
          open_rate?: number | null
          recipient_scope?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brevo_campaign_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_number?: number
          open_rate?: number | null
          recipient_scope?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          status: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      newspaper_articles: {
        Row: {
          author: string | null
          created_at: string
          guid: string
          id: string
          indexed_at: string | null
          indexed_by: string | null
          indexing_status: string
          link: string | null
          published_at: string | null
          serial_id: string
          subjects: Json
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          guid: string
          id?: string
          indexed_at?: string | null
          indexed_by?: string | null
          indexing_status?: string
          link?: string | null
          published_at?: string | null
          serial_id: string
          subjects?: Json
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          guid?: string
          id?: string
          indexed_at?: string | null
          indexed_by?: string | null
          indexing_status?: string
          link?: string | null
          published_at?: string | null
          serial_id?: string
          subjects?: Json
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newspaper_articles_serial_id_fkey"
            columns: ["serial_id"]
            isOneToOne: false
            referencedRelation: "newspaper_serials"
            referencedColumns: ["id"]
          },
        ]
      }
      newspaper_serials: {
        Row: {
          article_count: number
          branch_origin: string | null
          call_number: string | null
          category: string | null
          continent: string | null
          country: string | null
          created_at: string
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean
          issn: string | null
          language: string | null
          last_harvested_at: string | null
          name: string
          rss_url: string | null
          slug: string
          state: string | null
          updated_at: string
          url: string | null
          zone: string | null
        }
        Insert: {
          article_count?: number
          branch_origin?: string | null
          call_number?: string | null
          category?: string | null
          continent?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean
          issn?: string | null
          language?: string | null
          last_harvested_at?: string | null
          name: string
          rss_url?: string | null
          slug: string
          state?: string | null
          updated_at?: string
          url?: string | null
          zone?: string | null
        }
        Update: {
          article_count?: number
          branch_origin?: string | null
          call_number?: string | null
          category?: string | null
          continent?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean
          issn?: string | null
          language?: string | null
          last_harvested_at?: string | null
          name?: string
          rss_url?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
          url?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          patron_id: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          patron_id: string
          title: string
          type?: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          patron_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_saved_items: {
        Row: {
          authors: string | null
          created_at: string
          doi: string | null
          id: string
          patron_id: string
          source: string | null
          title: string
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          authors?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          patron_id: string
          source?: string | null
          title: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          authors?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          patron_id?: string
          source?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patron_saved_items_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      patrons: {
        Row: {
          academic_rank: string | null
          account_role: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_level: string | null
          date_of_birth: string | null
          deletion_requested: boolean
          deletion_requested_at: string | null
          department: string | null
          duration_years: number | null
          email: string
          faculty_code: string | null
          faculty_name: string | null
          full_name: string
          gender: string | null
          highest_qualification: string | null
          id: string
          institution: string | null
          job_title: string | null
          level: string | null
          library_number: string | null
          library_section: string | null
          matric_number: string | null
          membership_expires_at: string | null
          other_names: string | null
          patron_category: string
          patron_id: string
          phone: string | null
          preferred_branch: string | null
          professional_qualification: string | null
          programme: string | null
          rank: string | null
          research_interests: string[] | null
          short_bio: string | null
          staff_id: string | null
          status: string
          student_type: string | null
          surname: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          academic_rank?: string | null
          account_role?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_level?: string | null
          date_of_birth?: string | null
          deletion_requested?: boolean
          deletion_requested_at?: string | null
          department?: string | null
          duration_years?: number | null
          email: string
          faculty_code?: string | null
          faculty_name?: string | null
          full_name: string
          gender?: string | null
          highest_qualification?: string | null
          id?: string
          institution?: string | null
          job_title?: string | null
          level?: string | null
          library_number?: string | null
          library_section?: string | null
          matric_number?: string | null
          membership_expires_at?: string | null
          other_names?: string | null
          patron_category: string
          patron_id: string
          phone?: string | null
          preferred_branch?: string | null
          professional_qualification?: string | null
          programme?: string | null
          rank?: string | null
          research_interests?: string[] | null
          short_bio?: string | null
          staff_id?: string | null
          status?: string
          student_type?: string | null
          surname?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          academic_rank?: string | null
          account_role?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_level?: string | null
          date_of_birth?: string | null
          deletion_requested?: boolean
          deletion_requested_at?: string | null
          department?: string | null
          duration_years?: number | null
          email?: string
          faculty_code?: string | null
          faculty_name?: string | null
          full_name?: string
          gender?: string | null
          highest_qualification?: string | null
          id?: string
          institution?: string | null
          job_title?: string | null
          level?: string | null
          library_number?: string | null
          library_section?: string | null
          matric_number?: string | null
          membership_expires_at?: string | null
          other_names?: string | null
          patron_category?: string
          patron_id?: string
          phone?: string | null
          preferred_branch?: string | null
          professional_qualification?: string | null
          programme?: string | null
          rank?: string | null
          research_interests?: string[] | null
          short_bio?: string | null
          staff_id?: string | null
          status?: string
          student_type?: string | null
          surname?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fine_id: string | null
          id: string
          paid_at: string | null
          patron_id: string
          payment_method: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          fine_id?: string | null
          id?: string
          paid_at?: string | null
          patron_id: string
          payment_method: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          fine_id?: string | null
          id?: string
          paid_at?: string | null
          patron_id?: string
          payment_method?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          code: string
          created_at: string
          degree_type: string
          department_id: string
          duration_years: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          degree_type: string
          department_id: string
          duration_years: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          degree_type?: string
          department_id?: string
          duration_years?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          authors: string | null
          catalogue_item_id: string | null
          format: string
          id: string
          isbn: string | null
          po_id: string
          quantity: number
          received_qty: number
          recommendation_id: string | null
          status: string
          title: string
          unit_price: number
        }
        Insert: {
          authors?: string | null
          catalogue_item_id?: string | null
          format?: string
          id?: string
          isbn?: string | null
          po_id: string
          quantity?: number
          received_qty?: number
          recommendation_id?: string | null
          status?: string
          title: string
          unit_price?: number
        }
        Update: {
          authors?: string | null
          catalogue_item_id?: string | null
          format?: string
          id?: string
          isbn?: string | null
          po_id?: string
          quantity?: number
          received_qty?: number
          recommendation_id?: string | null
          status?: string
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "purchase_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_date: string | null
          faculty_code: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          faculty_code?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          faculty_code?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "acquisition_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_recommendations: {
        Row: {
          authors: string | null
          catalogue_item_id: string | null
          created_at: string
          faculty_code: string | null
          format: string
          id: string
          isbn: string | null
          notes: string | null
          publisher: string | null
          reason: string | null
          requested_by: string | null
          requester_email: string | null
          requester_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          urgency: string
          year: number | null
        }
        Insert: {
          authors?: string | null
          catalogue_item_id?: string | null
          created_at?: string
          faculty_code?: string | null
          format?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          publisher?: string | null
          reason?: string | null
          requested_by?: string | null
          requester_email?: string | null
          requester_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          urgency?: string
          year?: number | null
        }
        Update: {
          authors?: string | null
          catalogue_item_id?: string | null
          created_at?: string
          faculty_code?: string | null
          format?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          publisher?: string | null
          reason?: string | null
          requested_by?: string | null
          requester_email?: string | null
          requester_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          urgency?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_recommendations_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_list_items: {
        Row: {
          catalogue_item_id: string
          created_at: string
          id: string
          item_authors: string | null
          item_title: string | null
          item_type: string | null
          notes: string | null
          reading_list_id: string
          sort_order: number | null
        }
        Insert: {
          catalogue_item_id: string
          created_at?: string
          id?: string
          item_authors?: string | null
          item_title?: string | null
          item_type?: string | null
          notes?: string | null
          reading_list_id: string
          sort_order?: number | null
        }
        Update: {
          catalogue_item_id?: string
          created_at?: string
          id?: string
          item_authors?: string | null
          item_title?: string | null
          item_type?: string | null
          notes?: string | null
          reading_list_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_list_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_list_items_reading_list_id_fkey"
            columns: ["reading_list_id"]
            isOneToOne: false
            referencedRelation: "reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          patron_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          patron_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          patron_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_lists_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          data: Json
          id: string
          recorded_at: string
          recorded_by: string | null
          section: string
        }
        Insert: {
          data?: Json
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          section: string
        }
        Update: {
          data?: Json
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          section?: string
        }
        Relationships: []
      }
      repository_collections: {
        Row: {
          community_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_collections_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "repository_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_communities: {
        Row: {
          created_at: string
          description: string | null
          faculty_code: string | null
          id: string
          logo_url: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          faculty_code?: string | null
          id?: string
          logo_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          faculty_code?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_communities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "repository_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_items: {
        Row: {
          abstract: string | null
          ai_content_score: number | null
          authors: Json
          collection_id: string | null
          community_id: string | null
          copyleaks_scan_id: string | null
          created_at: string
          department: string | null
          doi: string | null
          download_count: number | null
          embargo_until: string | null
          faculty_code: string | null
          file_size: number | null
          file_url: string | null
          id: string
          item_type: string | null
          keywords: Json | null
          language: string | null
          matched_sources: Json | null
          orcid_ids: Json | null
          plagiarism_scanned_at: string | null
          rejection_reason: string | null
          similarity_score: number | null
          status: string
          subjects: Json | null
          submitter_id: string | null
          supervisor: string | null
          title: string
          type: string
          updated_at: string
          view_count: number | null
          visibility: string
          year: number | null
          zenodo_id: string | null
        }
        Insert: {
          abstract?: string | null
          ai_content_score?: number | null
          authors?: Json
          collection_id?: string | null
          community_id?: string | null
          copyleaks_scan_id?: string | null
          created_at?: string
          department?: string | null
          doi?: string | null
          download_count?: number | null
          embargo_until?: string | null
          faculty_code?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          item_type?: string | null
          keywords?: Json | null
          language?: string | null
          matched_sources?: Json | null
          orcid_ids?: Json | null
          plagiarism_scanned_at?: string | null
          rejection_reason?: string | null
          similarity_score?: number | null
          status?: string
          subjects?: Json | null
          submitter_id?: string | null
          supervisor?: string | null
          title: string
          type?: string
          updated_at?: string
          view_count?: number | null
          visibility?: string
          year?: number | null
          zenodo_id?: string | null
        }
        Update: {
          abstract?: string | null
          ai_content_score?: number | null
          authors?: Json
          collection_id?: string | null
          community_id?: string | null
          copyleaks_scan_id?: string | null
          created_at?: string
          department?: string | null
          doi?: string | null
          download_count?: number | null
          embargo_until?: string | null
          faculty_code?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          item_type?: string | null
          keywords?: Json | null
          language?: string | null
          matched_sources?: Json | null
          orcid_ids?: Json | null
          plagiarism_scanned_at?: string | null
          rejection_reason?: string | null
          similarity_score?: number | null
          status?: string
          subjects?: Json | null
          submitter_id?: string | null
          supervisor?: string | null
          title?: string
          type?: string
          updated_at?: string
          view_count?: number | null
          visibility?: string
          year?: number | null
          zenodo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repository_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "repository_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repository_items_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "repository_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_grants: {
        Row: {
          amount: string | null
          created_at: string | null
          funding_body: string | null
          id: string
          researcher_id: string | null
          role: string | null
          title: string | null
          year: number | null
        }
        Insert: {
          amount?: string | null
          created_at?: string | null
          funding_body?: string | null
          id?: string
          researcher_id?: string | null
          role?: string | null
          title?: string | null
          year?: number | null
        }
        Update: {
          amount?: string | null
          created_at?: string | null
          funding_body?: string | null
          id?: string
          researcher_id?: string | null
          role?: string | null
          title?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "researcher_grants_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researcher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_profiles: {
        Row: {
          academia_url: string | null
          academic_rank: string | null
          biography: string | null
          created_at: string | null
          department: string | null
          employment_status: string | null
          first_name: string
          google_scholar_id: string | null
          h_index: number | null
          highest_qualification: Json | null
          i10_index: number | null
          id: string
          institution: string | null
          institutional_email: string | null
          last_updated_at: string | null
          middle_name: string | null
          office_location: string | null
          orcid_id: string | null
          orcid_verified: boolean | null
          other_qualifications: Json[] | null
          patron_id: string | null
          phone: string | null
          professional_memberships: string[] | null
          profile_photo_url: string | null
          programmes_taught: string[] | null
          research_keywords: string[] | null
          researchgate_url: string | null
          return_notes: string | null
          salutation: string | null
          scopus_id: string | null
          slug: string | null
          specialisations: string[] | null
          status: string | null
          supervision_med_completed: number | null
          supervision_med_current: number | null
          supervision_phd_completed: number | null
          supervision_phd_current: number | null
          surname: string
          total_citations: number | null
          visibility: string | null
        }
        Insert: {
          academia_url?: string | null
          academic_rank?: string | null
          biography?: string | null
          created_at?: string | null
          department?: string | null
          employment_status?: string | null
          first_name: string
          google_scholar_id?: string | null
          h_index?: number | null
          highest_qualification?: Json | null
          i10_index?: number | null
          id?: string
          institution?: string | null
          institutional_email?: string | null
          last_updated_at?: string | null
          middle_name?: string | null
          office_location?: string | null
          orcid_id?: string | null
          orcid_verified?: boolean | null
          other_qualifications?: Json[] | null
          patron_id?: string | null
          phone?: string | null
          professional_memberships?: string[] | null
          profile_photo_url?: string | null
          programmes_taught?: string[] | null
          research_keywords?: string[] | null
          researchgate_url?: string | null
          return_notes?: string | null
          salutation?: string | null
          scopus_id?: string | null
          slug?: string | null
          specialisations?: string[] | null
          status?: string | null
          supervision_med_completed?: number | null
          supervision_med_current?: number | null
          supervision_phd_completed?: number | null
          supervision_phd_current?: number | null
          surname: string
          total_citations?: number | null
          visibility?: string | null
        }
        Update: {
          academia_url?: string | null
          academic_rank?: string | null
          biography?: string | null
          created_at?: string | null
          department?: string | null
          employment_status?: string | null
          first_name?: string
          google_scholar_id?: string | null
          h_index?: number | null
          highest_qualification?: Json | null
          i10_index?: number | null
          id?: string
          institution?: string | null
          institutional_email?: string | null
          last_updated_at?: string | null
          middle_name?: string | null
          office_location?: string | null
          orcid_id?: string | null
          orcid_verified?: boolean | null
          other_qualifications?: Json[] | null
          patron_id?: string | null
          phone?: string | null
          professional_memberships?: string[] | null
          profile_photo_url?: string | null
          programmes_taught?: string[] | null
          research_keywords?: string[] | null
          researchgate_url?: string | null
          return_notes?: string | null
          salutation?: string | null
          scopus_id?: string | null
          slug?: string | null
          specialisations?: string[] | null
          status?: string | null
          supervision_med_completed?: number | null
          supervision_med_current?: number | null
          supervision_phd_completed?: number | null
          supervision_phd_current?: number | null
          surname?: string
          total_citations?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "researcher_profiles_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_publications: {
        Row: {
          authors: string
          citations: number | null
          created_at: string
          doi: string | null
          id: string
          issue: string | null
          journal: string | null
          pages: string | null
          publication_type: string | null
          researcher_id: string
          title: string
          url: string | null
          volume: string | null
          year: number | null
        }
        Insert: {
          authors: string
          citations?: number | null
          created_at?: string
          doi?: string | null
          id?: string
          issue?: string | null
          journal?: string | null
          pages?: string | null
          publication_type?: string | null
          researcher_id: string
          title: string
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Update: {
          authors?: string
          citations?: number | null
          created_at?: string
          doi?: string | null
          id?: string
          issue?: string | null
          journal?: string | null
          pages?: string | null
          publication_type?: string | null
          researcher_id?: string
          title?: string
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "researcher_publications_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      researchers: {
        Row: {
          bio: string | null
          created_at: string
          department: string | null
          faculty_code: string | null
          full_name: string
          google_scholar_url: string | null
          h_index: number | null
          id: string
          is_public: boolean | null
          orcid_id: string | null
          patron_id: string | null
          profile_image: string | null
          research_interests: Json | null
          researchgate_url: string | null
          title: string | null
          total_citations: number | null
          total_publications: number | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          department?: string | null
          faculty_code?: string | null
          full_name: string
          google_scholar_url?: string | null
          h_index?: number | null
          id?: string
          is_public?: boolean | null
          orcid_id?: string | null
          patron_id?: string | null
          profile_image?: string | null
          research_interests?: Json | null
          researchgate_url?: string | null
          title?: string | null
          total_citations?: number | null
          total_publications?: number | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          department?: string | null
          faculty_code?: string | null
          full_name?: string
          google_scholar_url?: string | null
          h_index?: number | null
          id?: string
          is_public?: boolean | null
          orcid_id?: string | null
          patron_id?: string | null
          profile_image?: string | null
          research_interests?: Json | null
          researchgate_url?: string | null
          title?: string | null
          total_citations?: number | null
          total_publications?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "researchers_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: true
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          catalogue_item_id: string
          created_at: string
          expiry_date: string
          id: string
          notify_sent: boolean | null
          patron_id: string
          priority: number | null
          reservation_date: string
          status: string
          updated_at: string
        }
        Insert: {
          catalogue_item_id: string
          created_at?: string
          expiry_date: string
          id?: string
          notify_sent?: boolean | null
          patron_id: string
          priority?: number | null
          reservation_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          catalogue_item_id?: string
          created_at?: string
          expiry_date?: string
          id?: string
          notify_sent?: boolean | null
          patron_id?: string
          priority?: number | null
          reservation_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      reserve_clicks: {
        Row: {
          created_at: string
          id: string
          item_id: string
          patron_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          patron_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          patron_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserve_clicks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "course_reading_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_clicks_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_requests: {
        Row: {
          collect_by_date: string | null
          collection_location: string | null
          course: string | null
          created_at: string
          id: string
          item_title: string | null
          librarian_note: string | null
          needed_by_date: string | null
          patron_department: string | null
          patron_email: string | null
          patron_faculty: string | null
          patron_id: string
          patron_name: string | null
          preferred_format: string
          reason: string
          reference_no: string
          request_text: string
          status: string
          updated_at: string
        }
        Insert: {
          collect_by_date?: string | null
          collection_location?: string | null
          course?: string | null
          created_at?: string
          id?: string
          item_title?: string | null
          librarian_note?: string | null
          needed_by_date?: string | null
          patron_department?: string | null
          patron_email?: string | null
          patron_faculty?: string | null
          patron_id: string
          patron_name?: string | null
          preferred_format?: string
          reason: string
          reference_no?: string
          request_text: string
          status?: string
          updated_at?: string
        }
        Update: {
          collect_by_date?: string | null
          collection_location?: string | null
          course?: string | null
          created_at?: string
          id?: string
          item_title?: string | null
          librarian_note?: string | null
          needed_by_date?: string | null
          patron_department?: string | null
          patron_email?: string | null
          patron_faculty?: string | null
          patron_id?: string
          patron_name?: string | null
          preferred_format?: string
          reason?: string
          reference_no?: string
          request_text?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_requests_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          item_id: string
          item_type: string
          patron_name: string | null
          rating: number
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          patron_name?: string | null
          rating: number
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          patron_name?: string | null
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      serials_issues: {
        Row: {
          actual_arrival_date: string | null
          claim_sent_at: string | null
          created_at: string
          id: string
          issue_number: string
          notes: string | null
          predicted_date: string | null
          status: string
          subscription_id: string
          volume: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          claim_sent_at?: string | null
          created_at?: string
          id?: string
          issue_number: string
          notes?: string | null
          predicted_date?: string | null
          status?: string
          subscription_id: string
          volume?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          claim_sent_at?: string | null
          created_at?: string
          id?: string
          issue_number?: string
          notes?: string | null
          predicted_date?: string | null
          status?: string
          subscription_id?: string
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serials_issues_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "serials_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      serials_routing: {
        Row: {
          created_at: string
          id: string
          issue_id: string | null
          patron_email: string | null
          patron_name: string
          returned_at: string | null
          routed_at: string | null
          sequence_order: number
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id?: string | null
          patron_email?: string | null
          patron_name: string
          returned_at?: string | null
          routed_at?: string | null
          sequence_order?: number
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string | null
          patron_email?: string | null
          patron_name?: string
          returned_at?: string | null
          routed_at?: string | null
          sequence_order?: number
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serials_routing_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "serials_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serials_routing_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "serials_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      serials_subscriptions: {
        Row: {
          call_number: string | null
          cost_per_year: number
          created_at: string
          currency: string
          faculty_code: string | null
          frequency: string
          id: string
          issn: string | null
          issn_online: string | null
          location: string | null
          notes: string | null
          publisher: string | null
          renewal_date: string | null
          start_date: string | null
          status: string
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          call_number?: string | null
          cost_per_year?: number
          created_at?: string
          currency?: string
          faculty_code?: string | null
          frequency?: string
          id?: string
          issn?: string | null
          issn_online?: string | null
          location?: string | null
          notes?: string | null
          publisher?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          call_number?: string | null
          cost_per_year?: number
          created_at?: string
          currency?: string
          faculty_code?: string | null
          frequency?: string
          id?: string
          issn?: string | null
          issn_online?: string | null
          location?: string | null
          notes?: string | null
          publisher?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serials_subscriptions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "acquisition_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          author: string | null
          created_at: string
          id: string
          isbn: string | null
          notes: string | null
          patron_id: string | null
          reason: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          patron_id?: string | null
          reason?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          patron_id?: string | null
          reason?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_date: string | null
          payment_status: string
          po_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          po_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          po_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio: string
          created_at: string
          email: string
          id: string
          initials: string
          is_published: boolean
          name: string
          photo_url: string | null
          qual: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          bio?: string
          created_at?: string
          email?: string
          id?: string
          initials?: string
          is_published?: boolean
          name: string
          photo_url?: string | null
          qual?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          email?: string
          id?: string
          initials?: string
          is_published?: boolean
          name?: string
          photo_url?: string | null
          qual?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      theses: {
        Row: {
          abstract: string | null
          ai_content_score: number | null
          approval_date: string | null
          co_supervisors: Json | null
          copyleaks_scan_id: string | null
          created_at: string
          declaration_ip: string | null
          declaration_timestamp: string | null
          degree: string
          department: string
          doi: string | null
          file_size: number | null
          file_url: string | null
          id: string
          keywords: Json | null
          language: string | null
          matched_sources: Json | null
          pages: number | null
          patron_id: string
          plagiariism_score: number | null
          plagiarism_scanned_at: string | null
          programme: string | null
          reference_no: string | null
          repository_item_id: string | null
          revision_notes: string | null
          session: string | null
          similarity_score: number | null
          status: string
          submission_date: string | null
          submission_type: string
          submitter_id: string | null
          supervisor: string
          title: string
          updated_at: string
          visibility: string
          year: number
          zenodo_id: string | null
        }
        Insert: {
          abstract?: string | null
          ai_content_score?: number | null
          approval_date?: string | null
          co_supervisors?: Json | null
          copyleaks_scan_id?: string | null
          created_at?: string
          declaration_ip?: string | null
          declaration_timestamp?: string | null
          degree: string
          department: string
          doi?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          keywords?: Json | null
          language?: string | null
          matched_sources?: Json | null
          pages?: number | null
          patron_id: string
          plagiariism_score?: number | null
          plagiarism_scanned_at?: string | null
          programme?: string | null
          reference_no?: string | null
          repository_item_id?: string | null
          revision_notes?: string | null
          session?: string | null
          similarity_score?: number | null
          status?: string
          submission_date?: string | null
          submission_type?: string
          submitter_id?: string | null
          supervisor: string
          title: string
          updated_at?: string
          visibility?: string
          year: number
          zenodo_id?: string | null
        }
        Update: {
          abstract?: string | null
          ai_content_score?: number | null
          approval_date?: string | null
          co_supervisors?: Json | null
          copyleaks_scan_id?: string | null
          created_at?: string
          declaration_ip?: string | null
          declaration_timestamp?: string | null
          degree?: string
          department?: string
          doi?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          keywords?: Json | null
          language?: string | null
          matched_sources?: Json | null
          pages?: number | null
          patron_id?: string
          plagiariism_score?: number | null
          plagiarism_scanned_at?: string | null
          programme?: string | null
          reference_no?: string | null
          repository_item_id?: string | null
          revision_notes?: string | null
          session?: string | null
          similarity_score?: number | null
          status?: string
          submission_date?: string | null
          submission_type?: string
          submitter_id?: string | null
          supervisor?: string
          title?: string
          updated_at?: string
          visibility?: string
          year?: number
          zenodo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theses_patron_id_fkey"
            columns: ["patron_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
        ]
      }
      thesis_reviews: {
        Row: {
          comments: string | null
          created_at: string
          grade: string | null
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_name: string
          status: string
          thesis_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_name: string
          status?: string
          thesis_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_name?: string
          status?: string
          thesis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thesis_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "patrons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thesis_reviews_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "theses"
            referencedColumns: ["id"]
          },
        ]
      }
      thesis_supervisors: {
        Row: {
          created_at: string
          id: string
          role: string
          supervisor_email: string
          supervisor_name: string
          supervisor_orcid: string | null
          thesis_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          supervisor_email: string
          supervisor_name: string
          supervisor_orcid?: string | null
          thesis_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          supervisor_email?: string
          supervisor_name?: string
          supervisor_orcid?: string | null
          thesis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thesis_supervisors_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "theses"
            referencedColumns: ["id"]
          },
        ]
      }
      thesis_workflow: {
        Row: {
          acted_by: string | null
          action: string
          created_at: string
          id: string
          notes: string | null
          stage: string
          thesis_id: string
        }
        Insert: {
          acted_by?: string | null
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          stage: string
          thesis_id: string
        }
        Update: {
          acted_by?: string | null
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          stage?: string
          thesis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thesis_workflow_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "theses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_code: string | null
          created_at: string
          faculty_code: string | null
          id: string
          librarian_section:
            | Database["public"]["Enums"]["librarian_section"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_code?: string | null
          created_at?: string
          faculty_code?: string | null
          id?: string
          librarian_section?:
            | Database["public"]["Enums"]["librarian_section"]
            | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_code?: string | null
          created_at?: string
          faculty_code?: string | null
          id?: string
          librarian_section?:
            | Database["public"]["Enums"]["librarian_section"]
            | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          ip_address: unknown
          is_current: boolean | null
          last_active: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active?: string
          user_id?: string
        }
        Relationships: []
      }
      webometrics_actions: {
        Row: {
          action_id: number
          status: string
        }
        Insert: {
          action_id: number
          status?: string
        }
        Update: {
          action_id?: number
          status?: string
        }
        Relationships: []
      }
      webometrics_ranks: {
        Row: {
          initiative_key: string
          rank_text: string | null
          rank_year: number | null
          updated_at: string | null
        }
        Insert: {
          initiative_key: string
          rank_text?: string | null
          rank_year?: number | null
          updated_at?: string | null
        }
        Update: {
          initiative_key?: string
          rank_text?: string | null
          rank_year?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webometrics_stats: {
        Row: {
          created_at: string
          id: string
          metric_type: string
          metric_value: number
          rank_country: number | null
          rank_global: number | null
          recorded_date: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metric_type: string
          metric_value: number
          rank_country?: number | null
          rank_global?: number | null
          recorded_date: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metric_type?: string
          metric_value?: number
          rank_country?: number | null
          rank_global?: number | null
          recorded_date?: string
          source?: string | null
        }
        Relationships: []
      }
      z3950_imports: {
        Row: {
          id: string
          imported_at: string
          imported_by: string | null
          isbn: string | null
          marc21_data: Json | null
          query: string
          source: string
        }
        Insert: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          isbn?: string | null
          marc21_data?: Json | null
          query: string
          source: string
        }
        Update: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          isbn?: string | null
          marc21_data?: Json | null
          query?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_super_admin: { Args: { _email: string }; Returns: string }
      claim_base_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      gen_request_ref: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_student_levels: { Args: never; Returns: number }
      is_library_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      librarian_covers_branch: {
        Args: { _branch: string; _user_id: string }
        Returns: boolean
      }
      list_consortium_members_public: {
        Args: never
        Returns: {
          email_domain: string
          id: string
          institution_name: string
          short_code: string
          status: string
        }[]
      }
      list_team_members_public: {
        Args: never
        Returns: {
          bio: string
          email: string
          id: string
          initials: string
          name: string
          photo_url: string
          qual: string
          sort_order: number
          title: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "librarian"
        | "faculty_librarian"
        | "student"
        | "researcher_lecturer"
        | "admin_staff"
        | "guest"
      librarian_section:
        | "Acquisitions"
        | "Cataloguing"
        | "Circulation"
        | "Reference"
        | "Serials"
        | "Digital Services"
        | "Administration"
        | "Special Collections"
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
    Enums: {
      app_role: [
        "super_admin",
        "librarian",
        "faculty_librarian",
        "student",
        "researcher_lecturer",
        "admin_staff",
        "guest",
      ],
      librarian_section: [
        "Acquisitions",
        "Cataloguing",
        "Circulation",
        "Reference",
        "Serials",
        "Digital Services",
        "Administration",
        "Special Collections",
      ],
    },
  },
} as const
