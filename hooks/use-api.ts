import { useCallback } from 'react';
import { endpoints } from '@/constants/api';

/**
 * Fetch helper for calling the Next.js API routes hosted on the Visa Atlas web app.
 *
 * Usage:
 *   const api = useApi();
 *   const data = await api.post<TripResponse>(endpoints.generateTrip, { destination: 'Japan' });
 */
export function useApi() {
  const post = useCallback(
    async <T>(url: string, body: object): Promise<T> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `API error ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as T;
      return data;
    },
    [],
  );

  const get = useCallback(
    async <T>(url: string, params?: Record<string, string>): Promise<T> => {
      const queryString = params
        ? '?' + new URLSearchParams(params).toString()
        : '';
      const response = await fetch(`${url}${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `API error ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as T;
      return data;
    },
    [],
  );

  return { post, get };
}
