import type { Medico } from '../lib/auth'

export default function ProfileModal({ medico, onClose, onLogout }: { medico: Medico; onClose: () => void; onLogout: () => void }) {
  const inicial = medico.nombre.trim().charAt(0).toUpperCase()
  const rows: { label: string; value: string }[] = [
    { label: 'Nombre completo', value: medico.nombre },
    { label: 'Código de doctor', value: medico.codigo },
    { label: 'Establecimiento', value: medico.establecimiento || '—' },
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#ffffff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 16, color: '#94a3b8', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 16, marginTop: -8 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a6fa8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
            {inicial}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f4a73', fontFamily: 'Outfit, sans-serif' }}>{medico.nombre}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'Outfit, sans-serif' }}>Médico</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>
          Datos Personales
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ padding: '9px 12px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Outfit, sans-serif' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f4a73', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{ width: '100%', minHeight: 46, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          ⏻ Cerrar sesión
        </button>
      </div>
    </div>
  )
}