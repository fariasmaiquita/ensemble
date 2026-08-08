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
 * Poster and profile URLs.
 *
 * TMDB serves images from a separate CDN host with fixed width buckets; asking for
 * an arbitrary size returns nothing, so the sizes here are the real supported ones.
 */
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type PosterSize = "w185" | "w342" | "w500" | "original";
export type ProfileSize = "w185" | "h632" | "original";

export function posterUrl(path: string | null, size: PosterSize = "w342"): string | null {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

export function profileUrl(path: string | null, size: ProfileSize = "w185"): string | null {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}
