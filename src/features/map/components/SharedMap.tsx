"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery, Driver } from "@/shared/types/delivery";
import "leaflet/dist/leaflet.css";

function createPinIcon(color: string, isLarge: boolean): L.DivIcon {
  const size = isLarge ? 20 : 14;
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="width:${size}px;height:${size}px;background-color:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Props = {
  deliveries: Delivery[];
  drivers: Driver[];
};

export function SharedMap({ deliveries, drivers }: Props) {
  const plotted = deliveries.filter((d) => d.lat != null && d.lng != null);
  const center: [number, number] = plotted.length > 0
    ? [plotted[0].lat!, plotted[0].lng!]
    : [35.4, 139.5];

  return (
    <MapContainer center={center} zoom={11} className="h-full w-full" style={{ minHeight: "500px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {plotted.map((d) => {
        const color = d.colorCode || "#9CA3AF";
        const icon = createPinIcon(color, d.volume >= 1000);
        return (
          <Marker key={d.id} position={[d.lat!, d.lng!]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{d.destinationName}</p>
                <p>{d.address}</p>
                <p>容積: {d.volume}L / 重量: {d.actualWeight}kg</p>
                {d.driverName && <p>担当: {d.driverName}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
