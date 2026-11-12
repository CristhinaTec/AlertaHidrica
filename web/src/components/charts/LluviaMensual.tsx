import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '@/lib/datos'
import { C, eje, num } from './estilo'

/** Lluvia mensual (mm) de una localidad. */
export function LluviaMensual({ s, loc, desde = '2000-01' }: { s: Series; loc: string; desde?: string }) {
  const datos = useMemo(() => s.lluvia_mensual.filter((d) => d.mes >= desde).map((d) => ({ mes: d.mes, mm: d[loc] as number | null })), [s, loc, desde])
  return (
    <div className="h-60 w-full" role="img" aria-label={`Lluvia mensual en ${s.localidades[loc]}`}>
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={C.rejilla} vertical={false} />
          <XAxis dataKey="mes" tick={eje} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
          <YAxis tick={eje} width={48} label={{ value: 'mm/mes', angle: -90, position: 'insideLeft', fontSize: 11, fill: C.texto }} />
          <Tooltip formatter={(v) => [`${num(Number(v))} mm`, 'Lluvia del mes']} />
          <Bar dataKey="mm" fill={C.brand} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
