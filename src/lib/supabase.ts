// Re-export the Lovable Cloud Supabase client so existing app imports
// (`@/lib/supabase`) keep working while using the managed client.
// Cast to an untyped client: the imported app was written against an
// untyped supabase client and queries many tables by name, so we expose
// it loosely to preserve behavior without per-table generics.
import { supabase as typedClient } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase = typedClient as unknown as SupabaseClient;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Patron {
  id: string;
  user_id: string;
  patron_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  patron_category: string;
  faculty_code: string | null;
  faculty_name: string | null;
  department: string | null;
  level: string | null;
  programme: string | null;
  matric_number: string | null;
  staff_id: string | null;
  rank: string | null;
  status: 'active' | 'suspended' | 'expired';
  membership_expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogueItem {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  edition: string | null;
  subjects: string[];
  call_number: string | null;
  format: string;
  language: string;
  abstract: string | null;
  cover_image: string | null;
  faculty_code: string | null;
  total_copies: number;
  available_copies: number;
  marc21: Json | null;
  created_at: string;
  updated_at: string;
}

export interface RepositoryItem {
  id: string;
  title: string;
  authors: Json[];
  abstract: string | null;
  type: string;
  subjects: string[];
  keywords: string[];
  year: number | null;
  language: string;
  faculty_code: string | null;
  community_id: string | null;
  collection_id: string | null;
  orcid_ids: string[];
  doi: string | null;
  file_url: string | null;
  file_size: number | null;
  embargo_until: string | null;
  visibility: 'global' | 'faculty' | 'private';
  status: 'submitted' | 'review' | 'approved' | 'published' | 'rejected';
  view_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
}
