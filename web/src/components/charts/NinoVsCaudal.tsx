import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '@/lib/datos'
import { C, eje, num } from './estilo'

/** Anomalía Niño 1+2 (eje izq.) frente a caudal máximo mensual del río Piura (eje der.). */
export function NinoVsCaudal({ s, desde = '1997' }: { s: Series; desde?: string }) {
  const datos = useMemo(() => {
    const m = new Map<string, { mes: string; nino?: number; q?: number }>()
    for (const [f, v] of s.nino12_semanal) {
      if (f < desde || v == null) continue
      const k = f.slice(0, 7); const o = m.get(k) ?? { mes: k }
      o.nino = Math.max(o.nino ?? -99, v); m.set(k, o)
    }
    for (const c of s.caudal_semanal) {
      if (c.semana < desde || c.piura == null) continue
      const k = c.semana.slice(0, 7); const o = m.get(k) ?? { mes: k }
      o.q = Math.max(o.q ?? 0, c.piura); m.set(k, o)
    }
    return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  }, [s, desde])
  return (
    <div className="w-full" role="img" aria-label="Anomalía Niño 1+2 y caudal máximo mensual del río Piura">
      <div className="h-72">
        <ResponsiveContainer>
          <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={C.rejilla} vertical={false} />
            <XAxis dataKey="mes" tick={eje} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
            <YAxis yAxisId="n" tick={eje} width={44} label={{ value: 'Niño 1+2 (°C)', angle: -90, position: 'insideLeft', fontSize: 11, fill: C.texto }} />
            <YAxis yAxisId="q" orientation="right" tick={eje} width={56} tickFormatter={(v: number) => num(v)}
              label={{ value: 'Caudal (m³/s)', angle: 90, position: 'insideRight', fontSize: 11, fill: C.texto }} />
            <ReferenceLine yAxisId="n" y={1} stroke={C.ink} strokeDasharray="3 3" label={{ value: 'Niño 1+2 = +1 °C', position: 'insideTopLeft', fontSize: 10, fill: C.ink }} />
            <Tooltip formatter={(v, n) => (n === 'nino' ? [`${num(Number(v), 1)} °C`, 'Niño 1+2'] : [`${num(Number(v))} m³/s`, 'Caudal Piura'])} />
            <Line yAxisId="q" dataKey="q" stroke={C.gris} dot={false} strokeWidth={1.2} isAnimationActive={false} />
            <Line yAxisId="n" dataKey="nino" stroke={C.brand} dot={false} strokeWidth={1.8} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block h-0.5 w-5 align-middle" style={{ background: C.brand }} />Niño 1+2 (anomalía, eje izq.)</span>
        <span><span className="mr-1 inline-block h-0.5 w-5 align-middle" style={{ background: C.gris }} />Caudal río Piura (eje der.)</span>
      </p>
    </div>
  )
}
