import { useState } from 'react'
import { AlertTriangle, Copy, Droplets, Mail, Truck, Users } from 'lucide-react'
import { Mapa } from '@/components/Mapa'
import { NivelBadge } from '@/components/NivelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { escenarios } from '@/data/escenarios'
import { useSemaforo } from '@/hooks/useSemaforo'
import { evaluarSanitario } from '@/lib/sanitario'
import { correoDecisores, sismate, smsCiudadano } from '@/lib/mensajes'
import { fmtHoras, type Nivel } from '@/lib/semaforo'
import { reglas } from '@/config/reglas'

function Rango({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value.toLocaleString('es-PE')} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--brand)]" aria-label={label} />
    </label>
  )
}

export default function Decisores() {
  const s = useSemaforo('hoy')
  const [sel, setSel] = useState(s.items[0].loc.id)
  const [canal, setCanal] = useState<'correo' | 'sms' | 'sismate'>('correo')
  const actual = s.items.find((i) => i.loc.id === sel) ?? s.items[0]
  const { loc, r, planta } = actual

  const conteo = (n: Nivel) => s.items.filter((i) => i.r.nivel === n).length
  const totalCisternas = s.items.reduce((a, i) => a + i.r.cisternas, 0)
  const pobRiesgo = s.items.filter((i) => i.r.nivel === 'naranja' || i.r.nivel === 'rojo').reduce((a, i) => a + i.r.poblacion, 0)
  const correo = correoDecisores(loc, r)
  const texto = canal === 'correo' ? `Asunto: ${correo.asunto}\n\n${correo.cuerpo}` : canal === 'sms' ? smsCiudadano(loc, r, evaluarSanitario(loc, planta, r)) : sismate(loc)

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      {/* Escenario */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label">Simulador · EPS Grau</p><h1 className="titulo-lima text-2xl font-extrabold text-ink-navy">Tablero de decisión</h1>
          <p className="text-sm text-muted-foreground">Cuántas horas de agua le quedan a cada localidad y qué hacer ahora.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Escenario">
          {escenarios.map((e) => (
            <Button key={e.id} size="sm" variant={s.escId === e.id ? 'default' : 'outline'} onClick={() => s.cambiarEscenario(e.id)}>
              {e.nombre}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<AlertTriangle className="size-4" />} label="Localidades en rojo / naranja" value={`${conteo('rojo')} / ${conteo('naranja')}`} />
        <Kpi icon={<Users className="size-4" />} label="Personas en riesgo" value={pobRiesgo.toLocaleString('es-PE')} />
        <Kpi icon={<Truck className="size-4" />} label="Cisternas necesarias" value={String(totalCisternas)} />
        <Kpi icon={<Droplets className="size-4" />} label="Río Piura (Sánchez Cerro)" value={`${s.amenaza.caudalSanchezCerro.toLocaleString('es-PE')} m³/s`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Mapa + lista */}
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-4">
            <div className="h-[340px]"><Mapa items={s.items} seleccion={sel} onSelect={setSel} /></div>
            <ul className="divide-y" aria-label="Localidades por urgencia">
              {s.items.map(({ loc: l, r: rr }) => (
                <li key={l.id}>
                  <button onClick={() => setSel(l.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted ${l.id === sel ? 'bg-brand-soft' : ''}`}>
                    <span className="font-medium">{l.nombre}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums text-muted-foreground">{fmtHoras(rr.autonomiaH)}</span>
                      <NivelBadge nivel={rr.nivel} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Ficha */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl">{loc.nombre}</CardTitle>
              <NivelBadge nivel={r.nivel} size="lg" />
            </div>
            <p className="text-sm text-muted-foreground">{r.ruta}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Dato label="Autonomía" value={fmtHoras(r.autonomiaH)} />
              <Dato label="Corte previsto" value={`${Math.round(r.corteEstimadoH)} h`} />
              <Dato label="Déficit" value={`${Math.round(r.deficitH)} h`} />
              <Dato label="Déficit (m³)" value={Math.round(r.deficitM3).toLocaleString('es-PE')} />
              <Dato label="Personas" value={r.poblacion.toLocaleString('es-PE')} />
              <Dato label="Cisternas" value={String(r.cisternas)} />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Por qué este nivel</h3>
              {r.causas.length ? (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">{r.causas.map((c) => <li key={c}>{c}</li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">Sin señales de riesgo.</p>}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Qué hacer ahora</h3>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm">{r.acciones.map((a) => <li key={a}>{a}</li>)}</ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Planta: {planta.nombre} · Vulnerabilidad {Math.round(loc.vulnerabilidad * 100)} % · {loc.menores5Pct} % hogares con menores de 5 años · Confianza {r.confianza}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Simulador */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Simulador “¿y si…?”</CardTitle>
            <p className="text-sm text-muted-foreground">Mueve la amenaza y mira cómo cambia el semáforo de todas las localidades.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Rango label="Caudal río Piura (Sánchez Cerro)" unit="m³/s" min={0} max={3500} step={50}
              value={s.amenaza.caudalSanchezCerro} onChange={(v) => s.setAmenaza({ ...s.amenaza, caudalSanchezCerro: v })} />
            <p className="-mt-2 text-xs text-muted-foreground">Umbrales de referencia: {reglas.caudal.amarillo} · {reglas.caudal.naranja} · {reglas.caudal.rojo} m³/s (calibrables)</p>
            <Rango label="Lluvia en 24 h" unit="mm" min={0} max={150} step={5}
              value={s.amenaza.lluvia24h} onChange={(v) => s.setAmenaza({ ...s.amenaza, lluvia24h: v })} />
            <Rango label="Turbiedad en PTAP Curumuy" unit="NTU" min={0} max={5000} step={100}
              value={s.turbiedad.curumuy} onChange={(v) => s.setTurbiedad({ ...s.turbiedad, curumuy: v })} />
            <Rango label="Turbiedad en PTAP El Arenal" unit="NTU" min={0} max={5000} step={100}
              value={s.turbiedad.arenal} onChange={(v) => s.setTurbiedad({ ...s.turbiedad, arenal: v })} />
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aviso de SENAMHI</span>
              <select className="rounded-md border bg-card px-2 py-1" value={s.amenaza.avisoSenamhi}
                onChange={(e) => s.setAmenaza({ ...s.amenaza, avisoSenamhi: e.target.value as Nivel })}>
                <option value="verde">Sin aviso</option><option value="amarillo">Amarillo</option>
                <option value="naranja">Naranja</option><option value="rojo">Rojo</option>
              </select>
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Alerta ENFEN vigente</span>
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={s.amenaza.alertaEnfen}
                onChange={(e) => s.setAmenaza({ ...s.amenaza, alertaEnfen: e.target.checked })} />
            </label>
          </CardContent>
        </Card>

        {/* Mensajes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Mail className="size-5" /> Mensajes para {loc.nombre}</CardTitle>
            <div className="flex gap-2 pt-1">
              {(['correo', 'sms', 'sismate'] as const).map((c) => (
                <Button key={c} size="sm" variant={canal === c ? 'default' : 'outline'} onClick={() => setCanal(c)}
                  disabled={c === 'sismate' && r.nivel !== 'rojo'}>
                  {c === 'correo' ? 'Correo EPS / COE' : c === 'sms' ? 'SMS ciudadano' : 'SISMATE (solo rojo)'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm">{texto}</pre>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(texto)}>
              <Copy className="size-4" /> Copiar
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">Prototipo con DATOS SIMULADOS (expediente Sunass y supuestos editables). No usar para decisiones reales.</p>
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-ink">{value}</div>
    </CardContent></Card>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
