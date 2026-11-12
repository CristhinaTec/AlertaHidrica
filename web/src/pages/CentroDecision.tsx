import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, Copy, History, Megaphone, MessageSquare, Siren, Truck } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { KpiPortada } from '@/components/KpiPortada'
import { NIVEL_HEX, NivelBadge } from '@/components/NivelBadge'
import { Disclosure } from '@/components/Disclosure'
import { Button } from '@/components/ui/button'
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
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(id) }, [])

  const alertas = useMemo(() => s.items.filter((i) => i.r.nivel !== 'verde')
    .sort((a, b) => ORD.indexOf(b.r.nivel) - ORD.indexOf(a.r.nivel) || a.r.autonomiaH - b.r.autonomiaH), [s.items])
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

  const frasePron = (id: string) => {
    const c = n4?.localidades.find((x) => x.id === id)
    if (c && pron) {
      const d = c.dias.find((x) => x.p_corte_72h >= 0.4) ?? [...c.dias].sort((a, b) => b.p_corte_72h - a.p_corte_72h)[0]
      const n = Math.max(0, Math.round((new Date(d.fecha + 'T12:00:00').getTime() - new Date(pron.generado.slice(0, 10) + 'T12:00:00').getTime()) / 864e5))
      return `Corte probable en ${n} días (${Math.round(d.p_corte_72h * 100)} %, modelo en demostración).`
    }
    const l = pron?.localidades.find((x) => x.id === id)
    if (!l) return ''
    const d = l.dias.find((x) => x.nivel !== 'verde')
    if (!d) return 'El pronóstico real no muestra el río sobre umbral en 15 días.'
    const n = Math.round((new Date(d.fecha + 'T12:00:00').getTime() - new Date(pron!.generado.slice(0, 10) + 'T12:00:00').getTime()) / 864e5)
    return `Río sobre umbral probable en ${n} días (${Math.round(Math.max(d.p_amarillo, d.p_naranja, d.p_rojo) * 100)} %).`
  }
  const toggleCheck = (id: string, v: boolean) => { const c = { ...check, [id]: v }; setCheck(c); guardarLS(kC, c) }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <PageHero etiqueta="Centro de decisión" titulo="Qué hacer ahora"
        frase="Toca una alerta para ver la acción, el responsable y el plazo.">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Actuando como</span>
          <select className="rounded-md border bg-card px-2 py-1.5" value={actor} onChange={(e) => setActor(e.target.value)}>
            {ACTORES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </PageHero>

      <KpiPortada enRiesgo={alertas.length} total={s.items.length} origenRiesgo={modo === 'demo' ? 'Demo · marzo 2023' : 'Simulado · datos EPS supuestos'} />

      <section aria-labelledby="bandeja" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="bandeja" className="flex items-center gap-2 text-lg font-semibold text-brand-ink"><BellRing className="size-5" aria-hidden /> Alertas ({alertas.length})</h2>
          <Button size="sm" variant="ghost" onClick={reiniciar}>Reiniciar demo</Button>
        </div>
        {!alertas.length && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 size-6" />Sin alertas activas. Todo en NORMAL.</p>}
        <ul className="space-y-2">
          {alertas.map(({ loc, r }) => {
            const k = clave(loc.id, r.nivel)
            const st = estado[k]
            const acciones = proto?.niveles[r.nivel] ?? []
            const principal = acciones.find((a) => a.actor === 'EPS Grau') ?? acciones[0]
            const plazo = principal && st ? st.emitida + principal.plazo_h * 36e5 - ahora : null
            const vencido = plazo != null && plazo <= 0 && !st?.confirmada
            const open = abierta === k
            const panelId = `alerta-${k.replace(':', '-')}`
            return (
              <li key={k} className="overflow-hidden rounded-xl border bg-card" style={{ borderLeft: `6px solid ${NIVEL_HEX[r.nivel]}` }}>
                <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setAbierta(open ? null : k)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-brand">
                  <NivelBadge nivel={r.nivel} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink-navy">{loc.nombre}</span>
                  <span className="shrink-0 tabular-nums text-sm">agua para <strong>~{fmtHoras(r.autonomiaH)}</strong></span>
                  {st?.confirmada && <CheckCircle2 className="size-4 shrink-0 text-sem-verde" aria-label="Confirmada" />}
                  <ChevronDown className={`size-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open && (
                  <div id={panelId} className="space-y-3 border-t px-4 py-3">
                    <p className="text-sm"><span className="text-muted-foreground">Causa:</span> {r.causas[0] ?? r.ruta}. {frasePron(loc.id)}</p>
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
                        <CheckCircle2 className="size-4" /> {st?.confirmada ? 'Confirmada' : 'Confirmar'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!st?.escalada}
                        onClick={() => registrar(loc.nombre, k, 'escalada', 'Escaló a Sunass y COE')}>
                        <Siren className="size-4" /> {st?.escalada ? 'Escalada' : 'Escalar'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!st?.aviso}
                        onClick={() => registrar(loc.nombre, k, 'aviso', r.nivel === 'rojo' ? 'Envió aviso SISMATE (vía COE)' : 'Envió SMS ciudadano')}>
                        <Megaphone className="size-4" /> {st?.aviso ? 'Aviso enviado' : 'Enviar aviso'}
                      </Button>
                    </div>
                    <Pestanas nivel={r.nivel} proto={proto} check={check} onCheck={toggleCheck} desp={desp}
                      mensajes={{ sms: smsCiudadano(loc, r), sismate: r.nivel === 'rojo' ? sismate(loc) : null }} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <Disclosure titulo={<span className="flex items-center gap-2"><History className="size-4" aria-hidden /> Bitácora ({bitacora.length})</span>}>
        {!bitacora.length ? <p className="text-sm text-muted-foreground">Sin acciones todavía.</p> : (
          <ol className="max-h-64 space-y-1 overflow-auto text-sm">
            {bitacora.map((b, i) => (
              <li key={i} className="flex gap-2"><span className="tabular-nums text-muted-foreground">{hora(b.t)}</span><span><strong>{b.actor}</strong> · {b.loc}: {b.evento}</span></li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Acciones simuladas: no se envía nada real. Se guardan solo en este navegador.</p>
      </Disclosure>
    </div>
  )
}

type Tab = 'hacer' | 'cisternas' | 'mensaje'
const TABS: [Tab, string, typeof ClipboardList][] = [['hacer', 'Qué hacer', ClipboardList], ['cisternas', 'Cisternas', Truck], ['mensaje', 'Mensaje', MessageSquare]]

function Pestanas({ nivel, proto, check, onCheck, desp, mensajes }: {
  nivel: Nivel; proto: Protocolo | null; check: Record<string, boolean>; onCheck: (id: string, v: boolean) => void
  desp: Despacho | null; mensajes: { sms: string; sismate: string | null }
}) {
  const [tab, setTab] = useState<Tab>('hacer')
  const [canal, setCanal] = useState<'sms' | 'sismate'>('sms')
  const [copiado, setCopiado] = useState(false)
  const uid = useId()
  const tareas = (proto?.niveles[nivel] ?? []).filter((a) => a.plazo_h <= 24)
  const msg = canal === 'sismate' && mensajes.sismate ? mensajes.sismate : mensajes.sms
  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    const i = TABS.findIndex(([t]) => t === tab)
    const n = TABS[(i + d + TABS.length) % TABS.length][0]
    setTab(n); document.getElementById(`${uid}-${n}`)?.focus()
  }
  return (
    <div>
      <div role="tablist" aria-label="Detalle de la alerta" onKeyDown={mover} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([t, txt, Ic]) => (
          <button key={t} id={`${uid}-${t}`} role="tab" type="button" aria-selected={tab === t} aria-controls={`${uid}-p`} tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-semibold ${tab === t ? 'border-brand text-brand-ink' : 'border-transparent text-muted-foreground hover:text-brand-ink'}`}>
            <Ic className="size-4" aria-hidden />{txt}
          </button>
        ))}
      </div>
      <div id={`${uid}-p`} role="tabpanel" aria-labelledby={`${uid}-${tab}`} className="pt-3 text-sm">
        {tab === 'hacer' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Próximas 24 h · protocolo {proto?.estado === 'propuesta_a_validar' ? 'propuesta a validar' : proto?.estado}</p>
            {ACTORES.map((a) => {
              const ts = tareas.filter((t) => t.actor === a)
              if (!ts.length) return null
              return (
                <div key={a}>
                  <h4 className="font-semibold">{a}</h4>
                  <ul className="mt-1 space-y-1">
                    {ts.map((t) => {
                      const id = `${nivel}:${t.accion}`
                      return (
                        <li key={id}>
                          <label className="flex items-start gap-2">
                            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={!!check[id]} onChange={(e) => onCheck(id, e.target.checked)} />
                            <span className={check[id] ? 'text-muted-foreground line-through' : ''}>{t.accion} <span className="text-xs text-muted-foreground">({t.plazo_h} h)</span></span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            {!tareas.length && <p className="text-muted-foreground">Sin tareas urgentes.</p>}
          </div>
        )}
        {tab === 'cisternas' && (
          <div>
            {desp && <p className="mb-2 text-xs text-muted-foreground">{desp.rutas.cisternas_usadas} cisternas · {desp.rutas.viajes_usados} viajes · {desp.rutas.m3_total} m³/día</p>}
            <ol className="space-y-1.5">
              {desp?.despacho.slice(0, 6).map((d) => (
                <li key={d.prioridad} className="flex justify-between gap-2">
                  <span className="truncate"><span className="tabular-nums text-muted-foreground">{d.prioridad}.</span> {d.nombre.split(' / ')[0]}</span>
                  <span className="shrink-0 tabular-nums">{d.asignado_m3d} m³</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Puntos reales (OSM, COESALUD); demanda y flota supuestas.</p>
          </div>
        )}
        {tab === 'mensaje' && (
          <div>
            <div className="mb-2 flex gap-2">
              <Button size="sm" variant={canal === 'sms' ? 'default' : 'outline'} onClick={() => setCanal('sms')}>SMS</Button>
              <Button size="sm" variant={canal === 'sismate' ? 'default' : 'outline'} disabled={!mensajes.sismate} onClick={() => setCanal('sismate')}>SISMATE (solo rojo)</Button>
            </div>
            <p className="rounded-lg bg-muted p-3">{msg}</p>
            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(msg); setCopiado(true) }}><Copy className="size-4" /> {copiado ? 'Copiado' : 'Copiar'}</Button>
              <span className="text-xs text-muted-foreground">{msg.length} caracteres</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
