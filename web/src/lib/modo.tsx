import { createContext, useContext, useState, type ReactNode } from 'react'

export type Modo = 'hoy' | 'demo'
interface Ctx { modo: Modo; setModo: (m: Modo) => void; escenarioId: string }
const ModoCtx = createContext<Ctx>({ modo: 'demo', setModo: () => {}, escenarioId: 'marzo2023' })

export function leerLS<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def } catch { return def }
}
export function guardarLS(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ }
}

export function ModoProvider({ children }: { children: ReactNode }) {
  const [modo, set] = useState<Modo>(() => leerLS<Modo>('ah_modo', 'demo'))
  const setModo = (m: Modo) => { set(m); guardarLS('ah_modo', m) }
  return <ModoCtx.Provider value={{ modo, setModo, escenarioId: modo === 'demo' ? 'marzo2023' : 'hoy' }}>{children}</ModoCtx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useModo = () => useContext(ModoCtx)
