/**
 * Resolves full backend API URL. In local dev with Vite proxy, it defaults to empty string ("").
 * On Render / production deployment, it reads from VITE_BACKEND_URL.
 */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${BACKEND_URL}${cleanEndpoint}`;
}
