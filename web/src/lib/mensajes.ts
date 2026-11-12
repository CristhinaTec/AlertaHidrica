import type { Localidad, Resultado } from './semaforo'
import { fmtHoras } from './semaforo'
import type { Sanitario } from './sanitario'

export const NIVEL_TXT = { verde: 'NORMAL', amarillo: 'ATENCIÓN', naranja: 'PRECAUCIÓN', rojo: 'EMERGENCIA' } as const
export const NIVEL_ICONO = { verde: '●', amarillo: '▲', naranja: '◆', rojo: '■' } as const

const horasCiudadano = (h: number) =>
  !Number.isFinite(h) || h > 72 ? 'más de 3 días' : h >= 24 ? `unos ${Math.round(h / 24)} día(s)` : `unas ${Math.max(1, Math.round(h))} horas`

export function correoDecisores(loc: Localidad, r: Resultado) {
  const asunto = `[${r.nivel.toUpperCase()}] ${loc.nombre}: autonomía ${fmtHoras(r.autonomiaH)}, corte previsto ${Math.round(r.corteEstimadoH)} h`
  const cuerpo = [
    `${NIVEL_TXT[r.nivel]} en ${loc.nombre} (${loc.id})`,
    '',
    `Por qué: ${r.causas.join('; ') || 'sin señales de riesgo'}.`,
    `Ruta de activación: ${r.ruta}.`,
    '',
    `En cifras: autonomía ${fmtHoras(r.autonomiaH)} · corte previsto ${Math.round(r.corteEstimadoH)} h · déficit ${Math.round(r.deficitH)} h (${Math.round(r.deficitM3).toLocaleString('es-PE')} m³) · ${r.poblacion.toLocaleString('es-PE')} personas · ${r.cisternas} cisternas para población prioritaria.`,
    '',
    'Acciones recomendadas:',
    ...r.acciones.map((a, i) => `${i + 1}. ${a}`),
    '',
    'Confirme recepción respondiendo 1. Sin confirmación en 2 h, el aviso escala a Sunass y al COE.',
    'Fuentes: SENAMHI, ENFEN, datos de la EPS. DATOS SIMULADOS (prototipo).',
  ].join('\n')
  return { asunto, cuerpo }
}

export function smsCiudadano(loc: Localidad, r: Resultado, s?: Pick<Sanitario, 'nivel'>) {
  const insegura = s ? s.nivel !== 'segura' : r.nivel === 'rojo'
  const hierve = insegura ? ' Agua no segura: hiérvela o clórala.' : ''
  if (r.nivel === 'verde') return `AguaSegura ${loc.nombre}: servicio normal.${hierve || ' Cuide el agua.'}`
  const base = `${NIVEL_TXT[r.nivel]} ${loc.nombre}: tu zona tiene agua para ${horasCiudadano(r.autonomiaH)}.${hierve}`
  if (r.nivel === 'amarillo') return `${base} Guarda agua en recipientes limpios y tapados.`
  if (r.nivel === 'naranja') return `${base} Guarda agua tapada y elimina agua estancada (dengue). Apoyo: ${loc.puntoApoyo}.`
  return `${base} Reparto: ${loc.puntoApoyo}. Fiebre o diarrea: acude al centro de salud.`
}

export function sismate(loc: Localidad) {
  return `ALERTA ROJA AGUA ${loc.nombre.toUpperCase()}: interrupción prolongada del agua potable. Use solo agua segura. Punto de reparto: ${loc.puntoApoyo}. Siga indicaciones de su municipalidad.`
}

export function consejosCiudadano(nivel: Resultado['nivel']): string[] {
  switch (nivel) {
    case 'verde': return ['Cuida el agua y revisa fugas en casa.']
    case 'amarillo': return ['Guarda agua en recipientes limpios y tapados.', 'Mantente atenta a nuevos avisos.']
    case 'naranja': return ['Guarda agua para 2 o 3 días, siempre tapada.', 'Elimina agua estancada en baldes, llantas y macetas.', 'Usa repelente: el agua acumulada atrae al zancudo del dengue.']
    case 'rojo': return ['Usa solo agua segura: hiérvela o clórala.', 'Acude al punto de reparto indicado.', 'Si hay fiebre o diarrea, ve al centro de salud.']
  }
}
