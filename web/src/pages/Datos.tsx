import { useEffect, useState } from 'react'
import { Download, FileJson } from 'lucide-react'
import { Cargando } from '@/components/charts/ChartCard'
import { PageHero } from '@/components/PageHero'
import { type Fila, TablaPaginada } from '@/components/TablaPaginada'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cargar, useDatos } from '@/hooks/useDatos'
import type { AnalisisN2, Catalogo, Despacho, Gemelo, Infra, Pronostico, Puntos, RiesgoGeo, Series } from '@/lib/datos'
import { aCSV, descargar } from '@/lib/descarga'

interface Dataset { id: string; nombre: string; archivo: string; origen: 'REAL' | 'SUPUESTO' | 'MIXTO'; filas: (d: never) => Fila[] }

const DATASETS: Dataset[] = [
  { id: 'caudal', nombre: 'Caudal semanal máx. ríos Piura y Chira', archivo: 'series.json', origen: 'REAL', filas: (d: Series) => d.caudal_semanal },
  { id: 'lluvia', nombre: 'Lluvia mensual por localidad', archivo: 'series.json', origen: 'REAL',
    filas: (d: Series) => d.lluvia_mensual.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [d.localidades[k] ?? k, v]))) },
  { id: 'nino', nombre: 'Niño 1+2 semanal (anomalía °C)', archivo: 'series.json', origen: 'REAL', filas: (d: Series) => d.nino12_semanal.map(([semana, anom]) => ({ semana, anom })) },
  { id: 'oni', nombre: 'ONI mensual', archivo: 'series.json', origen: 'REAL', filas: (d: Series) => d.oni_mensual.map(([mes, oni]) => ({ mes, oni })) },
  { id: 'pron', nombre: 'Pronóstico 15 días por localidad', archivo: 'pronostico.json', origen: 'REAL',
    filas: (d: Pronostico) => d.localidades.flatMap((l) => l.dias.map((x) => ({ localidad: l.nombre, ...x }))) },
  { id: 'riesgo', nombre: 'Riesgo CENEPRED por distrito', archivo: 'riesgo_distritos.geojson', origen: 'REAL', filas: (d: RiesgoGeo) => d.features.map((f) => ({ ...f.properties })) },
  { id: 'infra', nombre: 'Infraestructura de salud y agua (OSM)', archivo: 'infraestructura.json', origen: 'REAL', filas: (d: Infra) => d.elementos },
  { id: 'coen', nombre: 'Puntos críticos e IPRESS (COEN)', archivo: 'puntos_criticos.json', origen: 'REAL', filas: (d: Puntos) => d.puntos as unknown as Fila[] },
  { id: 'eventos', nombre: 'Nivel 2 · eventos y anticipación', archivo: 'analisis_n2.json', origen: 'REAL', filas: (d: AnalisisN2) => d.eventos as unknown as Fila[] },
  { id: 'gemelo', nombre: 'Nivel 5 · autonomía por localidad', archivo: 'gemelo_n5.json', origen: 'MIXTO',
    filas: (d: Gemelo) => d.localidades.map((l) => ({ localidad: l.nombre, riesgo: l.distrito_cenepred.niv_sinu, ...l.supuestos_eps,
      rojo_p10: l.mc_autonomia_rojo_h.p10, rojo_p50: l.mc_autonomia_rojo_h.p50, rojo_p90: l.mc_autonomia_rojo_h.p90, semaforo_peor: l.semaforo_peor, dia_peor: l.dia_peor })) },
  { id: 'despacho', nombre: 'Nivel 6 · despacho de cisternas', archivo: 'despacho_n6.json', origen: 'MIXTO', filas: (d: Despacho) => d.despacho as unknown as Fila[] },
]

const estadoChip = (e: string) => (e === 'OK' ? <span className="chip">✓ OK</span> : <span className="chip chip-borde" title={e}>⚠ Revisar</span>)

export default function Datos() {
  const { datos: cat, error } = useDatos<Catalogo>('catalogo.json')
  const [sel, setSel] = useState(DATASETS[0].id)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const ds = DATASETS.find((d) => d.id === sel)!

  useEffect(() => {
    let vivo = true
    setFilas(null)
    cargar<never>(ds.archivo).then((d) => vivo && setFilas(ds.filas(d))).catch(() => vivo && setFilas([]))
    return () => { vivo = false }
  }, [ds])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <PageHero etiqueta="Datos abiertos · extractor" titulo="De dónde sale cada número"
        frase="Revisa las fuentes, su periodo y estado; previsualiza cada tabla y descárgala en CSV o JSON para auditar o reutilizar." />

      <Card className="ventana">
        <CardHeader className="pb-1"><CardTitle className="text-base text-ink-navy">Catálogo de fuentes recolectadas</CardTitle></CardHeader>
        <CardContent>
          {!cat ? <Cargando error={error} /> : (
            <div className="overflow-x-auto rounded-lg">
              <table className="tabla-marca w-full text-sm">
                <caption className="sr-only">Catálogo de fuentes</caption>
                <thead><tr>{['Fuente', 'Filas', 'Periodo', 'Método', 'Licencia / origen', 'Estado'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {cat.fuentes.map((f) => (
                    <tr key={f.fuente} className="border-t align-top">
                      <th scope="row" className="px-2 py-1.5 text-left font-mono text-xs font-semibold">{f.fuente}</th>
                      <td className="px-2 py-1.5 text-right tabular-nums">{f.filas.toLocaleString('es-PE')}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{f.fecha_min ? `${f.fecha_min} → ${f.fecha_max}` : '—'}</td>
                      <td className="px-2 py-1.5">{f.metodo}</td>
                      <td className="max-w-72 px-2 py-1.5 text-xs text-muted-foreground">{f.licencia_url}</td>
                      <td className="px-2 py-1.5">{estadoChip(f.estado)}{f.estado !== 'OK' && <div className="mt-1 text-xs text-muted-foreground">{f.estado}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Catálogo generado {new Date(cat.generado).toLocaleString('es-PE')}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ventana">
        <CardHeader className="pb-1">
          <CardTitle className="text-base text-ink-navy">Vista previa y descarga</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="sr-only" htmlFor="ds">Conjunto de datos</label>
            <select id="ds" className="rounded-md border bg-card px-2 py-1.5 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
              {DATASETS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <span className={ds.origen === 'REAL' ? 'chip' : 'chip chip-lila'}>{ds.origen === 'REAL' ? 'Dato real' : 'Real + supuestos EPS'}</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" disabled={!filas?.length} onClick={() => filas && descargar(`${ds.id}.csv`, aCSV(filas), 'text/csv;charset=utf-8')}><Download className="size-4" /> CSV</Button>
              <Button size="sm" variant="outline" disabled={!filas?.length} onClick={() => filas && descargar(`${ds.id}.json`, JSON.stringify(filas, null, 1), 'application/json')}><FileJson className="size-4" /> JSON</Button>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!filas ? <Cargando /> : filas.length ? <TablaPaginada key={sel} filas={filas} caption={ds.nombre} /> : <p className="text-sm text-muted-foreground">Sin datos.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Archivo fuente: <code className="font-mono">/data/{ds.archivo}</code> · generado por <code className="font-mono">analisis/exportar_web.py</code></p>
        </CardContent>
      </Card>
    </div>
  )
}
