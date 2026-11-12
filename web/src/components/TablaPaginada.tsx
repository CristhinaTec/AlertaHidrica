import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type Fila = Record<string, unknown>
const celda = (v: unknown) => (v == null ? '–' : typeof v === 'number' ? v.toLocaleString('es-PE', { maximumFractionDigits: 2 }) : typeof v === 'object' ? JSON.stringify(v) : String(v))

export function TablaPaginada({ filas, columnas, porPagina = 10, caption }: { filas: Fila[]; columnas?: string[]; porPagina?: number; caption?: string }) {
  const [pag, setPag] = useState(0)
  const cols = columnas ?? Object.keys(filas[0] ?? {})
  const n = Math.max(1, Math.ceil(filas.length / porPagina))
  const p = Math.min(pag, n - 1)
  const vista = filas.slice(p * porPagina, (p + 1) * porPagina)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border tabla-marca">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="text-left text-xs">
            <tr>{cols.map((c) => <th key={c} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {vista.map((f, i) => (
              <tr key={i} className="border-t">
                {cols.map((c) => <td key={c} className={`max-w-64 truncate px-2 py-1.5 ${typeof f[c] === 'number' ? 'text-right tabular-nums' : ''}`} title={celda(f[c])}>{celda(f[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filas.length.toLocaleString('es-PE')} filas · página {p + 1} de {n}</span>
        <span className="flex gap-1">
          <Button size="sm" variant="outline" disabled={p === 0} onClick={() => setPag(p - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={p >= n - 1} onClick={() => setPag(p + 1)}>Siguiente</Button>
        </span>
      </div>
    </div>
  )
}
