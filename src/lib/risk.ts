export type Resultado = 'negativo' | 'repetir' | 'positivo'

export function getInstrucciones(resultado: Resultado): string[] {
  switch (resultado) {
    case 'positivo':
      return [
        'No dar de alta al recién nacido sin evaluación especializada.',
        'Realizar examen físico dirigido: soplos, pulsos, PA en 4 extremidades.',
        'Active la referencia inmediata al establecimiento con mayor capacidad.',
        'Si hay signos de shock o cianosis, inicie manejo de emergencia según protocolo local mientras se coordina el traslado.',
      ]
    case 'repetir':
      return [
        'Repita la medición hasta 3 veces, con al menos 1 hora entre cada intento (proceso total: hasta 3 horas).',
        'Mantenga al bebé tranquilo, tibio y bien perfundido entre cada toma.',
        'Si algún resultado posterior es limítrofe o peor, trátelo como positivo.',
        'Observe signos clínicos de alarma mientras espera.',
      ]
    default:
      return [
        'Resultado normal. Continúe con los controles habituales del recién nacido.',
        'Un tamizaje negativo no descarta todas las cardiopatías: mantenga vigilancia clínica.',
      ]
  }
}
