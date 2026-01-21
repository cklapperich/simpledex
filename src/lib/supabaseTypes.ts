export interface Collection {
  id: string
  user_id: string
  card_id: string
  variation: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      collections: {
        Row: Collection
        Insert: Omit<Collection, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Collection, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
