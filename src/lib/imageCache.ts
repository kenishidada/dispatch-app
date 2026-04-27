async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedImageRules(
  areaImages: string[],
  courses: Array<{ id: string; name: string }>
): Promise<{ key: string; cached: string | null }> {
  const perImageHashes = await Promise.all(areaImages.map(sha256));
  const imagesHash = await sha256(perImageHashes.join("|"));
  const coursesHash = await sha256(JSON.stringify(courses.map((c) => `${c.id}:${c.name}`)));
  const key = `area-rules-${imagesHash}-${coursesHash}`;
  const cached = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  return { key, cached };
}

export function setCachedImageRules(key: string, value: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}
