export interface ProcedimientoNotif {
  id: string
  titulo: string
  resumen: string
  pasos: string[]
}

const PROCEDIMIENTOS: Record<string, ProcedimientoNotif> = {
  alprostadil: {
    id: 'alprostadil', titulo: 'Infusión de Alprostadil (Prostaglandina E1)', resumen: 'Mantiene el ductus arterioso permeable en cardiopatías ductus-dependientes',
    pasos: [
      'Indicado ante sospecha de cardiopatía congénita crítica ductus-dependiente (cianosis, pulsos débiles/ausentes o soplo con mala perfusión).',
      'Inicie infusión EV continua en vía exclusiva; dosis inicial habitual 0.01–0.05 mcg/kg/min, ajustando según respuesta.',
      'Vigile apnea, hipotensión y fiebre; tenga listo equipo de intubación durante el traslado.',
      'No suspenda la infusión hasta confirmar el diagnóstico en el centro de referencia.',
    ],
  },
  congestion: {
    id: 'congestion', titulo: 'Manejo de Congestión / Taquipnea', resumen: 'FC >160 lpm o signos de congestión pulmonar',
    pasos: [
      'Medicamento: Furosemida.',
      'Administre por vía endovenosa (EV) lenta.',
      'Efecto: disminuye la precarga cardíaca, aliviando el edema pulmonar por cortocircuito izquierda-derecha.',
    ],
  },
  inotropico: {
    id: 'inotropico', titulo: 'Soporte Inotrópico', resumen: 'Shock o mala perfusión distal (llenado capilar >3s, piel moteada, hipotensión)',
    pasos: [
      'Medicamento: Dobutamina.',
      'Administre en infusión continua por una vía endovenosa exclusiva.',
      'Evite Dopamina a dosis altas en la altura: aumenta marcadamente la resistencia vascular pulmonar.',
    ],
  },
  oxigeno: {
    id: 'oxigeno', titulo: 'Oxigenoterapia (Reglas de Altura)', resumen: 'El oxígeno es un medicamento; el exceso es dañino',
    pasos: [
      'Evite el oxígeno al 100%: es vasoconstrictor del ductus arterioso y puede cerrarlo, causando colapso cardiovascular.',
      'Meta de saturación 75–85% en cardiopatía cianótica (>3,000 m s.n.m.); no suba a 90–95%.',
      'Administre O2 solo si SatO2 <70%, idealmente con blender a puntas nasales o casco cefálico, al mínimo flujo necesario.',
      'Si hay dificultad respiratoria moderada-severa, use CPAP nasal (4–5 cmH2O) con FiO2 mínima; evite presiones altas.',
    ],
  },
  monitorizacion: {
    id: 'monitorizacion', titulo: 'Monitorización', resumen: 'Oximetría pre/postductal horaria y posición de traslado',
    pasos: [
      'Coloque sensor en mano derecha (preductal) y pie (postductal); registre cada hora.',
      'Diferencia >3% entre ambos confirma el diagnóstico estructural.',
      'Posición Semifowler durante el traslado (cabecera a 30°) para mejorar la capacidad pulmonar.',
    ],
  },
  vigilancia: {
    id: 'vigilancia', titulo: 'Vigilancia Clínica', resumen: 'Síntoma adicional reportado: observe evolución',
    pasos: [
      'Reevalúe cada 30–60 min: color, frecuencia respiratoria, perfusión y pulsos.',
      'Ante empeoramiento o nuevo signo de alarma, escale el caso de inmediato.',
      'Documente hallazgos para el equipo de referencia.',
    ],
  },
  traslado: {
    id: 'traslado', titulo: 'Logística de Traslado', resumen: 'Prepare la maleta de transporte antes de la ambulancia',
    pasos: [
      'Ambú neonatal con mascarillas tamaño 0 y 1.',
      'Tubos endotraqueales N° 3.0 y 3.5, laringoscopio con hojas rectas 00, 0 y 1 (posible apnea con Prostaglandina).',
      'Baterías cargadas en las bombas de infusión portátiles.',
      'Balones de oxígeno para el trayecto total más 50% de reserva por retrasos.',
    ],
  },
}

const SINTOMA_PROCEDIMIENTOS: Record<string, string[]> = {
  cianosis: ['alprostadil', 'oxigeno'],
  taquipnea: ['oxigeno', 'congestion'],
  soplo: ['alprostadil', 'monitorizacion'],
  pulsos_debiles: ['alprostadil', 'inotropico'],
  dificultad_resp: ['oxigeno', 'inotropico'],
  otro: ['vigilancia'],
}

export function getProcedimientosPorSintomas(sintomas: string[]): ProcedimientoNotif[] {
  const ids: string[] = []
  for (const s of sintomas) {
    const key = s.startsWith('otro') ? 'otro' : s
    for (const id of SINTOMA_PROCEDIMIENTOS[key] ?? []) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  if (ids.length) ids.push('traslado')
  return ids.map(id => PROCEDIMIENTOS[id])
}
