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
  defaultRoute?: number[][]
  stops?: Station[]
  className?: string
}

export default function RouteMap({ stations = [], route = [], defaultRoute = [], stops = [], className = '' }: Props) {
  const routePoints: [number, number][] = route.map(([lon, lat]) => [lat, lon])
  const defaultPoints: [number, number][] = defaultRoute.map(([lon, lat]) => [lat, lon])
  const stationPoints: [number, number][] = stations.map((station) => [station.latitude, station.longitude])
  const fitPoints = routePoints.length ? routePoints : stationPoints
  return (
    <div className={`map-wrap ${className}`}>
      <MapContainer center={fitPoints[0] || [20.5937, 78.9629]} zoom={5} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {defaultPoints.length > 0 && <Polyline positions={defaultPoints} pathOptions={{ color: '#79cdb2', weight: 4, opacity: 0.45, dashArray: '10 10' }} />}
        {routePoints.length > 0 && <Polyline positions={routePoints} pathOptions={{ color: '#06d6a0', weight: 8, opacity: 0.98 }} />}
        {routePoints.length > 0 && <CircleMarker center={routePoints[0]} radius={8} pathOptions={{ color: '#04785e', fillColor: '#f8ffe5', fillOpacity: 1, weight: 3 }}><Popup>Journey start</Popup></CircleMarker>}
        {routePoints.length > 0 && <CircleMarker center={routePoints[routePoints.length - 1]} radius={8} pathOptions={{ color: '#04785e', fillColor: '#06d6a0', fillOpacity: 1, weight: 3 }}><Popup>Destination</Popup></CircleMarker>}
        {stations.slice(0, 250).map((station) => {
          const isStop = stops.some((stop) => stop.osm_key === station.osm_key)
          return (
            <CircleMarker key={station.osm_key} center={[station.latitude, station.longitude]} radius={isStop ? 9 : 6} pathOptions={{ color: '#04785e', fillColor: isStop ? '#04785e' : '#f8ffe5', fillOpacity: 1, weight: 2 }}>
              <Popup><strong>{station.name}</strong><br />{station.opening_status || 'Opening status unavailable'}<br />{station.connectors.join(', ') || 'Connector data unavailable'}{station.power_kw ? <><br />{station.power_kw} kW</> : null}{station.detour_km !== undefined ? <><br />{station.detour_km} km from route</> : null}</Popup>
            </CircleMarker>
          )
        })}
        <FitMap points={fitPoints} />
      </MapContainer>
      {routePoints.length > 0 && <div className="map-legend"><span><i className="legend-friendly" />Charging-Friendly Route</span><span><i className="legend-default" />Default Route</span><span><i className="legend-station" />EV Charging Station</span></div>}
    </div>
  )
}
