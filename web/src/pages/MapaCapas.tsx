import 'leaflet/dist/leaflet.css'
import { useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import type { Layer, PathOptions } from 'leaflet'
import { NIVEL_HEX, NivelBadge } from '@/components/NivelBadge'
import { Card, CardContent } from '@/components/ui/card'
import { useDatos } from '@/hooks/useDatos'
import { useSemaforo } from '@/hooks/useSemaforo'
import { RIESGO_COLOR, RIESGO_ORDEN, type CatInfra, type Despacho, type DistritoProps, type Infra, type Puntos, type RiesgoGeo } from '@/lib/datos'
import { NIVEL_TXT } from '@/lib/mensajes'
import { useModo } from '@/lib/modo'
import { fmtHoras } from '@/lib/semaforo'

type Capa = 'semaforo' | 'riesgo' | 'salud' | 'agua' | 'coen' | 'rutas'
const CAPAS: { id: Capa; txt: string; origen: string; muestra: React.ReactNode }[] = [
  { id: 'semaforo', txt: 'Semáforo por localidad', origen: 'simulado/demo', muestra: <span className="inline-block size-3 rounded-full border-2 border-white bg-sem-naranja ring-1 ring-black/20" /> },
  { id: 'riesgo', txt: 'Riesgo de inundación por distrito', origen: 'CENEPRED', muestra: <span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'linear-gradient(90deg,#f3eef9,#1d1b3a)' }} /> },
  { id: 'salud', txt: 'Hospitales y clínicas', origen: 'OSM', muestra: <span className="inline-block size-3 rounded-full bg-white ring-2 ring-[#1d1b3a]" /> },
  { id: 'agua', txt: 'Tanques, reservorios y plantas', origen: 'OSM', muestra: <span className="inline-block size-3 rounded-full bg-[#656162]" /> },
  { id: 'coen', txt: 'Puntos críticos e IPRESS afectadas', origen: 'COEN', muestra: <span className="inline-block size-3 rotate-45 bg-black" /> },
  { id: 'rutas', txt: 'Rutas de cisternas', origen: 'n6 · supuesto', muestra: <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#6d61eb]" /> },
]
const SALUD: CatInfra[] = ['hospital', 'clinica']
const AGUA: CatInfra[] = ['tanque', 'reservorio', 'planta', 'planta_residual']
const CAT_TXT: Record<CatInfra, string> = { hospital: 'Hospital', clinica: 'Clínica / centro de salud', consultorio: 'Consultorio', tanque: 'Tanque elevado', reservorio: 'Reservorio', planta: 'Planta de agua', planta_residual: 'Planta de aguas residuales' }

export default function MapaCapas() {
  const { escenarioId, modo } = useModo()
  const s = useSemaforo(escenarioId)
  const { datos: geo } = useDatos<RiesgoGeo>('riesgo_distritos.geojson')
  const { datos: infra } = useDatos<Infra>('infraestructura.json')
  const { datos: coen } = useDatos<Puntos>('puntos_criticos.json')
  const { datos: desp } = useDatos<Despacho>('despacho_n6.json')
  const [on, setOn] = useState<Record<Capa, boolean>>({ semaforo: true, riesgo: true, salud: false, agua: false, coen: false, rutas: false })

  const estilo = (f?: { properties: DistritoProps }): PathOptions => ({
    fillColor: f ? RIESGO_COLOR[f.properties.nivel] ?? '#ccc' : '#ccc', fillOpacity: 0.6, color: '#ffffff', weight: 1,
  })
  const popupDistrito = (f: { properties: DistritoProps }, l: Layer) => {
    const p = f.properties
    l.bindPopup(`<strong>${p.distrito}</strong> (${p.provincia})<br/>Riesgo inundación: <strong>${p.nivel}</strong><br/>Población 2017: ${p.poblacion?.toLocaleString('es-PE')}<br/>Pobreza monetaria: ${p.pobreza_pct} %<br/>Establecimientos de salud expuestos: ${p.eess_expuestos} de ${p.eess_total}`)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-ink">Mapa de riesgo y respuesta</h1>
        <p className="text-sm text-muted-foreground">Activa o quita capas. Toca un elemento para ver sus datos. Semáforo: {modo === 'demo' ? 'demostración marzo 2023' : 'simulado con datos EPS supuestos'}.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card size="sm"><CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Capas</legend>
            {CAPAS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={on[c.id]} onChange={(e) => setOn({ ...on, [c.id]: e.target.checked })} />
                <span className="w-5 text-center" aria-hidden>{c.muestra}</span>
                <span className="flex-1">{c.txt}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{c.origen}</span>
              </label>
            ))}
          </fieldset>
          {on.riesgo && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Riesgo de inundación (CENEPRED)</h2>
              <ul className="space-y-1 text-xs">
                {RIESGO_ORDEN.map((n) => (
                  <li key={n} className="flex items-center gap-2"><span className="inline-block h-3 w-6 rounded-sm ring-1 ring-black/10" style={{ background: RIESGO_COLOR[n] }} />{n}</li>
                ))}
              </ul>
            </div>
          )}
          {on.semaforo && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Semáforo</h2>
              <div className="flex flex-wrap gap-1">{(['verde', 'amarillo', 'naranja', 'rojo'] as const).map((n) => <NivelBadge key={n} nivel={n} />)}</div>
            </div>
          )}
          {on.rutas && desp && <p className="text-xs text-muted-foreground">{desp.rutas.AVISO}</p>}
        </CardContent></Card>

        <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <MapContainer center={[-5.0, -80.75]} zoom={9} className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {on.riesgo && geo && <GeoJSON data={geo as unknown as GeoJSON.FeatureCollection} style={estilo as never} onEachFeature={popupDistrito as never} />}
            {on.rutas && desp?.rutas.viajes.map((v) => (
              <Polyline key={v.viaje} positions={[desp.rutas.base, ...v.paradas.map((p) => [p.lat, p.lon] as [number, number]), desp.rutas.base]}
                pathOptions={{ color: '#6d61eb', weight: 2, dashArray: '6 4', opacity: 0.8 }}>
                <Popup>Viaje {v.viaje} · cisterna {v.cisterna}<br />{v.paradas.length} paradas · {v.km} km · {v.m3} m³</Popup>
              </Polyline>
            ))}
            {on.salud && infra?.elementos.filter((e) => SALUD.includes(e.cat)).map((e) => (
              <CircleMarker key={e.id} center={[e.lat, e.lon]} radius={e.cat === 'hospital' ? 6 : 4} pathOptions={{ color: '#1d1b3a', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}>
                <Popup><strong>{e.nombre ?? 'Sin nombre'}</strong><br />{CAT_TXT[e.cat]}{e.operador ? ` · ${e.operador}` : ''}<br /><small>OpenStreetMap</small></Popup>
              </CircleMarker>
            ))}
            {on.agua && infra?.elementos.filter((e) => AGUA.includes(e.cat)).map((e) => (
              <CircleMarker key={e.id} center={[e.lat, e.lon]} radius={4} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#656162', fillOpacity: 1 }}>
                <Popup><strong>{e.nombre ?? CAT_TXT[e.cat]}</strong><br />{CAT_TXT[e.cat]}{e.operador ? ` · ${e.operador}` : ''}<br /><small>OpenStreetMap</small></Popup>
              </CircleMarker>
            ))}
            {on.coen && coen?.puntos.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: '#000000', weight: 2, fillColor: p.capa === 'punto_critico' ? '#000000' : '#ffffff', fillOpacity: 1 }}>
                <Popup>
                  {p.capa === 'punto_critico' ? (
                    <><strong>Punto crítico · {p.distrito}</strong><br />{p.nombre}<br />Peligro: {p.peligro} ({p.nivel_peligro})<br />Intervención: {p.actividad}<br />Costo: S/ {p.costo?.toLocaleString('es-PE')}</>
                  ) : (
                    <><strong>{p.nombre}</strong> ({p.categoria})<br />IPRESS {p.estado?.toLowerCase()} · {p.temporada}</>
                  )}
                </Popup>
              </CircleMarker>
            ))}
            {on.semaforo && s.items.map(({ loc, r }) => (
              <CircleMarker key={loc.id} center={[loc.lat, loc.lng]} radius={10 + Math.sqrt(loc.conexiones) / 25}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: NIVEL_HEX[r.nivel], fillOpacity: 0.95 }}>
                <Popup><strong>{loc.nombre}</strong> · {NIVEL_TXT[r.nivel]}<br />Agua para: {fmtHoras(r.autonomiaH)}<br />Personas: {r.poblacion.toLocaleString('es-PE')}<br />{r.causas.slice(0, 2).join('; ')}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Leyenda de puntos COEN: relleno negro = punto crítico 2027; blanco con borde negro = IPRESS afectada en lluvias 2023. Escala de riesgo en tonos de la marca (no semáforo).</p>
    </div>
  )
}
