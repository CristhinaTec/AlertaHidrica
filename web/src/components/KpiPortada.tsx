import type { ReactNode } from 'react'
import { InfoTip } from '@/components/InfoTip'
import { useDatos } from '@/hooks/useDatos'
import type { Pronostico, RiesgoGeo } from '@/lib/datos'
import type { Nivel } from '@/lib/semaforo'

function Kpi({ label, value, info }: { label: string; value: string; info: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-3xl font-extrabold tabular-nums text-ink-navy">{value}</div>
      <div className="flex items-center gap-1 text-sm text-ink-gris">{label}<InfoTip label={`Fuente de: ${label}`}>{info}</InfoTip></div>
    </div>
  )
}

/** 4 indicadores: número grande + etiqueta; fuente, fecha y origen en el tooltip. */
export function KpiPortada({ enRiesgo, total, origenRiesgo }: { enRiesgo: number; total: number; origenRiesgo: string }) {
  const { datos: p } = useDatos<Pronostico>('pronostico.json')
  const { datos: g } = useDatos<RiesgoGeo>('riesgo_distritos.geojson')
  const nino = p?.nino.ultimas.at(-1)
  let dias = '–', diasDet = ''
  if (p) {
    const hoy = new Date(p.generado.slice(0, 10) + 'T12:00:00')
    const prox = p.localidades.flatMap((l) => l.dias.filter((d) => d.nivel !== ('verde' as Nivel)).map((d) => ({ d, l })))
      .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha))[0]
    if (prox) {
      dias = `${Math.round((new Date(prox.d.fecha + 'T12:00:00').getTime() - hoy.getTime()) / 864e5)} d`
      diasDet = `${prox.l.nombre}, ${prox.d.fecha}.`
    } else { dias = '> 15 d'; diasDet = 'Ningún río supera umbral en el pronóstico.' }
  }
  const ma = g?.features.filter((f) => f.properties.nivel === 'Muy alto')
  const pobMA = ma?.reduce((a, f) => a + (f.properties.poblacion ?? 0), 0)
  const act = p ? new Date(p.generado).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Localidades en riesgo" value={`${enRiesgo}/${total}`}
        info={<><strong>{origenRiesgo}.</strong> Nivel Atención o más, según horas de agua.</>} />
      <Kpi label="Días al próximo umbral" value={dias}
        info={<><strong>Real · GloFAS/ECMWF.</strong> {diasDet} Actualizado {act}.</>} />
      <Kpi label="Mar frente a Piura" value={nino ? `+${nino.nino12_anom.toFixed(1).replace(".", ",")} °C` : '–'}
        info={<><strong>Real · NOAA.</strong> Anomalía Niño 1+2, semana {nino?.semana}.</>} />
      <Kpi label="Personas en riesgo muy alto" value={pobMA ? `${Math.round(pobMA / 1000).toLocaleString('es-PE')} mil` : '–'}
        info={<><strong>Real · CENEPRED, censo 2017.</strong> {ma?.length ?? '–'} distritos con riesgo Muy alto.</>} />
    </div>
  )
}
