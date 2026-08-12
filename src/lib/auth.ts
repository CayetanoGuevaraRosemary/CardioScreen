import { supabase, supabaseEnabled } from './supabase'

export interface Medico {
  codigo: string
  nombre: string
  establecimiento: string
}

const SESSION_KEY = 'cardioscreen.medico'

export function getSession(): Medico | null {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as Medico) : null
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function loginMedico(codigo: string, contrasena: string): Promise<{ medico: Medico | null; error: string | null }> {
  const c = codigo.trim()

  if (!supabaseEnabled || !supabase || !navigator.onLine) {
    const cached = getSession()
    if (cached && cached.codigo === c) return { medico: cached, error: null }
    return { medico: null, error: 'Sin conexión y no hay sesión previa para este código. Conéctate una vez para validar tus credenciales.' }
  }

  const { data, error } = await supabase!
    .from('medicos')
    .select('codigo, nombre, establecimiento, contrasena')
    .eq('codigo', c)
    .maybeSingle()

  console.log("Respuesta exacta de Supabase:", { data, error, contrasenaIngresada: contrasena });

  if (error) {
    console.error("Supabase arrojó un error:", error);
    return { medico: null, error: `Error en BD: ${error.message}` }
  }
  
  if (!data) {
    return { medico: null, error: `No se encontró el código ${c} en la base de datos.` }
  }

  if (data.contrasena !== contrasena) {
    return { medico: null, error: 'El código existe, pero la contraseña no coincide.' }
  }

  const medico: Medico = { codigo: data.codigo, nombre: data.nombre, establecimiento: data.establecimiento }
  localStorage.setItem(SESSION_KEY, JSON.stringify(medico))
  return { medico, error: null }
}