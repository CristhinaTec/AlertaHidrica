import type { GemeloLoc } from '@/lib/datos'
import { C } from './estilo'

/** Barras de rango P10–P90 con marca en P50 (SVG propio, accesible). */
export function AutonomiaRango({ locs, clave }: { locs: GemeloLoc[]; clave: 'mc_autonomia_rojo_h' | 'mc_autonomia_naranja_h' }) {
  const max = Math.max(...locs.map((l) => l[clave].p90)) * 1.1
  const W = 100
  const x = (v: number) => (v / max) * W
  const marcas = [12, 24, 48].filter((m) => m < max)
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <caption className="sr-only">Horas de autonomía P10, P50 y P90 por localidad</caption>
        <tbody>
          {locs.map((l) => {
            const p = l[clave]
            return (
              <tr key={l.id}>
                <th scope="row" className="w-32 truncate py-1 pr-2 text-left font-normal">{l.nombre}</th>
                <td className="py-1">
                  <svg viewBox={`0 0 ${W} 10`} preserveAspectRatio="none" className="h-5 w-full" aria-hidden>
                    {marcas.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={10} stroke={C.grisClaro} strokeWidth={0.4} />)}
                    <rect x={x(p.p10)} y={3} width={x(p.p90) - x(p.p10)} height={4} rx={2} fill={C.banda} />
                    <rect x={x(p.p50) - 0.6} y={1} width={1.2} height={8} fill={C.ink} />
                  </svg>
                </td>
                <td className="w-28 py-1 pl-2 text-right tabular-nums text-muted-foreground">
                  {Math.round(p.p10)}–{Math.round(p.p90)} h · <strong className="text-brand-ink">{Math.round(p.p50)} h</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Líneas guía verticales: {marcas.join(' · ')} h. Banda clara = 80 % de escenarios (P10–P90); trazo oscuro = mediana.</p>
    </div>
  )
}
