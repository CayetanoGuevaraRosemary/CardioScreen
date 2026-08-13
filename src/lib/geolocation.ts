export interface AltitudResult {
  altitud: number | null
  error: string | null
}

async function altitudPorCoordenadas(lat: number, lng: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
    if (!res.ok) return null
    const data = await res.json()
    const alt = data?.results?.[0]?.elevation
    return typeof alt === 'number' ? Math.round(alt) : null
  } catch {
    return null
  }
}

export function obtenerAltitud(): Promise<AltitudResult> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve({ altitud: null, error: 'Este dispositivo no soporta geolocalización.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const gpsAlt = pos.coords.altitude
        if (gpsAlt !== null && gpsAlt !== undefined && !Number.isNaN(gpsAlt) && gpsAlt > -400) {
          resolve({ altitud: Math.round(gpsAlt), error: null })
          return
        }
        const porCoordenadas = await altitudPorCoordenadas(pos.coords.latitude, pos.coords.longitude)
        if (porCoordenadas !== null) {
          resolve({ altitud: porCoordenadas, error: null })
        } else {
          resolve({ altitud: null, error: 'No se pudo calcular la altitud para esta ubicación. Ingrésala manualmente.' })
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