import { useState } from 'react'
import { Anticipacion } from '@/components/charts/Anticipacion'
import { AutonomiaRango } from '@/components/charts/AutonomiaRango'
import { Cargando, ChartCard } from '@/components/charts/ChartCard'
import { LluviaMensual } from '@/components/charts/LluviaMensual'
import { NinoVsCaudal } from '@/components/charts/NinoVsCaudal'
import { SerieCaudal } from '@/components/charts/SerieCaudal'
import { PageHero } from '@/components/PageHero'
import { TablaPaginada } from '@/components/TablaPaginada'
import { useDatos } from '@/hooks/useDatos'
import type { AnalisisN2, Despacho, Gemelo, Series } from '@/lib/datos'

const pct = (x: number) => `${Math.round(x * 100)} %`

export default function Analisis() {
  const { datos: s, error: e1 } = useDatos<Series>('series.json')
  const { datos: n2 } = useDatos<AnalisisN2>('analisis_n2.json')
  const { datos: n5 } = useDatos<Gemelo>('gemelo_n5.json')
  const { datos: n6 } = useDatos<Despacho>('despacho_n6.json')
  const [loc, setLoc] = useState('GRAU-01')
  const [umbral, setUmbral] = useState(1)
  const [escenario, setEscenario] = useState<'mc_autonomia_rojo_h' | 'mc_autonomia_naranja_h'>('mc_autonomia_rojo_h')

  if (!s) return <Cargando error={e1} />
  const eventos = n2?.eventos.filter((e) => e.umbral_nino12 === umbral) ?? []
  const anios = n2?.dias_umbral.filter((d) => d.roja_1900 > 0) ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <PageHero etiqueta="Análisis · niveles 2, 5 y 6" titulo="Lo que dicen los datos"
        frase="Evidencia histórica para calibrar umbrales, decidir cuánto antes alertar y a quién llevar agua primero." />

      <section className="space-y-4" aria-labelledby="h-hist">
        <h2 id="h-hist" className="mono-label">01 · Historia del río y la lluvia (datos reales)</h2>
        <ChartCard titulo={`El río Piura superó la emergencia (1 900 m³/s) en ${anios.length} años desde 1997: ${anios.map((a) => a.fecha).join(', ')}`}
          lectura="Máximo semanal del caudal. Las bandas marcan los tres grandes eventos; las líneas punteadas, los umbrales de SENAMHI."
          aviso="GloFAS es un modelo; el río Piura se multiplicó ×1,35 para igualar el pico observado de 2017 (calibración con un solo evento)."
          fuente="GloFAS reanálisis (Copernicus) vía Open-Meteo">
          <SerieCaudal s={s} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard titulo="La lluvia se concentra en pocos meses de años Niño"
            lectura="Lluvia acumulada por mes. Los picos de 2017 y 2023 multiplican varias veces un verano normal."
            fuente="Open-Meteo ERA5 (reanálisis)">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Localidad</span>
              <select className="rounded-md border bg-card px-2 py-1" value={loc} onChange={(e) => setLoc(e.target.value)}>
                {Object.entries(s.localidades).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <LluviaMensual s={s} loc={loc} />
          </ChartCard>
          <ChartCard titulo="Cuando el mar de Piura se calienta (+1 °C o más), el río suele crecer meses después"
            lectura="Anomalía Niño 1+2 frente al caudal máximo mensual. La relación es fuerte en eventos grandes, débil en años normales."
            fuente="NOAA CPC; GloFAS">
            <NinoVsCaudal s={s} />
          </ChartCard>
        </div>
      </section>

      {n2 && (
        <section className="space-y-4" aria-labelledby="h-n2">
          <h2 id="h-n2" className="mono-label">02 · ¿Cuánto antes avisa el Niño 1+2? (nivel 2)</h2>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <ChartCard titulo={`Con umbral +${umbral} °C, el aviso llegó con ${Math.round(Math.max(...eventos.map((e) => e.anticipacion_semanas ?? 0)))} semanas de ventaja en el mejor caso`}
              lectura="Semanas entre la primera alerta oceánica y el primer día con el río sobre 1 290 m³/s, por año hidrológico."
              fuente="analisis/02_correlacional">
              <div className="flex gap-2" role="group" aria-label="Umbral Niño 1+2">
                {[...new Set(n2.metricas.map((m) => m.umbral_nino12))].map((u) => (
                  <button key={u} onClick={() => setUmbral(u)} className={u === umbral ? 'chip' : 'chip chip-lila'} aria-pressed={u === umbral}>+{u} °C</button>
                ))}
              </div>
              <Anticipacion eventos={eventos} />
            </ChartCard>
            <ChartCard titulo="Un umbral más bajo detecta más eventos pero da más falsas alarmas"
              lectura="POD = eventos detectados; FAR = alarmas que no terminaron en crecida."
              aviso="Pocos eventos en la muestra (8 años con crecida): las métricas son indicativas.">
              <div className="overflow-x-auto">
                <table className="tabla-marca w-full overflow-hidden rounded-lg text-sm">
                  <thead><tr>{['Umbral', 'Aciertos', 'No anticipados', 'Falsas alarmas', 'POD', 'FAR'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {n2.metricas.map((m) => (
                      <tr key={m.umbral_nino12} className="border-t">
                        <th scope="row" className="px-2 py-1.5 text-left font-mono">+{m.umbral_nino12} °C</th>
                        <td className="px-2 tabular-nums">{m.aciertos}</td><td className="px-2 tabular-nums">{m.eventos_no_anticipados}</td>
                        <td className="px-2 tabular-nums">{m.falsas_alarmas}</td>
                        <td className="px-2 font-semibold tabular-nums">{pct(m.POD)}</td><td className="px-2 tabular-nums">{pct(m.FAR)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {n5 && (
        <section className="space-y-4" aria-labelledby="h-n5">
          <h2 id="h-n5" className="mono-label">03 · ¿Cuántas horas de agua quedan si se corta la captación? (nivel 5)</h2>
          <ChartCard titulo={`En un escenario ${escenario.includes('rojo') ? 'rojo' : 'naranja'}, ${[...n5.localidades].sort((a, b) => a[escenario].p50 - b[escenario].p50)[0].nombre} es la primera en quedarse sin agua`}
            lectura="Horas de autonomía de los reservorios (1 000 simulaciones Monte Carlo variando pérdidas, dotación y llenado)."
            aviso={n5.AVISO}>
            <div className="flex gap-2" role="group" aria-label="Escenario">
              <button className={escenario === 'mc_autonomia_rojo_h' ? 'chip' : 'chip chip-lila'} aria-pressed={escenario === 'mc_autonomia_rojo_h'} onClick={() => setEscenario('mc_autonomia_rojo_h')}>Escenario rojo</button>
              <button className={escenario === 'mc_autonomia_naranja_h' ? 'chip' : 'chip chip-lila'} aria-pressed={escenario === 'mc_autonomia_naranja_h'} onClick={() => setEscenario('mc_autonomia_naranja_h')}>Escenario naranja</button>
            </div>
            <AutonomiaRango locs={n5.localidades} clave={escenario} />
          </ChartCard>
        </section>
      )}

      {n6 && (
        <section className="space-y-4" aria-labelledby="h-n6">
          <h2 id="h-n6" className="mono-label">04 · ¿A quién llevar agua primero? (nivel 6)</h2>
          <ChartCard titulo={`${n6.rutas.cisternas_usadas} cisternas en ${n6.rutas.viajes_usados} viajes cubren ${n6.despacho.filter((d) => d.cubierto === 'total').length} de ${n6.despacho.length} puntos prioritarios`}
            lectura="Prioridad = tipo de establecimiento (hospital primero) + afectación previa + riesgo CENEPRED del distrito + pobreza."
            aviso={`${n6.aviso} ${n6.rutas.AVISO}`}>
            <TablaPaginada caption="Despacho priorizado de cisternas" filas={n6.despacho.map((d) => ({
              '#': d.prioridad, Punto: d.nombre.split(' / ')[0], Tipo: d.tipo, Distrito: d.distrito, 'Riesgo': d.niv_sinu, 'km': d.km_desde_base, 'm³/día': d.asignado_m3d, Cobertura: d.cubierto,
            }))} />
          </ChartCard>
        </section>
      )}
    </div>
  )
}
