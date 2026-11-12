import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import type { Localidad, Resultado } from '@/lib/semaforo'
import { NIVEL_HEX } from './NivelBadge'
import { NIVEL_TXT } from '@/lib/mensajes'

interface Props {
  items: { loc: Localidad; r: Resultado }[]
  seleccion: string
  onSelect: (id: string) => void
}

export function Mapa({ items, seleccion, onSelect }: Props) {
  return (
    <MapContainer center={[-4.95, -80.9]} zoom={8} scrollWheelZoom={false} className="h-full min-h-[320px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map(({ loc, r }) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={8 + Math.sqrt(loc.conexiones) / 25}
          pathOptions={{
            color: loc.id === seleccion ? '#1d1b3a' : '#ffffff',
            weight: loc.id === seleccion ? 4 : 2,
            fillColor: NIVEL_HEX[r.nivel],
            fillOpacity: 0.9,
          }}
          eventHandlers={{ click: () => onSelect(loc.id) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <strong>{loc.nombre}</strong> · {NIVEL_TXT[r.nivel]}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
