import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmdb, posterUrl, TmdbError } from "@/lib/tmdb";
import {
  type CollectionDetail,
  franchiseName,
  inReleaseOrder,
  parseId,
  slugify,
  year,
} from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { Plate } from "@/components/plate";

async function getFranchise(param: string): Promise<CollectionDetail> {
  const id = parseId(param);
  if (id === null) notFound();

  try {
    return await tmdb<CollectionDetail>(`/collection/${id}`);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/franchise/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const collection = await getFranchise(id);
    return {
      title: `${franchiseName(collection.name)} — Ensemble`,
      description: collection.overview?.slice(0, 160) || undefined,
    };
  } catch {
    return { title: "Ensemble" };
  }
}

export default async function FranchisePage({ params }: PageProps<"/franchise/[id]">) {
  const { id } = await params;
  const collection = await getFranchise(id);

  const films = inReleaseOrder(collection.parts);
  const name = franchiseName(collection.name);

  const releasedYears = films.map((f) => year(f.release_date)).filter(Boolean) as string[];
  const span =
    releasedYears.length > 1
      ? `${releasedYears[0]}–${releasedYears[releasedYears.length - 1]}`
      : (releasedYears[0] ?? null);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <h1 className="editorial text-display text-ink">{name}</h1>

        <p className="label text-ink-muted mt-3">
          {[
            "Franchise",
            `${films.length} ${films.length === 1 ? "film" : "films"}`,
            span,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {collection.overview ? (
          <p className="text-body text-ink border-rule mt-8 max-w-prose border-t pt-8">
            {collection.overview}
          </p>
        ) : null}

        <ol className="mt-10">
          {films.map((film, index) => (
            <li key={film.id} className="border-rule border-t">
              <Link
                href={`/film/${film.id}-${slugify(film.title)}`}
                className="hover:bg-paper-sunk/60 -mx-3 flex gap-4 px-3 py-6 transition-colors sm:gap-5"
              >
                {/* The sequence number is the whole point of this view: it says where a
                    film sits in the run, which is the thing a search result can never
                    tell you. */}
                <span
                  className="editorial text-title text-accent w-6 shrink-0 tabular-nums"
                  aria-hidden
                >
                  {index + 1}
                </span>

                <Plate src={posterUrl(film.poster_path)} alt="" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    {/* Never truncate a franchise title. Entries in a run share a long
                        prefix, so clipping the end removes the only words that tell them
                        apart — "The Lord of the Rings: The Fellowship of…" and "…The Return
                        of the…" are the same string until the part that gets cut. */}
                    <h2 className="editorial text-title text-ink text-balance">
                      {film.title}
                    </h2>
                    <span className="label text-ink-faint shrink-0 tabular-nums">
                      {year(film.release_date) ?? "TBA"}
                    </span>
                  </div>

                  {film.overview ? (
                    <p className="text-meta text-ink-muted mt-2.5 line-clamp-2">
                      {film.overview}
                    </p>
                  ) : (
                    <p className="text-meta text-ink-faint mt-2.5 italic">
                      No synopsis yet.
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
