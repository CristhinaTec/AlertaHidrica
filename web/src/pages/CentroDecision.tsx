import { useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, ClipboardList, Copy, History, Megaphone, Siren, Truck } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { KpiPortada } from '@/components/KpiPortada'
import { NivelBadge } from '@/components/NivelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDatos } from '@/hooks/useDatos'
import { useSemaforo } from '@/hooks/useSemaforo'
import type { Despacho, Pronostico } from '@/lib/datos'
import { sismate, smsCiudadano } from '@/lib/mensajes'
import { guardarLS, leerLS, useModo } from '@/lib/modo'
import { fmtHoras, type Nivel } from '@/lib/semaforo'

interface Accion { actor: string; accion: string; plazo_h: number }
interface Protocolo { estado: string; version: number; niveles: Record<Nivel, Accion[]> }
interface Registro { t: number; actor: string; evento: string; loc: string }
type Estado = Record<string, { emitida: number; confirmada?: number; escalada?: number; aviso?: number }>

const ACTORES = ['EPS Grau', 'Sunass', 'COE', 'DIRESA', 'Municipalidad']
const ORD: Nivel[] = ['verde', 'amarillo', 'naranja', 'rojo']

function restante(ms: number) {
  if (ms <= 0) return 'Plazo vencido'
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3)
  return `${h} h ${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} s`
}
const hora = (t: number) => new Date(t).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function CentroDecision() {
  const { modo, escenarioId } = useModo()
  return <Centro key={modo} modo={modo} escenarioId={escenarioId} />
}

function Centro({ modo, escenarioId }: { modo: string; escenarioId: string }) {
  const s = useSemaforo(escenarioId)
  const { datos: proto } = useDatos<Protocolo>('protocolo.json')
  const { datos: pron } = useDatos<Pronostico>('pronostico.json')
  const { datos: desp } = useDatos<Despacho>('despacho_n6.json')
  const { datos: n4 } = useDatos<{ localidades: { id: string; dias: { fecha: string; p_corte_72h: number }[] }[] }>('n4_p_corte.json')
  const kE = `ah_alertas_${modo}`, kB = `ah_bitacora_${modo}`, kC = `ah_check_${modo}`
  const [estado, setEstado] = useState<Estado>(() => leerLS(kE, {}))
  const [bitacora, setBitacora] = useState<Registro[]>(() => leerLS(kB, []))
  const [check, setCheck] = useState<Record<string, boolean>>(() => leerLS(kC, {}))
  const [actor, setActor] = useState('EPS Grau')
  const [canal, setCanal] = useState<'sms' | 'sismate'>('sms')
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(id) }, [])

  const alertas = s.items.filter((i) => i.r.nivel !== 'verde')
  const clave = (id: string, n: Nivel) => `${id}:${n}`

  // registra la hora de emisión la primera vez que se ve cada alerta
  useEffect(() => {
    const faltan = alertas.filter((a) => !estado[clave(a.loc.id, a.r.nivel)])
    if (!faltan.length) return
    const t = Date.now()
    const nuevo = { ...estado }
    faltan.forEach((a) => { nuevo[clave(a.loc.id, a.r.nivel)] = { emitida: t } })
    setEstado(nuevo); guardarLS(kE, nuevo)
  }, [alertas, estado, kE])

  const registrar = (loc: string, k: string, campo: 'confirmada' | 'escalada' | 'aviso', evento: string) => {
    const t = Date.now()
    const nuevo = { ...estado, [k]: { ...estado[k], emitida: estado[k]?.emitida ?? t, [campo]: t } }
    setEstado(nuevo); guardarLS(kE, nuevo)
    const b = [{ t, actor, evento, loc }, ...bitacora].slice(0, 100)
    setBitacora(b); guardarLS(kB, b)
  }
  const reiniciar = () => {
    setEstado({}); setBitacora([]); setCheck({})
    guardarLS(kE, {}); guardarLS(kB, []); guardarLS(kC, {})
  }

  const nivelMax = alertas.reduce<Nivel>((m, a) => (ORD.indexOf(a.r.nivel) > ORD.indexOf(m) ? a.r.nivel : m), 'verde')
  const tareas24 = useMemo(() => (proto?.niveles[nivelMax] ?? []).filter((a) => a.plazo_h <= 24), [proto, nivelMax])
  const top = alertas[0] ?? s.items[0]
  const mensaje = canal === 'sms' ? smsCiudadano(top.loc, top.r) : sismate(top.loc)
  const frasePron = (id: string) => {
    const c = n4?.localidades.find((x) => x.id === id)
    if (c && pron) {
      const d = c.dias.find((x) => x.p_corte_72h >= 0.4) ?? [...c.dias].sort((a, b) => b.p_corte_72h - a.p_corte_72h)[0]
      const n = Math.max(0, Math.round((new Date(d.fecha + 'T12:00:00').getTime() - new Date(pron.generado.slice(0, 10) + 'T12:00:00').getTime()) / 864e5))
      return `corte probable en ${n} días (${Math.round(d.p_corte_72h * 100)} %, modelo nivel 4 en demostración)`
    }
    const l = pron?.localidades.find((x) => x.id === id)
    if (!l) return ''
    const d = l.dias.find((x) => x.nivel !== 'verde')
    if (!d) return 'el pronóstico real no muestra el río sobre umbral en 15 días'
    const n = Math.round((new Date(d.fecha + 'T12:00:00').getTime() - new Date(pron!.generado.slice(0, 10) + 'T12:00:00').getTime()) / 864e5)
    return `río sobre umbral probable en ${n} días (${Math.round(Math.max(d.p_amarillo, d.p_naranja, d.p_rojo) * 100)} %)`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageHero etiqueta="Centro de decisión · EPS Grau · Sunass · COE" titulo="Qué hacer ahora, quién y en cuánto tiempo"
        frase="Alertas activas ordenadas por urgencia, con la acción del protocolo, su responsable y el plazo que corre.">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Actuando como</span>
          <select className="rounded-md border bg-card px-2 py-1.5" value={actor} onChange={(e) => setActor(e.target.value)}>
            {ACTORES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </PageHero>

      <KpiPortada enRiesgo={alertas.length} total={s.items.length} origenRiesgo={modo === 'demo' ? 'Demo · marzo 2023' : 'Simulado · datos EPS supuestos'} />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="bandeja" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="bandeja" className="flex items-center gap-2 text-lg font-semibold text-brand-ink"><BellRing className="size-5" aria-hidden /> Bandeja de alertas ({alertas.length})</h2>
            <Button size="sm" variant="ghost" onClick={reiniciar}>Reiniciar demo</Button>
          </div>
          {!alertas.length && <Card><CardContent className="p-6 text-center text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 size-6" />Sin alertas activas. Todas las localidades en NORMAL.</CardContent></Card>}
          {alertas.map(({ loc, r }) => {
            const k = clave(loc.id, r.nivel)
            const st = estado[k]
            const acciones = proto?.niveles[r.nivel] ?? []
            const principal = acciones.find((a) => a.actor === 'EPS Grau') ?? acciones[0]
            const plazo = principal && st ? st.emitida + principal.plazo_h * 36e5 - ahora : null
            const vencido = plazo != null && plazo <= 0 && !st?.confirmada
            return (
              <Card key={k} className={`border-l-4 ${r.nivel === 'rojo' ? 'border-l-sem-rojo' : r.nivel === 'naranja' ? 'border-l-sem-naranja' : 'border-l-sem-amarillo'}`}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <NivelBadge nivel={r.nivel} size="lg" />
                      <h3 className="text-lg font-semibold">{loc.nombre}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.poblacion.toLocaleString('es-PE')} personas · confianza {r.confianza}</span>
                  </div>
                  <p className="text-base font-medium text-brand-ink">
                    {loc.nombre}: agua para ~{fmtHoras(r.autonomiaH)}; corte previsto de {Math.round(r.corteEstimadoH)} h{frasePron(loc.id) ? `; ${frasePron(loc.id)}` : ''}.
                  </p>
                  <p className="text-sm"><span className="text-muted-foreground">Causa principal:</span> {r.causas[0] ?? r.ruta}</p>
                  {principal && (
                    <div className="rounded-lg bg-brand-soft p-3 text-sm">
                      <div className="font-semibold text-brand-ink">{principal.accion}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>Responsable: <strong>{principal.actor}</strong></span>
                        <span>Plazo: <strong>{principal.plazo_h} h</strong></span>
                        <span aria-live="polite" className={vencido ? 'font-semibold text-sem-rojo' : ''}>
                          {st?.confirmada ? `Confirmada a las ${hora(st.confirmada)}` : plazo != null ? `Quedan ${restante(plazo)}` : ''}
                          {vencido && ' ⚠ escalar'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={st?.confirmada ? 'outline' : 'default'} disabled={!!st?.confirmada}
                      onClick={() => registrar(loc.nombre, k, 'confirmada', `Confirmó recepción de alerta ${r.nivel}`)}>
                      <CheckCircle2 className="size-4" /> {st?.confirmada ? 'Recepción confirmada' : 'Confirmar recepción'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!st?.escalada}
                      onClick={() => registrar(loc.nombre, k, 'escalada', 'Escaló a Sunass y COE')}>
                      <Siren className="size-4" /> {st?.escalada ? 'Escalada' : 'Escalar a Sunass/COE'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!st?.aviso}
                      onClick={() => registrar(loc.nombre, k, 'aviso', r.nivel === 'rojo' ? 'Envió aviso SISMATE (vía COE)' : 'Envió SMS ciudadano')}>
                      <Megaphone className="size-4" /> {st?.aviso ? 'Aviso enviado' : 'Enviar aviso ciudadano'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4" /> Bitácora</CardTitle></CardHeader>
            <CardContent>
              {!bitacora.length ? <p className="text-sm text-muted-foreground">Sin acciones registradas todavía.</p> : (
                <ol className="max-h-64 space-y-1 overflow-auto text-sm">
                  {bitacora.map((b, i) => (
                    <li key={i} className="flex gap-2"><span className="tabular-nums text-muted-foreground">{hora(b.t)}</span><span><strong>{b.actor}</strong> · {b.loc}: {b.evento}</span></li>
                  ))}
                </ol>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Acciones simuladas: no se envía nada real. Se guardan solo en este navegador.</p>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4" aria-label="Próximas 24 horas">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4" /> Próximas 24 h por actor</CardTitle>
              <p className="text-xs text-muted-foreground">Protocolo nivel {nivelMax} · {proto?.estado === 'propuesta_a_validar' ? 'propuesta a validar' : proto?.estado}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {ACTORES.map((a) => {
                const ts = tareas24.filter((t) => t.actor === a)
                if (!ts.length) return null
                return (
                  <div key={a}>
                    <h3 className="text-sm font-semibold">{a}</h3>
                    <ul className="mt-1 space-y-1">
                      {ts.map((t) => {
                        const id = `${nivelMax}:${t.accion}`
                        return (
                          <li key={id}>
                            <label className="flex items-start gap-2 text-sm">
                              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={!!check[id]}
                                onChange={(e) => { const c = { ...check, [id]: e.target.checked }; setCheck(c); guardarLS(kC, c) }} />
                              <span className={check[id] ? 'text-muted-foreground line-through' : ''}>{t.accion} <span className="text-xs text-muted-foreground">({t.plazo_h} h)</span></span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {!tareas24.length && <p className="text-sm text-muted-foreground">Sin tareas urgentes.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-base"><Truck className="size-4" /> Cisternas a despachar primero</CardTitle>
              {desp && <p className="text-xs text-muted-foreground">{desp.rutas.cisternas_usadas} cisternas · {desp.rutas.viajes_usados} viajes · {desp.rutas.m3_total} m³/día</p>}
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5 text-sm">
                {desp?.despacho.slice(0, 6).map((d) => (
                  <li key={d.prioridad} className="flex justify-between gap-2">
                    <span className="truncate"><span className="tabular-nums text-muted-foreground">{d.prioridad}.</span> {d.nombre.split(' / ')[0]}</span>
                    <span className="shrink-0 tabular-nums">{d.asignado_m3d} m³</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">Puntos reales (OSM, COESALUD); demanda y flota supuestas.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Mensaje listo · {top.loc.nombre}</CardTitle>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant={canal === 'sms' ? 'default' : 'outline'} onClick={() => setCanal('sms')}>SMS</Button>
                <Button size="sm" variant={canal === 'sismate' ? 'default' : 'outline'} disabled={top.r.nivel !== 'rojo'} onClick={() => setCanal('sismate')}>SISMATE (solo rojo)</Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="rounded-lg bg-muted p-3 text-sm">{mensaje}</p>
              <p className="mt-1 text-xs text-muted-foreground">{mensaje.length} caracteres</p>
              <Button className="mt-2" size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(mensaje)}><Copy className="size-4" /> Copiar</Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
