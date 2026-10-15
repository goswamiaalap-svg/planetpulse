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

export type Routine = {
  id: string
  title: string
  type: ActivityType
  quantity: number
  days_of_week: number[] // 1=Mon, ..., 7=Sun
  is_active: boolean
  created_at: string
}

export type HabitGoal = {
  id: string
  title: string
  category: ActivityType
  target_action: string
  weekly_goal_count: number
  completed_count: number
  archived: boolean
  created_at: string
}

export type RecommendationFeedback = {
  id: string
  recommendation: string
  action: 'accepted' | 'dismissed' | 'completed'
  context_category: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: Activity
        Insert: Omit<Activity, 'id' | 'created_at'>
        Update: Partial<Omit<Activity, 'id' | 'created_at'>>
        Relationships: []
      }
      settings: {
        Row: Settings
        Insert: Settings
        Update: Partial<Settings>
        Relationships: []
      }
      routines: {
        Row: Routine
        Insert: Omit<Routine, 'id' | 'created_at'>
        Update: Partial<Omit<Routine, 'id' | 'created_at'>>
        Relationships: []
      }
      habits: {
        Row: HabitGoal
        Insert: Omit<HabitGoal, 'id' | 'created_at'>
        Update: Partial<Omit<HabitGoal, 'id' | 'created_at'>>
        Relationships: []
      }
      recommendation_feedback: {
        Row: RecommendationFeedback
        Insert: Omit<RecommendationFeedback, 'id' | 'created_at'>
        Update: Partial<Omit<RecommendationFeedback, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
