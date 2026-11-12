import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Home, Thermometer } from 'lucide-react'
import { InfoTip } from '@/components/InfoTip'
import { Disclosure } from '@/components/Disclosure'
import { useDatos } from '@/hooks/useDatos'
import type { Pronostico } from '@/lib/datos'

const PASOS = [
  ['Anticipa', 'Lee el mar, la lluvia y los ríos hasta 15 días antes.'],
  ['Calcula horas de agua', 'Estima cuántas horas de agua le quedan a cada localidad.'],
  ['Activa la respuesta', 'Dice qué hacer, quién y en cuánto tiempo.'],
]

export default function Caratula() {
  const { datos: p } = useDatos<Pronostico>('pronostico.json')
  const nino = p?.nino.ultimas.at(-1)
  const anom = nino ? `${nino.nino12_anom >= 0 ? '+' : ''}${nino.nino12_anom.toFixed(1).replace('.', ',')} °C` : '…'
  return (
    <div className="hero-grid min-h-[calc(100vh-8rem)]">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-8 px-4 py-12 sm:py-20">
        <div>
          <p className="mono-label">Hackathon Sunass · Piura</p>
          <h1 className="wordmark mt-2 text-5xl leading-none sm:text-7xl" style={{ color: 'var(--brand)' }}>AlertaHídrica<br />Piura</h1>
        </div>

        <div className="space-y-2 text-ink-navy">
          <p className="text-xl font-medium sm:text-2xl">Sabemos que viene El Niño.</p>
          <p className="text-3xl font-extrabold leading-tight sm:text-4xl">
            Sin embargo, ¿sabemos <span className="titulo-lima">cuánto tiempo tendremos agua</span>?
          </p>
        </div>

        <div className="space-y-1 text-ink-navy">
          <p className="flex items-center gap-2 text-xl font-semibold">
            <Thermometer className="size-5 text-brand" aria-hidden />
            Mar frente a Piura <span className="tabular-nums">{anom}</span>
            <InfoTip label="Qué significa este dato">
              <strong>Fuente:</strong> NOAA, anomalía Niño 1+2{nino ? `, semana ${nino.semana}` : ''}.<br />
              Es cuánto más caliente está el mar frente a Piura que lo normal. Más calor = más lluvia y huaicos.
            </InfoTip>
          </p>
          <p className="text-sm text-ink-gris">Alerta de El Niño costero vigente (ENFEN)</p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          <Link to="/decision" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink-navy bg-ink-navy px-5 py-4 text-lg font-bold text-white shadow-[4px_4px_0_var(--brand-lima)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <span className="flex items-center gap-2"><Building2 className="size-5" aria-hidden /> Soy autoridad / EPS</span><ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link to="/ciudadania" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink-navy bg-card px-5 py-4 text-lg font-bold text-ink-navy transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <span className="flex items-center gap-2"><Home className="size-5" aria-hidden /> Soy vecina o vecino</span><ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>

        <Disclosure titulo="¿Cómo funciona?" className="w-full">
          <ol className="space-y-2">
            {PASOS.map(([t, d], i) => (
              <li key={t} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand font-mono text-xs font-bold text-white">{i + 1}</span>
                <span><strong className="text-ink-navy">{t}.</strong> <span className="text-ink-gris">{d}</span></span>
              </li>
            ))}
          </ol>
          <Link to="/hoja-de-ruta" className="mt-3 inline-block text-sm font-semibold text-brand-ink underline underline-offset-4">Ver hoja de ruta</Link>
        </Disclosure>
      </div>
    </div>
  )
}
