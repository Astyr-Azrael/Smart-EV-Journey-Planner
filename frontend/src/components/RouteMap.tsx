import { useEffect } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
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
        {defaultPoints.length > 0 && <Polyline positions={defaultPoints} pathOptions={{ color: '#04785e', weight: 5, opacity: 0.42, dashArray: '9 10' }} />}
        {routePoints.length > 0 && <Polyline positions={routePoints} pathOptions={{ color: '#06d6a0', weight: 7, opacity: 0.96 }} />}
        {routePoints.length > 0 && <CircleMarker center={routePoints[0]} radius={8} pathOptions={{ color: '#04785e', fillColor: '#f8ffe5', fillOpacity: 1, weight: 3 }}><Popup>Journey start</Popup></CircleMarker>}
        {routePoints.length > 0 && <CircleMarker center={routePoints[routePoints.length - 1]} radius={8} pathOptions={{ color: '#04785e', fillColor: '#06d6a0', fillOpacity: 1, weight: 3 }}><Popup>Destination</Popup></CircleMarker>}
        {stations.slice(0, 250).filter((station) => !stops.some((stop) => stop.osm_key === station.osm_key)).map((station) => (
          <CircleMarker key={station.osm_key} center={[station.latitude, station.longitude]} radius={4} pathOptions={{ color: '#04785e', fillColor: '#f8ffe5', fillOpacity: 0.88, weight: 1.5 }}>
            <Popup><strong>{station.name}</strong><br />{station.connectors.join(', ') || 'Confirm connector with operator'}{station.power_kw ? <><br />{station.power_kw} kW</> : null}{station.detour_km !== undefined ? <><br />{station.detour_km} km from route</> : null}</Popup>
          </CircleMarker>
        ))}
        {stops.map((stop, index) => (
          <Marker key={`stop-${stop.osm_key}`} position={[stop.latitude, stop.longitude]} icon={divIcon({ className: 'planned-stop-marker', html: `<div><span>${index + 1}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] })} zIndexOffset={1000}>
            <Popup><strong>Planned stop {index + 1}: {stop.name}</strong><br />Arrive near {stop.arrival_soc}% · charge to {stop.target_soc}%<br />About {stop.charge_minutes} min{stop.detour_km !== undefined ? <><br />{stop.detour_km} km from route</> : null}</Popup>
          </Marker>
        ))}
        <FitMap points={fitPoints} />
      </MapContainer>
      {routePoints.length > 0 && <div className="map-legend"><span><i className="legend-friendly" />Charging-friendly</span><span><i className="legend-default" />Default route</span><span><i className="legend-stop" />Planned stop</span><span><i className="legend-station" />Other charger</span></div>}
    </div>
  )
}
