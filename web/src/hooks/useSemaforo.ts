import { useMemo, useState } from 'react'
import { construirLocalidades, construirPlantas, escenarios, type Escenario } from '@/data/escenarios'
import { evaluar, type Amenaza, type Nivel } from '@/lib/semaforo'

const ORDEN: Record<Nivel, number> = { rojo: 0, naranja: 1, amarillo: 2, verde: 3 }

/** Estado del escenario (simulado) y resultados del motor del semáforo. Luego vendrá de Supabase. */
export function useSemaforo(inicial = 'hoy') {
  const [escId, setEscId] = useState(inicial)
  const esc0 = escenarios.find((e) => e.id === escId) as Escenario
  const [amenaza, setAmenaza] = useState<Amenaza>(esc0.amenaza)
  const [turbiedad, setTurbiedad] = useState<Record<string, number>>(esc0.plantas)

  const cambiarEscenario = (id: string) => {
    const e = escenarios.find((x) => x.id === id)!
    setEscId(id); setAmenaza(e.amenaza); setTurbiedad(e.plantas)
  }

  const items = useMemo(() => {
    const esc = { ...esc0, amenaza, plantas: turbiedad }
    const plantas = construirPlantas(esc)
    return construirLocalidades(esc)
      .map((loc) => {
        const planta = plantas.find((p) => p.id === loc.plantaId)!
        return { loc, planta, r: evaluar(loc, planta, amenaza) }
      })
      .sort((a, b) => ORDEN[a.r.nivel] - ORDEN[b.r.nivel] || a.r.autonomiaH - b.r.autonomiaH)
  }, [esc0, amenaza, turbiedad])

  return { escId, cambiarEscenario, amenaza, setAmenaza, turbiedad, setTurbiedad, items }
}
