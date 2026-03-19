"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery, Driver } from "@/shared/types/delivery";
import "leaflet/dist/leaflet.css";

function createPinIcon(color: string, isLarge: boolean): L.DivIcon {
  const w = isLarge ? 24 : 18;
  const h = isLarge ? 32 : 24;
  return L.divIcon({
    className: "custom-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="11" r="4.5" fill="white" opacity="0.9"/>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
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
