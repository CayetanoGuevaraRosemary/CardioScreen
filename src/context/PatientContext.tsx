import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Paciente } from '../lib/patients'
import type { Tamizaje } from '../lib/tamizajes'
import type { Medico } from '../lib/auth'

interface PatientCtx {
  medico: Medico | null
  setMedico: (m: Medico | null) => void
  paciente: Paciente | null
  setPaciente: (p: Paciente | null) => void
  tamizajeActual: Tamizaje | null
  setTamizajeActual: (t: Tamizaje | null) => void
}

const Ctx = createContext<PatientCtx | null>(null)

export function PatientProvider({ children, medico: initialMedico }: { children: ReactNode; medico: Medico | null }) {
  const [medico, setMedico] = useState<Medico | null>(initialMedico)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [tamizajeActual, setTamizajeActual] = useState<Tamizaje | null>(null)

  return (
    <Ctx.Provider value={{ medico, setMedico, paciente, setPaciente, tamizajeActual, setTamizajeActual }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePatient() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePatient debe usarse dentro de PatientProvider')
  return ctx
}
