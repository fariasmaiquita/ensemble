import { tmdb, TmdbError } from "@/lib/tmdb";
import type { MultiSearchResult, Paginated } from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { ResultRow } from "@/components/result-row";
import { HomeLibrary } from "@/components/home-library";

/**
 * Search state lives in the URL rather than in component state — see decisions.md #5.
 *
 * With no query, this is the library page: sections computed from what you have marked,
 * joined to what TMDB knows about it. Nothing on it comes from what anyone else is
 * watching, which is the rule the whole page was designed to.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead />
      <SearchField query={query} />
      {query ? <Results query={query} /> : <HomeLibrary />}
    </div>
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
      <p
        role="alert"
        className="text-body text-accent border-accent/30 mt-10 border-l-2 pl-4"
      >
        {message}
      </p>
    );
  }

  if (data.results.length === 0) {
    return (
      <p className="text-body text-ink-muted pt-10">
        Nothing found for <em className="editorial text-ink not-italic">{query}</em>.
      </p>
    );
  }

  return (
    <section>
      <p className="label text-ink-faint pt-8 pb-2">
        {data.total_results.toLocaleString()}{" "}
        {data.total_results === 1 ? "result" : "results"}
      </p>
      <ul className="divide-rule divide-y">
        {data.results.map((result) => (
          <ResultRow key={`${result.media_type}-${result.id}`} result={result} />
        ))}
      </ul>
    </section>
  );
}
