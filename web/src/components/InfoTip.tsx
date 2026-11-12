import { useId, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Tooltip accesible: aparece con cursor o foco de teclado; el texto queda enlazado con aria-describedby. */
export function InfoTip({ children, label = 'Más información', className, align = 'center' }: { children: ReactNode; label?: string; className?: string; align?: 'center' | 'right' | 'left' }) {
  const id = useId()
  const pos = align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'
  return (
    <span className={cn('group/tip relative inline-flex align-middle', className)}>
      <button type="button" aria-label={label} aria-describedby={id}
        className="grid size-6 place-items-center rounded-full text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
        <Info className="size-4" aria-hidden />
      </button>
      <span role="tooltip" id={id}
        className={cn('pointer-events-none invisible absolute top-full z-[1200] mt-1 w-64 max-w-[80vw] rounded-lg border border-ink-navy bg-ink-navy p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100', pos)}>
        {children}
      </span>
    </span>
  )
}
