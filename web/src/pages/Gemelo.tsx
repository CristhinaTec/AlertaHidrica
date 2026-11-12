import { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Building2, Factory, Home, RotateCcw, Waves, Cylinder } from 'lucide-react'
import type { ReactNode } from 'react'
import { NivelBadge } from '@/components/NivelBadge'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { reglas as R } from '@/config/reglas'
import { construirLocalidades, construirPlantas, escenarios } from '@/data/escenarios'
import { useDatos } from '@/hooks/useDatos'
import type { Infra, Pronostico } from '@/lib/datos'
import { useModo } from '@/lib/modo'
import { evaluar, fmtHoras, type Nivel } from '@/lib/semaforo'

type Origen = 'REAL' | 'SUPUESTO' | 'SIMULADO-IoT' | 'DEMO' | 'CALCULADO'
interface Valor { label: string; valor: string; origen: Origen; fuente: string }

// Hidrograma de demostración (marzo 2023): pico al día 2 y recesión lenta.
const CURVA_DEMO = [0.7, 0.9, 1, 0.97, 0.9, 0.82, 0.74, 0.66, 0.6, 0.55, 0.5, 0.46, 0.43, 0.4, 0.38]
const turbDesdeCaudal = (q: number) => Math.round(Math.max(60, 0.0009 * q * q + 0.5 * q))
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

const CHIP: Record<Origen, string> = {
  REAL: 'chip', SUPUESTO: 'chip chip-lila', 'SIMULADO-IoT': 'chip chip-borde', DEMO: 'chip chip-lila', CALCULADO: 'chip chip-lila',
}

function Nodo({ icon, titulo, valores, sinSensor, destacado, children }: {
  icon: ReactNode; titulo: string; valores: Valor[]; sinSensor?: string; destacado?: ReactNode; children?: ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl bg-card p-3 ${sinSensor ? 'border-2 border-dashed border-brand-lila' : 'border border-brand-lila'}`}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-rosa text-brand-ink">{icon}</span>
        <h3 className="mono-label">{titulo}</h3>
      </div>
      {destacado}
      {children}
      <dl className="space-y-1.5">
        {valores.map((v) => (
          <div key={v.label}>
            <dt className="text-xs text-muted-foreground">{v.label}</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-base font-semibold text-ink-navy">{v.valor}</span>
              <span className={CHIP[v.origen]} title={v.fuente}>{v.origen}</span>
            </dd>
          </div>
        ))}
      </dl>
      {sinSensor && <p className="mt-auto rounded-md bg-brand-rosa px-2 py-1 text-xs text-brand-ink">Sin sensor — propuesta AIoT: {sinSensor}</p>}
    </div>
  )
}

function Gauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-end gap-3" role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label="Nivel del reservorio">
      <div className="relative h-20 w-12 overflow-hidden rounded-md border-2 border-ink-navy bg-white">
        <div className="absolute inset-x-0 bottom-0 bg-brand transition-all" style={{ height: `${p}%` }} />
        <div className="absolute inset-x-0 border-t border-dashed border-ink-navy" style={{ bottom: `${R.reservorioCriticoPct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">línea punteada:<br />crítico {R.reservorioCriticoPct} %</div>
    </div>
  )
}

const Flecha = () => (
  <div className="flex items-center justify-center text-brand" aria-hidden>
    <ArrowRight className="hidden size-6 lg:block" /><ArrowDown className="size-6 lg:hidden" />
  </div>
)

export default function Gemelo() {
  const { modo, escenarioId } = useModo()
  const { datos: pron } = useDatos<Pronostico>('pronostico.json')
  const { datos: infra } = useDatos<Infra>('infraestructura.json')
  const esc = escenarios.find((e) => e.id === escenarioId)!
  const locs = useMemo(() => construirLocalidades(esc), [esc])
  const plantas = useMemo(() => construirPlantas(esc), [esc])
  const [locId, setLocId] = useState('GRAU-02')
  const [dia, setDia] = useState(0)
  const [qMan, setQMan] = useState<number | null>(null)
  const [tMan, setTMan] = useState<number | null>(null)
  const [sinEnergia, setSinEnergia] = useState(false)
  const [falla, setFalla] = useState(false)
  const reset = () => { setQMan(null); setTMan(null); setSinEnergia(false); setFalla(false) }

  const loc0 = locs.find((l) => l.id === locId)!
  const planta0 = plantas.find((p) => p.id === loc0.plantaId)!
  const lp = pron?.localidades.find((l) => l.id === locId)
  const nDias = lp?.dias.length ?? 15
  const demo = modo === 'demo'

  /** Amenaza de un día: pronóstico real (hoy) o hidrograma de demostración. */
  const amenazaDia = (d: number) => {
    const pd = lp?.dias[Math.min(d, nDias - 1)]
    const q = qMan ?? (demo ? Math.round(esc.amenaza.caudalSanchezCerro * CURVA_DEMO[d % 15]) : pd?.caudal_mediana ?? 0)
    const lluvia = demo ? Math.round(esc.amenaza.lluvia24h * CURVA_DEMO[d % 15]) : pd?.lluvia_mediana ?? 0
    const aviso: Nivel = demo ? (CURVA_DEMO[d % 15] > 0.8 ? 'rojo' : 'naranja') : pd?.nivel ?? 'verde'
    return { q, lluvia, aviso, p90: pd?.caudal_p90 }
  }

  const sim = useMemo(() => {
    let pct = loc0.reservorioPct
    let out = null as null | ReturnType<typeof paso>
    function paso(d: number, pctIni: number) {
      const a = amenazaDia(d)
      const turb = tMan ?? (demo && d === 0 ? planta0.turbiedad : turbDesdeCaudal(a.q))
      const loc = { ...loc0, reservorioPct: pctIni, energiaOk: !sinEnergia && loc0.energiaOk, fallaConfirmada: falla || loc0.fallaConfirmada }
      const planta = { ...planta0, turbiedad: turb }
      const amenaza = { caudalSanchezCerro: a.q, lluvia24h: a.lluvia, avisoSenamhi: a.aviso, alertaEnfen: true }
      const r = evaluar(loc, planta, amenaza)
      let f = 1
      if (turb >= R.turbiedad.critica) f -= R.perdidaProduccion.turbiedadCritica
      else if (turb >= R.turbiedad.alta) f -= R.perdidaProduccion.turbiedadAlta
      if (!loc.energiaOk && loc.dependePozos) f -= R.perdidaProduccion.sinEnergia
      if (loc.fallaConfirmada) f = 0
      f = Math.max(0, f)
      const demanda = ((r.poblacion * loc.dotacionLhd) / 1000 / 24) * (1 + R.perdidasRed)
      const prod = loc.produccionM3h * f
      return { a, turb, f, r, demanda, prod, pct: pctIni, loc }
    }
    for (let d = 0; d <= dia; d++) {
      out = paso(d, pct)
      pct = Math.max(0, Math.min(100, pct + ((out.prod - out.demanda) * 24 / loc0.volumenReservoriosM3) * 100))
    }
    return out!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc0, planta0, dia, qMan, tMan, sinEnergia, falla, lp, demo, esc])

  const salud = infra?.elementos.filter((e) => (e.cat === 'hospital' || e.cat === 'clinica') && km([e.lat, e.lon], [loc0.lat, loc0.lng]) < 8) ?? []
  const fecha = lp?.dias[Math.min(dia, nDias - 1)]?.fecha
  const origenRio: Origen = qMan != null ? 'DEMO' : demo ? 'DEMO' : 'REAL'
  const r = sim.r

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageHero etiqueta="Gemelo digital · cadena física del agua" titulo="Del río al grifo, día por día"
        frase="Mueve el tiempo o provoca una falla y mira cómo se propaga el efecto hasta los hogares y hospitales: así se decide dónde actuar primero.">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Localidad</span>
          <select className="rounded-md border bg-card px-2 py-1.5" value={locId} onChange={(e) => setLocId(e.target.value)}>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </label>
      </PageHero>

      <Card className="ventana">
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="dia" className="text-sm font-semibold text-ink-navy">
              Día {dia} del pronóstico {fecha && !demo ? `· ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}` : demo ? '· réplica marzo 2023' : ''}
            </label>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Estado resultante</span><NivelBadge nivel={r.nivel} size="lg" /></div>
          </div>
          <input id="dia" type="range" min={0} max={nDias - 1} value={dia} onChange={(e) => setDia(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
          <p className="text-xs text-muted-foreground">El reservorio se llena o vacía día a día según producción menos demanda. {demo ? 'Río y lluvia: hidrograma de demostración basado en marzo 2023.' : 'Río y lluvia: mediana de 51 pronósticos reales (GloFAS/ECMWF).'}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <Nodo icon={<Waves className="size-4" />} titulo="Río / cuenca" valores={[
          { label: 'Caudal', valor: `${Math.round(sim.a.q).toLocaleString('es-PE')} m³/s`, origen: origenRio, fuente: 'GloFAS vía Open-Meteo (Piura ×1,35)' },
          ...(sim.a.p90 && !demo && qMan == null ? [{ label: 'Caudal P90 (pesimista)', valor: `${Math.round(sim.a.p90).toLocaleString('es-PE')} m³/s`, origen: 'REAL' as Origen, fuente: 'GloFAS 51 miembros' }] : []),
          { label: 'Lluvia del día', valor: `${sim.a.lluvia ?? 0} mm`, origen: demo ? 'DEMO' : 'REAL', fuente: 'ECMWF IFS ensemble' },
        ]} />
        <Flecha />
        <Nodo icon={<Factory className="size-4" />} titulo={`Captación / ${planta0.nombre}`} sinSensor="turbidímetro en línea y medidor de energía en captación" valores={[
          { label: 'Turbiedad agua cruda', valor: `${sim.turb.toLocaleString('es-PE')} NTU`, origen: tMan != null ? 'DEMO' : 'SIMULADO-IoT', fuente: 'Estimada desde el caudal (curva supuesta)' },
          { label: 'Energía', valor: sim.loc.energiaOk ? 'Con energía' : 'Sin energía', origen: 'SIMULADO-IoT', fuente: 'Supuesto / escenario' },
          { label: 'Producción', valor: `${Math.round(sim.f * 100)} % · ${Math.round(sim.prod).toLocaleString('es-PE')} m³/h`, origen: 'CALCULADO', fuente: 'Reglas del semáforo + capacidad supuesta' },
        ]} />
        <Flecha />
        <Nodo icon={<Cylinder className="size-4" />} titulo="Reservorio" sinSensor="sensor de nivel ultrasónico con telemetría LoRa/4G"
          destacado={<Gauge pct={sim.pct} />} valores={[
            { label: 'Nivel', valor: `${Math.round(sim.pct)} %`, origen: 'SIMULADO-IoT', fuente: 'Escenario + balance diario' },
            { label: 'Volumen útil', valor: `${Math.round(loc0.volumenReservoriosM3 * sim.pct / 100).toLocaleString('es-PE')} m³`, origen: 'SUPUESTO', fuente: 'Volumen de reservorios supuesto' },
          ]} />
        <Flecha />
        <Nodo icon={<Home className="size-4" />} titulo="Sector / barrio" valores={[
          { label: 'Agua para', valor: fmtHoras(r.autonomiaH), origen: 'CALCULADO', fuente: 'Almacenado / (demanda − producción)' },
          { label: 'Corte previsto', valor: `${Math.round(r.corteEstimadoH)} h`, origen: 'CALCULADO', fuente: 'Duración típica por causa (reglas)' },
          { label: 'Población servida', valor: r.poblacion.toLocaleString('es-PE'), origen: 'SUPUESTO', fuente: 'Conexiones × 4 personas' },
        ]} />
        <Flecha />
        <Nodo icon={<Building2 className="size-4" />} titulo="Hogares y salud" valores={[
          { label: 'Vulnerabilidad', valor: `${Math.round(loc0.vulnerabilidad * 100)} %`, origen: 'SUPUESTO', fuente: 'Índice DS08 (simulado)' },
          { label: 'Hogares con menores de 5', valor: `${loc0.menores5Pct} %`, origen: 'SUPUESTO', fuente: 'DS08' },
          { label: 'Hospitales y clínicas a < 8 km', valor: String(salud.length), origen: 'REAL', fuente: 'OpenStreetMap' },
          { label: 'Cisternas prioritarias', valor: String(r.cisternas), origen: 'CALCULADO', fuente: 'Déficit × 15 % / (20 m³ × 4 viajes)' },
        ]} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="ventana">
          <CardHeader className="pb-1">
            <CardTitle className="text-base text-ink-navy">¿Y si…? (se propaga aguas abajo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Caudal del río</span><span className="font-mono font-semibold">{qMan == null ? 'según pronóstico' : `${qMan.toLocaleString('es-PE')} m³/s`}</span></div>
              <input type="range" min={0} max={4000} step={50} value={qMan ?? Math.round(sim.a.q)} onChange={(e) => setQMan(Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-label="Caudal del río (m³/s)" />
            </label>
            <label className="block space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Turbiedad en planta</span><span className="font-mono font-semibold">{tMan == null ? 'según caudal' : `${tMan.toLocaleString('es-PE')} NTU`}</span></div>
              <input type="range" min={0} max={6000} step={100} value={tMan ?? sim.turb} onChange={(e) => setTMan(Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-label="Turbiedad (NTU)" />
            </label>
            <label className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Corte de energía en pozos/bombeo</span>
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={sinEnergia} onChange={(e) => setSinEnergia(e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Falla de línea de conducción</span>
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={falla} onChange={(e) => setFalla(e.target.checked)} /></label>
            <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="size-4" /> Volver al pronóstico</Button>
          </CardContent>
        </Card>
        <Card className="ventana">
          <CardHeader className="pb-1"><CardTitle className="text-base text-ink-navy">Por qué {r.nivel === 'verde' ? 'está normal' : 'está en este nivel'}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">{r.ruta}</p>
            {r.causas.length ? <ul className="list-disc space-y-0.5 pl-5">{r.causas.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-muted-foreground">Sin señales de riesgo.</p>}
            <div><h3 className="font-semibold">Qué hacer</h3><ol className="list-decimal pl-5">{r.acciones.map((a) => <li key={a}>{a}</li>)}</ol></div>
            <div className="flex flex-wrap gap-1.5 border-t pt-2 text-xs">
              <span className="chip">REAL</span> dato medido/pronosticado
              <span className="chip chip-lila">SUPUESTO</span> dato EPS por confirmar
              <span className="chip chip-borde">SIMULADO-IoT</span> sensor que aún no existe
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
