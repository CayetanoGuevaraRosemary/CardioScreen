import { useState, useEffect, useRef, useCallback } from 'react'
import TutorialScreen from './components/TutorialScreen'
import Login from './components/Login'
import PatientPicker from './components/PatientPicker'
import ProfileModal from './components/ProfileModal'
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

function TopBar({ networkStatus, screen, medico, onProfileClick }: { networkStatus: NetworkStatus; screen: Screen; medico?: Medico | null; onProfileClick?: () => void }) {
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16.1, lineHeight: 1.1, fontFamily: 'Outfit, sans-serif' }}>CardioScreen</div>
          <div style={{ color: '#7bb8e8', fontSize: 12.6, lineHeight: 1.1, fontFamily: 'Outfit, sans-serif' }}>{titles[screen]}</div>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
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
          style={{ marginLeft: 8, width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 13.8, fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {medico.nombre.trim().charAt(0).toUpperCase()}
        </button>
      )}
    </div>
  )
}

function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const items: { key: Screen; label: string; Icon: React.ComponentType<{ active?: boolean }> }[] = [
    { key: 'tutorial', label: 'Tutorial', Icon: IconTutorial },
    { key: 'medicion', label: 'Medición', Icon: IconMedicion },
    { key: 'paquete', label: 'Paquete', Icon: IconPaquete },
    { key: 'derivacion', label: 'Red', Icon: IconDerivacion },
    { key: 'alertas', label: 'Alertas', Icon: IconAlertas },
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
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: 500, color: '#64748b' }}>m.s.n.m.</span>
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
          <div style={{ fontSize: 15, fontWeight: 700, color: tierBanner.text, fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>{tierBanner.label}</div>
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
            <span style={{ fontSize: 15, fontWeight: 600, color: diff > 3 ? '#7f1d1d' : '#475569', fontFamily: 'Outfit, sans-serif' }}>Diferencial Pre–Post</span>
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
                <div style={{ fontSize: 15, color: cfg.text, opacity: 0.8, fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{cfg.sub}</div>
              </div>
            </div>
            {result === 'repetir' && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#713f12', fontFamily: 'Outfit, sans-serif' }}>Intento N°:</span>
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

      {result === 'positivo' && (
        <div style={{ padding: '14px 16px', background: '#fee2e2', borderRadius: 14, border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#7f1d1d', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>⚠ Caso grave — siga estos pasos:</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {getInstrucciones('positivo').map((inst, i) => (
              <li key={i} style={{ fontSize: 13.8, color: '#7f1d1d', fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>{inst}</li>
            ))}
          </ul>
        </div>
      )}

      {!result && (
        <div style={{ padding: '12px 16px', background: '#f8fafd', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 15, color: '#64748b', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
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
  const { paciente, setPaciente, tamizajeActual } = usePatient()
  const [sintomas, setSintomas] = useState<Record<string, boolean>>({
    cianosis: false, taquipnea: false, soplo: false, pulsos_debiles: false, dificultad_resp: false,
  })
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'queued'>('idle')

  const sitomasList = [
    { key: 'cianosis', label: 'Cianosis central', icon: '🔵' },
    { key: 'taquipnea', label: 'Taquipnea (FR > 60/min)', icon: '💨' },
    { key: 'soplo', label: 'Soplo cardíaco audible', icon: '🩺' },
    { key: 'pulsos_debiles', label: 'Pulsos débiles o ausentes', icon: '💓' },
    { key: 'dificultad_resp', label: 'Dificultad respiratoria', icon: '⚠' },
  ]

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
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{value}</div>
              ) : (
                <input
                  value={String(value)}
                  onChange={e => setPaciente({ ...paciente, [key]: e.target.value } as Paciente)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 15, fontWeight: 600, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', outline: 'none', padding: 0 }}
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
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: sintomas[key] ? '#fee2e2' : '#f8fafd', borderRadius: 12, border: `2px solid ${sintomas[key] ? '#fca5a5' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${sintomas[key] ? '#dc2626' : '#cbd5e1'}`, background: sintomas[key] ? '#dc2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sintomas[key] && <IconCheck size={14} color="#fff" />}
              </div>
              <input type="checkbox" style={{ display: 'none' }} checked={sintomas[key]} onChange={e => setSintomas(s => ({ ...s, [key]: e.target.checked }))} />
              <span style={{ fontSize: 16.1 }}>{icon}</span>
              <span style={{ fontSize: 16.1, fontWeight: 500, color: sintomas[key] ? '#7f1d1d' : '#334155', fontFamily: 'Outfit, sans-serif' }}>{label}</span>
            </label>
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
          Síntomas: {Object.entries(sintomas).filter(([, v]) => v).map(([k]) => k).join(', ') || 'Ninguno registrado'}
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

function DerivacionScreen({ networkStatus }: { networkStatus: NetworkStatus }) {
  const { paciente, tamizajeActual, medico } = usePatient()
  const diff = tamizajeActual ? Math.abs(tamizajeActual.spo2_pre - tamizajeActual.spo2_post) : null
  const [editableText, setEditableText] = useState('')

  useEffect(() => {
    if (!tamizajeActual) {
      setEditableText('Aún no hay una medición para este paciente. Ve a la pestaña Medición primero.')
      return
    }
    setEditableText(
      `Se deriva a ${paciente?.nombre || 'recién nacido'} (DNI ${paciente?.dni ?? '—'}) con resultado ${tamizajeActual.resultado.toUpperCase()} en oximetría de pulso. ` +
`SpO2 preductal: ${tamizajeActual.spo2_pre}%, postductal: ${tamizajeActual.spo2_post}%. Diferencial: ${diff}%. Altitud: ${tamizajeActual.altitud.toLocaleString('es-PE')} m.s.n.m. ` +
      (tamizajeActual.resultado === 'positivo' ? 'Se solicita evaluación cardiológica urgente.' : 'Se solicita evaluación e interconsulta.')
    )
  }, [tamizajeActual, paciente])

  const [copiado, setCopiado] = useState(false)
  const handleCopiar = async () => {
    await navigator.clipboard.writeText(editableText)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }
  const handleSMS = () => {
    window.location.href = `sms:?&body=${encodeURIComponent(editableText)}`
  }
  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(editableText)}`, '_blank')
  }
  const handlePDF = () => {
    const doc = new jsPDF()
    const azul: [number, number, number] = [15, 74, 115]
    const grisTexto: [number, number, number] = [30, 41, 59]
    const grisLabel: [number, number, number] = [148, 163, 184]
    const grisLinea: [number, number, number] = [226, 232, 240]
    const mx = 20
    const w = 210
    let y = 0

    doc.setFillColor(...azul)
    doc.rect(0, 0, w, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Hoja de Referencia Clínica', mx, 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('CardioScreen — Tamizaje Neonatal Cardiaco', mx, 18)
    const caso = tamizajeActual?.id ? tamizajeActual.id.slice(0, 8).toUpperCase() : 'S/N'
    doc.text(`Caso N° ${caso}  ·  ${new Date().toLocaleString('es-PE')}`, w - mx, 18, { align: 'right' })

    y = 34
    const seccion = (titulo: string) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...azul)
      doc.text(titulo.toUpperCase(), mx, y)
      y += 3
      doc.setDrawColor(...grisLinea)
      doc.line(mx, y, w - mx, y)
      y += 8
    }
    const campo = (label: string, valor: string) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...grisLabel)
      doc.text(label.toUpperCase(), mx, y)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...grisTexto)
      doc.text(valor || '—', mx, y)
      y += 9
    }

    seccion('Establecimientos')
    campo('Origen', paciente?.establecimiento || medico?.establecimiento || '—')
    campo('Referencia', 'Establecimiento con capacidad resolutiva (ver Red de Derivación)')

    seccion('Identificación del Paciente')
    campo('Nombre', paciente?.nombre || 'Recién nacido')
    campo('DNI', paciente?.dni || '—')
    campo('Edad gestacional', paciente?.edad_gestacional || '—')

    seccion('Resultado del Tamizaje')
    if (tamizajeActual) { 
      const mitad = mx + (w - 2 * mx) / 2
      const yInicio = y
      campo('SpO2 Preductal (mano derecha)', `${tamizajeActual.spo2_pre}%`)
      const yFinCol1 = y
     y = yInicio
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grisLabel)
      doc.text('SPO2 POSTDUCTAL (PIE)', mitad, y)
      y += 5
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...grisTexto)
      doc.text(`${tamizajeActual.spo2_post}%`, mitad, y)
      y = Math.max(yFinCol1, y + 9)
      campo('Diferencial', `${Math.abs(tamizajeActual.spo2_pre - tamizajeActual.spo2_post)}%`)
      campo('Altitud del establecimiento', `${tamizajeActual.altitud.toLocaleString('es-PE')} m.s.n.m.`)
      campo('Clasificación', tamizajeActual.resultado.toUpperCase())
    } else {
      campo('Clasificación', 'Sin medición registrada')
    }

    seccion('Motivo de Referencia')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...grisTexto)
    const lineas = doc.splitTextToSize(editableText, w - 2 * mx)
    doc.text(lineas, mx, y)
    y += lineas.length * 5.5 + 14

    doc.setDrawColor(...grisLinea)
    doc.line(mx, y, w - mx, y)
    y += 6
    doc.setFontSize(7.5)
    doc.setTextColor(...grisLabel)
    doc.text('Documento generado por CardioScreen · Es un apoyo a la decisión clínica, no reemplaza la evaluación del establecimiento receptor.', mx, y, { maxWidth: w - 2 * mx })

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }



  const facilities = [
    { name: 'Hospital Regional Huancavelica', dist: '12 km', time: '25 min', status: 'Disponible', urgencia: 'alta', phone: '+51 67 452 890' },
    { name: 'HRDLM Huancayo', dist: '48 km', time: '1h 10min', status: 'Disponible', urgencia: 'media', phone: '+51 64 231 456' },
    { name: 'Hospital Arzobispo Loayza', dist: '280 km', time: '5h', status: 'Referencia Nacional', urgencia: 'baja', phone: '+51 1 411 7700' },
  ]

  const specialists = [
    { name: 'Dr. Carlos Quispe', specialty: 'Cardiología Pediátrica', status: 'disponible', phone: '+51 987 654 321' },
    { name: 'Dra. María Flores', specialty: 'Neonatología', status: 'disponible', phone: '+51 976 543 210' },
    { name: 'Dr. Jorge Lima', specialty: 'Cardiología Pediátrica', status: 'no_disponible', phone: '+51 965 432 109' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'Outfit, sans-serif' }}>
          Documento de Derivación
        </div>
        <div style={{ padding: '4px 0 8px', fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Edite el texto de ser necesario:</div>
        <textarea
          value={editableText}
          onChange={e => setEditableText(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 15, color: '#334155', lineHeight: 1.6, resize: 'vertical', outline: 'none' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#1a6fa8' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleCopiar} style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1px solid #c8ddf5', background: '#e8f1fb', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
          <button onClick={handlePDF} style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1px solid #c8ddf5', background: '#e8f1fb', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            📄 PDF / Imprimir
          </button>
          <button onClick={handleSMS} style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1px solid #c8ddf5', background: '#e8f1fb', color: '#155d8f', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            💬 SMS
          </button>
          <button onClick={handleWhatsApp} style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            🟢 WhatsApp
          </button>
        </div>
      </SectionCard>

      {tamizajeActual?.resultado === 'positivo' && (
        <div style={{ padding: '14px 16px', background: '#fee2e2', borderRadius: 14, border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#7f1d1d', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>⚠ Caso grave — instrucciones</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {getInstrucciones('positivo').map((inst, i) => (
              <li key={i} style={{ fontSize: 13.8, color: '#7f1d1d', fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>{inst}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', padding: '0 2px' }}>Establecimientos Cercanos</div>
      {facilities.map((f, i) => (
        <div key={i} style={{ padding: '14px', background: '#fff', borderRadius: 14, border: `2px solid ${f.urgencia === 'alta' ? '#6ee7b7' : '#e2e8f0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{f.name}</div>
              <div style={{ fontSize: 13.8, color: '#64748b', marginTop: 3, fontFamily: 'Outfit, sans-serif' }}>
                📍 {f.dist} · 🕐 {f.time}
              </div>
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 20, background: f.urgencia === 'alta' ? '#d1fae5' : f.urgencia === 'media' ? '#fef9c3' : '#f1f5f9', border: `1px solid ${f.urgencia === 'alta' ? '#6ee7b7' : f.urgencia === 'media' ? '#fde047' : '#e2e8f0'}` }}>
              <span style={{ fontSize: 12.6, fontWeight: 700, color: f.urgencia === 'alta' ? '#065f46' : f.urgencia === 'media' ? '#713f12' : '#64748b', fontFamily: 'Outfit, sans-serif' }}>{f.status}</span>
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <a href={`tel:${f.phone}`} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#0f4a73', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15 }}>
              <IconPhone /> Llamar
            </a>
            <button style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '2px solid #0f4a73', background: '#fff', color: '#0f4a73', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              <IconMessage /> Mensaje
            </button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', padding: '4px 2px 0' }}>Especialistas de Guardia</div>
      {specialists.map((s, i) => (
        <div key={i} style={{ padding: '14px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: s.status === 'disponible' ? '#d1fae5' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${s.status === 'disponible' ? '#6ee7b7' : '#e2e8f0'}` }}>
            <span style={{ fontSize: 23 }}>👨‍⚕️</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
            <div style={{ fontSize: 13.8, color: '#64748b', fontFamily: 'Outfit, sans-serif' }}>{s.specialty}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: s.status === 'disponible' ? '#059669' : '#94a3b8' }} />
              <span style={{ fontSize: 12.6, color: s.status === 'disponible' ? '#059669' : '#94a3b8', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                {s.status === 'disponible' ? 'Disponible' : 'No disponible'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <a href={`tel:${s.phone}`} style={{ width: 40, height: 40, borderRadius: 10, background: s.status === 'disponible' ? '#0f4a73' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: s.status === 'disponible' ? '#fff' : '#94a3b8' }}>
              <IconPhone />
            </a>
            <button style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${s.status === 'disponible' ? '#0f4a73' : '#e2e8f0'}`, background: '#fff', color: s.status === 'disponible' ? '#0f4a73' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: s.status === 'disponible' ? 'pointer' : 'not-allowed' }}>
              <IconMessage />
            </button>
          </div>
        </div>
      ))}

      <div style={{ padding: '14px 16px', background: '#fef9c3', borderRadius: 14, border: '1px solid #fde047' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#713f12', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>⚠ Teleconsulta de Respaldo</div>
        <div style={{ fontSize: 15, color: '#713f12', marginBottom: 10, fontFamily: 'Outfit, sans-serif', opacity: 0.85 }}>
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

function AlertasScreen({ networkStatus, setNetworkStatus }: { networkStatus: NetworkStatus; setNetworkStatus: (s: NetworkStatus) => void }) {
  const { paciente, tamizajeActual, medico } = usePatient()
  const [urgencia, setUrgencia] = useState<'alta' | 'media' | 'baja'>('alta')
  const [alertMsg, setAlertMsg] = useState('')
  const [autoSync, setAutoSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [alertSent, setAlertSent] = useState(false)
  const [historial, setHistorial] = useState<Screening[]>(mockHistory)

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

  const handleSync = () => {
    if (networkStatus === 'offline') return
    setSyncing(true)
    setNetworkStatus('syncing')
    setTimeout(() => {
      setSyncing(false)
      setNetworkStatus('online')
    }, 2500)
  }

  const handleSendAlert = () => {
    if (!alertMsg.trim()) return
    setAlertSent(true)
    generarReciboPDF()
    setTimeout(() => setAlertSent(false), 3000)
    setAlertMsg('')
  }

  const generarReciboPDF = () => {
    const doc = new jsPDF({ format: 'a5' })
    const azul: [number, number, number] = [15, 74, 115]
    const grisTexto: [number, number, number] = [30, 41, 59]
    const grisLabel: [number, number, number] = [148, 163, 184]
    const mx = 12
    const w = 148
    let y = 0

    doc.setFillColor(...azul)
    doc.rect(0, 0, w, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('CardioScreen', mx, 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Comprobante de Notificación de Alerta', mx, 18)

    y = 33
    const campo = (label: string, valor: string) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...grisLabel)
      doc.text(label.toUpperCase(), mx, y)
      y += 4.5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...grisTexto)
      doc.text(valor || '—', mx, y)
      y += 8
    }

    campo('Fecha', new Date().toLocaleString('es-PE'))
    campo('Paciente', paciente?.nombre || 'Recién nacido')
    campo('DNI', paciente?.dni || '—')
    if (tamizajeActual) {
      campo('SpO2 Preductal / Postductal', `${tamizajeActual.spo2_pre}% / ${tamizajeActual.spo2_post}%`)
      campo('Clasificación', tamizajeActual.resultado.toUpperCase())
    }
    campo('Urgencia', urgenciaConfig[urgencia].label)
    campo('Profesional', medico?.nombre || '—')

    doc.setDrawColor(226, 232, 240)
    doc.line(mx, y, w - mx, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...grisLabel)
    doc.text('MENSAJE', mx, y)
    y += 5
    doc.setFontSize(10)
    doc.setTextColor(...grisTexto)
    const lineas = doc.splitTextToSize(alertMsg, w - 2 * mx)
    doc.text(lineas, mx, y)
    y += lineas.length * 5

    doc.setFontSize(7)
    doc.setTextColor(...grisLabel)
    doc.text('Documento generado automáticamente por CardioScreen — válido como constancia de envío.', mx, 195, { maxWidth: w - 2 * mx })

    window.open(doc.output('bloburl'), '_blank')
  }

  const urgenciaConfig = {
    alta: { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', label: 'URGENTE' },
    media: { color: '#ca8a04', bg: '#fef9c3', border: '#fde047', label: 'MEDIO' },
    baja: { color: '#1a6fa8', bg: '#e8f1fb', border: '#c8ddf5', label: 'INFORMATIVO' },
  }

  const syncStatusConfig = {
    synced: { color: '#059669', bg: '#d1fae5', label: 'Sincronizado', icon: '✓' },
    pending: { color: '#ca8a04', bg: '#fef9c3', label: 'Pendiente', icon: '⏳' },
    failed: { color: '#dc2626', bg: '#fee2e2', label: 'Error', icon: '✕' },
  }

  const resultLabel = { negativo: 'NEGATIVO', repetir: 'REPETIR', positivo: 'POSITIVO' }
  const resultColor = { negativo: '#059669', repetir: '#ca8a04', positivo: '#dc2626' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
          Compositor de Alerta
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['alta', 'media', 'baja'] as const).map(u => {
            const cfg = urgenciaConfig[u]
            return (
              <button key={u} onClick={() => setUrgencia(u)} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${urgencia === u ? cfg.color : '#e2e8f0'}`, background: urgencia === u ? cfg.bg : '#f8fafd', color: urgencia === u ? cfg.color : '#64748b', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 12.6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.15s' }}>
                {cfg.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={alertMsg}
          onChange={e => setAlertMsg(e.target.value)}
          placeholder="Escriba el mensaje de alerta..."
          rows={3}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: `2px solid ${alertSent ? '#6ee7b7' : '#e2e8f0'}`, background: '#f8fafd', fontFamily: 'Outfit, sans-serif', fontSize: 16.1, color: '#334155', lineHeight: 1.5, resize: 'none', outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = urgenciaConfig[urgencia].color }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
        />
        {!alertMsg.trim() && !alertSent && (
          <div style={{ marginTop: 6, fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Campo requerido para enviar alerta.</div>
        )}
        <BigButton onClick={handleSendAlert} disabled={!alertMsg.trim()} color={urgenciaConfig[urgencia].color} style={{ marginTop: 10 }}>
          <IconAlert /> Enviar Alerta {urgenciaConfig[urgencia].label}
        </BigButton>
        {alertSent && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#d1fae5', borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#065f46', fontFamily: 'Outfit, sans-serif' }}>
            ✓ Alerta enviada exitosamente.
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div style={{ fontSize: 13.8, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
          Estado de Sincronización
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '12px 14px', background: '#f8fafd', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', fontFamily: 'Outfit, sans-serif' }}>Sincronización automática</div>
            <div style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>Sincroniza cuando hay conexión disponible</div>
          </div>
          <div
            onClick={() => setAutoSync(a => !a)}
            style={{ width: 52, height: 28, borderRadius: 14, background: autoSync ? '#1a6fa8' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 3, left: autoSync ? 27 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Pendientes', value: String(historialConActual.filter(h => h.syncStatus === 'pending').length), color: '#ca8a04' },
            { label: 'Fallidos', value: String(historialConActual.filter(h => h.syncStatus === 'failed').length), color: '#dc2626' },
            { label: 'Sincronizados', value: String(historialConActual.filter(h => h.syncStatus === 'synced').length), color: '#059669' },
            { label: 'Total registros', value: String(historialConActual.length), color: '#1a6fa8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '10px 12px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 25.3, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 12.6, color: '#64748b', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <BigButton onClick={handleSync} disabled={networkStatus === 'offline' || syncing} color="#1a6fa8">
          <IconSync /> {syncing ? 'Sincronizando...' : networkStatus === 'offline' ? 'Sin conexión' : 'Sincronizar Ahora'}
        </BigButton>

        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f1f5f9', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12.6, color: '#64748b', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>Simular red:</span>
          {(['online', 'offline'] as const).map(s => (
            <button key={s} onClick={() => { if (!syncing) setNetworkStatus(s) }} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${networkStatus === s ? (s === 'online' ? '#059669' : '#dc2626') : '#e2e8f0'}`, background: networkStatus === s ? (s === 'online' ? '#d1fae5' : '#fee2e2') : '#fff', color: networkStatus === s ? (s === 'online' ? '#059669' : '#dc2626') : '#64748b', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 12.6, cursor: 'pointer' }}>
              {s === 'online' ? '📶 En línea' : '📵 Sin conexión'}
            </button>
          ))}
        </div>
      </SectionCard>

      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', padding: '0 2px' }}>Historial de Tamizajes</div>
      {historialConActual.map(s => {
        const syncCfg = syncStatusConfig[s.syncStatus]
        const rColor = resultColor[s.resultado!]
        return (
          <div key={s.id} style={{ padding: '14px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16.1, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{s.paciente}</div>
                <div style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{s.id} · {s.fecha}</div><div style={{ fontSize: 12.6, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{s.altitud.toLocaleString('es-PE')} m.s.n.m. · {s.fecha}</div>              </div>
              <div style={{ padding: '4px 10px', borderRadius: 20, background: syncCfg.bg, border: `1px solid ${s.syncStatus === 'synced' ? '#6ee7b7' : s.syncStatus === 'pending' ? '#fde047' : '#fca5a5'}`, flexShrink: 0 }}>
                <span style={{ fontSize: 12.6, fontWeight: 700, color: syncCfg.color, fontFamily: 'Outfit, sans-serif' }}>
                  {syncCfg.icon} {syncCfg.label}
                </span>
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
      </div>

      <div className="splash-title" style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 34.5, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>CardioScreen</div>
      </div>
      <div className="splash-sub" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, color: '#7bb8e8', marginBottom: 40, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.5 }}>
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

export default function App() {
  const [screen, setScreen] = useState<Screen>('tutorial')
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online')
  const [showSplash, setShowSplash] = useState(true)
  const [medico, setMedico] = useState<Medico | null>(() => getSession())
  const [welcome, setWelcome] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

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
            <TopBar networkStatus={networkStatus} screen={screen} medico={medico} onProfileClick={() => setShowProfile(true)} />
            {showProfile && (
              <ProfileModal
                medico={medico}
                onClose={() => setShowProfile(false)}
                onLogout={() => { clearSession(); setMedico(null); setShowProfile(false) }}
              />
            )}
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
