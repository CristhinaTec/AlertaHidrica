import { useState } from 'react'
import { Copy, MapPin, Volume2 } from 'lucide-react'
import { NIVEL_BG } from '@/components/NivelBadge'
import { Button } from '@/components/ui/button'
import { useSemaforo } from '@/hooks/useSemaforo'
import { consejosCiudadano, NIVEL_ICONO, NIVEL_TXT, smsCiudadano } from '@/lib/mensajes'

const horasTexto = (h: number) =>
  !Number.isFinite(h) || h > 72 ? 'más de 3 días' : h >= 24 ? `unos ${Math.round(h / 24)} día(s)` : `unas ${Math.max(1, Math.round(h))} horas`

export default function Ciudadania() {
  const { items } = useSemaforo('hoy')
  const [id, setId] = useState('')
  const sel = items.find((i) => i.loc.id === id)

  const escuchar = (texto: string) => {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-PE'
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-6 text-[18px]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">AguaSegura Piura</p>
        <p className="mono-label">Ciudadanía · tu zona</p><h1 className="text-3xl font-extrabold leading-tight text-ink-navy">¿Cómo está el agua en mi zona?</h1>
      </div>

      <label className="block space-y-2">
        <span className="text-base text-muted-foreground">Elige tu distrito</span>
        <select value={id} onChange={(e) => setId(e.target.value)}
          className="w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-lg focus:border-brand focus:outline-none">
          <option value="">Selecciona…</option>
          {[...items].sort((a, b) => a.loc.nombre.localeCompare(b.loc.nombre)).map(({ loc }) => (
            <option key={loc.id} value={loc.id}>{loc.nombre}</option>
          ))}
        </select>
      </label>

      {sel && (() => {
        const { loc, r } = sel
        const resumen = `${NIVEL_TXT[r.nivel]} en ${loc.nombre}. Tu zona tiene agua para ${horasTexto(r.autonomiaH)}. ${consejosCiudadano(r.nivel).join(' ')}`
        return (
          <section aria-live="polite" className="space-y-4">
            <div className={`rounded-2xl p-5 ${NIVEL_BG[r.nivel]}`}>
              <div className="flex items-center gap-2 text-2xl font-bold">
                <span aria-hidden>{NIVEL_ICONO[r.nivel]}</span>{NIVEL_TXT[r.nivel]}
              </div>
              <p className="mt-2 text-xl">
                {r.nivel === 'verde' ? 'El servicio está normal.' : <>Tu zona tiene agua para <strong>{horasTexto(r.autonomiaH)}</strong>.</>}
              </p>
            </div>

            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="mb-2 font-semibold">Qué hacer</h2>
              <ol className="list-decimal space-y-1.5 pl-6">
                {consejosCiudadano(r.nivel).map((c) => <li key={c}>{c}</li>)}
              </ol>
              {r.nivel !== 'verde' && (
                <p className="mt-4 flex items-start gap-2 text-base">
                  <MapPin className="mt-1 size-5 shrink-0 text-brand" />
                  <span>Punto de apoyo: <strong>{loc.puntoApoyo}</strong></span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => escuchar(resumen)}><Volume2 className="size-5" /> Escuchar</Button>
              <Button size="lg" variant="outline" onClick={() => navigator.clipboard?.writeText(smsCiudadano(loc, r))}>
                <Copy className="size-5" /> Copiar aviso para reenviar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">El botón “Copiar aviso” sirve a promotoras y vecinas para reenviar por WhatsApp o leer en la radio.</p>
          </section>
        )
      })()}

      <div className="rounded-2xl border border-dashed p-4 text-base">
        <h2 className="font-semibold">Recibe alertas por SMS</h2>
        <p className="text-sm text-muted-foreground">Solo pedimos tu celular y distrito. Puedes darte de baja cuando quieras (Ley N.º 29733).</p>
        <div className="mt-3 flex gap-2">
          <input disabled placeholder="Celular (demo)" className="flex-1 rounded-lg border bg-muted px-3 py-2" />
          <Button disabled>Suscribirme</Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Prototipo con datos simulados.</p>
    </div>
  )
}
