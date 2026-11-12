import type { Nivel } from '@/lib/semaforo'

export interface Series {
  generado: string
  notas: Record<string, string>
  localidades: Record<string, string>
  umbrales_piura: { amarillo: number; naranja: number; rojo: number }
  lluvia_mensual: ({ mes: string } & Record<string, number | string | null>)[]
  caudal_semanal: { semana: string; piura?: number | null; chira?: number | null }[]
  nino12_semanal: [string, number | null][]
  oni_mensual: [string, number | null][]
}

export type NivelRiesgo = 'Muy bajo' | 'Bajo' | 'Medio' | 'Alto' | 'Muy alto'
export interface DistritoProps {
  ubigeo: string; distrito: string; provincia: string; nivel: NivelRiesgo; riesgo_inundacion: string
  poblacion: number; viviendas: number; pobreza_pct: number; eess_expuestos: number; eess_total: number
}
export interface RiesgoGeo {
  type: 'FeatureCollection'
  features: { type: 'Feature'; properties: DistritoProps; geometry: GeoJSON.Geometry }[]
}

export type CatInfra = 'hospital' | 'clinica' | 'consultorio' | 'tanque' | 'reservorio' | 'planta' | 'planta_residual'
export interface Infra { fuente: string; elementos: { id: string; cat: CatInfra; nombre: string | null; operador: string | null; lat: number; lon: number }[] }

export interface PuntoCritico {
  capa: 'punto_critico' | 'ipress_afectada'; lat: number; lon: number; nombre: string | null; distrito: string | null
  rio?: string; peligro?: string; nivel_peligro?: string; actividad?: string; costo?: number; poblacion?: string
  categoria?: string; estado?: string; temporada?: string
}
export interface Puntos { fuente: string; puntos: PuntoCritico[] }

export interface EventoN2 {
  umbral_nino12: number; umbral_caudal: number; anio_hidrologico: string; primera_alerta: string | null
  primer_dia_caudal_sobre_umbral: string | null; dias_sobre_umbral: number; caudal_max: number; nino12_max: number
  anticipacion_dias: number | null; anticipacion_semanas: number | null; anticipacion_meses: number | null; resultado: string
}
export interface MetricaN2 { umbral_nino12: number; aciertos: number; eventos_no_anticipados: number; falsas_alarmas: number; correctos_negativos: number; POD: number; FAR: number }
export interface AnalisisN2 {
  fuente: string; eventos: EventoN2[]; metricas: MetricaN2[]
  desfases: Record<string, string | number | null>[]
  dias_umbral: { fecha: number; amarilla_900: number; naranja_1290: number; roja_1900: number; caudal_max: number }[]
  nino_vs_resto: Record<string, string | number | null>[]
}

export interface P { p10: number; p50: number; p90: number }
export interface GemeloLoc {
  id: string; nombre: string; rio: string
  distrito_cenepred: { niv_sinu: string; pob_2017: number; pobreza_pct: number }
  supuestos_eps: { poblacion_servida: number; demanda_m3h: number; produccion_m3h: number; volumen_reservorios_m3: number }
  mc_autonomia_rojo_h: P; mc_autonomia_naranja_h: P
  dia_peor: string; semaforo_peor: Nivel; cisternas_condicional_max: number
}
export interface Gemelo { AVISO: string; pronostico_generado: string; localidades: GemeloLoc[] }

export interface FilaDespacho {
  prioridad: number; puntaje: number; nombre: string; tipo: string; categoria: string | null; fuente: string
  ipress_afectada: boolean; localidad: string; distrito: string; niv_sinu: string; pobreza_pct: number
  lat: number; lon: number; km_desde_base: number; demanda_m3d: number; asignado_m3d: number; viajes_dia: number; cubierto: string
}
export interface Despacho {
  aviso: string; despacho: FilaDespacho[]
  rutas: {
    metodo: string; AVISO: string; base: [number, number]; km_total: number; m3_total: number; cisternas_usadas: number; viajes_usados: number
    viajes: { viaje: number; km: number; m3: number; cisterna: number; paradas: { prioridad: number; nombre: string; tipo: string; lat: number; lon: number; m3: number }[] }[]
  }
}

export interface Catalogo {
  generado: string
  fuentes: { fuente: string; tabla: string; filas: number; fecha_min: string | null; fecha_max: string | null; metodo: string; licencia_url: string; estado: string }[]
}

export interface DiaPron { fecha: string; nivel: Nivel; p_amarillo: number; p_naranja: number; p_rojo: number; caudal_mediana: number; caudal_p90: number; lluvia_mediana: number | null; lluvia_p90: number | null }
export interface LocPron { id: string; nombre: string; rio: string; rio_nombre: string; dias: DiaPron[]; dia_critico: string | null; nivel_max: Nivel }
export interface Pronostico {
  generado: string
  enfen: { comunicado: string; fecha: string; estado: string; magnitud: string; url: string }
  nino: { ultimas: { semana: string; nino12_anom: number; nino34_anom: number }[] }
  prob_decision: number
  rios: Record<string, { nombre: string; umbrales: Record<string, number>; tipo_umbral: string }>
  lluvia_umbrales: Record<string, number>
  fuentes: { nombre: string; variable: string; url: string }[]
  localidades: LocPron[]
}

export const RIESGO_ORDEN: NivelRiesgo[] = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto']
/** Escala secuencial de brand (NO semáforo). */
export const RIESGO_COLOR: Record<NivelRiesgo, string> = {
  'Muy bajo': '#f3eef9', Bajo: '#d0c9f6', Medio: '#9d93f0', Alto: '#6d61eb', 'Muy alto': '#1d1b3a',
}
