// lib/supabase.ts — Supabase client and TypeScript types

import { createClient } from '@supabase/supabase-js'
import { ActivityType } from './co2'

export type Activity = {
  id: string
  type: ActivityType
  quantity: number
  co2_kg: number
  date: string // ISO date string YYYY-MM-DD
  created_at: string
}

export type Settings = {
  id: number
  weekly_target_kg: number | null
}

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: Activity
        Insert: Omit<Activity, 'id' | 'created_at'>
        Update: Partial<Omit<Activity, 'id' | 'created_at'>>
      }
      settings: {
        Row: Settings
        Insert: Settings
        Update: Partial<Settings>
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
