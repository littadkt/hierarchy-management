export interface GeoCoordinates {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

/**
 * Capture current device GPS coordinates using the HTML5 Geolocation API.
 * Gracefully resolves with nulls if permission is denied, timed out, or unsupported.
 */
export async function getBrowserLocation(): Promise<GeoCoordinates> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return { latitude: null, longitude: null, accuracy: null };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn("[Geolocation] Could not obtain position:", err.message);
        resolve({ latitude: null, longitude: null, accuracy: null });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Generate a standard Google Maps link for the given coordinates.
 */
export function getGoogleMapsUrl(latitude?: number | null, longitude?: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
