import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '@/lib/datos'
import { C, UMBRALES_PIURA, eje, num } from './estilo'

const EVENTOS = [
  { x1: '1997-12-01', x2: '1998-05-31', txt: 'Niño 1998' },
  { x1: '2017-01-15', x2: '2017-04-30', txt: 'Niño costero 2017' },
  { x1: '2023-02-15', x2: '2023-05-31', txt: 'Yaku 2023' },
]

/** Caudal semanal máximo del río Piura con umbrales y eventos marcados. */
export function SerieCaudal({ s, desde = '1997-01-01' }: { s: Series; desde?: string }) {
  const datos = useMemo(() => s.caudal_semanal.filter((d) => d.semana >= desde && d.piura != null), [s, desde])
  const semana = (f: string) => datos.find((d) => d.semana >= f)?.semana ?? f
  return (
    <div className="h-72 w-full" role="img" aria-label="Caudal semanal máximo del río Piura 1997-2025 con umbrales 900, 1290 y 1900 m³/s">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 18, right: 96, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={C.rejilla} vertical={false} />
          {EVENTOS.map((e) => (
            <ReferenceArea key={e.txt} x1={semana(e.x1)} x2={semana(e.x2)} fill={C.banda} fillOpacity={0.4}
              label={{ value: e.txt, position: 'insideTop', fontSize: 10, fill: C.ink }} />
          ))}
          <XAxis dataKey="semana" tick={eje} tickFormatter={(v: string) => v.slice(0, 4)} minTickGap={40} />
          <YAxis tick={eje} width={56} tickFormatter={(v: number) => num(v)}
            label={{ value: 'm³/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: C.texto }} />
          {UMBRALES_PIURA.map((u) => (
            <ReferenceLine key={u.v} y={u.v} stroke={C.ink} strokeDasharray="4 4"
              label={{ value: u.txt, position: 'right', fontSize: 10, fill: C.ink }} />
          ))}
          <Tooltip formatter={(v) => [`${num(Number(v))} m³/s`, 'Caudal máx. semanal']} labelFormatter={(l) => `Semana del ${l}`} />
          <Line dataKey="piura" stroke={C.brand} dot={false} strokeWidth={1.4} isAnimationActive={false} name="Río Piura" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
