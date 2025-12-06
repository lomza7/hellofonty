import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  role: 'student' | 'landlord';
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  verification_document_url?: string;
  verification_status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  verification_rejection_reason?: string | null;
  preferred_language: 'fr' | 'en';
  stripe_account_id?: string;
  stripe_onboarding_status?: 'not_connected' | 'pending' | 'complete';
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  stripe_details_submitted?: boolean;
  stripe_onboarding_updated_at?: string;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  landlord_id: string;
  title: string;
  description: string;
  property_type: 'apartment' | 'house' | 'room' | 'studio';
  address: string;
  city: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  price_per_month: number;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  landlord?: Profile;
  images?: ListingImage[];
  floor?: number;
  total_floors?: number;
  has_elevator?: boolean;
  building_year?: number;
  apartment_area?: number;
  furnished?: 'furnished' | 'unfurnished' | 'semi-furnished';
  accessibility?: string[];
  bonus_features?: string[];
  base_rent?: number;
  electricity_cost?: number;
  heating_cost?: number;
  water_cost?: number;
  custom_charges?: Array<{ name: string; amount: string }>;
  security_deposit?: number;
  video_url?: string;
  check_in_start?: string;
  check_in_end?: string;
  check_out_time?: string;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  parties_allowed?: boolean;
  children_allowed?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  additional_rules?: string;
  minimum_stay?: number;
  charges?: number;
};

export type ListingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
};

export type Favorite = {
  id: string;
  student_id: string;
  listing_id: string;
  created_at: string;
  listing?: Listing;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  listing_id?: string;
  booking_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  recipient?: Profile;
  booking?: Booking;
};

export type Booking = {
  id: string;
  listing_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  listing?: Listing;
  student?: Profile;
};

export type BlockedMessage = {
  id: string;
  user_id: string;
  recipient_id: string;
  blocked_content: string;
  detection_type: 'phone' | 'email' | 'url' | 'address' | 'social_media';
  detected_patterns: string[];
  created_at: string;
  conversation_context?: string;
  booking_id?: string;
  user?: Profile;
  recipient?: Profile;
};
