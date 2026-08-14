import { useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { buscarPacientePorDni, guardarPaciente, type Paciente } from '../lib/patients'

export default function PatientPicker() {
  const { paciente, setPaciente } = usePatient()
  const [dni, setDni] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [nuevo, setNuevo] = useState(false)

  const handleBuscar = async () => {
    if (dni.trim().length < 8) return
    setBuscando(true)
    const encontrado = await buscarPacientePorDni(dni)
    setBuscando(false)
    if (encontrado) {
      setPaciente(encontrado)
      setNuevo(false)
    } else {
      const nuevoPaciente: Paciente = {
        dni: dni.trim(), nombre: '', fecha_nacimiento: '', edad_gestacional: '', establecimiento: '', altitud: 0,
      }
      setPaciente(nuevoPaciente)
      guardarPaciente(nuevoPaciente)
      setNuevo(true)
    }
  }

  if (paciente) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#e8f1fb', borderRadius: 12, border: '1px solid #c8ddf5' }}>
        <span style={{ fontSize: 16 }}>👶</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {paciente.nombre || 'Paciente nuevo'} · DNI {paciente.dni}
          </div>
          <div style={{ fontSize: 11, color: '#155d8f', fontFamily: 'Outfit, sans-serif' }}>
            {nuevo ? 'Registro nuevo — completa sus datos en Paquete' : 'Paciente activo en todas las pestañas'}
          </div>
        </div>
        <button
          onClick={() => { setPaciente(null); setDni(''); setNuevo(false) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #c8ddf5', background: '#fff', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px', background: '#fff7ed', borderRadius: 12, border: '1px solid #fed7aa' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>
        ⚠ Identifica al paciente antes de continuar
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={dni}
          onChange={e => setDni(e.target.value)}
          placeholder="CNV / DNI del recién nacido"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '2px solid #fed7aa', fontFamily: 'Outfit, sans-serif', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={handleBuscar}
          disabled={buscando}
          style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: '#ca8a04', color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          {buscando ? '...' : 'Buscar'}
        </button>
      </div>
    </div>
  )
}
