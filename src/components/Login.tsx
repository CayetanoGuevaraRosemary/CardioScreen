import { useState } from 'react'
import { loginMedico, type Medico } from '../lib/auth'

export default function Login({ onLogin }: { onLogin: (m: Medico) => void }) {
  const [codigo, setCodigo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = codigo.trim().length >= 3 && contrasena.trim().length >= 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    const { medico, error: err } = await loginMedico(codigo, contrasena)
    setLoading(false)
    if (medico) onLogin(medico)
    else setError(err)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-clinical-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-blue-500 text-2xl">
            💙
          </div>
          <h1 className="font-sans text-xl font-bold text-clinical-blue-900">CardioScreen</h1>
          <p className="font-sans text-sm text-muted">Ingresa con tu código de doctor</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-clinical-card p-5 shadow-sm">
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-muted">
              Código de doctor *
            </label>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Ej. DR754"
              autoCapitalize="characters"
              className="w-full rounded-xl border-2 border-border bg-clinical-surface px-4 py-3 font-sans text-base text-clinical-blue-900 outline-none focus:border-clinical-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-muted">
              Contraseña *
            </label>
            <input
              value={contrasena}
              onChange={e => setContrasena(e.target.value)}
              type="password"
              placeholder="••••••"
              className="w-full rounded-xl border-2 border-border bg-clinical-surface px-4 py-3 font-sans text-base text-clinical-blue-900 outline-none focus:border-clinical-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-result-red-border bg-result-red-bg px-3 py-2 font-sans text-xs font-medium text-result-red-text">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || loading}
            className="mt-2 min-h-[52px] rounded-2xl bg-clinical-blue-500 font-sans text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-border-strong"
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
          <p className="text-center font-sans text-[11px] text-muted-light">
            Funciona sin conexión si ya iniciaste sesión antes en este dispositivo.
          </p>
        </form>
      </div>
    </div>
  )
}
