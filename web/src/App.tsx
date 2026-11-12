import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ChevronDown, Droplet } from 'lucide-react'
import CentroDecision from '@/pages/CentroDecision'
import Caratula from '@/pages/Caratula'
import Ciudadania from '@/pages/Ciudadania'
import Decisores from '@/pages/Decisores'
import { InfoTip } from '@/components/InfoTip'
import { ModoProvider, useModo } from '@/lib/modo'

const Analisis = lazy(() => import('@/pages/Analisis'))
const Datos = lazy(() => import('@/pages/Datos'))
const Gemelo = lazy(() => import('@/pages/Gemelo'))
const HojaRuta = lazy(() => import('@/pages/HojaRuta'))
const MapaCapas = lazy(() => import('@/pages/MapaCapas'))
const Pronostico = lazy(() => import('@/pages/Pronostico'))

const link = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide transition ${isActive ? 'bg-brand-lima text-ink-navy' : 'text-white/90 hover:bg-white/15'}`

const NAV = [
  { to: '/decision', txt: 'Decidir' },
  { to: '/gemelo', txt: 'Gemelo' },
  { to: '/mapa', txt: 'Mapa' },
  { to: '/ciudadania', txt: 'Ciudadanía' },
]
const MAS = [
  { to: '/pronostico', txt: 'Pronóstico' },
  { to: '/analisis', txt: 'Análisis' },
  { to: '/tablero', txt: 'Simulador' },
  { to: '/datos', txt: 'Datos' },
  { to: '/hoja-de-ruta', txt: 'Hoja de ruta' },
]

function MenuMas() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const activo = MAS.some((m) => pathname.startsWith(m.to))
  useEffect(() => setAbierto(false), [pathname])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={abierto} aria-controls="menu-mas" onClick={() => setAbierto(!abierto)}
        className={`${link({ isActive: activo })} flex items-center gap-1`}>
        Más <ChevronDown className={`size-3.5 transition ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {abierto && (
        <ul id="menu-mas" className="absolute right-0 top-full z-[1100] mt-2 w-48 rounded-xl border-2 border-ink-navy bg-card p-1 shadow-[4px_4px_0_var(--brand-lima)]">
          {MAS.map((m) => (
            <li key={m.to}>
              <NavLink to={m.to} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-navy hover:bg-brand-soft'}`}>{m.txt}</NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Interruptor compacto Demo / Hoy con explicación en tooltip. */
function InterruptorModo() {
  const { modo, setModo } = useModo()
  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="Modo de datos" className="flex overflow-hidden rounded-full border border-white/60 font-mono text-[11px] font-semibold uppercase">
        {(['demo', 'hoy'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)}
            className={`px-2.5 py-1 ${modo === m ? 'bg-brand-lima text-ink-navy' : 'text-white/90 hover:bg-white/15'}`}>
            {m === 'demo' ? 'Demo' : 'Hoy'}
          </button>
        ))}
      </div>
      <InfoTip label="Qué es real, supuesto y demo" align="right" className="[&>button]:text-white [&>button:hover]:bg-white/15">
        <strong>Demo:</strong> réplica del ciclón Yaku (marzo 2023).<br />
        <strong>Hoy:</strong> pronóstico del día.<br />
        <strong>Real:</strong> GloFAS/ECMWF, NOAA, CENEPRED, OSM.<br />
        <strong>Supuesto:</strong> reservorios, producción y conexiones de la EPS.<br />
        <strong>Simulado:</strong> sensores IoT.
      </InfoTip>
    </div>
  )
}

export default function App() {
  return (
    <ModoProvider>
      <BrowserRouter>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-[1100] focus:bg-white focus:p-2">Saltar al contenido</a>
        <header className="sticky top-0 z-[1000] bg-ink-navy">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
            <Link to="/" className="flex items-center gap-2 rounded-lg text-white focus-visible:outline-2 focus-visible:outline-brand-lima" aria-label="AlertaHídrica Piura, inicio">
              <span className="grid size-8 place-items-center rounded-lg border-2 border-white bg-brand text-white shadow-[3px_3px_0_var(--brand-lima)]"><Droplet className="size-4" aria-hidden /></span>
              <span className="wordmark text-lg sm:text-xl">AlertaHídrica</span>
              <span className="chip">Piura</span>
            </Link>
            <div className="sm:order-last"><InterruptorModo /></div>
            <nav aria-label="Principal" className="flex w-full items-center gap-1 sm:w-auto">
              <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 py-0.5">
                {NAV.map((n) => <NavLink key={n.to} to={n.to} className={link}>{n.txt}</NavLink>)}
              </div>
              <MenuMas />
            </nav>
          </div>
        </header>
        <main id="contenido">
          <Suspense fallback={<p role="status" className="p-8 text-center text-muted-foreground">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<Caratula />} />
            <Route path="/decision" element={<CentroDecision />} />
            <Route path="/mapa" element={<MapaCapas />} />
            <Route path="/gemelo" element={<Gemelo />} />
            <Route path="/pronostico" element={<Pronostico />} />
            <Route path="/analisis" element={<Analisis />} />
            <Route path="/tablero" element={<Decisores />} />
            <Route path="/datos" element={<Datos />} />
            <Route path="/ciudadania" element={<Ciudadania />} />
            <Route path="/hoja-de-ruta" element={<HojaRuta />} />
          </Routes>
          </Suspense>
        </main>
        <footer className="mx-auto max-w-7xl px-4 py-6 text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          AlertaHídrica Piura · prototipo hackathon Sunass · no usar para decisiones reales sin validación de EPS Grau
        </footer>
      </BrowserRouter>
    </ModoProvider>
  )
}
