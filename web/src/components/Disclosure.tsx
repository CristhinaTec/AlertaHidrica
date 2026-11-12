import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Bloque plegable nativo (details/summary): accesible por teclado sin JS extra. */
export function Disclosure({ titulo, children, className, abierto, onToggle }: { titulo: ReactNode; children: ReactNode; className?: string; abierto?: boolean; onToggle?: (a: boolean) => void }) {
  return (
    <details open={abierto} onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      className={cn('group/dis rounded-xl border bg-card', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{titulo}</span>
        <ChevronDown className="size-4 shrink-0 transition group-open/dis:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}
