import type { Response } from 'supertest';

export function readBody<T>(response: Response): T {
  const body = response.body as unknown;
  return body as T;
}
