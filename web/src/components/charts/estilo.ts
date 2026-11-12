/** Paleta de series: brand + grises. El semáforo queda reservado para estados. */
export const C = {
  brand: '#6d61eb', ink: '#1d1b3a', gris: '#656162', grisClaro: '#ddd3df', banda: '#d6cdf6', rejilla: '#eee6ec', texto: '#5c585a',
}
export const UMBRALES_PIURA = [
  { v: 900, txt: 'Atención 900' },
  { v: 1290, txt: 'Precaución 1 290' },
  { v: 1900, txt: 'Emergencia 1 900' },
]
export const eje = { fontSize: 11, fill: C.texto }
export const num = (n: number | null | undefined, d = 0) =>
  n == null || Number.isNaN(n) ? '–' : n.toLocaleString('es-PE', { maximumFractionDigits: d })
