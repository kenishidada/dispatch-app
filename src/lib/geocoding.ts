type GeocodeResult = {
  lat: number;
  lng: number;
} | null;

const cache = new Map<string, GeocodeResult>();

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (cache.has(address)) return cache.get(address)!;

  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.length > 0 && data[0].geometry?.coordinates) {
        const [lng, lat] = data[0].geometry.coordinates;
        const result = { lat, lng };
        cache.set(address, result);
        return result;
      }

      cache.set(address, null);
      return null;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  return null;
}

export async function geocodeBatch(
  addresses: { id: string; address: string }[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  const uniqueAddresses = [...new Set(addresses.map((a) => a.address))];
  const concurrency = 5;
  let completed = 0;

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueAddresses.length; i += concurrency) {
    chunks.push(uniqueAddresses.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((addr) => geocodeAddress(addr))
    );
    chunk.forEach((addr, i) => {
      results.set(addr, chunkResults[i]);
    });
    completed += chunk.length;
    onProgress?.(completed, uniqueAddresses.length);
  }

  return results;
}
