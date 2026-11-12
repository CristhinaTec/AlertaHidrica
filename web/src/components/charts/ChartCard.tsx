import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Bloque de gráfico: el título dice el hallazgo; una frase de lectura; aviso opcional. */
export function ChartCard({ titulo, lectura, aviso, fuente, children }: {
  titulo: string; lectura?: string; aviso?: string; fuente?: string; children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base leading-snug text-brand-ink">{titulo}</CardTitle>
        {lectura && <p className="text-sm text-muted-foreground">{lectura}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
        {aviso && (
          <p className="flex items-start gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-brand-ink">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span><strong>Ojo:</strong> {aviso}</span>
          </p>
        )}
        {fuente && <p className="text-xs text-muted-foreground">Fuente: {fuente}</p>}
      </CardContent>
    </Card>
  )
}

export function Cargando({ error }: { error?: string | null }) {
  return <p role="status" className="p-6 text-center text-sm text-muted-foreground">{error ? `No se pudo cargar: ${error}` : 'Cargando datos…'}</p>
}
