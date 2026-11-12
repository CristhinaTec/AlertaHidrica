import type { Nivel } from '@/lib/semaforo'
import { NIVEL_ICONO, NIVEL_TXT } from '@/lib/mensajes'
import { cn } from '@/lib/utils'

export const NIVEL_BG: Record<Nivel, string> = {
  verde: 'bg-sem-verde text-white',
  amarillo: 'bg-sem-amarillo text-[#3a2e00]',
  naranja: 'bg-sem-naranja text-white',
  rojo: 'bg-sem-rojo text-white',
}
export const NIVEL_HEX: Record<Nivel, string> = {
  verde: '#1e8e4f', amarillo: '#f2c230', naranja: '#e06c0b', rojo: '#c93030',
}

/** Color + palabra + forma: nunca solo color (accesible para daltonismo). */
export function NivelBadge({ nivel, size = 'sm', className }: { nivel: Nivel; size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide',
        size === 'lg' ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs',
        NIVEL_BG[nivel], className,
      )}
    >
      <span aria-hidden>{NIVEL_ICONO[nivel]}</span>
      {NIVEL_TXT[nivel]}
    </span>
  )
}
