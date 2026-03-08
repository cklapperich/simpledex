export interface Collection {
  id: string
  user_id: string
  card_id: string
  variation: string
  language: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface WishlistRow {
  id: string
  user_id: string
  card_id: string
  variation: string
  language: string
  created_at: string
  updated_at: string
}

export interface UserShareCode {
  user_id: string
  share_code: string
  created_at: string
}

export interface DeckRow {
  id: string
  user_id: string
  name: string
  cards: Record<string, number>
  strategy?: string
  created_at: string
  updated_at: string
  TCG: string
}

export interface CardRow {
  id: string
  set_name: string
  number: string
  set_number: string | null
  release_date: string
  series: string
  supertype: string
  rarity: string
  hp: number | null
  ptcgo_code: string | null
  evolve_from: string | null
  flavor_text: string | null
  regulation_mark: string | null
  illustrator: string | null
  subtypes: string[]
  types: string[]
  retreat_cost: string[]
  rules: string[]
  names: Json
  attacks: Json
  abilities: Json
  weaknesses: Json
  resistances: Json
  images: Json
  legalities: Json
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      collections: {
        Row: {
          id: string
          user_id: string
          card_id: string
          variation: string
          language: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          variation?: string
          language?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          variation?: string
          language?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          card_id: string
          variation: string
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          variation?: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          variation?: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_share_codes: {
        Row: {
          user_id: string
          share_code: string
          created_at: string
        }
        Insert: {
          user_id: string
          share_code: string
          created_at?: string
        }
        Update: {
          user_id?: string
          share_code?: string
          created_at?: string
        }
        Relationships: []
      }
      decks: {
        Row: {
          id: string
          user_id: string
          name: string
          cards: Record<string, number>
          strategy?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          name?: string
          cards?: Record<string, number>
          strategy?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          cards?: Record<string, number>
          strategy?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cards: {
        Row: CardRow
        Insert: Omit<CardRow, never>
        Update: Partial<CardRow>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
