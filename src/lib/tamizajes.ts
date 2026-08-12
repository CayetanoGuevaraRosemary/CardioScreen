import { supabase, supabaseEnabled } from './supabase'

export interface Tamizaje {
  id?: string
  paciente_dni: string
  medico_codigo: string | null
  spo2_pre: number
  spo2_post: number
  altitud: number
  resultado: 'negativo' | 'repetir' | 'positivo'
  sintomas: string[]
  creado_en?: string
  sync_status?: 'pending' | 'synced' | 'failed'
}

export async function guardarTamizaje(t: Tamizaje): Promise<{ ok: boolean; offline: boolean }> {
  if (!supabaseEnabled || !supabase || !navigator.onLine) return { ok: false, offline: true }
  const { error } = await supabase.from('tamizajes').insert({ ...t, sync_status: 'synced' })
  return { ok: !error, offline: false }
}

export async function obtenerHistorial(dni?: string, limit = 20): Promise<Tamizaje[]> {
  if (!supabaseEnabled || !supabase) return []
  let query = supabase.from('tamizajes').select('*').order('creado_en', { ascending: false }).limit(limit)
  if (dni) query = query.eq('paciente_dni', dni)
  const { data, error } = await query
  return error || !data ? [] : (data as Tamizaje[])
}
