import Image from "next/image";
import { tmdb, posterUrl, profileUrl, TmdbError } from "@/lib/tmdb";
import {
  type MultiSearchResult,
  type Paginated,
  displayTitle,
  isPerson,
  releaseYear,
} from "@/lib/types";

/**
 * Search lives in the URL rather than in component state.
 *
 * That makes a result set shareable, makes the back button behave, and lets the
 * whole page render on the server — which is what keeps the TMDB token off the
 * client. The cost is that this plain form submits on enter rather than filtering
 * as you type; a debounced client input that pushes to the same URL comes later.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Ensemble</h1>
      <p className="mt-1 text-sm opacity-70">
        Scaffold — searching TMDB from the server.
      </p>

      <form className="mt-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search films, series, people…"
          aria-label="Search films, series and people"
          className="flex-1 rounded border border-current/20 bg-transparent px-3 py-2"
        />
        <button type="submit" className="rounded border border-current/20 px-4 py-2">
          Search
        </button>
      </form>

      {query ? <Results query={query} /> : null}
    </main>
  );
}

async function Results({ query }: { query: string }) {
  let data: Paginated<MultiSearchResult>;

  try {
    data = await tmdb<Paginated<MultiSearchResult>>("/search/multi", {
      query,
      include_adult: false,
      page: 1,
    });
  } catch (error) {
    const message =
      error instanceof TmdbError ? error.message : "Something went wrong reaching TMDB.";
    return (
      <p role="alert" className="mt-8 rounded border border-red-500/40 p-4 text-sm">
        {message}
      </p>
    );
  }

  if (data.results.length === 0) {
    return <p className="mt-8 text-sm opacity-70">No results for “{query}”.</p>;
  }

  return (
    <>
      <p className="mt-8 text-sm opacity-70">
        {data.total_results.toLocaleString()} results for “{query}”
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {data.results.map((result) => {
          const image = isPerson(result)
            ? profileUrl(result.profile_path)
            : posterUrl(result.poster_path);
          const year = releaseYear(result);

          return (
            <li key={`${result.media_type}-${result.id}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded bg-current/10">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-snug">{displayTitle(result)}</p>
              <p className="text-xs opacity-60">
                {result.media_type}
                {year ? ` · ${year}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
