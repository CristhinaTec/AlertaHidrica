import type { Amenaza, Localidad, Planta } from '@/lib/semaforo'

/**
 * DATOS SIMULADOS para la demostración.
 * - Conexiones: muestra DS01/DS02 del expediente (simulada).
 * - Volúmenes, producción, dotación y lecturas: SUPUESTOS editables hasta obtener datos de EPS Grau.
 * - Coordenadas: centro aproximado de cada ciudad.
 */

const base: Omit<Localidad, 'reservorioPct' | 'energiaOk' | 'corteActivoH' | 'fallaConfirmada'>[] = [
  { id: 'GRAU-01', nombre: 'Piura', lat: -5.1945, lng: -80.6328, plantaId: 'curumuy', conexiones: 61797, personasPorConexion: 4, dotacionLhd: 150, volumenReservoriosM3: 60000, produccionM3h: 2250, dependePozos: true, vulnerabilidad: 0.45, hogaresSinRedPct: 10, menores5Pct: 21, sinInternetPct: 20, puntoApoyo: 'Plaza de Armas de Piura' },
  { id: 'GRAU-02', nombre: 'Castilla', lat: -5.1990, lng: -80.6080, plantaId: 'curumuy', conexiones: 25582, personasPorConexion: 4, dotacionLhd: 150, volumenReservoriosM3: 18000, produccionM3h: 930, dependePozos: true, vulnerabilidad: 0.62, hogaresSinRedPct: 15, menores5Pct: 24, sinInternetPct: 27, puntoApoyo: 'Estadio de Castilla' },
  { id: 'GRAU-05', nombre: 'Veintiséis de Octubre', lat: -5.1810, lng: -80.6720, plantaId: 'curumuy', conexiones: 30000, personasPorConexion: 4, dotacionLhd: 140, volumenReservoriosM3: 20000, produccionM3h: 1050, dependePozos: true, vulnerabilidad: 0.66, hogaresSinRedPct: 18, menores5Pct: 25, sinInternetPct: 30, puntoApoyo: 'Parque Central de Veintiséis de Octubre' },
  { id: 'GRAU-06', nombre: 'Sullana', lat: -4.9039, lng: -80.6853, plantaId: 'sullana', conexiones: 31427, personasPorConexion: 4, dotacionLhd: 150, volumenReservoriosM3: 26000, produccionM3h: 1150, dependePozos: true, vulnerabilidad: 0.52, hogaresSinRedPct: 12, menores5Pct: 22, sinInternetPct: 25, puntoApoyo: 'Plaza de Armas de Sullana' },
  { id: 'GRAU-27', nombre: 'Paita', lat: -5.0892, lng: -81.1144, plantaId: 'arenal', conexiones: 15056, personasPorConexion: 4, dotacionLhd: 140, volumenReservoriosM3: 9000, produccionM3h: 520, dependePozos: false, vulnerabilidad: 0.58, hogaresSinRedPct: 14, menores5Pct: 23, sinInternetPct: 28, puntoApoyo: 'Municipalidad de Paita' },
  { id: 'GRAU-03', nombre: 'Talara', lat: -4.5772, lng: -81.2719, plantaId: 'arenal', conexiones: 16400, personasPorConexion: 4, dotacionLhd: 140, volumenReservoriosM3: 11000, produccionM3h: 560, dependePozos: false, vulnerabilidad: 0.48, hogaresSinRedPct: 9, menores5Pct: 20, sinInternetPct: 22, puntoApoyo: 'Municipalidad de Talara' },
]

export const plantasBase: Planta[] = [
  { id: 'curumuy', nombre: 'PTAP Curumuy', turbiedad: 150 },
  { id: 'arenal', nombre: 'PTAP El Arenal', turbiedad: 120 },
  { id: 'sullana', nombre: 'Captación Sullana', turbiedad: 100 },
]

type Lecturas = Pick<Localidad, 'reservorioPct' | 'energiaOk' | 'corteActivoH' | 'fallaConfirmada'>
const normal: Lecturas = { reservorioPct: 90, energiaOk: true, corteActivoH: 0, fallaConfirmada: false }

export interface Escenario {
  id: string
  nombre: string
  descripcion: string
  amenaza: Amenaza
  plantas: Record<string, number> // turbiedad por planta
  lecturas: Record<string, Partial<Lecturas>>
}

export const escenarios: Escenario[] = [
  {
    id: 'normal', nombre: 'Temporada normal', descripcion: 'Sin aviso ni alerta ENFEN.',
    amenaza: { caudalSanchezCerro: 120, lluvia24h: 0, avisoSenamhi: 'verde', alertaEnfen: false },
    plantas: { curumuy: 150, arenal: 120, sullana: 100 }, lecturas: {},
  },
  {
    id: 'hoy', nombre: 'Inicio de lluvias (simulado)', descripcion: 'Alerta ENFEN vigente, aviso naranja de SENAMHI y río en ascenso.',
    amenaza: { caudalSanchezCerro: 950, lluvia24h: 35, avisoSenamhi: 'naranja', alertaEnfen: true },
    plantas: { curumuy: 1200, arenal: 300, sullana: 400 },
    lecturas: { 'GRAU-02': { reservorioPct: 55 }, 'GRAU-05': { reservorioPct: 60 } },
  },
  {
    id: 'marzo2023', nombre: 'Marzo 2023 (réplica simulada)', descripcion: 'Ciclón Yaku: aviso rojo, río sobre el umbral rojo, turbiedad extrema.',
    amenaza: { caudalSanchezCerro: 2100, lluvia24h: 95, avisoSenamhi: 'rojo', alertaEnfen: true },
    plantas: { curumuy: 3500, arenal: 900, sullana: 1500 },
    lecturas: {
      'GRAU-01': { reservorioPct: 45 },
      'GRAU-02': { reservorioPct: 25, fallaConfirmada: true, corteActivoH: 30 },
      'GRAU-06': { energiaOk: false, reservorioPct: 40 },
      'GRAU-27': { reservorioPct: 50 },
    },
  },
]

export function construirLocalidades(esc: Escenario): Localidad[] {
  return base.map((b) => ({ ...b, ...normal, ...esc.lecturas[b.id] }))
}

export function construirPlantas(esc: Escenario): Planta[] {
  return plantasBase.map((p) => ({ ...p, turbiedad: esc.plantas[p.id] ?? p.turbiedad }))
}
