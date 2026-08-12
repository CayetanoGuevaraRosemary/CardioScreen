import { useEffect, useRef, useState } from 'react'

type StepId = 'preparar' | 'mano' | 'pie' | 'confirmar'
type Signal = 'inestable' | 'estabilizando' | 'estable'

const STEP_ORDER: StepId[] = ['preparar', 'mano', 'pie', 'confirmar']
const STEP_LABEL: Record<StepId, string> = {
  preparar: 'Preparar',
  mano: 'Mano derecha',
  pie: 'Pie',
  confirmar: 'Confirmar',
}

function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-clinical-blue-100 text-[10px] font-bold text-clinical-blue-600"
        aria-label="Más información"
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 top-6 z-10 w-48 -translate-x-1/2 rounded-lg border border-border bg-clinical-card p-2 text-left text-xs font-normal text-slate-600 shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

function ProgressBar({ current }: { current: StepId }) {
  const idx = STEP_ORDER.indexOf(current)
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-clinical-blue-500 transition-all duration-300"
          style={{ width: `${((idx + 1) / STEP_ORDER.length) * 100}%` }}/>
      </div>
      <div className="flex w-full justify-between gap-2 font-sans text-[11px] font-semibold">
        {STEP_ORDER.map((s, i) => (
          <span 
            key={s} 
            className={i <= idx ? 'text-clinical-blue-600' : 'text-muted-light'}
          >
            {i + 1}. {STEP_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  )
}

//PASO1
function PasoPreparar({ onListo }: { onListo: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    estable: false, movimiento: false, piel: false, luz: false,
  })
  const items: { key: string; label: string; info?: string }[] = [
    { key: 'estable', label: 'Recién nacido estable' },
    { key: 'movimiento', label: 'Poco movimiento' },
    { key: 'piel', label: 'Piel tibia y bien perfundida', info: 'Una mala perfusión puede dificultar la obtención de una señal confiable.' },
    { key: 'luz', label: 'Sin luz directa sobre el sensor', info: 'La luz externa puede interferir con algunos sensores.' },
  ]
  const allChecked = Object.values(checks).every(Boolean)

  useEffect(() => { if (allChecked) onListo() }, [allChecked, onListo])

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-sm leading-relaxed text-slate-600">
        Antes de medir, verifica que el recién nacido esté estable y que las condiciones permitan obtener una señal confiable.
      </p>
      <div className="flex flex-col gap-2">
        {items.map(({ key, label, info }) => (
          <label
            key={key}
            className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${checks[key] ? 'border-result-green-border bg-result-green-bg' : 'border-border bg-clinical-surface'}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checks[key]}
              onChange={e => setChecks(c => ({ ...c, [key]: e.target.checked }))}
            />
            <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-white ${checks[key] ? 'border-result-green-solid bg-result-green-solid' : 'border-border-strong bg-white'}`}>
              {checks[key] && '✓'}
            </span>
            <span className={`font-sans text-sm font-medium ${checks[key] ? 'text-result-green-text' : 'text-slate-700'}`}>
              {label}
              {info && <InfoDot text={info} />}
            </span>
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-clinical-blue-100 bg-clinical-blue-50 px-3 py-2 font-sans text-xs font-medium text-clinical-blue-700">
        💡 Una medición confiable empieza antes de colocar el sensor.
      </div>
    </div>
  )
}

//PASO2 Y 3
function PasoSensor({ tipo, onListo }: { tipo: 'mano' | 'pie'; onListo: () => void }) {
  const [colocado, setColocado] = useState(false)
  useEffect(() => { if (colocado) onListo() }, [colocado, onListo])

  const isMano = tipo === 'mano'
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-sm leading-relaxed text-slate-600">
        {isMano
          ? 'Coloca el sensor en la mano derecha siguiendo las indicaciones del dispositivo.'
          : 'Coloca el sensor en uno de los pies siguiendo las indicaciones del dispositivo.'}
      </p>

      <div className="flex flex-col items-center gap-2 rounded-2xl bg-clinical-bg p-5">
        <svg width="140" height="110" viewBox="0 0 160 120">
          {isMano ? (
            <>
              <rect x="55" y="40" width="50" height="60" rx="10" fill="#fde8d8" stroke="#c97a5b" strokeWidth="2" />
              {[60, 74, 88, 102].map((x, i) => (
                <rect key={i} x={x} y={16 + i * 2} width="14" height="32" rx="7" fill="#fde8d8" stroke="#c97a5b" strokeWidth="1.5" />
              ))}
              <rect x="36" y="50" width="22" height="14" rx="7" fill="#fde8d8" stroke="#c97a5b" strokeWidth="1.5" />
              <rect x="34" y="48" width="26" height="18" rx="6" fill="#1a6fa8" className="animate-pulse" />
              <rect x="38" y="52" width="18" height="10" rx="4" fill="#7bb8e8" opacity="0.7" />
            </>
          ) : (
            <>
              <ellipse cx="80" cy="75" rx="38" ry="28" fill="#fde8d8" stroke="#c97a5b" strokeWidth="2" />
              {[-24, -12, 0, 12, 22].map((ox, i) => (
                <ellipse key={i} cx={80 + ox} cy={48} rx={i === 0 ? 7 : 5} ry={i === 0 ? 9 : 7} fill="#fde8d8" stroke="#c97a5b" strokeWidth="1.5" />
              ))}
              <ellipse cx="80" cy="82" rx="22" ry="14" fill="#1d95a1" className="animate-pulse" />
              <ellipse cx="80" cy="82" rx="14" ry="8" fill="#7dd3dc" opacity="0.7" />
            </>
          )}
        </svg>
        <div className="font-sans text-sm font-bold text-clinical-blue-700">
          {isMano ? '🖐️ MANO DERECHA' : '🦶 PIE'}
        </div>
        <div className="font-sans text-xs text-muted">
          {isMano ? 'Medición PREductal' : 'Medición POSTductal'}
          <InfoDot text={isMano ? 'La mano derecha corresponde a la medición preductal.' : 'El pie corresponde a la medición postductal.'} />
        </div>
      </div>

      <label className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${colocado ? 'border-result-green-border bg-result-green-bg' : 'border-border bg-clinical-surface'}`}>
        <input type="checkbox" className="sr-only" checked={colocado} onChange={e => setColocado(e.target.checked)} />
        <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-white ${colocado ? 'border-result-green-solid bg-result-green-solid' : 'border-border-strong bg-white'}`}>
          {colocado && '✓'}
        </span>
        <span className={`font-sans text-sm font-medium ${colocado ? 'text-result-green-text' : 'text-slate-700'}`}>Sensor colocado</span>
      </label>
    </div>
  )
}

// PASO4
function PasoConfirmar({ onFinalizar }: { onFinalizar: () => void }) {
  const [signal, setSignal] = useState<Signal>('inestable')
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    const t1 = setTimeout(() => setSignal('estabilizando'), 2500)
    const t2 = setTimeout(() => setSignal('estable'), 5500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, [])

  const config: Record<Signal, { emoji: string; label: string; msg: string; color: string; bg: string; border: string }> = {
    inestable: { emoji: '🔴', label: 'INESTABLE', msg: 'No registrar todavía.', color: 'text-result-red-text', bg: 'bg-result-red-bg', border: 'border-result-red-border' },
    estabilizando: { emoji: '🟡', label: 'ESTABILIZANDO', msg: 'Espera y observa la señal.', color: 'text-result-yellow-text', bg: 'bg-result-yellow-bg', border: 'border-result-yellow-border' },
    estable: { emoji: '🟢', label: 'ESTABLE', msg: 'Lectura lista para registrar.', color: 'text-result-green-text', bg: 'bg-result-green-bg', border: 'border-result-green-border' },
  }
  const c = config[signal]

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-sm leading-relaxed text-slate-600">
        Espera hasta que la lectura sea estable antes de registrar el valor.
      </p>

      <div className={`flex flex-col items-center gap-2 rounded-2xl border-2 ${c.border} ${c.bg} p-5`}>
        <span className="text-3xl">{c.emoji}</span>
        <span className={`font-sans text-sm font-bold tracking-wide ${c.color}`}>{c.label}</span>
        <svg width="140" height="36" viewBox="0 0 140 36" className={c.color}>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={
              signal === 'estable'
                ? '0,18 20,18 28,4 36,32 44,18 140,18'
                : signal === 'estabilizando'
                ? '0,18 15,10 30,24 45,12 60,20 75,18 140,18'
                : '0,18 10,4 20,30 30,8 40,26 50,6 60,22 70,12 80,28 90,10 100,20 140,15'
            }
          />
        </svg>
        <span className={`font-sans text-xs font-medium ${c.color}`}>{c.msg}</span>
      </div>

      <div className="flex items-center justify-center gap-2 font-sans text-xs text-muted-light">
        <span>⏱ {seconds}s</span>
        <span>· El tiempo es orientativo, no una regla fija</span>
      </div>

      {signal === 'estable' ? (
        <button
          onClick={onFinalizar}
          className="min-h-[52px] rounded-2xl bg-clinical-blue-500 font-sans text-base font-semibold text-white"
        >
          ✓ Señal estable — Continuar
        </button>
      ) : (
        <div className="rounded-xl border border-clinical-blue-100 bg-clinical-blue-50 px-3 py-2 text-center font-sans text-xs font-medium text-clinical-blue-700">
          ⚠️ Ajusta el sensor y vuelve a comprobar si la señal no mejora.
        </div>
      )}
    </div>
  )
}

// GUIA RAPIDA
function GuiaRapida({ onSeleccionar, onCerrar }: { onSeleccionar: (s: StepId) => void; onCerrar: () => void }) {
  const items: { id: StepId; icon: string; label: string }[] = [
    { id: 'preparar', icon: '📋', label: 'Preparar' },
    { id: 'mano', icon: '🖐️', label: 'Mano derecha (PREductal)' },
    { id: 'pie', icon: '🦶', label: 'Pie (POSTductal)' },
    { id: 'confirmar', icon: '✅', label: 'Confirmar señal estable' },
  ]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-bold uppercase tracking-wide text-clinical-blue-600">📖 Guía rápida</span>
        <button onClick={onCerrar} className="font-sans text-xs font-semibold text-muted">Cerrar ✕</button>
      </div>
      <p className="font-sans text-xs text-muted">Selecciona un paso para verlo de inmediato, sin repetir todo el tutorial.</p>
      <div className="flex flex-col gap-2">
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onSeleccionar(it.id)}
            className="flex min-h-[52px] items-center gap-3 rounded-xl border border-border bg-clinical-surface px-4 py-3 text-left font-sans text-sm font-medium text-clinical-blue-900"
          >
            <span className="text-lg">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TutorialScreen({ onIniciarTamizaje }: { onIniciarTamizaje?: () => void }) {
  const [step, setStep] = useState<StepId>('preparar')
  const [ready, setReady] = useState<Record<StepId, boolean>>({ preparar: false, mano: false, pie: false, confirmar: false })
  const [showGuia, setShowGuia] = useState(false)
  const [terminado, setTerminado] = useState(false)

  const idx = STEP_ORDER.indexOf(step)
  const isLast = idx === STEP_ORDER.length - 1

  const marcarListo = (s: StepId) => setReady(r => ({ ...r, [s]: true }))
  const siguiente = () => { if (!isLast) setStep(STEP_ORDER[idx + 1]) }
  const anterior = () => { if (idx > 0) setStep(STEP_ORDER[idx - 1]) }

  if (showGuia) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <GuiaRapida
          onCerrar={() => setShowGuia(false)}
          onSeleccionar={s => { setStep(s); setShowGuia(false); setTerminado(false) }}
        />
      </div>
    )
  }

  if (terminado) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-result-green-border bg-result-green-bg p-6 text-center">
          <span className="text-3xl">✓</span>
          <span className="font-sans text-base font-bold text-result-green-text">Tamizaje listo</span>
          <p className="font-sans text-xs leading-relaxed text-result-green-text">
            NeoAlerta utilizará tus mediciones junto con la altitud y la información clínica para orientar el nivel de riesgo.
          </p>
        </div>
        <button
          onClick={onIniciarTamizaje}
          className="min-h-[52px] rounded-2xl bg-clinical-blue-500 font-sans text-base font-semibold text-white"
        >
          Comenzar tamizaje →
        </button>
        <button
          onClick={() => setShowGuia(true)}
          className="min-h-[44px] rounded-2xl border border-border font-sans text-sm font-semibold text-clinical-blue-600"
        >
          📖 Abrir guía rápida
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <ProgressBar current={step} />
      </div>
      <button
        onClick={() => setShowGuia(true)}
        className="self-start font-sans text-xs font-semibold text-clinical-blue-600"
      >
        📖 Guía rápida
      </button>

      <div className="rounded-2xl border border-border bg-clinical-card p-4 shadow-sm">
        <div className="mb-1 font-sans text-xs font-bold uppercase tracking-wide text-clinical-blue-600">
          Paso {idx + 1}
        </div>
        <div className="mb-3 font-sans text-lg font-bold text-clinical-blue-900">
          {step === 'preparar' && 'Preparar al recién nacido'}
          {step === 'mano' && 'Medición PREductal'}
          {step === 'pie' && 'Medición POSTductal'}
          {step === 'confirmar' && 'Confirmar una señal estable'}
        </div>

        {step === 'preparar' && <PasoPreparar onListo={() => marcarListo('preparar')} />}
        {step === 'mano' && <PasoSensor tipo="mano" onListo={() => marcarListo('mano')} />}
        {step === 'pie' && <PasoSensor tipo="pie" onListo={() => marcarListo('pie')} />}
        {step === 'confirmar' && <PasoConfirmar onFinalizar={() => setTerminado(true)} />}
      </div>

      {step !== 'confirmar' && (
        <div className="flex gap-2">
          {idx > 0 && (
            <button onClick={anterior} className="min-h-[52px] flex-1 rounded-2xl border-2 border-border bg-clinical-surface font-sans text-sm font-semibold text-slate-600">
              ← Anterior
            </button>
          )}
          <button
            onClick={siguiente}
            disabled={!ready[step]}
            className="min-h-[52px] flex-1 rounded-2xl bg-clinical-blue-500 font-sans text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-border-strong"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
