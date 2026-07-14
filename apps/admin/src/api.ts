const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function adminRequest<T>(
  path: string,
  key: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-key": key,
      ...init.headers
    }
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
