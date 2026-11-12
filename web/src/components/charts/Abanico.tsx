import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LocPron } from '@/lib/datos'
import { C, eje, num } from './estilo'

const TXT: Record<string, string> = { amarillo: 'Atención', naranja: 'Precaución', rojo: 'Emergencia' }

/** Abanico de caudal pronosticado: mediana y banda hasta P90 (pronostico.json no trae P10). */
export function Abanico({ loc, umbrales }: { loc: LocPron; umbrales: Record<string, number> }) {
  const datos = loc.dias.map((d) => ({ f: d.fecha.slice(5), med: d.caudal_mediana, banda: [d.caudal_mediana, d.caudal_p90] as [number, number], p90: d.caudal_p90 }))
  const top = Math.max(...datos.map((d) => d.p90), umbrales.amarillo) * 1.1
  return (
    <div className="h-60 w-full" role="img" aria-label={`Caudal pronosticado ${loc.rio_nombre}: mediana y P90 a 15 días`}>
      <ResponsiveContainer>
        <ComposedChart data={datos} margin={{ top: 8, right: 96, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={C.rejilla} vertical={false} />
          <XAxis dataKey="f" tick={eje} />
          <YAxis tick={eje} width={52} domain={[0, Math.ceil(top / 100) * 100]} tickFormatter={(v: number) => num(v)}
            label={{ value: 'm³/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: C.texto }} />
          {Object.entries(umbrales).filter(([, v]) => v <= top).map(([k, v]) => (
            <ReferenceLine key={k} y={v} stroke={C.ink} strokeDasharray="4 4" label={{ value: `${TXT[k] ?? k} ${num(v)}`, position: 'right', fontSize: 10, fill: C.ink }} />
          ))}
          <Tooltip formatter={(v, n) => (n === 'banda' ? [`${(v as number[]).map((x) => num(x)).join(' – ')} m³/s`, 'Mediana – P90'] : [`${num(Number(v))} m³/s`, 'Mediana'])} />
          <Area dataKey="banda" stroke="none" fill={C.banda} fillOpacity={0.8} isAnimationActive={false} />
          <Line dataKey="med" stroke={C.brand} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
