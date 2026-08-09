import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmdb, posterUrl, TmdbError } from "@/lib/tmdb";
import {
  type Credits,
  type MovieDetail,
  formatRuntime,
  franchiseHref,
  franchiseName,
  parseId,
  year,
} from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { Plate } from "@/components/plate";
import { CastList } from "@/components/cast-list";

interface FilmWithCredits extends MovieDetail {
  credits: Credits;
}

async function getFilm(param: string): Promise<FilmWithCredits> {
  const id = parseId(param);
  if (id === null) notFound();

  try {
    // One request rather than two: TMDB will inline a sub-resource on the detail response.
    return await tmdb<FilmWithCredits>(`/movie/${id}`, { append_to_response: "credits" });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<"/film/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const film = await getFilm(id);
    const released = year(film.release_date);
    return {
      title: released ? `${film.title} (${released}) — Ensemble` : `${film.title} — Ensemble`,
      description: film.overview?.slice(0, 160),
    };
  } catch {
    return { title: "Ensemble" };
  }
}

export default async function FilmPage({ params }: PageProps<"/film/[id]">) {
  const { id } = await params;
  const film = await getFilm(id);

  const released = year(film.release_date);
  const runtime = formatRuntime(film.runtime);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <h1 className="editorial text-display text-ink">{film.title}</h1>

        <p className="label text-ink-muted mt-3">
          {["Film", released, runtime].filter(Boolean).join(" · ")}
        </p>

        <div className="border-rule mt-8 flex gap-6 border-t pt-8 sm:gap-8">
          <Plate
            src={posterUrl(film.poster_path, "w500")}
            size="detail"
            alt={film.title}
            priority
          />

          <div className="min-w-0 flex-1">
            {film.tagline ? (
              <p className="editorial text-subtitle text-ink-muted italic">
                {film.tagline}
              </p>
            ) : null}

            {film.overview ? (
              <p className={`text-body text-ink ${film.tagline ? "mt-5" : ""}`}>
                {film.overview}
              </p>
            ) : (
              <p className="text-body text-ink-faint italic">
                TMDB has no synopsis for this film.
              </p>
            )}

            {film.genres.length > 0 ? (
              <p className="label text-ink-faint mt-6">
                {film.genres.map((g) => g.name).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        {film.belongs_to_collection ? (
          <p className="border-rule mt-8 border-t pt-8">
            <Link
              href={franchiseHref(
                film.belongs_to_collection.id,
                film.belongs_to_collection.name,
              )}
              className="label text-accent hover:underline"
            >
              Part of the {franchiseName(film.belongs_to_collection.name)} franchise →
            </Link>
          </p>
        ) : null}

        <CastList cast={film.credits?.cast ?? []} />
      </article>
    </div>
  );
}
