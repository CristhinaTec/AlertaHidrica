import { CheckCircle2, CircleDashed, Clock } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Card, CardContent } from '@/components/ui/card'
import { useDatos } from '@/hooks/useDatos'

interface NivelEstado { nivel: number; nombre: string; pregunta?: string; estado?: string; hecho?: string | string[]; falta?: string | string[]; evidencia?: string | string[] }

const BASE: NivelEstado[] = [
  { nivel: 1, nombre: 'Descriptivo', pregunta: '¿Qué pasó?' },
  { nivel: 2, nombre: 'Correlacional', pregunta: '¿Qué se relaciona con qué?' },
  { nivel: 3, nombre: 'Diagnóstico', pregunta: '¿Por qué pasó?' },
  { nivel: 4, nombre: 'Predictivo', pregunta: '¿Qué pasará?' },
  { nivel: 5, nombre: 'Preventivo', pregunta: '¿Qué pasa si…?' },
  { nivel: 6, nombre: 'Prescriptivo', pregunta: '¿Qué debemos hacer?' },
  { nivel: 7, nombre: 'Cognitivo / continuo', pregunta: '¿Cómo aprende el sistema?' },
]

/** Normaliza estado_niveles.json, que puede venir como lista o como {niveles: [...]}. */
function normalizar(d: unknown): NivelEstado[] {
  const lista = Array.isArray(d) ? d : (d as { niveles?: unknown })?.niveles
  if (!Array.isArray(lista)) return []
  return lista.map((x, i) => {
    const o = x as Record<string, unknown>
    return {
      nivel: Number(o.nivel ?? o.n ?? i + 1),
      nombre: String(o.nombre ?? o.name ?? BASE[i]?.nombre ?? ''),
      pregunta: (o.pregunta as string) ?? BASE[i]?.pregunta,
      estado: o.estado as string | undefined,
      hecho: (o.hecho ?? o.logrado ?? o.resultado ?? (o.viabilidad ? `Viabilidad: ${o.viabilidad}` : undefined)) as string | string[] | undefined,
      falta: (o.falta ?? o.falta_para_real ?? o.falta_produccion ?? o.pendiente) as string | string[] | undefined,
      evidencia: (o.evidencia ?? o.salidas ?? o.archivos) as string | string[] | undefined,
    }
  })
}
const lista = (v?: string | string[]) => (v == null ? [] : Array.isArray(v) ? v : [v])

function Estado({ e }: { e?: string }) {
  const t = (e ?? '').toLowerCase()
  if (!e) return <span className="chip chip-borde"><CircleDashed className="size-3" /> Sin reporte</span>
  if (/^(real|listo|complet|hecho|ok|operativo)/.test(t)) return <span className="chip"><CheckCircle2 className="size-3" /> {e}</span>
  return <span className="chip chip-lila"><Clock className="size-3" /> {e}</span>
}

export default function HojaRuta() {
  const { datos, error } = useDatos<unknown>('estado_niveles.json')
  const reporte = datos ? normalizar(datos) : []
  const niveles = BASE.map((b) => ({ ...b, ...reporte.find((r) => r.nivel === b.nivel) }))

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHero etiqueta="Hoja de ruta · 7 niveles de analítica" titulo="De mirar el pasado a decidir solos"
        frase="Qué está construido hoy en cada nivel y qué falta para llevarlo a producción con EPS Grau y Sunass." />
      {error && (
        <p className="rounded-lg border border-dashed border-brand-lila bg-card p-3 text-sm text-muted-foreground">
          Aún no hay reporte de estado (<code className="font-mono">estado_niveles.json</code>). Ejecuta el análisis y <code className="font-mono">exportar_web.py</code>; mientras tanto se muestran los niveles sin estado.
        </p>
      )}
      <ol className="relative space-y-4 border-l-4 border-brand pl-6">
        {niveles.map((n) => (
          <li key={n.nivel} className="relative">
            <span className="absolute -left-[2.35rem] top-3 grid size-7 place-items-center rounded-full border-2 border-ink-navy bg-brand-lima font-mono text-xs font-bold text-ink-navy">{n.nivel}</span>
            <Card className="ventana"><CardContent className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-ink-navy">{n.nombre}</h2>
                  <p className="mono-label">{n.pregunta}</p>
                </div>
                <Estado e={n.estado} />
              </div>
              {lista(n.hecho).length > 0 && <div className="text-sm"><strong>Hecho:</strong><ul className="list-disc pl-5">{lista(n.hecho).map((h) => <li key={h}>{h}</li>)}</ul></div>}
              {lista(n.falta).length > 0 && <div className="text-sm"><strong>Falta para producción:</strong><ul className="list-disc pl-5">{lista(n.falta).map((h) => <li key={h}>{h}</li>)}</ul></div>}
              {lista(n.evidencia).length > 0 && <p className="text-xs text-muted-foreground">Evidencia: {lista(n.evidencia).join(' · ')}</p>}
            </CardContent></Card>
          </li>
        ))}
      </ol>
    </div>
  )
}
