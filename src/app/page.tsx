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
 * Search state lives in the URL rather than in component state — see decisions.md #5.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead />
      <SearchField query={query} />
      {query ? <Results query={query} /> : <EmptyState />}
    </div>
  );
}

function Masthead() {
  return (
    <header className="border-rule border-b pt-16 pb-6">
      <h1 className="editorial text-display text-ink">Ensemble</h1>
      <p className="label text-ink-muted mt-3">
        Films &amp; television — by what connects them
      </p>
    </header>
  );
}

function SearchField({ query }: { query: string }) {
  return (
    <form className="border-rule flex items-baseline gap-4 border-b py-5">
      <label htmlFor="q" className="label text-ink-faint shrink-0">
        Search
      </label>
      <input
        id="q"
        type="search"
        name="q"
        defaultValue={query}
        placeholder="A film, a series, a person…"
        autoComplete="off"
        className="text-subtitle editorial text-ink placeholder:text-ink-faint w-full bg-transparent outline-none placeholder:italic"
      />
    </form>
  );
}

function EmptyState() {
  return (
    <p className="text-body text-ink-muted max-w-md pt-10 italic">
      Every film in a franchise in one place. The faces that recur across what you love.
      Whether a series is still running before you start it.
    </p>
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

function ResultRow({ result }: { result: MultiSearchResult }) {
  const person = isPerson(result);
  const image = person ? profileUrl(result.profile_path) : posterUrl(result.poster_path);
  const year = releaseYear(result);
  const category = person ? "Person" : result.media_type === "movie" ? "Film" : "Series";

  return (
    <li className="flex gap-5 py-6">
      <Plate src={image} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="editorial text-title text-ink truncate">{displayTitle(result)}</h2>
          {year ? (
            <span className="label text-ink-faint shrink-0 tabular-nums">{year}</span>
          ) : null}
        </div>

        <p className="label text-ink-muted mt-1.5">
          {category}
          {person && result.known_for_department ? ` · ${result.known_for_department}` : ""}
        </p>

        {!person && result.overview ? (
          <p className="text-meta text-ink-muted mt-2.5 line-clamp-2">{result.overview}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A poster or profile image, treated as a plate in a book: fixed, ruled, and captioned
 * by the text beside it — rather than as a tile in a grid.
 */
function Plate({ src }: { src: string | null }) {
  return (
    <div className="border-rule bg-paper-sunk relative aspect-[2/3] w-20 shrink-0 overflow-hidden border">
      {src ? (
        <Image src={src} alt="" fill sizes="80px" className="object-cover" />
      ) : null}
    </div>
  );
}
