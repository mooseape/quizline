import { getSupabase } from './supabase'

type ResultRow = {
  code: string
  category_id: string
  you_name: string
  you_score: number
  them_name: string
  them_score: number
}

export async function saveDuelResult(row: ResultRow) {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.from('duel_results').insert(row)
  if (error) console.warn('Could not save match', error.message)
}
