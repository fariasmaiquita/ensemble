import "server-only";

/**
 * Server-only TMDB client.
 *
 * The `server-only` import is load-bearing: if any client component ever imports
 * this module, the build fails rather than shipping the access token to a browser.
 * That guarantee is why every TMDB call in this app runs on the server.
 */

const BASE_URL = "https://api.themoviedb.org/3";

/** Default cache window. TMDB metadata changes rarely; an hour is generous. */
const DEFAULT_REVALIDATE_SECONDS = 60 * 60;

export class TmdbError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

type QueryValue = string | number | boolean | undefined;

export async function tmdb<T>(
  path: string,
  params: Record<string, QueryValue> = {},
  revalidate: number = DEFAULT_REVALIDATE_SECONDS,
): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!token) {
    throw new TmdbError(
      "TMDB_READ_ACCESS_TOKEN is not set. Copy .env.example to .env.local and add your token.",
      500,
    );
  }

  const url = new URL(BASE_URL + path);
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new TmdbError(`TMDB responded ${response.status} for ${path}`, response.status);
  }

  return response.json() as Promise<T>;
}

/**
 * Image URLs live in `images.ts` and are re-exported here.
 *
 * They were defined in this file until the home page needed them in a client component,
 * where importing this module fails the build by design. Building a CDN URL needs no token,
 * so the code moved rather than the guard.
 */
export { type PosterSize, type ProfileSize, posterUrl, profileUrl } from "./images";
