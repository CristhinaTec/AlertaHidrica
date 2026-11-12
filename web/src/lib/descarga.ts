export function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function aCSV(filas: Record<string, unknown>[]): string {
  const cols = [...new Set(filas.flatMap((f) => Object.keys(f)))]
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n')
}
