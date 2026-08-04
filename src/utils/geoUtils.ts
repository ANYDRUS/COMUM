import { Comunidade } from '../types';

export function hasValidCoordinates(c: Partial<Comunidade> | null | undefined): boolean {
  if (!c) return false;
  if (c.LAT === null || c.LAT === undefined || c.LON === null || c.LON === undefined) {
    return false;
  }
  const latStr = String(c.LAT).trim();
  const lonStr = String(c.LON).trim();
  if (!latStr || !lonStr) return false;

  const lat = parseFloat(latStr.replace(',', '.'));
  const lon = parseFloat(lonStr.replace(',', '.'));

  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;

  return true;
}
