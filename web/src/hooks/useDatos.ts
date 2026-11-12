import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

/** Carga (y cachea) un archivo de /public/data. */
export function cargar<T>(archivo: string): Promise<T> {
  if (!cache.has(archivo)) {
    cache.set(archivo, fetch(`/data/${archivo}`).then((r) => {
      if (!r.ok) throw new Error(`${archivo}: HTTP ${r.status}`)
      return r.json()
    }).catch((e) => { cache.delete(archivo); throw e }))
  }
  return cache.get(archivo) as Promise<T>
}

export function useDatos<T>(archivo: string) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    cargar<T>(archivo).then((d) => vivo && setDatos(d)).catch((e) => vivo && setError(String(e)))
    return () => { vivo = false }
  }, [archivo])
  return { datos, error, cargando: !datos && !error }
}
