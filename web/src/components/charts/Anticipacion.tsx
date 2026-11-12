import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EventoN2 } from '@/lib/datos'
import { C, eje } from './estilo'

/** Semanas de anticipación del aviso Niño 1+2 por año con caudal sobre umbral. */
export function Anticipacion({ eventos }: { eventos: EventoN2[] }) {
  const datos = eventos.filter((e) => e.primer_dia_caudal_sobre_umbral)
    .map((e) => ({ anio: e.anio_hidrologico, sem: e.anticipacion_semanas ?? 0, ok: e.resultado === 'acierto' }))
  return (
    <div className="w-full" style={{ height: 40 + datos.length * 30 }} role="img" aria-label="Semanas de anticipación por evento">
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 14 }}>
          <CartesianGrid stroke={C.rejilla} horizontal={false} />
          <XAxis type="number" tick={eje} label={{ value: 'semanas de anticipación', position: 'insideBottom', offset: -10, fontSize: 11, fill: C.texto }} />
          <YAxis type="category" dataKey="anio" tick={eje} width={72} />
          <Tooltip formatter={(v, _n, p) => [`${v} semanas${(p.payload as { ok: boolean }).ok ? '' : ' (no anticipado)'}`, 'Anticipación']} />
          <Bar dataKey="sem" isAnimationActive={false} fill={C.brand}>
            <LabelList dataKey="sem" position="right" fontSize={11} fill={C.ink}
              formatter={(v: number) => (v ? `${v} sem` : 'sin aviso')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
