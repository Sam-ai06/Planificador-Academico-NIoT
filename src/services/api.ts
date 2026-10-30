export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    if (!response.ok)
        throw new Error(`Error del servicio (${response.status})`);
    return response.json() as Promise<T>;
}
