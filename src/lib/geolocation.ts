export interface AltitudResult {
  altitud: number | null
  error: string | null
}

export function obtenerAltitud(): Promise<AltitudResult> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve({ altitud: null, error: 'Este dispositivo no soporta geolocalización.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const alt = pos.coords.altitude
        if (alt === null || alt === undefined || Number.isNaN(alt)) {
          resolve({ altitud: null, error: 'El GPS no reportó altitud. Ingrésala manualmente.' })
        } else {
          resolve({ altitud: Math.round(alt), error: null })
        }
      },
      err => {
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado. Ingresa la altitud manualmente.'
          : 'No se pudo obtener la ubicación. Ingresa la altitud manualmente.'
        resolve({ altitud: null, error: msg })
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  })
}
