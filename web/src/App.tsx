import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Droplet } from 'lucide-react'
import CentroDecision from '@/pages/CentroDecision'
import Ciudadania from '@/pages/Ciudadania'
import Decisores from '@/pages/Decisores'
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
  { to: '/', txt: 'Centro de decisión', end: true },
  { to: '/mapa', txt: 'Mapa' },
  { to: '/gemelo', txt: 'Gemelo' },
  { to: '/pronostico', txt: 'Pronóstico' },
  { to: '/analisis', txt: 'Análisis' },
  { to: '/tablero', txt: 'Simulador' },
  { to: '/datos', txt: 'Datos' },
  { to: '/ciudadania', txt: 'Ciudadanía' },
  { to: '/hoja-de-ruta', txt: 'Hoja de ruta' },
]

function BandaModo() {
  const { modo, setModo } = useModo()
  return (
    <div className="sticky top-0 z-[1000] border-b border-ink-navy/20 bg-brand-lima text-ink-navy">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs">
        <div role="radiogroup" aria-label="Modo de datos" className="flex overflow-hidden rounded-full border border-ink-navy font-mono font-semibold uppercase">
          {(['demo', 'hoy'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={modo === m} onClick={() => setModo(m)}
              className={`px-2.5 py-0.5 ${modo === m ? 'bg-ink-navy text-white' : 'bg-transparent'}`}>
              {m === 'demo' ? 'Demo: marzo 2023' : 'Hoy (datos reales)'}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1">
          {modo === 'demo'
            ? <><strong>Demostración:</strong> réplica simulada del ciclón Yaku (mar-2023). Clima, riesgo y mapas son reales; datos de la EPS son supuestos.</>
            : <><strong>Real:</strong> pronóstico GloFAS/ECMWF, NOAA, CENEPRED, OSM. <strong>Supuesto:</strong> reservorios, producción y conexiones de la EPS. <strong>Simulado:</strong> sensores IoT.</>}
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ModoProvider>
      <BrowserRouter>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-[1100] focus:bg-white focus:p-2">Saltar al contenido</a>
        <BandaModo />
        <header className="bg-ink-navy">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <span className="grid size-9 place-items-center rounded-lg border-2 border-white bg-brand text-white shadow-[3px_3px_0_#cbee79]"><Droplet className="size-5" aria-hidden /></span>
              <span className="wordmark text-xl sm:text-2xl">AlertaHídrica</span>
              <span className="chip ml-1">Piura</span>
            </div>
            <nav aria-label="Principal" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1">
              {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.txt}</NavLink>)}
            </nav>
          </div>
        </header>
        <main id="contenido">
          <Suspense fallback={<p role="status" className="p-8 text-center text-muted-foreground">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<CentroDecision />} />
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
