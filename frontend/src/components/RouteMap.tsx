import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Station } from '../types'

function FitMap({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [35, 35], maxZoom: 13 })
  }, [map, points])
  return null
}

type Props = {
  stations?: Station[]
  route?: number[][]
  stops?: Station[]
  className?: string
}

export default function RouteMap({ stations = [], route = [], stops = [], className = '' }: Props) {
  const routePoints: [number, number][] = route.map(([lon, lat]) => [lat, lon])
  const stationPoints: [number, number][] = stations.map((station) => [station.latitude, station.longitude])
  const fitPoints = routePoints.length ? routePoints : stationPoints
  return (
    <div className={`map-wrap ${className}`}>
      <MapContainer center={fitPoints[0] || [20.5937, 78.9629]} zoom={5} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routePoints.length > 0 && <Polyline positions={routePoints} pathOptions={{ color: '#06d6a0', weight: 6, opacity: 0.95 }} />}
        {routePoints.length > 0 && <CircleMarker center={routePoints[0]} radius={8} pathOptions={{ color: '#07110e', fillColor: '#06d6a0', fillOpacity: 1, weight: 3 }}><Popup>Journey start</Popup></CircleMarker>}
        {routePoints.length > 0 && <CircleMarker center={routePoints[routePoints.length - 1]} radius={8} pathOptions={{ color: '#07110e', fillColor: '#ff3158', fillOpacity: 1, weight: 3 }}><Popup>Destination</Popup></CircleMarker>}
        {stations.slice(0, 250).map((station) => {
          const isStop = stops.some((stop) => stop.osm_key === station.osm_key)
          return (
            <CircleMarker key={station.osm_key} center={[station.latitude, station.longitude]} radius={isStop ? 9 : 5} pathOptions={{ color: isStop ? '#ff3158' : '#07110e', fillColor: isStop ? '#ff3158' : '#f8ffe5', fillOpacity: 1, weight: 2 }}>
              <Popup><strong>{station.name}</strong><br />{station.operator || 'Operator not listed'}<br />{station.connectors.join(', ') || 'Connector data unavailable'}</Popup>
            </CircleMarker>
          )
        })}
        <FitMap points={fitPoints} />
      </MapContainer>
    </div>
  )
}
