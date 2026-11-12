import { reglas as R } from '@/config/reglas'
import type { Localidad, Nivel, Planta, Resultado } from './semaforo'

export type NivelSanitario = 'segura' | 'hervir' | 'no_tomar'
export type Origen = 'REAL' | 'SUPUESTO' | 'SIMULADO-IoT' | 'CALCULADO'
export type Riesgo = 'Bajo' | 'Medio' | 'Alto'

export const SANITARIO_TXT: Record<NivelSanitario, string> = {
  segura: 'Segura', hervir: 'Hiérvela o clórala', no_tomar: 'No la tomes del caño',
}
/** Reutiliza los colores del semáforo (es un estado). */
export const SANITARIO_NIVEL: Record<NivelSanitario, Nivel> = { segura: 'verde', hervir: 'amarillo', no_tomar: 'rojo' }
export const SANITARIO_ICONO: Record<NivelSanitario, string> = { segura: '●', hervir: '▲', no_tomar: '■' }

/** Dengue en el departamento de Piura: REAL, CDC-MINSA, sala situacional SE43-2026. */
export const DENGUE_PIURA = {
  casos: 15716, fallecidos: 17, incidencia100k: 716,
  fuente: 'CDC-MINSA, sala situacional de dengue SE43-2026 (departamento de Piura)',
  url: 'https://www.dge.gob.pe/portal/docs/vigilancia/sala/2026/SE43/dengue.pdf',
}

/** Riesgo base de dengue por distrito: SUPUESTO hasta tener datos distritales de DIRESA. */
const DENGUE_DISTRITO: Record<string, Riesgo> = {
  'GRAU-01': 'Alto', 'GRAU-02': 'Alto', 'GRAU-05': 'Alto', 'GRAU-06': 'Alto', 'GRAU-27': 'Medio', 'GRAU-03': 'Medio',
}
const SUBE: Record<Riesgo, Riesgo> = { Bajo: 'Medio', Medio: 'Alto', Alto: 'Alto' }

export interface Valor<T> { valor: T; origen: Origen; fuente: string }
export interface Sanitario {
  nivel: NivelSanitario
  motivos: string[]
  cloro: Valor<number> // mg/L
  turbiedadRed: Valor<number> // NTU
  almacenada: Valor<boolean>
  dengue: Valor<Riesgo>
  diarrea: Valor<Riesgo>
  accionDiresa: string
}

const r1 = (x: number) => Math.round(x * 10) / 10

export function evaluarSanitario(loc: Localidad, planta: Planta, r: Resultado): Sanitario {
  const S = R.sanitario
  const corte = Math.max(loc.corteActivoH, r.corteEstimadoH)
  // Cloro residual en red (SIMULADO-IoT): baja con turbiedad de planta alta y cortes largos.
  let cloro = 1.0
  if (planta.turbiedad >= R.turbiedad.critica) cloro -= 0.7
  else if (planta.turbiedad >= R.turbiedad.alta) cloro -= 0.4
  if (corte > S.corteAlmacenamientoH) cloro -= 0.3
  if (loc.reservorioPct < R.reservorioCriticoPct) cloro -= 0.15
  cloro = r1(Math.max(0, cloro))
  // Turbiedad en red (SIMULADO-IoT): fracción de la turbiedad cruda que pasa el tratamiento.
  const turb = r1(0.6 + planta.turbiedad / 800)
  const almacenada = corte >= S.corteAlmacenamientoH || r.autonomiaH < R.autonomiaH.naranja

  const motivos: string[] = []
  let nivel: NivelSanitario = 'segura'
  if (cloro < S.cloroMinMgL) { nivel = 'hervir'; motivos.push(`Cloro residual ${cloro.toFixed(1)} mg/L (mínimo ${S.cloroMinMgL})`) }
  if (turb > S.turbiedadRedAvisoNTU) { nivel = 'hervir'; motivos.push(`Turbiedad en red ${turb.toFixed(1)} NTU`) }
  if (almacenada) { nivel = 'hervir'; motivos.push('Agua almacenada por corte prolongado') }
  if (cloro < S.cloroCriticoMgL || turb > S.turbiedadRedMaxNTU || loc.fallaConfirmada) {
    nivel = 'no_tomar'
    if (loc.fallaConfirmada) motivos.push('Falla confirmada en la infraestructura')
  }

  const dBase = DENGUE_DISTRITO[loc.id] ?? 'Medio'
  const dengue = almacenada ? SUBE[dBase] : dBase
  const diarrea: Riesgo = nivel === 'no_tomar' ? 'Alto' : nivel === 'hervir' ? 'Medio' : 'Bajo'

  const accionDiresa = nivel === 'no_tomar'
    ? 'Vigilancia activa de EDA y dengue; muestreo de laboratorio con la EPS en 24 h; reparto de cloro y mensajes de hervir el agua.'
    : nivel === 'hervir'
      ? 'Reforzar vigilancia de EDA en menores de 5 años; control larvario en recipientes; difundir hervir o clorar.'
      : 'Vigilancia rutinaria de EDA y dengue.'

  return {
    nivel, motivos: [...new Set(motivos)],
    cloro: { valor: cloro, origen: 'SIMULADO-IoT', fuente: 'Sensor en red simulado, derivado del escenario' },
    turbiedadRed: { valor: turb, origen: 'SIMULADO-IoT', fuente: `Derivada de la turbiedad de ${planta.nombre}` },
    almacenada: { valor: almacenada, origen: 'CALCULADO', fuente: 'Motor del semáforo (horas de corte y autonomía)' },
    dengue: { valor: dengue, origen: 'SUPUESTO', fuente: `Por distrito, supuesto. Contexto REAL: ${DENGUE_PIURA.casos.toLocaleString('es-PE')} casos en Piura (${DENGUE_PIURA.fuente})` },
    diarrea: { valor: diarrea, origen: 'SUPUESTO', fuente: 'Supuesto: sube con agua no segura' },
    accionDiresa,
  }
}

export function consejosSanitarios(s: Sanitario): string[] {
  if (s.nivel === 'segura') return ['Guarda el agua en recipientes limpios y tapados.']
  return [
    s.nivel === 'no_tomar' ? 'No la tomes del caño: hiérvela 1 minuto o usa 2 gotas de lejía por litro y espera 30 min.' : 'Hiérvela o clórala antes de tomarla.',
    'Tapa los recipientes: evita el zancudo del dengue.',
    'Si un niño tiene diarrea, vómitos o mucha sed, dale suero y llévalo al centro de salud.',
  ]
}
