/**
 * Poster and profile URLs.
 *
 * Split out of `tmdb.ts` when the home page arrived, and the reason is the whole point of
 * that file's first line: `tmdb.ts` imports `server-only`, so anything importing it from a
 * browser bundle fails the build rather than shipping the access token. That guard is
 * load-bearing (#4) and should not be loosened — but building an image URL needs no token,
 * no network and no secret. It is string concatenation that happened to be filed next to
 * something dangerous.
 *
 * So the URLs move here, where both sides can have them, and `tmdb.ts` re-exports them so
 * that every existing server-side import keeps working unchanged.
 *
 * TMDB serves images from a separate CDN host with fixed width buckets; asking for an
 * arbitrary size returns nothing, so the sizes here are the real supported ones.
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
