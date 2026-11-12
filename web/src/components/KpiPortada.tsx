import { CalendarClock, Clock, MapPin, Thermometer, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDatos } from '@/hooks/useDatos'
import type { Pronostico, RiesgoGeo } from '@/lib/datos'
import type { Nivel } from '@/lib/semaforo'

function Kpi({ icon, label, value, detalle, origen }: { icon: ReactNode; label: string; value: string; detalle?: string; origen: string }) {
  return (
    <Card size="sm"><CardContent>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-ink">{value}</div>
      {detalle && <div className="text-xs text-muted-foreground">{detalle}</div>}
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{origen}</div>
    </CardContent></Card>
  )
}

/** Indicadores clave de portada. `enRiesgo` viene del semáforo (simulado o demo). */
export function KpiPortada({ enRiesgo, total, origenRiesgo }: { enRiesgo: number; total: number; origenRiesgo: string }) {
  const { datos: p } = useDatos<Pronostico>('pronostico.json')
  const { datos: g } = useDatos<RiesgoGeo>('riesgo_distritos.geojson')
  const nino = p?.nino.ultimas.at(-1)
  let dias: string = '–', diasDet = ''
  if (p) {
    const hoy = new Date(p.generado.slice(0, 10) + 'T12:00:00')
    const prox = p.localidades.flatMap((l) => l.dias.filter((d) => d.nivel !== ('verde' as Nivel)).map((d) => ({ d, l })))
      .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha))[0]
    if (prox) {
      const n = Math.round((new Date(prox.d.fecha + 'T12:00:00').getTime() - hoy.getTime()) / 864e5)
      dias = `${n} días`; diasDet = `${prox.l.nombre}, ${prox.d.fecha}`
    } else { dias = '> 15 días'; diasDet = 'Ningún río supera umbral en el pronóstico' }
  }
  const pobMA = g?.features.filter((f) => f.properties.nivel === 'Muy alto').reduce((a, f) => a + (f.properties.poblacion ?? 0), 0)
  const nMA = g?.features.filter((f) => f.properties.nivel === 'Muy alto').length
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={<Thermometer className="size-4" />} label="Mar frente a Piura (Niño 1+2)" value={nino ? `+${nino.nino12_anom} °C` : '–'} detalle={nino ? `Semana ${nino.semana}` : ''} origen="Real · NOAA" />
      <Kpi icon={<CalendarClock className="size-4" />} label="Días al próximo umbral" value={dias} detalle={diasDet} origen="Real · GloFAS/ECMWF" />
      <Kpi icon={<MapPin className="size-4" />} label="Localidades en riesgo" value={`${enRiesgo} de ${total}`} detalle="Atención o más" origen={origenRiesgo} />
      <Kpi icon={<Users className="size-4" />} label="Personas en distritos de riesgo Muy alto" value={pobMA ? pobMA.toLocaleString('es-PE') : '–'} detalle={nMA ? `${nMA} distritos · censo 2017` : ''} origen="Real · CENEPRED" />
      <Kpi icon={<Clock className="size-4" />} label="Última actualización" value={p ? new Date(p.generado).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '–'} detalle={p ? new Date(p.generado).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''} origen="Pronóstico" />
    </div>
  )
}
