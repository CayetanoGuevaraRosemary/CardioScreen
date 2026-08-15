import { useState, useEffect, useRef, useCallback } from 'react'
import TutorialScreen from './components/TutorialScreen'
import Login from './components/Login'
import PatientPicker from './components/PatientPicker'
import ProfileModal from './components/ProfileModal'
import WifiModal from './components/WifiModal'
import { getSession, clearSession, type Medico } from './lib/auth'
import { obtenerAltitud } from './lib/geolocation'
import { guardarTamizaje, obtenerHistorial, type Tamizaje } from './lib/tamizajes'
import { getInstrucciones } from './lib/risk'
import { jsPDF } from 'jspdf'
import type { Paciente } from './lib/patients'
import { PatientProvider, usePatient } from './context/PatientContext'

type Screen = 'tutorial' | 'medicion' | 'paquete' | 'derivacion' | 'alertas'
type NetworkStatus = 'online' | 'offline' | 'syncing'
type ResultClass = 'negativo' | 'repetir' | 'positivo' | null

interface Screening {
  id: string
  paciente: string
  fecha: string
  spo2Pre: number
  spo2Post: number
  altitud: number
  resultado: ResultClass
  syncStatus: 'synced' | 'pending' | 'failed'
}

function calcularEdadDetallada(fechaNacimiento?: string | null): { anios: number; meses: number; dias: number } | null {
  if (!fechaNacimiento) return null
  const nac = new Date(fechaNacimiento)
  if (isNaN(nac.getTime())) return null
  const hoy = new Date()
  let anios = hoy.getFullYear() - nac.getFullYear()
  let meses = hoy.getMonth() - nac.getMonth()
  let dias = hoy.getDate() - nac.getDate()
  if (dias < 0) { meses--; dias += new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate() }
  if (meses < 0) { anios--; meses += 12 }
  return { anios, meses, dias }
}

function calcularEdadDias(fechaNacimiento?: string | null): number | null {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento).getTime()
  if (isNaN(nacimiento)) return null
  return Math.max(0, Math.floor((Date.now() - nacimiento) / 86400000))
}

function getAltitudeTier(alt: number): { label: string; tier: 1 | 2 | 3 } {
  if (alt < 2500) return { label: '0–2,499 m', tier: 1 }
  if (alt < 3600) return { label: '2,500–3,599 m', tier: 2 }
  return { label: '3,600–4,500 m', tier: 3 }
}

function getThresholds(tier: 1 | 2 | 3) {
  if (tier === 1) return { negMin: 95, repMin: 90, positMax: 89, maxReintentos: 2 }
  if (tier === 2) return { negMin: 92, repMin: 87, positMax: 86, maxReintentos: 3 }
  return { negMin: 88, repMin: 83, positMax: 82, maxReintentos: 3 }
}

function classifyResult(pre: number, post: number, alt: number): ResultClass {
  const { tier } = getAltitudeTier(alt)
  const { negMin, repMin } = getThresholds(tier)
  const minVal = Math.min(pre, post)
  const diff = Math.abs(pre - post)
  if (minVal >= negMin && diff <= 3) return 'negativo'
  if (minVal >= repMin && diff <= 4) return 'repetir'
  return 'positivo'
}

const IconTutorial = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a6fa8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)
const IconMedicion = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a6fa8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)
const IconPaquete = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a6fa8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)
const IconDerivacion = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a6fa8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const IconAlertas = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a6fa8' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)
const IconCheck = ({ size = 20, color = '#059669' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconWifi = ({ off }: { off?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={off ? '#ea580c' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill={off ? '#ea580c' : '#059669'} />
      </>
    ) : (
      <>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill={off ? '#ea580c' : '#059669'} />
      </>
    )}
  </svg>
)
const IconSync = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <polyline points="23 20 23 14 17 14" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </svg>
)
const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l.95-1.89a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)
const IconMessage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)
const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const SINTOMAS_LABELS: Record<string, { label: string; icon: string }> = {
  cianosis: { label: 'Cianosis central', icon: '🚩' },
  taquipnea: { label: 'Taquipnea (FR > 60/min)', icon: '🚩' },
  soplo: { label: 'Soplo cardíaco audible', icon: '🚩' },
  pulsos_debiles: { label: 'Pulsos débiles o ausentes', icon: '🚩' },
  dificultad_resp: { label: 'Dificultad respiratoria', icon: '🚩' },
  otro: { label: 'Otro síntoma indicado', icon: '🚩' },
}

function TopBar({ networkStatus, screen, medico, onProfileClick, onWifiClick, onSettingsClick, onFaqClick }: { networkStatus: NetworkStatus; screen: Screen; medico?: Medico | null; onProfileClick?: () => void; onWifiClick?: () => void; onSettingsClick?: () => void; onFaqClick?: () => void }) {
  const titles: Record<Screen, string> = {
    tutorial: 'Tutorial de Tamizaje',
    medicion: 'Medición SpO₂',
    paquete: 'Paquete CARDIO',
    derivacion: 'Red de Derivación',
    alertas: 'Alertas y Sincronización',
  }
  return (
    <div style={{ background: '#0f4a73', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, background: '#1a6fa8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/favicon.svg" alt="Sunqu" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16.1, lineHeight: 1.1, fontFamily: 'Outfit, sans-serif' }}>Sunqu</div>
          <div style={{ color: '#7bb8e8', fontSize: 12.6, lineHeight: 1.1, fontFamily: 'Outfit, sans-serif' }}>{titles[screen]}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={onSettingsClick}
          title="Idioma / Configuración"
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <IconGear />
        </button>
        <button
          onClick={onFaqClick}
          title="Preguntas Frecuentes"
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13.8 }}
        >
          ?
        </button>
        <div
          onClick={onWifiClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer',
            background: networkStatus === 'offline' ? '#7f2d0a' : networkStatus === 'syncing' ? '#1e3a5f' : '#0d3b24',
            borderRadius: 20, border: `1px solid ${networkStatus === 'offline' ? '#c2440a' : networkStatus === 'syncing' ? '#1a6fa8' : '#059669'}`,
          }}>
          {networkStatus === 'syncing' ? <IconSync /> : <IconWifi off={networkStatus === 'offline'} />}
          <span style={{
            fontSize: 12.6, fontWeight: 600, letterSpacing: '0.02em', fontFamily: 'Outfit, sans-serif',
            color: networkStatus === 'offline' ? '#fb923c' : networkStatus === 'syncing' ? '#60a5fa' : '#34d399',
          }}>
            {networkStatus === 'offline' ? 'Sin Conexión' : networkStatus === 'syncing' ? 'Sincronizando' : 'En Línea'}
          </span>
        </div>
        {medico && (
          <button
            onClick={onProfileClick}
            title="Mi perfil"
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 13.8, fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {medico.nombre.trim().charAt(0).toUpperCase()}
          </button>
        )}
      </div>
    </div>
  )
}

function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const items: { key: Screen; label: string; Icon: React.ComponentType<{ active?: boolean }> }[] = [
    { key: 'tutorial', label: ' Tutorial', Icon: IconTutorial },
    { key: 'medicion', label: '1. Medición', Icon: IconMedicion },
    { key: 'paquete', label: '2. Paquete', Icon: IconPaquete },
    { key: 'derivacion', label: '3. Derivación', Icon: IconDerivacion },
    { key: 'alertas', label: '4. Alertas', Icon: IconAlertas },
  ]
  return (
    <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexShrink: 0, boxShadow: '0 -2px 12px rgba(0,0,0,0.07)' }}>
      {items.map(({ key, label, Icon }) => {
        const active = screen === key
        return (
          <button
            key={key}
            onClick={() => setScreen(key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              borderTop: active ? '2px solid #1a6fa8' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon active={active} />
            <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 400, color: active ? '#1a6fa8' : '#64748b', fontFamily: 'Outfit, sans-serif' }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0',
      padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...style,
    }}>
      {children}
    </div>
  )
}

function BigButton({ onClick, children, color = '#1a6fa8', disabled, style }: {
  onClick?: () => void; children: React.ReactNode; color?: string; disabled?: boolean; style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', minHeight: 56, padding: '14px 20px', borderRadius: 14,
        background: disabled ? '#94a3b8' : color, color: '#fff',
        fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18.4,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: disabled ? 'none' : `0 4px 14px ${color}55`,
        transition: 'all 0.15s ease', ...style,
      }}
    >
      {children}
    </button>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 13.8, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
      {children}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: number; max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        width: '100%', minHeight: 56, padding: '14px 16px', borderRadius: 12,
        border: '2px solid #e2e8f0', background: '#f8fafd',
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 25.3,
        color: '#0f4a73', textAlign: 'center', outline: 'none',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#1a6fa8' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
    />
  )
}

function MedicionScreen({ networkStatus }: { networkStatus: NetworkStatus }) {
  const { paciente, medico, setTamizajeActual } = usePatient()
  const [altitud, setAltitud] = useState('3400')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [spo2Pre, setSpo2Pre] = useState('')
  const [spo2Post, setSpo2Post] = useState('')
  const [intentos, setIntentos] = useState(1)
  const [submitted, setSubmitted] = useState(false)

  const handleUsarUbicacion = async () => {
    setBuscandoUbicacion(true)
    setGeoError(null)
    const r = await obtenerAltitud()
    setBuscandoUbicacion(false)
    if (r.altitud !== null) setAltitud(String(r.altitud))
    else setGeoError(r.error)
  }

  const alt = parseInt(altitud) || 0
  const pre = parseInt(spo2Pre)
  const post = parseInt(spo2Post)
  const diff = !isNaN(pre) && !isNaN(post) ? Math.abs(pre - post) : null
  const { label: tierLabel, tier } = getAltitudeTier(alt)
  const { negMin, repMin, maxReintentos } = getThresholds(tier)
  const result: ResultClass = !isNaN(pre) && !isNaN(post) && pre > 0 && post > 0 ? classifyResult(pre, post, alt) : null

  const resultConfig = {
    negativo: { label: 'NEGATIVO', sub: 'Resultado normal. No se requiere acción inmediata.', bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', solid: '#059669', icon: '✓' },
    repetir: { label: 'REPETIR EN 1 HORA', sub: 'Resultado limítrofe. Repita la prueba en 1 hora.', bg: '#fef9c3', border: '#fde047', text: '#713f12', solid: '#ca8a04', icon: '⚠' },
    positivo: { label: 'POSITIVO', sub: 'Valores críticos. Derive al especialista de inmediato.', bg: '#fee2e2', border: '#fca5a5', text: '#7f1d1d', solid: '#dc2626', icon: '✕' },
  }

  const tierBanner = {
    1: { label: 'Nivel Mar (0–2,499 m)', bg: '#e8f1fb', border: '#c8ddf5', text: '#155d8f' },
    2: { label: 'Altitud Media (2,500–3,599 m)', bg: '#e0f7f9', border: '#b2ebf2', text: '#0a6b75' },
    3: { label: 'Gran Altitud (3,600–4,500 m)', bg: '#fef9c3', border: '#fde047', text: '#713f12' },
  }[tier]

  const handleGuardar = async () => {
    setSubmitted(true)
    if (!result || !paciente) return
    const t: Tamizaje = {
      paciente_dni: paciente.dni, medico_codigo: medico?.codigo ?? null,
      spo2_pre: pre, spo2_post: post, altitud: alt, resultado: result, sintomas: [],
      creado_en: new Date().toISOString(),
    }
    setTamizajeActual(t)
    await guardarTamizaje(t)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <Label required>Altitud de la Instalación</Label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <NumInput value={altitud} onChange={setAltitud} placeholder="m.s.n.m." min={0} max={5000} />
          </div>
          <div style={{ flexShrink: 0, padding: '10px 14px', background: '#eef2f7', borderRadius: 12, border: '1px solid #e2e8f0', minHeight: 56, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17.2, fontWeight: 500, color: '#64748b' }}>m.s.n.m.</span>
          </div>
        </div>
        <button
          onClick={handleUsarUbicacion}
          disabled={buscandoUbicacion}
          style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #c8ddf5', background: '#e8f1fb', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 13.8, cursor: 'pointer' }}
        >
          {buscandoUbicacion ? 'Obteniendo ubicación...' : '📍 Usar mi ubicación para la altitud'}
        </button>
        {geoError && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', fontSize: 12.6, color: '#9a3412', fontFamily: 'Outfit, sans-serif' }}>
            ⚠ {geoError} Puedes editar el campo de altitud arriba.
          </div>
        )}
        <div style={{ marginTop: 10, padding: '12px 14px', background: tierBanner.bg, borderRadius: 12, border: `1px solid ${tierBanner.border}` }}>
          <div style={{ fontSize: 17.2, fontWeight: 700, color: tierBanner.text, fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>{tierBanner.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontSize: 13.8, color: tierBanner.text, fontFamily: 'Outfit, sans-serif' }}><b>NEGATIVO:</b> ambas ≥ {negMin}% y diff ≤ 3%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', flexShrink: 0 }} />
              <span style={{ fontSize: 13.8, color: tierBanner.text, fontFamily: 'Outfit, sans-serif' }}><b>REPETIR:</b> {repMin}–{negMin - 1}% cualquiera o diff &gt; 3%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontSize: 13.8, color: tierBanner.text, fontFamily: 'Outfit, sans-serif' }}><b>POSITIVO:</b> &lt; {repMin}% cualquier extremidad</span>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12.6, color: tierBanner.text, fontFamily: 'Outfit, sans-serif', opacity: 0.75 }}>Máx. reintentos: {maxReintentos}</div>
        </div>
      </SectionCard>

      <SectionCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label required>SpO₂ Preductal</Label>
            <div style={{ fontSize: 12.6, color: '#64748b', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Mano Derecha</div>
            <NumInput value={spo2Pre} onChange={setSpo2Pre} placeholder="–" min={50} max={100} />
            <div style={{ textAlign: 'center', marginTop: 6, fontSize: 20.7 }}>🤚</div>
          </div>
          <div>
            <Label required>SpO₂ Postductal</Label>
            <div style={{ fontSize: 12.6, color: '#64748b', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Pie Derecho</div>
            <NumInput value={spo2Post} onChange={setSpo2Post} placeholder="–" min={50} max={100} />
            <div style={{ textAlign: 'center', marginTop: 6, fontSize: 20.7 }}>🦶</div>
          </div>
        </div>
        {diff !== null && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: diff > 3 ? '#fee2e2' : '#eef2f7', borderRadius: 12, border: `1px solid ${diff > 3 ? '#fca5a5' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17.2, fontWeight: 600, color: diff > 3 ? '#7f1d1d' : '#475569', fontFamily: 'Outfit, sans-serif' }}>Diferencial Pre–Post</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 25.3, color: diff > 3 ? '#dc2626' : '#0f4a73' }}>
              {diff}%
            </span>
          </div>
        )}
      </SectionCard>

      {result && (() => {
        const cfg = resultConfig[result]
        return (
          <div style={{ padding: '20px', background: cfg.bg, borderRadius: 16, border: `2px solid ${cfg.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: cfg.solid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${cfg.solid}44` }}>
                <span style={{ fontSize: 27.6, color: '#fff', fontWeight: 700 }}>{cfg.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: 20.7, fontWeight: 800, color: cfg.text, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.02em' }}>{cfg.label}</div>
                <div style={{ fontSize: 17.2, color: cfg.text, opacity: 0.8, fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{cfg.sub}</div>
              </div>
            </div>
            {result === 'repetir' && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 17.2, fontWeight: 600, color: '#713f12', fontFamily: 'Outfit, sans-serif' }}>Intento N°:</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setIntentos(n)} style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${n <= intentos ? '#ca8a04' : '#fde047'}`, background: n <= intentos ? '#ca8a04' : '#fef9c3', color: n <= intentos ? '#fff' : '#713f12', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 18.4, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {result && (() => {
        const cfg = resultConfig[result]
        const titulos = { positivo: '⚠ Caso grave — siga estos pasos:', repetir: '⚠ Repetir medición — siga estos pasos:', negativo: '✓ Indicaciones' }
        return (
          <div style={{ padding: '14px 16px', background: cfg.bg, borderRadius: 14, border: `1px solid ${cfg.border}` }}>
            <div style={{ fontSize: 17.2, fontWeight: 700, color: cfg.text, marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>{titulos[result]}</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {getInstrucciones(result).map((inst, i) => (
                <li key={i} style={{ fontSize: 13.8, color: cfg.text, fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>{inst}</li>
              ))}
            </ul>
          </div>
        )
      })()}

      {!result && (
        <div style={{ padding: '12px 16px', background: '#f8fafd', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 17.2, color: '#64748b', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
          Ingrese ambas lecturas SpO₂ para obtener el resultado clasificado.
        </div>
      )}

      {result && !submitted && (
        <BigButton onClick={handleGuardar} color="#0f4a73" disabled={!paciente}>
          <IconSend /> {paciente ? 'Guardar y Continuar' : 'Identifica al paciente primero'}
        </BigButton>
      )}
      {submitted && (
        <div style={{ padding: '16px', background: '#d1fae5', borderRadius: 14, border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconCheck size={24} color="#059669" />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#065f46', fontSize: 17.3 }}>
            {networkStatus === 'offline' ? 'Guardado localmente. Se sincronizará cuando haya conexión.' : 'Registro guardado y sincronizado.'}
          </span>
        </div>
      )}
    </div>
  )
}

function PaqueteScreen({ networkStatus }: { networkStatus: NetworkStatus }) {
  const { paciente, setPaciente, tamizajeActual, setTamizajeActual } = usePatient()
  const [otroTexto, setOtroTexto] = useState(() => {
    const s = tamizajeActual?.sintomas?.find(x => x.startsWith('otro:'))
    return s ? s.replace('otro:', '') : ''
  })
  const [sintomas, setSintomas] = useState<Record<string, boolean>>(() => {
    const activos = tamizajeActual?.sintomas ?? []
    return Object.fromEntries(Object.keys(SINTOMAS_LABELS).map(k => [
      k, 
      k === 'otro' ? activos.some(x => x === 'otro' || x.startsWith('otro:')) : activos.includes(k)
    ]))
  })

  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'queued'>('idle')

  const sitomasList = Object.entries(SINTOMAS_LABELS).map(([key, v]) => ({ key, ...v }))

  const toggleSintoma = (key: string, checked: boolean) => {
    const nuevos = { ...sintomas, [key]: checked }
    setSintomas(nuevos)
    if (tamizajeActual) {
      const actualizados = Object.keys(nuevos).filter(k => nuevos[k] && k !== 'otro')
      if (nuevos['otro']) {
        actualizados.push(otroTexto ? `otro:${otroTexto}` : 'otro')
      }
      setTamizajeActual({ ...tamizajeActual, sintomas: actualizados })
    }
  }

  const handleOtroTexto = (txt: string) => {
    setOtroTexto(txt)
    if (sintomas['otro'] && tamizajeActual) {
      const actualizados = Object.keys(sintomas).filter(k => sintomas[k] && k !== 'otro')
      actualizados.push(txt ? `otro:${txt}` : 'otro')
      setTamizajeActual({ ...tamizajeActual, sintomas: actualizados })
    }
  }

  const handleSend = () => {
    setSendState('sending')
    setTimeout(() => {
      setSendState(networkStatus === 'offline' ? 'queued' : 'sent')
    }, 1800)
  }

  const now = new Date()
  const fechaStr = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
          Datos del Paciente
        </div>
        {!paciente ? (
          <div style={{ fontSize: 13.8, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Busca un paciente por DNI arriba para completar sus datos.</div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { key: 'nombre', label: 'Paciente', value: paciente.nombre || 'Recién nacido' },
            { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', value: paciente.fecha_nacimiento || fechaStr },
            { key: 'edad_gestacional', label: 'Edad Gestacional', value: paciente.edad_gestacional || '—' },
            { key: 'establecimiento', label: 'Establecimiento', value: paciente.establecimiento || '—' },
            { key: 'altitud', label: 'Altitud', value: `${(tamizajeActual?.altitud ?? paciente.altitud ?? 0).toLocaleString('es-PE')} m.s.n.m.` },
            { key: 'hora', label: 'Hora Cribado', value: horaStr },
          ].map(({ key, label, value }) => (
            <div key={label} style={{ padding: '10px 12px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontFamily: 'Outfit, sans-serif' }}>{label}</div>
              {key === 'hora' || key === 'altitud' ? (
                <div style={{ fontSize: 17.2, fontWeight: 600, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{value}</div>
              ) : (
                <input
                  value={String(value)}
                  onChange={e => setPaciente({ ...paciente, [key]: e.target.value } as Paciente)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 17.2, fontWeight: 600, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', outline: 'none', padding: 0 }}
                />
              )}
            </div>
          ))}
        </div>
        )}
      </SectionCard>

      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
          Síntomas Observados
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sitomasList.map(({ key, label, icon }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: sintomas[key] ? '#fee2e2' : '#f8fafd', borderRadius: 12, border: `2px solid ${sintomas[key] ? '#fca5a5' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${sintomas[key] ? '#dc2626' : '#cbd5e1'}`, background: sintomas[key] ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sintomas[key] && <IconCheck size={14} color="#fff" />}
                </div>
                <input type="checkbox" style={{ display: 'none' }} checked={sintomas[key]} onChange={e => toggleSintoma(key, e.target.checked)} />
                <span style={{ fontSize: 16.1 }}>{sintomas[key] ? icon : '⬜'}</span>
                <span style={{ fontSize: 16.1, fontWeight: 500, color: sintomas[key] ? '#7f1d1d' : '#334155', fontFamily: 'Outfit, sans-serif' }}>{label}</span>
              </label>
              
              {/* Nuevo Input que aparece solo si "otro" está marcado */}
              {key === 'otro' && sintomas['otro'] && (
                <input
                  type="text"
                  placeholder="Especifique el síntoma..."
                  value={otroTexto}
                  onChange={e => handleOtroTexto(e.target.value)}
                  style={{ marginLeft: 48, padding: '10px 12px', borderRadius: 10, border: '2px solid #fca5a5', background: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: 15, outline: 'none' }}
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ padding: '18px', background: '#0f4a73', borderRadius: 16, border: '1px solid #155d8f', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#34d399' }} />
          <span style={{ fontSize: 13.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Outfit, sans-serif', color: '#7bb8e8' }}>PAQUETE CARDIO</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.6, color: '#64748b' }}>#{Date.now().toString().slice(-6)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'SpO₂ Pre', value: tamizajeActual ? `${tamizajeActual.spo2_pre}%` : '—', alert: (tamizajeActual?.resultado ?? 'negativo') !== 'negativo' },
            { label: 'SpO₂ Post', value: tamizajeActual ? `${tamizajeActual.spo2_post}%` : '—', alert: (tamizajeActual?.resultado ?? 'negativo') !== 'negativo' },
            { label: 'Diferencial', value: tamizajeActual ? `${Math.abs(tamizajeActual.spo2_pre - tamizajeActual.spo2_post)}%` : '—', alert: false },
            { label: 'Resultado', value: tamizajeActual ? tamizajeActual.resultado.toUpperCase() : 'Sin medir', alert: (tamizajeActual?.resultado ?? 'negativo') !== 'negativo' },
          ].map(({ label, value, alert }) => (
            <div key={label} style={{ padding: '8px 12px', background: alert ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.08)', borderRadius: 8, border: `1px solid ${alert ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.12)'}` }}>
              <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 18.4, color: alert ? '#fca5a5' : '#e2e8f0' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13.8, color: '#7bb8e8', fontFamily: 'Outfit, sans-serif' }}>
          Síntomas: {Object.entries(sintomas).filter(([, v]) => v).map(([k]) => SINTOMAS_LABELS[k]?.icon + ' ' + SINTOMAS_LABELS[k]?.label).join(' · ') || 'Ninguno registrado'}
        </div>
      </div>

      {sendState === 'idle' && (
        <BigButton onClick={handleSend} color={networkStatus === 'offline' ? '#ca8a04' : '#1a6fa8'} disabled={!paciente || !tamizajeActual}>
          <IconSend />
          {!paciente || !tamizajeActual
            ? 'Falta medir al paciente en la pestaña Medición'
            : networkStatus === 'offline' ? 'Encolar para Línea de Especialistas' : 'Enviar a Línea de Especialistas'}
        </BigButton>
      )}
      {sendState === 'sending' && (
        <div style={{ padding: '18px', background: '#e8f1fb', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #c8ddf5' }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, border: '3px solid #1a6fa8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#155d8f' }}>Enviando paquete...</span>
        </div>
      )}
      {sendState === 'sent' && (
        <div style={{ padding: '18px', background: '#d1fae5', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #6ee7b7' }}>
          <IconCheck size={24} color="#059669" />
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#065f46', fontSize: 17.3 }}>Paquete enviado exitosamente</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13.8, color: '#065f46', opacity: 0.7, marginTop: 2 }}>El especialista ha recibido la notificación.</div>
          </div>
        </div>
      )}
      {sendState === 'queued' && (
        <div style={{ padding: '18px', background: '#fff7ed', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #fed7aa' }}>
          <IconAlert />
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#9a3412', fontSize: 17.3 }}>En cola — Sin conexión</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13.8, color: '#9a3412', opacity: 0.8, marginTop: 2 }}>Se enviará automáticamente cuando haya internet disponible.</div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DatosComplementarios {
  asegurado: 'si' | 'no' | ''
  establecimientoDestino: string
  anamnesis: string
  examenFisico: string
  diagnostico: string
  tratamiento: string
  acompanante: string
}

const ESTABLECIMIENTOS_DESTINO = [
  'Hospital Regional Huancavelica',
  'HRDLM Huancayo',
  'Hospital Arzobispo Loayza (Lima)',
  'Instituto Nacional del Niño (San Borja)',
]

const CIE10_DEFAULT = 'Q24.9 - Malformación congénita del corazón, no especificada'

const DATOS_COMPLEMENTARIOS_VACIOS: DatosComplementarios = {
  asegurado: '', establecimientoDestino: '',
  anamnesis: '', examenFisico: '', diagnostico: '', tratamiento: '', acompanante: '',
}

function DerivacionScreen({ networkStatus }: { networkStatus: NetworkStatus }) {
  const { paciente, tamizajeActual, medico } = usePatient()
  const diff = tamizajeActual ? Math.abs(tamizajeActual.spo2_pre - tamizajeActual.spo2_post) : null
  const [datos, setDatos] = useState<DatosComplementarios>(DATOS_COMPLEMENTARIOS_VACIOS)
  useEffect(() => {
    if (paciente) setDatos(d => ({
      ...d,
      anamnesis: d.anamnesis || paciente.historial || '',
      diagnostico: d.diagnostico || CIE10_DEFAULT,
    }))
  }, [paciente])
  const [intentoDescarga, setIntentoDescarga] = useState(false)

  const listo = Boolean(paciente && tamizajeActual)

  const sintomasActivos = (tamizajeActual?.sintomas ?? []).map(s => {
    if (s.startsWith('otro:')) return `Otro síntoma: ${s.replace('otro:', '')}`
    return SINTOMAS_LABELS[s]?.label || s
  })

  const edadDias = calcularEdadDias(paciente?.fecha_nacimiento)

  const resumen = !listo
    ? null
    : `📋 RESUMEN DE ATENCIÓN: TAMIZAJE NEONATAL CARDIOLÓGICO\n\n` +
      `👤 DATOS DEL PACIENTE\n` +
      `Paciente: ${paciente!.nombre || 'Recién nacido'}\n` +
      `DNI / CNV: ${paciente!.dni}\n` +
      `Edad: ${edadDias !== null ? `${edadDias} días de nacido` : '—'}` +
      (paciente!.edad_gestacional ? ` (EG: ${paciente!.edad_gestacional})` : '') + `\n\n` +
      `🏥 DETALLES DEL TAMIZAJE\n` +
      `Fecha de realización: ${tamizajeActual!.creado_en ? new Date(tamizajeActual!.creado_en).toLocaleString('es-PE') : '—'}\n` +
      `Altitud del centro: ${tamizajeActual!.altitud.toLocaleString('es-PE')} msnm\n\n` +
      `📊 RESULTADOS DE OXIMETRÍA\n` +
      `✋ SpO2 Pre-ductal (Mano derecha): ${tamizajeActual!.spo2_pre}%\n` +
      `🦶 SpO2 Post-ductal (Cualquier pie): ${tamizajeActual!.spo2_post}%\n` +
      `🚨 Estado de Tamizaje: ${tamizajeActual!.resultado.toUpperCase()}\n\n` +
      `🩺 INFORMACIÓN CLÍNICA\n` +
      `Historial / Anamnesis: ${paciente!.historial || datos.anamnesis || '—'}\n` +
      `Síntomas:\n` +
      (sintomasActivos.length ? sintomasActivos.map(s => `🔸 ${s}`).join('\n') : '🔸 Sin síntomas de alarma registrados') + `\n\n` +
      `📌 Conclusión Médica: ${tamizajeActual!.resultado === 'positivo' ? 'Requiere derivación cardiológica urgente. Paciente inestable.' : 'Se solicita evaluación e interconsulta.'}`

  const [copiado, setCopiado] = useState(false)
  const handleCopiar = async () => {
    if (!resumen) return
    await navigator.clipboard.writeText(resumen)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }
  const handleSMS = () => { if (resumen) window.location.href = `sms:?&body=${encodeURIComponent(resumen)}` }
  const handleWhatsApp = () => { if (resumen) window.open(`https://wa.me/?text=${encodeURIComponent(resumen)}`, '_blank') }

  // Campos obligatorios para poder generar la Hoja de Referencia (marcados con * en el formulario).
  const camposFaltantes = (): string[] => {
    const faltan: string[] = []
    if (!paciente?.nombre) faltan.push('Nombre del paciente')
    if (!paciente?.dni) faltan.push('DNI / CNV')
    if (!paciente?.fecha_nacimiento) faltan.push('Fecha de nacimiento (registrar en ficha del paciente)')
    if (!paciente?.establecimiento) faltan.push('Establecimiento de origen')
    if (!datos.establecimientoDestino) faltan.push('Establecimiento de destino')
    if (!tamizajeActual) faltan.push('Medición de SpO₂ (pestaña Medición)')
    if (!datos.diagnostico) faltan.push('Diagnóstico')
    return faltan
  }

  const handlePDF = () => {
    const faltantes = camposFaltantes()
    if (faltantes.length > 0) {
      setIntentoDescarga(true)
      return
    }
    setIntentoDescarga(false)

    const doc = new jsPDF()
    const negro: [number, number, number] = [20, 20, 20]
    const gris: [number, number, number] = [90, 90, 90]
    const mx = 10
    const w = 210
    const cw = w - 2 * mx // 190
    doc.setDrawColor(0); doc.setLineWidth(0.25); doc.setTextColor(...negro)

    // ---- Encabezado ----
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('Ministerio de Salud', mx, 14)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    doc.text('Sunqu — Tamizaje Neonatal Cardíaco', mx, 18)
    doc.setLineWidth(0.4); doc.rect(mx + 45, 8, 95, 12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    doc.text('HOJA DE REFERENCIA', mx + 45 + 47.5, 16, { align: 'center' })
    doc.setLineWidth(0.25); doc.rect(w - mx - 45, 8, 45, 12)
    doc.setFontSize(7); doc.text('NÚMERO', w - mx - 22.5, 12, { align: 'center' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    const caso = tamizajeActual?.id ? tamizajeActual.id.slice(0, 8).toUpperCase() : 'S/N'
    doc.text(caso, w - mx - 22.5, 18, { align: 'center' })

    let y = 28
    const edadDet = calcularEdadDetallada(paciente?.fecha_nacimiento)
    const esUrgente = tamizajeActual?.resultado === 'positivo'

    // helpers
    const lbl = (t: string, x: number, yy: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...gris); doc.text(t, x, yy) }
    const val = (t: string, x: number, yy: number, size = 8.5) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...negro); doc.text(t || '—', x, yy) }
    const boxField = (x: number, yy: number, ww: number, h: number, label: string, value: string) => {
      doc.setLineWidth(0.25); doc.rect(x, yy, ww, h)
      lbl(label, x + 1.5, yy + 3.2)
      val(value, x + 1.5, yy + h - 2)
    }
    const parrafoBox = (x: number, yy: number, ww: number, h: number, label: string, texto: string) => {
      doc.rect(x, yy, ww, h)
      lbl(label, x + 1.5, yy + 3.2)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...negro)
      const lineas = doc.splitTextToSize(texto || '—', ww - 3)
      doc.text(lineas.slice(0, Math.floor((h - 4) / 4)), x + 1.5, yy + 8)
    }
    const circ = (x: number, yy: number, marked: boolean, texto: string) => {
      doc.setLineWidth(0.25); doc.circle(x, yy, 1.6)
      if (marked) { doc.setLineWidth(0.7); doc.circle(x, yy, 0.8, 'FD') }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...negro)
      doc.text(texto, x + 3, yy + 1)
    }
    const seccion = (t: string) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...negro); doc.text(t, mx, y); y += 4 }

    // ---- 1. DATOS GENERALES ----
    seccion('1.- DATOS GENERALES')
    const hoy = new Date()
    boxField(mx, y, 42, 9, 'FECHA', hoy.toLocaleDateString('es-PE'))
    boxField(mx + 44, y, 24, 9, 'HORA', hoy.toLocaleTimeString('es-PE').slice(0, 5))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('Asegurado:', mx + 70, y + 6)
    circ(mx + 88, y + 5, datos.asegurado === 'si', 'SI')
    circ(mx + 100, y + 5, datos.asegurado === 'no', 'NO')
    boxField(mx + 112, y, 78, 9, 'FECHA DE NACIMIENTO', paciente?.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-PE') : '—')
    y += 12
    boxField(mx, y, cw, 8, 'ESTABLECIMIENTO DE ORIGEN', paciente?.establecimiento || medico?.establecimiento || '—')
    y += 10
    boxField(mx, y, cw, 8, 'ESTABLECIMIENTO DESTINO', datos.establecimientoDestino)
    y += 13

    // ---- 2. IDENTIFICACIÓN DEL USUARIO ----
    seccion('2.- IDENTIFICACIÓN DEL USUARIO')
    boxField(mx, y, cw, 8, 'NOMBRES Y APELLIDOS', paciente?.nombre || 'Recién nacido')
    y += 10
    boxField(mx, y, 40, 9, 'DNI / CNV', paciente?.dni || '—')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('Sexo:', mx + 44, y + 6)
    circ(mx + 54, y + 5, false, 'M'); circ(mx + 64, y + 5, false, 'F')
    boxField(mx + 72, y, 24, 9, 'EDAD (AÑOS)', edadDet ? `${edadDet.anios}` : '—')
    boxField(mx + 98, y, 24, 9, 'MESES', edadDet ? `${edadDet.meses}` : '—')
    boxField(mx + 124, y, 24, 9, 'DÍAS', edadDet ? `${edadDet.dias}` : '—')
    boxField(mx + 150, y, 40, 9, 'EDAD GESTACIONAL', paciente?.edad_gestacional || '—')
    y += 12
    boxField(mx, y, cw, 8, 'DIRECCIÓN', `S/N - Jurisdicción ${paciente?.establecimiento || medico?.establecimiento || '—'}`)
    y += 13

    // ---- 3. RESUMEN DE HISTORIA CLÍNICA ----
    seccion('3.- RESUMEN DE HISTORIA CLÍNICA')
    parrafoBox(mx, y, cw, 16, 'ANAMNESIS', datos.anamnesis)
    y += 18
    parrafoBox(mx, y, cw, 16, 'EXAMEN FÍSICO (OPCIONAL)', datos.examenFisico)
    y += 18
    const examAux = tamizajeActual
      ? `Oximetría de pulso: SpO2 preductal ${tamizajeActual.spo2_pre}%, postductal ${tamizajeActual.spo2_post}% (diferencial ${diff}%). Altitud: ${tamizajeActual.altitud.toLocaleString('es-PE')} m.s.n.m. Clasificación: ${tamizajeActual.resultado.toUpperCase()}. Síntomas: ${sintomasActivos.length ? sintomasActivos.join(', ') : 'ninguno registrado'}.`
      : '—'
    parrafoBox(mx, y, cw, 20, 'EXÁMENES AUXILIARES', examAux)
    y += 22
    doc.rect(mx, y, cw - 30, 18); doc.rect(mx + cw - 30, y, 30, 18)
    lbl('DIAGNÓSTICO (CIE-10)', mx + 1.5, y + 3.2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(doc.splitTextToSize(`1. ${datos.diagnostico}`, cw - 33), mx + 1.5, y + 8)
    lbl('D / P / R', mx + cw - 28, y + 3.2)
    val('P', mx + cw - 15, y + 10, 9)
    y += 20
    boxField(mx, y, cw, 9, 'TRATAMIENTO INDICADO (OPCIONAL)', datos.tratamiento || 'Ninguno')
    y += 13

    // ---- 4. DATOS DE LA REFERENCIA ----
    seccion('4.- DATOS DE LA REFERENCIA')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    circ(mx + 4, y + 3, esUrgente, 'Emergencia (referencia urgente)')
    doc.text('Prioridad:', mx + 4, y + 10)
    circ(mx + 22, y + 9, esUrgente, 'I')
    circ(mx + 34, y + 9, !esUrgente, 'II')
    y += 15
    boxField(mx, y, cw / 2 - 2, 9, 'RESPONSABLE (ORIGEN)', medico ? medico.nombre : '—')
    boxField(mx + cw / 2 + 2, y, cw / 2 - 2, 9, 'CMP / COLEGIATURA', medico ? medico.codigo : '—')
    y += 11
    boxField(mx, y, cw / 2 - 2, 9, 'PERSONAL QUE ACOMPAÑA (OPCIONAL)', datos.acompanante ? `CMP ${datos.acompanante}` : '—')
    boxField(mx + cw / 2 + 2, y, cw / 2 - 2, 9, 'ESPECIALIDAD DE DESTINO', 'Pediatría / Cardiología')
    y += 14

    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(...gris)
    doc.text('Los campos de "Coordinación con destino", "Condiciones del paciente", "Personal que recibe" y firmas se completan de forma manual al momento del traslado.', mx, y, { maxWidth: cw })
    y += 8

    // Firma y sello
    doc.setDrawColor(...negro)
    doc.line(mx + 10, y + 14, mx + 70, y + 14)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('Firma y Sello — Responsable de Origen', mx + 40, y + 18, { align: 'center' })
    doc.line(mx + 110, y + 14, mx + 170, y + 14)
    doc.text('Firma y Sello — Personal que Acompaña', mx + 140, y + 18, { align: 'center' })

    doc.setFontSize(6.5); doc.setTextColor(...gris)
    doc.text('Documento generado por Sunqu · Apoyo a la decisión clínica, no reemplaza la evaluación del establecimiento receptor.', mx, 292, { maxWidth: cw })

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  const facilities = [
    { name: 'Hospital Regional Huancavelica', dist: '12 km', time: '25 min', urgencia: 'alta', phone: '+51 67 452 890' },
    { name: 'HRDLM Huancayo', dist: '48 km', time: '1h 10min', urgencia: 'media', phone: '+51 64 231 456' },
    { name: 'Hospital Arzobispo Loayza', dist: '280 km', time: '5h', urgencia: 'baja', phone: '+51 1 411 7700' },
  ]

  const faltantes = camposFaltantes()

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'Outfit, sans-serif' }}>
          Resumen de Caso
        </div>
        {!listo ? (
          <div style={{ padding: '14px', background: '#f8fafd', borderRadius: 10, border: '1px dashed #cbd5e1', fontSize: 13.8, color: '#64748b', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
            Complete la medición y los síntomas (pestañas Medición y Paquete) para generar el resumen automáticamente.
          </div>
        ) : (
          <div style={{ padding: '14px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14.5, color: '#334155', fontFamily: 'Outfit, sans-serif', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>
            {resumen}
          </div>
        )}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={handleCopiar} disabled={!listo} style={{ padding: '10px 8px', borderRadius: 10, border: '1px solid #c8ddf5', background: listo ? '#e8f1fb' : '#f1f5f9', color: listo ? '#155d8f' : '#94a3b8', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: listo ? 'pointer' : 'not-allowed' }}>
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
          <button onClick={handleWhatsApp} disabled={!listo} style={{ padding: '10px 8px', borderRadius: 10, border: '1px solid #86efac', background: listo ? '#dcfce7' : '#f1f5f9', color: listo ? '#166534' : '#94a3b8', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: listo ? 'pointer' : 'not-allowed' }}>
            🟢 WhatsApp
          </button>
          <button onClick={handleSMS} disabled={!listo} style={{ gridColumn: '1 / -1', padding: '10px 8px', borderRadius: 10, border: '1px solid #c8ddf5', background: listo ? '#e8f1fb' : '#f1f5f9', color: listo ? '#155d8f' : '#94a3b8', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: listo ? 'pointer' : 'not-allowed' }}>
            💬 SMS
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'Outfit, sans-serif' }}>
          Información Complementaria
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginBottom: 10 }}>
          Los campos con <span style={{ color: '#dc2626' }}>*</span> son obligatorios para generar la Hoja de Referencia. El resto puede dejarse en blanco si no aplica.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: '#eef6fc', fontSize: 13, color: '#334155', fontFamily: 'Outfit, sans-serif' }}>
            <b>Edad calculada:</b> {(() => {
              const e = calcularEdadDetallada(paciente?.fecha_nacimiento)
              return e ? `${e.anios} años, ${e.meses} meses, ${e.dias} días` : 'Falta fecha de nacimiento en la ficha del paciente'
            })()}
          </div>
          <div>
            <Label>¿Asegurado (SIS)?</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['si', 'no'] as const).map(v => (
                <button key={v} onClick={() => setDatos(d => ({ ...d, asegurado: v }))} style={{ flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${datos.asegurado === v ? '#1a6fa8' : '#e2e8f0'}`, background: datos.asegurado === v ? '#e8f1fb' : '#f8fafd', color: datos.asegurado === v ? '#155d8f' : '#64748b', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13.8, cursor: 'pointer' }}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label required>Establecimiento de destino</Label>
            <select value={datos.establecimientoDestino} onChange={e => setDatos(d => ({ ...d, establecimientoDestino: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none' }}>
              <option value="">Seleccionar...</option>
              {ESTABLECIMIENTOS_DESTINO.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <Label>Anamnesis</Label>
            <textarea value={datos.anamnesis} onChange={e => setDatos(d => ({ ...d, anamnesis: e.target.value }))} rows={2} placeholder="Antecedentes relevantes (ej. madre con antecedente de...)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none', resize: 'vertical' }} />
          </div>
          <div>
            <Label>Examen físico (opcional)</Label>
            <textarea value={datos.examenFisico} onChange={e => setDatos(d => ({ ...d, examenFisico: e.target.value }))} rows={2} placeholder="Hallazgos relevantes al examen"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none', resize: 'vertical' }} />
          </div>
          <div>
            <Label required>Diagnóstico (CIE-10)</Label>
            <input value={datos.diagnostico} onChange={e => setDatos(d => ({ ...d, diagnostico: e.target.value }))} placeholder="Ej. Sospecha de cardiopatía congénita crítica"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none' }} />
          </div>
          <div>
            <Label>Tratamiento indicado (opcional)</Label>
            <input value={datos.tratamiento} onChange={e => setDatos(d => ({ ...d, tratamiento: e.target.value }))} placeholder="Ej. Ninguno / Oxígeno suplementario"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none' }} />
          </div>
          <div>
            <Label>Personal que acompaña — código CMP (opcional)</Label>
            <input value={datos.acompanante} onChange={e => setDatos(d => ({ ...d, acompanante: e.target.value }))} placeholder="Ej. CMP 12345"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 17.2, outline: 'none' }} />
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'Outfit, sans-serif' }}>
          Documento de Derivación
        </div>
        {intentoDescarga && faltantes.length > 0 && (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', fontSize: 12.6, color: '#9a3412', fontFamily: 'Outfit, sans-serif' }}>
            ⚠ Complete todos los datos para la impresión de la derivación: {faltantes.join(', ')}.
          </div>
        )}
        <button onClick={handlePDF} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #c8ddf5', background: '#e8f1fb', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 17.2, cursor: 'pointer' }}>
          📄 PDF / Imprimir
        </button>
      </SectionCard>

      {tamizajeActual && (() => {
        const colores = {
          positivo: { bg: '#fee2e2', border: '#fca5a5', text: '#7f1d1d', titulo: '⚠ Caso grave — instrucciones' },
          repetir: { bg: '#fef9c3', border: '#fde047', text: '#713f12', titulo: '⚠ Repetir medición — instrucciones' },
          negativo: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', titulo: '✓ Indicaciones' },
        }[tamizajeActual.resultado]
        return (
          <div style={{ padding: '14px 16px', background: colores.bg, borderRadius: 14, border: `1px solid ${colores.border}` }}>
            <div style={{ fontSize: 17.2, fontWeight: 700, color: colores.text, marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>{colores.titulo}</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {getInstrucciones(tamizajeActual.resultado).map((inst, i) => (
                <li key={i} style={{ fontSize: 13.8, color: colores.text, fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>{inst}</li>
              ))}
            </ul>
          </div>
        )
      })()}

      <div style={{ fontSize: 17.2, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', padding: '0 2px' }}>Establecimientos Cercanos</div>
      {facilities.map((f, i) => (
        <div key={i} style={{ padding: '14px', background: '#fff', borderRadius: 14, border: `2px solid ${f.urgencia === 'alta' ? '#6ee7b7' : '#e2e8f0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{f.name}</div>
              <div style={{ fontSize: 13.8, color: '#64748b', marginTop: 3, fontFamily: 'Outfit, sans-serif' }}>
                📍 {f.dist} · 🕐 {f.time}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <a href={`tel:${f.phone}`} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#0f4a73', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 17.2 }}>
              <IconPhone /> Llamar
            </a>
          </div>
        </div>
      ))}

      <div style={{ padding: '14px 16px', background: '#fef9c3', borderRadius: 14, border: '1px solid #fde047' }}>
        <div style={{ fontSize: 17.2, fontWeight: 700, color: '#713f12', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>⚠ Teleconsulta de Respaldo</div>
        <div style={{ fontSize: 17.2, color: '#713f12', marginBottom: 10, fontFamily: 'Outfit, sans-serif', opacity: 0.85 }}>
          Si no hay especialista disponible o no es posible la transferencia inmediata, use la línea de teleconsulta nacional:
        </div>
        <a href="tel:+51800001234" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px', background: '#ca8a04', borderRadius: 12, color: '#fff', textDecoration: 'none', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 17.3 }}>
          <IconPhone /> 0800-001-234 (GRATUITO)
        </a>
      </div>
    </div>
  )
}

const mockHistory: Screening[] = [
  { id: 'SCR-001', paciente: 'R.N. Mamani A.', fecha: '11/08/2026 08:14', spo2Pre: 96, spo2Post: 95, altitud: 3400, resultado: 'negativo', syncStatus: 'synced' },
  { id: 'SCR-002', paciente: 'R.N. Quispe M.', fecha: '11/08/2026 10:32', spo2Pre: 90, spo2Post: 88, altitud: 3400, resultado: 'repetir', syncStatus: 'pending' },
  { id: 'SCR-003', paciente: 'R.N. Huanca P.', fecha: '10/08/2026 15:07', spo2Pre: 85, spo2Post: 83, altitud: 3400, resultado: 'positivo', syncStatus: 'failed' },
  { id: 'SCR-004', paciente: 'R.N. Ccori B.', fecha: '10/08/2026 09:45', spo2Pre: 94, spo2Post: 94, altitud: 3400, resultado: 'negativo', syncStatus: 'synced' },
]

function CaseDetailModal({ caso, onClose }: { caso: Screening; onClose: () => void }) {
  const resultLabel = { negativo: 'NEGATIVO', repetir: 'REPETIR', positivo: 'POSITIVO' }
  const resultColor = { negativo: '#059669', repetir: '#ca8a04', positivo: '#dc2626' }
  const rColor = resultColor[caso.resultado!]
  const derivado = caso.resultado !== 'negativo'

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>Detalle del Tamizaje</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18.4, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', marginBottom: 2 }}>{caso.paciente}</div>
        <div style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginBottom: 14 }}>{caso.fecha}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'SpO₂ Pre', value: `${caso.spo2Pre}%` },
            { label: 'SpO₂ Post', value: `${caso.spo2Post}%` },
            { label: 'Altitud', value: `${caso.altitud.toLocaleString('es-PE')} m` },
            { label: 'Resultado', value: resultLabel[caso.resultado!] },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '8px 12px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>{label}</div>
              <div style={{ fontSize: 17.2, fontWeight: 700, color: '#0f4a73', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: derivado ? '#fee2e2' : '#d1fae5', border: `1px solid ${derivado ? '#fca5a5' : '#6ee7b7'}`, marginBottom: 8 }}>
          <span style={{ fontSize: 13.8, fontWeight: 700, color: derivado ? '#7f1d1d' : '#065f46', fontFamily: 'Outfit, sans-serif' }}>
            {derivado ? '⚠ Derivado / requiere seguimiento' : '✓ No derivado — resultado normal'}
          </span>
        </div>
        <div style={{ padding: '3px 10px', borderRadius: 20, background: `${rColor}18`, border: `1px solid ${rColor}44`, display: 'inline-block' }}>
          <span style={{ fontSize: 12.6, fontWeight: 800, color: rColor, fontFamily: 'Outfit, sans-serif' }}>{resultLabel[caso.resultado!]}</span>
        </div>
      </div>
    </div>
  )
}

function ViewMessageModal({ mensaje, onClose }: { mensaje: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>Mensaje a enviar</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18.4, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '14px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 16.1, color: '#334155', fontFamily: 'Outfit, sans-serif', whiteSpace: 'pre-line', lineHeight: 1.6, marginBottom: 12 }}>
          {mensaje}
        </div>
        <button
          onClick={async () => { await navigator.clipboard.writeText(mensaje); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }}
          style={{ width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: '#1a6fa8', color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13.8, cursor: 'pointer' }}
        >
          {copiado ? '✓ Copiado' : '📋 Copiar mensaje'}
        </button>
      </div>
    </div>
  )
}

function AlertasScreen({ networkStatus, setNetworkStatus }: { networkStatus: NetworkStatus; setNetworkStatus: (s: NetworkStatus) => void }) {
  const { paciente, tamizajeActual } = usePatient()
  const [urgencia, setUrgencia] = useState<'alta' | 'media' | 'baja'>('alta')
  const [alertMsg, setAlertMsg] = useState('')
  const [alertSent, setAlertSent] = useState(false)
  const [historial, setHistorial] = useState<Screening[]>(mockHistory)
  const [detalle, setDetalle] = useState<Screening | null>(null)
  const [verMensaje, setVerMensaje] = useState(false)

  useEffect(() => {
    obtenerHistorial().then(data => {
      if (data.length === 0) return
      setHistorial(data.map((t, i) => ({
        id: t.id ?? `T-${i}`,
        paciente: `DNI ${t.paciente_dni}`,
        fecha: t.creado_en ? new Date(t.creado_en).toLocaleString('es-PE') : '—',
        spo2Pre: t.spo2_pre, spo2Post: t.spo2_post, altitud: t.altitud,
        resultado: t.resultado, syncStatus: t.sync_status ?? 'synced',
      })))
    })
  }, [])

  const historialConActual = tamizajeActual && paciente
    ? [{ id: 'actual', paciente: `${paciente.nombre || paciente.dni} (activo)`, fecha: 'Ahora', spo2Pre: tamizajeActual.spo2_pre, spo2Post: tamizajeActual.spo2_post, altitud: tamizajeActual.altitud, resultado: tamizajeActual.resultado, syncStatus: networkStatus === 'offline' ? 'pending' as const : 'synced' as const }, ...historial]
    : historial

  const urgenciaConfig = {
    alta: { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', label: 'URGENTE', icono: '🔴' },
    media: { color: '#ca8a04', bg: '#fef9c3', border: '#fde047', label: 'MEDIO', icono: '🟡' },
    baja: { color: '#1a6fa8', bg: '#e8f1fb', border: '#c8ddf5', label: 'INFORMATIVO', icono: '🔵' },
  }

  const sintomasActivos = (tamizajeActual?.sintomas ?? []).map(s => {
    if (s.startsWith('otro:')) return `🔸 Otro: ${s.replace('otro:', '')}`
    return `🔸 ${SINTOMAS_LABELS[s]?.icon ?? ''} ${SINTOMAS_LABELS[s]?.label ?? s}`
  })
  const edadDiasComunidad = calcularEdadDias(paciente?.fecha_nacimiento)
  const paqueteComunidad = tamizajeActual
    ? `🚨 NUEVO CASO EN RED — PRIORIDAD: ${urgenciaConfig[urgencia].icono} ${urgenciaConfig[urgencia].label}\n\n` +
      `👶 PERFIL DEL NEONATO (Anónimo)\n` +
      `Edad: ${edadDiasComunidad !== null ? `${edadDiasComunidad} días de nacido` : '—'}\n` +
      `Historial Médico: ${paciente?.historial || '—'}\n\n` +
      `🏥 DATOS DEL TAMIZAJE\n` +
      `Fecha: ${tamizajeActual.creado_en ? new Date(tamizajeActual.creado_en).toLocaleString('es-PE') : '—'}\n` +
      `Altitud: ${tamizajeActual.altitud.toLocaleString('es-PE')} msnm\n\n` +
      `📊 RESULTADOS DE OXIMETRÍA\n` +
      `✋ SpO2 Pre-ductal: ${tamizajeActual.spo2_pre}%\n` +
      `🦶 SpO2 Post-ductal: ${tamizajeActual.spo2_post}%\n` +
      `🛑 Resultado Automático: ${tamizajeActual.resultado.toUpperCase()}\n\n` +
      `🩺 EVALUACIÓN CLÍNICA\n` +
      `Síntomas Reportados:\n` +
      (sintomasActivos.length ? sintomasActivos.join('\n') : '🔸 Ninguno registrado') + `\n\n` +
      `📌 Estado Actual: ${alertMsg || '—'}`
    : 'Completa la medición para armar el paquete del caso.'

  const syncStatusConfig = {
    synced: { color: '#059669', bg: '#d1fae5', label: 'Sincronizado', icon: '✓' },
    pending: { color: '#ca8a04', bg: '#fef9c3', label: 'Pendiente', icon: '⏳' },
    failed: { color: '#dc2626', bg: '#fee2e2', label: 'Error', icon: '✕' },
  }
  const resultLabel = { negativo: 'NEGATIVO', repetir: 'REPETIR', positivo: 'POSITIVO' }
  const resultColor = { negativo: '#059669', repetir: '#ca8a04', positivo: '#dc2626' }

  const handleSendAlert = () => {
    if (!tamizajeActual) return
    setAlertSent(true)
    setTimeout(() => setAlertSent(false), 3000)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: urgenciaConfig[urgencia].color }} />
          <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>
            Red de Apoyo — Comunidad de Especialistas
          </div>
        </div>
        <div style={{ fontSize: 12.6, color: '#64748b', fontFamily: 'Outfit, sans-serif', marginBottom: 12 }}>
          Comparte el caso (sin datos identificables) con la comunidad de médicos voluntarios para recibir orientación.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['alta', 'media', 'baja'] as const).map(u => {
            const cfg = urgenciaConfig[u]
            return (
              <button key={u} onClick={() => setUrgencia(u)} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${urgencia === u ? cfg.color : '#e2e8f0'}`, background: urgencia === u ? cfg.bg : '#f8fafd', color: urgencia === u ? cfg.color : '#64748b', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 12.6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {cfg.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={alertMsg}
          onChange={e => setAlertMsg(e.target.value)}
          placeholder='Ej. "Caso 1 del día. Buen día doctores, llegó este caso, agradecería su apoyo."'
          rows={2}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: `2px solid ${alertSent ? '#6ee7b7' : '#e2e8f0'}`, background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 16.1, color: '#334155', lineHeight: 1.5, resize: 'none', outline: 'none' }}
        />
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#f8fafd', borderRadius: 10, border: '1px dashed #cbd5e1', fontSize: 13.8, color: '#64748b', fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
          {paqueteComunidad.slice(0, 90)}…
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <BigButton onClick={handleSendAlert} disabled={!tamizajeActual} color={urgenciaConfig[urgencia].color}>
            <IconAlert /> Enviar a la Comunidad
          </BigButton>
          <button onClick={() => setVerMensaje(true)} disabled={!tamizajeActual} style={{ flexShrink: 0, minHeight: 56, padding: '0 16px', borderRadius: 14, border: '2px solid #0f4a73', background: '#fff', color: '#0f4a73', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13.8, cursor: tamizajeActual ? 'pointer' : 'not-allowed', opacity: tamizajeActual ? 1 : 0.5 }}>
            👁 Ver mensaje
          </button>
        </div>
        {alertSent && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#d1fae5', borderRadius: 10, fontSize: 17.2, fontWeight: 600, color: '#065f46', fontFamily: 'Outfit, sans-serif' }}>
            ✓ Caso compartido con la red de apoyo.
          </div>
        )}
      </SectionCard>

      <div style={{ fontSize: 17.2, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', padding: '0 2px' }}>Historial de Tamizajes</div>
      {historialConActual.map(s => {
        const syncCfg = syncStatusConfig[s.syncStatus]
        const rColor = resultColor[s.resultado!]
        return (
          <div key={s.id} onClick={() => setDetalle(s)} style={{ padding: '14px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{s.paciente}</div>
                <div style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{s.altitud.toLocaleString('es-PE')} m.s.n.m. · {s.fecha}</div>
              </div>
              <div style={{ padding: '4px 10px', borderRadius: 20, background: syncCfg.bg, border: `1px solid ${s.syncStatus === 'synced' ? '#6ee7b7' : s.syncStatus === 'pending' ? '#fde047' : '#fca5a5'}`, flexShrink: 0 }}>
                <span style={{ fontSize: 12.6, fontWeight: 700, color: syncCfg.color, fontFamily: 'Outfit, sans-serif' }}>{syncCfg.icon} {syncCfg.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16.1, fontWeight: 600, color: '#0f4a73' }}>{s.spo2Pre}% Pre</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16.1, fontWeight: 600, color: '#0f4a73' }}>{s.spo2Post}% Post</span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ padding: '3px 10px', borderRadius: 20, background: `${rColor}18`, border: `1px solid ${rColor}44` }}>
                <span style={{ fontSize: 12.6, fontWeight: 800, color: rColor, fontFamily: 'Outfit, sans-serif' }}>{resultLabel[s.resultado!]}</span>
              </div>
            </div>
          </div>
        )
      })}

      {detalle && <CaseDetailModal caso={detalle} onClose={() => setDetalle(null)} />}
      {verMensaje && <ViewMessageModal mensaje={paqueteComunidad} onClose={() => setVerMensaje(false)} />}
    </div>
  )
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const [spo2, setSpo2] = useState(0)
  const [bpm, setBpm] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 1400
    const tick = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setSpo2(Math.round(ease * 96))
      setBpm(Math.round(ease * 142))
      if (t >= 1) clearInterval(tick)
    }, 30)

    const holdTimer = setTimeout(() => setPhase('hold'), 400)
    const outTimer = setTimeout(() => setPhase('out'), 2200)
    const doneTimer = setTimeout(() => onDone(), 2800)

    return () => {
      clearInterval(tick)
      clearTimeout(holdTimer)
      clearTimeout(outTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  const ecgD = 'M0,40 L30,40 L38,40 L44,10 L50,65 L56,40 L62,40 L160,40'

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0a2f4a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 0,
      opacity: phase === 'out' ? 0 : 1,
      transition: phase === 'out' ? 'opacity 0.6s ease' : 'opacity 0.4s ease',
    }}>
      <style>{`
        @keyframes ecgDraw {
          from { stroke-dashoffset: 220; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes ecgLoop {
          0%   { stroke-dashoffset: 220; opacity: 1; }
          60%  { stroke-dashoffset: 0;   opacity: 1; }
          80%  { stroke-dashoffset: 0;   opacity: 0.5; }
          100% { stroke-dashoffset: 220; opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.08); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .ecg-line {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: ecgLoop 2s ease-in-out infinite;
        }
        .splash-logo { animation: fadeUp 0.5s ease 0.1s both; }
        .splash-title { animation: fadeUp 0.5s ease 0.25s both; }
        .splash-sub   { animation: fadeUp 0.5s ease 0.4s both; }
        .splash-stats { animation: fadeUp 0.5s ease 0.55s both; }
        .splash-foot  { animation: fadeUp 0.5s ease 0.7s both; }
        .dot-blink    { animation: blink 1.2s ease-in-out infinite; }
      `}</style>

      <div className="splash-logo" style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #1a6fa8, #1d95a1)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(26,111,168,0.45)', animation: 'pulse 2.2s ease-in-out infinite' }}>
          <img src="/favicon.svg" alt="Sunqu" style={{ width: 46, height: 46 }} />
        </div>
      </div>

      <div className="splash-title" style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 34.5, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Sunqu</div>
      </div>
      <div className="splash-sub" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17.2, color: '#7bb8e8', marginBottom: 40, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.5 }}>
        Cribado de Oximetría Neonatal<br />
        <span style={{ fontSize: 12.6, color: '#4a7fa8' }}>Perú · Zonas de Alta Altitud</span>
      </div>

      <div className="splash-stats" style={{ width: 220, marginBottom: 28 }}>
        <svg width="220" height="80" viewBox="0 0 220 80" style={{ overflow: 'visible' }}>
          {[0, 20, 40, 60, 80].map(y => (
            <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(122,184,232,0.1)" strokeWidth="1" />
          ))}
          {[0, 55, 110, 165, 220].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="80" stroke="rgba(122,184,232,0.1)" strokeWidth="1" />
          ))}
          <path d={ecgD} fill="none" stroke="#1d95a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ecg-line" />
          <path d={`M${60},40 L${90},40 L${98},40 L${104},10 L${110},65 L${116},40 L${122},40 L${220},40`}
            fill="none" stroke="#1a6fa8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="ecg-line"
            style={{ animationDelay: '0.6s' }}
          />
        </svg>
      </div>

      <div className="splash-stats" style={{ display: 'flex', gap: 20, marginBottom: 48 }}>
        <div style={{ textAlign: 'center', padding: '14px 20px', background: 'rgba(26,111,168,0.15)', borderRadius: 16, border: '1px solid rgba(26,111,168,0.3)', minWidth: 90 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 32.2, fontWeight: 700, color: '#34d399' }}>
            {spo2}<span style={{ fontSize: 16.1, fontWeight: 400 }}>%</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#7bb8e8', fontFamily: 'Outfit, sans-serif', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>SpO₂</div>
        </div>
        <div style={{ textAlign: 'center', padding: '14px 20px', background: 'rgba(29,149,161,0.15)', borderRadius: 16, border: '1px solid rgba(29,149,161,0.3)', minWidth: 90 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 32.2, fontWeight: 700, color: '#60a5fa' }}>
            {bpm}<span style={{ fontSize: 16.1, fontWeight: 400 }}> bpm</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#7bb8e8', fontFamily: 'Outfit, sans-serif', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>FC</div>
        </div>
      </div>

      <div className="splash-foot" style={{ display: 'flex', alignItems: 'center', gap: 7, position: 'absolute', bottom: 36 }}>
        <div className="dot-blink" style={{ width: 6, height: 6, borderRadius: 3, background: '#34d399' }} />
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12.6, color: '#4a7fa8', letterSpacing: '0.06em' }}>
          Sistema activo · Modo sin conexión listo
        </span>
      </div>
    </div>
  )
}

function LanguageModal({ onClose }: { onClose: () => void }) {
  const [idioma, setIdioma] = useState<string>(() => localStorage.getItem('sunqu.idioma') || 'es')
  const opciones = [
    { code: 'es', label: 'Castellano', disponible: true },
    { code: 'qu', label: 'Runasimi (Quechua)', disponible: false },
    { code: 'ay', label: 'Aymar aru (Aymara)', disponible: false },
  ]
  const elegir = (code: string) => {
    setIdioma(code)
    localStorage.setItem('sunqu.idioma', code)
  }
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>Idioma / Simi</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18.4, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {opciones.map(o => (
            <button key={o.code} onClick={() => o.disponible && elegir(o.code)} disabled={!o.disponible}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 12, border: `2px solid ${idioma === o.code ? '#1a6fa8' : '#e2e8f0'}`, background: idioma === o.code ? '#e8f1fb' : '#f8fafd', cursor: o.disponible ? 'pointer' : 'not-allowed', opacity: o.disponible ? 1 : 0.6 }}>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#0f4a73', fontSize: 17.2 }}>{o.label}</span>
              {!o.disponible && <span style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Próximamente</span>}
              {idioma === o.code && o.disponible && <IconCheck size={16} />}
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', fontSize: 11.5, color: '#9a3412', fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>
          ⚠ Quechua y aymara están en preparación: una app clínica necesita que la traducción la revise un hablante nativo con formación en salud, para no arriesgar un error de interpretación en un caso real.
        </div>
      </div>
    </div>
  )
}

function FaqModal({ onClose }: { onClose: () => void }) {
  const [abierto, setAbierto] = useState<number | null>(null)
  const faqs = [
    { q: '¿Qué es el tamizaje neonatal cardiológico?', a: 'Es una prueba de oximetría de pulso que mide el SpO₂ en mano derecha (preductal) y en un pie (postductal) para detectar cardiopatías congénitas críticas antes del alta del recién nacido.' },
    { q: '¿Cuándo debo repetir la medición?', a: 'Cuando el resultado cae en el rango "Repetir" según los umbrales de altitud. Se recomienda esperar 1 hora y volver a medir; el número de reintentos permitidos depende de la altitud del establecimiento.' },
    { q: '¿Por qué los umbrales cambian según la altitud?', a: 'A mayor altitud hay menor saturación basal de oxígeno en recién nacidos sanos, por lo que los valores de corte para POSITIVO/NEGATIVO se ajustan según el nivel de altitud (baja, media o gran altitud).' },
    { q: '¿Qué significa un resultado POSITIVO?', a: 'Indica sospecha de cardiopatía congénita crítica. El bebé debe ser evaluado por cardiología de forma urgente; use la pestaña de Derivación para generar el resumen del caso.' },
    { q: '¿Cómo envío un caso a la Red de Derivación?', a: 'En la pestaña "Derivación" complete los datos faltantes indicados, y use los botones de Copiar, WhatsApp o SMS para enviar el resumen del tamizaje al centro de referencia.' },
    { q: '¿Qué hago si no tengo conexión a internet?', a: 'La app funciona offline: los tamizajes se guardan localmente y se sincronizan automáticamente cuando vuelva la conexión. El estado se muestra en la barra superior (En Línea / Sin Conexión / Sincronizando).' },
    { q: '¿Los datos del paciente son confidenciales?', a: 'Sí. El mensaje enviado a la Red de Comunidad es anónimo (sin nombre ni DNI); solo el resumen de Derivación, dirigido al establecimiento de salud, incluye datos identificables del paciente.' },
  ]
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>Preguntas Frecuentes</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18.4, color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {faqs.map((f, i) => (
            <div key={i} style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafd', overflow: 'hidden' }}>
              <button onClick={() => setAbierto(abierto === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: '#0f4a73', fontSize: 14.5 }}>{f.q}</span>
                <span style={{ color: '#7bb8e8', fontSize: 14, flexShrink: 0 }}>{abierto === i ? '▲' : '▼'}</span>
              </button>
              {abierto === i && (
                <div style={{ padding: '0 14px 12px', fontFamily: 'Outfit, sans-serif', fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('tutorial')
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online')
  const [showSplash, setShowSplash] = useState(true)
  const [medico, setMedico] = useState<Medico | null>(() => getSession())
  const [welcome, setWelcome] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showWifi, setShowWifi] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [showFaq, setShowFaq] = useState(false)

  const handleLogin = (m: Medico) => {
    setMedico(m)
    setWelcome(true)
    setTimeout(() => setWelcome(false), 1600)
  }

  const handleSplashDone = useCallback(() => setShowSplash(false), [])

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Outfit, sans-serif', position: 'relative' }}>
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        {!medico ? (
          <Login onLogin={handleLogin} />
        ) : (
          <PatientProvider medico={medico}>
            {welcome && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0f4a73', color: '#fff', animation: 'fadeIn 0.2s ease' }}>
                <span style={{ fontSize: 36.8 }}>💙</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20.7, fontWeight: 700 }}>¡Bienvenido, {medico.nombre}!</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13.8, color: '#a9d0ec' }}>{medico.establecimiento}</span>
              </div>
            )}
            <TopBar networkStatus={networkStatus} screen={screen} medico={medico} onProfileClick={() => setShowProfile(true)} onWifiClick={() => setShowWifi(true)} onSettingsClick={() => setShowLanguage(true)} onFaqClick={() => setShowFaq(true)} />
            {showWifi && (
              <WifiModal networkStatus={networkStatus} setNetworkStatus={setNetworkStatus} onClose={() => setShowWifi(false)} />
            )}
            {showProfile && (
              <ProfileModal medico={medico} onClose={() => setShowProfile(false)} onLogout={() => { clearSession(); setMedico(null); setShowProfile(false) }} />
            )}
            {showLanguage && <LanguageModal onClose={() => setShowLanguage(false)} />}
            {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
            {screen !== 'tutorial' && screen !== 'alertas' && (
              <div style={{ padding: '12px 16px 0' }}>
                <PatientPicker />
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }} key={screen}>
              {screen === 'tutorial' && <TutorialScreen onIniciarTamizaje={() => setScreen('medicion')} />}
              {screen === 'medicion' && <MedicionScreen networkStatus={networkStatus} />}
              {screen === 'paquete' && <PaqueteScreen networkStatus={networkStatus} />}
              {screen === 'derivacion' && <DerivacionScreen networkStatus={networkStatus} />}
              {screen === 'alertas' && <AlertasScreen networkStatus={networkStatus} setNetworkStatus={setNetworkStatus} />}
            </div>
            <BottomNav screen={screen} setScreen={setScreen} />
          </PatientProvider>
        )}
      </div>
    </>
  )
}
