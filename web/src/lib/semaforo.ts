import { reglas as R } from '@/config/reglas'

export type Nivel = 'verde' | 'amarillo' | 'naranja' | 'rojo'
const ORDEN: Nivel[] = ['verde', 'amarillo', 'naranja', 'rojo']
const max = (a: Nivel, b: Nivel) => (ORDEN.indexOf(a) >= ORDEN.indexOf(b) ? a : b)

/** Condiciones de la amenaza, comunes a toda la región. */
export interface Amenaza {
  caudalSanchezCerro: number // m³/s
  lluvia24h: number // mm
  avisoSenamhi: Nivel
  alertaEnfen: boolean
}

/** Estado de una planta (turbiedad compartida por las localidades que abastece). */
export interface Planta {
  id: string
  nombre: string
  turbiedad: number // NTU
}

export interface Localidad {
  id: string
  nombre: string
  lat: number
  lng: number
  plantaId: string
  conexiones: number
  personasPorConexion: number
  dotacionLhd: number // litros por habitante por día
  volumenReservoriosM3: number
  produccionM3h: number
  dependePozos: boolean
  // Lecturas (sensor o supuesto)
  reservorioPct: number
  energiaOk: boolean
  corteActivoH: number // horas de corte en curso (0 si no hay)
  fallaConfirmada: boolean
  vulnerabilidad: number // 0 a 1 (índice de DS08)
  hogaresSinRedPct: number
  menores5Pct: number
  sinInternetPct: number
  puntoApoyo: string
}

export interface Resultado {
  nivel: Nivel
  ruta: string
  causas: string[]
  autonomiaH: number // Infinity si la producción cubre la demanda
  corteEstimadoH: number
  deficitH: number
  deficitM3: number
  cisternas: number
  poblacion: number
  acciones: string[]
  confianza: 'alta' | 'media' | 'baja'
}

export function evaluar(loc: Localidad, planta: Planta, a: Amenaza): Resultado {
  const causas: string[] = []
  const poblacion = loc.conexiones * loc.personasPorConexion
  const demandaM3h = ((poblacion * loc.dotacionLhd) / 1000 / 24) * (1 + R.perdidasRed)

  // 1. Producción disponible según turbiedad y energía
  let factor = 1
  if (planta.turbiedad >= R.turbiedad.critica) factor -= R.perdidaProduccion.turbiedadCritica
  else if (planta.turbiedad >= R.turbiedad.alta) factor -= R.perdidaProduccion.turbiedadAlta
  if (!loc.energiaOk && loc.dependePozos) factor -= R.perdidaProduccion.sinEnergia
  if (loc.fallaConfirmada) factor = 0
  const produccion = loc.produccionM3h * Math.max(0, factor)

  // 2. Autonomía: horas que dura el agua almacenada con el faltante actual
  const almacenado = loc.volumenReservoriosM3 * (loc.reservorioPct / 100)
  const faltante = demandaM3h - produccion
  const autonomiaH = faltante <= 0 ? Infinity : almacenado / faltante

  // 3. Duración probable del corte según la causa más grave
  let corteEstimadoH = loc.corteActivoH
  if (a.caudalSanchezCerro >= R.caudal.rojo) corteEstimadoH = Math.max(corteEstimadoH, R.duracionCorteH.captacion)
  if (planta.turbiedad >= R.turbiedad.critica) corteEstimadoH = Math.max(corteEstimadoH, R.duracionCorteH.turbiedad)
  if (loc.fallaConfirmada) corteEstimadoH = Math.max(corteEstimadoH, R.duracionCorteH.linea)
  if (!loc.energiaOk) corteEstimadoH = Math.max(corteEstimadoH, R.duracionCorteH.energia)

  const autonomiaFinita = Number.isFinite(autonomiaH) ? autonomiaH : 9999
  const deficitH = Math.max(0, corteEstimadoH - autonomiaFinita)
  const deficitM3 = deficitH * demandaM3h
  const cisternas = Math.ceil(
    (deficitM3 * R.cisterna.fraccionPrioritaria) / (R.cisterna.capacidadM3 * R.cisterna.viajesPorDia),
  )

  // 4. Nivel por tres rutas; se toma el más severo
  let nivel: Nivel = 'verde'
  let ruta = 'Condiciones normales'

  // Amarillo
  if (a.alertaEnfen) { nivel = max(nivel, 'amarillo'); causas.push('Alerta ENFEN vigente') }
  if (a.caudalSanchezCerro >= R.caudal.amarillo) { nivel = max(nivel, 'amarillo'); causas.push(`Río Piura en ${a.caudalSanchezCerro} m³/s`) }
  if (a.avisoSenamhi === 'amarillo') { nivel = max(nivel, 'amarillo'); causas.push('Aviso amarillo de SENAMHI') }
  if (autonomiaFinita < R.autonomiaH.amarillo && corteEstimadoH > 0) nivel = max(nivel, 'amarillo')

  // Naranja
  const amenazaAlta =
    a.caudalSanchezCerro >= R.caudal.naranja || a.lluvia24h >= R.lluvia24h.naranja ||
    a.avisoSenamhi === 'naranja' || a.avisoSenamhi === 'rojo'
  if (amenazaAlta) { nivel = max(nivel, 'naranja'); ruta = 'Amenaza alta pronosticada' }
  if (a.lluvia24h >= R.lluvia24h.naranja) causas.push(`Lluvia de ${a.lluvia24h} mm en 24 h`)
  if (a.avisoSenamhi === 'naranja' || a.avisoSenamhi === 'rojo') causas.push(`Aviso ${a.avisoSenamhi} de SENAMHI`)
  if (planta.turbiedad >= R.turbiedad.alta) { nivel = max(nivel, 'naranja'); causas.push(`Turbiedad de ${planta.turbiedad} NTU en ${planta.nombre}`) }
  if (autonomiaFinita < R.autonomiaH.naranja && corteEstimadoH > 0) nivel = max(nivel, 'naranja')
  if (nivel === 'amarillo' && loc.vulnerabilidad >= R.vulnerabilidadAlta) {
    nivel = 'naranja'; ruta = 'Naranja preventivo por vulnerabilidad alta'; causas.push('Zona de vulnerabilidad alta')
  }
  if (!loc.energiaOk) causas.push('Corte de energía en pozos o bombeo')
  if (loc.reservorioPct < R.reservorioCriticoPct) causas.push(`Reservorio al ${loc.reservorioPct} %`)

  // Rojo anticipado: amenaza severa + sensor crítico, o autonomía < 24 h con corte previsto
  const sensorCritico = planta.turbiedad >= R.turbiedad.alta || loc.reservorioPct < R.reservorioCriticoPct || !loc.energiaOk
  if ((a.caudalSanchezCerro >= R.caudal.rojo || a.avisoSenamhi === 'rojo') && sensorCritico) {
    nivel = 'rojo'; ruta = 'Rojo anticipado: pronóstico severo + sensor crítico'
  }
  if (autonomiaFinita < R.autonomiaH.rojo && corteEstimadoH > autonomiaFinita) {
    nivel = 'rojo'; ruta = 'Rojo anticipado: menos de 24 h de agua'
  }
  // Rojo inmediato: falla confirmada
  if (loc.fallaConfirmada || loc.corteActivoH > 24 || planta.turbiedad >= R.turbiedad.critica) {
    nivel = 'rojo'; ruta = 'Rojo inmediato: falla confirmada'
    if (loc.fallaConfirmada) causas.push('Falla confirmada en la infraestructura')
    if (loc.corteActivoH > 24) causas.push(`Corte activo de ${loc.corteActivoH} h`)
  }
  if (nivel !== 'verde' && ruta === 'Condiciones normales') ruta = 'Señales de riesgo en aumento'

  const confianza: Resultado['confianza'] = loc.volumenReservoriosM3 > 0 ? 'media' : 'baja'

  return {
    nivel, ruta, causas: [...new Set(causas)], autonomiaH, corteEstimadoH,
    deficitH, deficitM3, cisternas, poblacion, acciones: accionesPara(nivel), confianza,
  }
}

export function accionesPara(nivel: Nivel): string[] {
  switch (nivel) {
    case 'verde': return ['Monitoreo normal', 'Mantenimiento preventivo']
    case 'amarillo': return ['Verificar niveles de reservorios', 'Revisar el plan de contingencia', 'Recomendar guardar agua en recipientes tapados']
    case 'naranja': return ['Preposicionar cisternas', 'Llenar reservorios al máximo', 'Avisar a hogares vulnerables y centros de salud', 'Reforzar control de calidad del agua']
    case 'rojo': return ['Activar puntos de reparto de agua segura', 'Despachar cisternas: hospitales primero', 'Coordinar con COE, INDECI y DIRESA', 'Emitir alerta ciudadana (SISMATE vía COE)']
  }
}

export const fmtHoras = (h: number) =>
  !Number.isFinite(h) || h > 999 ? 'Más de 72 h' : `${Math.round(h)} h`
