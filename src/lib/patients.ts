import { supabase, supabaseEnabled } from './supabase'

export interface Paciente {
  dni: string 
  nombre: string
  fecha_nacimiento: string
  edad_gestacional: string
  establecimiento: string
  altitud: number
  historial?: string | null
}

export async function buscarPacientePorDni(dni: string): Promise<Paciente | null> {
  if (!supabaseEnabled || !supabase) return null
  const { data, error } = await supabase.from('pacientes').select('*').eq('dni', dni.trim()).maybeSingle()
  if (error || !data) return null
  return data as Paciente
}

export async function guardarPaciente(paciente: Paciente): Promise<{ ok: boolean; offline: boolean }> {
  if (!supabaseEnabled || !supabase) return { ok: false, offline: true }
  if (!navigator.onLine) return { ok: false, offline: true }
  const { error } = await supabase.from('pacientes').upsert(paciente, { onConflict: 'dni' })
  return { ok: !error, offline: false }
}
