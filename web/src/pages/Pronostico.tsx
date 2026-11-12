import { useEffect, useState } from 'react'
import { CalendarClock, Thermometer, Waves } from 'lucide-react'
import { NIVEL_BG, NivelBadge } from '@/components/NivelBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Abanico } from '@/components/charts/Abanico'
import { ChartCard } from '@/components/charts/ChartCard'
import { PageHero } from '@/components/PageHero'
import type { LocPron } from '@/lib/datos'
import type { Nivel } from '@/lib/semaforo'

interface Dia { fecha: string; nivel: Nivel; p_amarillo: number; p_naranja: number; p_rojo: number; caudal_mediana: number; caudal_p90: number; lluvia_mediana: number | null; lluvia_p90: number | null }
type Loc = LocPron & { dias: Dia[] }
interface Datos {
  generado: string
  enfen: { comunicado: string; fecha: string; estado: string; magnitud: string; url: string }
  nino: { ultimas: { semana: string; nino12_anom: number; nino34_anom: number }[] }
  prob_decision: number
  rios: Record<string, { nombre: string; umbrales: Record<string, number>; tipo_umbral: string }>
  lluvia_umbrales: Record<string, number>
  fuentes: { nombre: string; variable: string; url: string }[]
  localidades: Loc[]
}

const dia = (f: string) => {
  const d = new Date(f + 'T12:00:00')
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })
}
const pct = (p: number) => `${Math.round(p * 100)} %`

export default function Pronostico() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetch('/data/pronostico.json', { cache: 'no-store' }).then((r) => r.json()).then(setDatos).catch(() => setError(true))
  }, [])

  if (error) return <p className="p-8 text-center">No hay pronóstico. Ejecuta <code>python recolector/pronostico.py</code>.</p>
  if (!datos) return <p className="p-8 text-center text-muted-foreground">Cargando pronóstico…</p>

  const nino = datos.nino.ultimas.at(-1)!
  const fechas = datos.localidades[0].dias.map((d) => d.fecha)

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageHero etiqueta="Pronóstico · próximos 15 días" titulo="¿Cuándo y dónde llega la amenaza?"
        frase={`Datos reales recolectados el ${new Date(datos.generado).toLocaleString('es-PE')}. Cada celda dice qué tan probable es superar el umbral de cada nivel, según 51 pronósticos posibles.`} />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Waves className="size-4" /> ENFEN {datos.enfen.comunicado}</div>
          <div className="mt-1 font-semibold text-brand-ink">{datos.enfen.estado}</div>
          <div className="text-sm text-muted-foreground">{datos.enfen.magnitud}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Thermometer className="size-4" /> Mar frente a Piura (Niño 1+2, NOAA)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-ink">+{nino.nino12_anom} °C</div>
          <div className="text-sm text-muted-foreground">Anomalía semana {nino.semana} · Niño 3.4: +{nino.nino34_anom} °C</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-4" /> Regla de decisión</div>
          <div className="mt-1 font-semibold text-brand-ink">Nivel si su probabilidad ≥ {pct(datos.prob_decision)}</div>
          <div className="text-sm text-muted-foreground">Parámetro editable por la EPS</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle>¿Cuándo y dónde?</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card text-left font-medium">Localidad</th>
                {fechas.map((f) => <th key={f} className="text-xs font-medium capitalize text-muted-foreground">{dia(f)}</th>)}
                <th className="text-left font-medium">Día crítico</th>
              </tr>
            </thead>
            <tbody>
              {datos.localidades.map((l) => (
                <tr key={l.id}>
                  <td className="sticky left-0 bg-card pr-2">
                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-xs text-muted-foreground">{l.rio_nombre}</div>
                  </td>
                  {l.dias.map((d) => {
                    const p = Math.max(d.p_amarillo, d.p_naranja, d.p_rojo)
                    return (
                      <td key={d.fecha}
                        title={`${d.fecha}\nCaudal mediano ${d.caudal_mediana} m³/s (P90 ${d.caudal_p90})\nLluvia mediana ${d.lluvia_mediana ?? '–'} mm (P90 ${d.lluvia_p90 ?? '–'})\nP amarillo ${pct(d.p_amarillo)} · naranja ${pct(d.p_naranja)} · rojo ${pct(d.p_rojo)}`}
                        className={`h-11 rounded-md text-center text-xs font-semibold tabular-nums ${d.nivel === 'verde' && p === 0 ? 'bg-muted text-muted-foreground' : NIVEL_BG[d.nivel]}`}>
                        {p > 0 ? pct(p) : '·'}
                      </td>
                    )
                  })}
                  <td className="whitespace-nowrap pl-2">
                    {l.dia_critico ? <span className="capitalize">{dia(l.dia_critico)}</span> : <span className="text-muted-foreground">—</span>}
                    <div className="mt-0.5"><NivelBadge nivel={l.nivel_max} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">El número es la probabilidad más alta de superar algún umbral ese día. Pasa el cursor sobre una celda para ver caudal, lluvia y cada probabilidad.</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(datos.rios).map(([k, rio]) => {
          const l = datos.localidades.find((x) => x.rio === k)
          if (!l) return null
          const maxP90 = Math.max(...l.dias.map((d) => d.caudal_p90))
          const sobre = l.dias.find((d) => d.caudal_p90 >= rio.umbrales.amarillo)
          return (
            <ChartCard key={k}
              titulo={sobre ? `${rio.nombre}: el escenario pesimista supera Atención el ${dia(sobre.fecha)}` : `${rio.nombre}: ni el escenario pesimista llega al umbral de Atención en 15 días`}
              lectura={`Línea = caudal mediano; banda = hasta el percentil 90 (1 de cada 10 pronósticos es peor). Máximo P90: ${Math.round(maxP90).toLocaleString('es-PE')} m³/s.`}
              aviso={k === 'piura' ? 'Caudal GloFAS calibrado ×1,35 con el pico de 2017. El archivo no trae P10: la banda inferior es la mediana.' : 'Umbrales del Chira = percentiles GloFAS, no oficiales.'}
              fuente="GloFAS vía Open-Meteo Flood API">
              <Abanico loc={l} umbrales={rio.umbrales} />
            </ChartCard>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Umbrales usados</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(datos.rios).map(([k, r]) => (
              <div key={k}>
                <span className="font-medium">{r.nombre}:</span> amarillo {r.umbrales.amarillo} · naranja {r.umbrales.naranja} · rojo {r.umbrales.rojo} m³/s
                <span className="text-muted-foreground"> ({r.tipo_umbral})</span>
              </div>
            ))}
            <div><span className="font-medium">Lluvia diaria:</span> {datos.lluvia_umbrales.amarillo} · {datos.lluvia_umbrales.naranja} · {datos.lluvia_umbrales.rojo} mm <span className="text-muted-foreground">(supuesto calibrable)</span></div>
            <p className="text-xs text-muted-foreground">Caudal del río Piura calibrado con el pico de 2017 (un solo evento): aproximado.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Fuentes recolectadas</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {datos.fuentes.map((f) => (
                <li key={f.nombre}><a className="font-medium text-brand underline-offset-2 hover:underline" href={f.url} target="_blank" rel="noreferrer">{f.nombre}</a> <span className="text-muted-foreground">— {f.variable}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-xs text-muted-foreground">Pronóstico de la amenaza con datos reales. El impacto en el servicio (autonomía y déficit) se calcula en el tablero con datos simulados de la EPS.</p>
    </div>
  )
}
