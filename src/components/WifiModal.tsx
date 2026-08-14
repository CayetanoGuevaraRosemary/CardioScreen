import { useEffect, useState } from 'react'
import { obtenerHistorial } from '../lib/tamizajes'

type NetworkStatus = 'online' | 'offline' | 'syncing'

export default function WifiModal({
  networkStatus, setNetworkStatus, onClose,
}: {
  networkStatus: NetworkStatus
  setNetworkStatus: (s: NetworkStatus) => void
  onClose: () => void
}) {
  const [autoSync, setAutoSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [counts, setCounts] = useState({ pending: 0, failed: 0, synced: 0, total: 0 })

  useEffect(() => {
    obtenerHistorial().then(data => {
      setCounts({
        pending: data.filter(t => t.sync_status === 'pending').length,
        failed: data.filter(t => t.sync_status === 'failed').length,
        synced: data.filter(t => t.sync_status === 'synced').length,
        total: data.length,
      })
    })
  }, [])

  const handleSync = () => {
    if (networkStatus === 'offline') return
    setSyncing(true)
    setNetworkStatus('syncing')
    setTimeout(() => {
      setSyncing(false)
      setNetworkStatus('online')
      setCounts(c => ({ ...c, pending: 0, synced: c.synced + c.pending }))
    }, 2000)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(15,74,115,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#ffffff', borderRadius: 18, padding: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a6fa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Outfit, sans-serif' }}>
            Estado de Sincronización
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 16, color: '#94a3b8', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '12px 14px', background: '#f8fafd', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Outfit, sans-serif' }}>Sincronización automática</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>Sincroniza cuando hay conexión disponible</div>
          </div>
          <div
            onClick={() => setAutoSync(a => !a)}
            style={{ width: 44, height: 24, borderRadius: 12, background: autoSync ? '#1a6fa8' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 3, left: autoSync ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Pendientes', value: counts.pending, color: '#ca8a04' },
            { label: 'Fallidos', value: counts.failed, color: '#dc2626' },
            { label: 'Sincronizados', value: counts.synced, color: '#059669' },
            { label: 'Total registros', value: counts.total, color: '#1a6fa8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '10px 12px', background: '#f8fafd', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSync}
          disabled={networkStatus === 'offline' || syncing}
          style={{ width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: networkStatus === 'offline' ? '#cbd5e1' : '#1a6fa8', color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13, cursor: networkStatus === 'offline' ? 'not-allowed' : 'pointer' }}
        >
          {syncing ? 'Sincronizando…' : networkStatus === 'offline' ? 'Sin conexión' : '🔄 Sincronizar Ahora'}
        </button>

        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f1f5f9', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>Simular red:</span>
          {(['online', 'offline'] as const).map(s => (
            <button
              key={s}
              onClick={() => { if (!syncing) setNetworkStatus(s) }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${networkStatus === s ? (s === 'online' ? '#059669' : '#dc2626') : '#e2e8f0'}`, background: networkStatus === s ? (s === 'online' ? '#d1fae5' : '#fee2e2') : '#fff', color: networkStatus === s ? (s === 'online' ? '#059669' : '#dc2626') : '#64748b', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
            >
              {s === 'online' ? '📶 En línea' : '📵 Sin conexión'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}