import type { ReactNode } from 'react'

/** Hero de página: etiqueta mono + título con barra violeta y subrayado lima + frase de decisión. */
export function PageHero({ etiqueta, titulo, frase, children }: { etiqueta: string; titulo: string; frase: string; children?: ReactNode }) {
  return (
    <header className="hero-grid -mx-4 flex flex-wrap items-end justify-between gap-4 rounded-b-2xl px-4 pb-5 pt-4 sm:mx-0 sm:rounded-2xl sm:px-6">
      <div className="border-l-4 border-brand pl-3">
        <p className="mono-label">{etiqueta}</p>
        <h1 className="titulo-lima mt-1 text-2xl font-extrabold text-ink-navy sm:text-3xl">{titulo}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-gris">{frase}</p>
      </div>
      {children}
    </header>
  )
}
