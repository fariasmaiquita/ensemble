import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmdb, posterUrl, TmdbError } from "@/lib/tmdb";
import {
  type Credits,
  type SeriesStanding,
  type TvDetail,
  isOpenEnded,
  seasonCensus,
  parseId,
  seriesStanding,
  standingLabel,
  year,
} from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { Plate } from "@/components/plate";
import { CastList } from "@/components/cast-list";
import { LibraryControls } from "@/components/library-controls";
import { SeasonIndex } from "@/components/season-index";

interface SeriesWithCredits extends TvDetail {
  credits: Credits;
}

async function getSeries(param: string): Promise<SeriesWithCredits> {
  const id = parseId(param);
  if (id === null) notFound();

  try {
    // One request rather than two: TMDB will inline a sub-resource on the detail response.
    return await tmdb<SeriesWithCredits>(`/tv/${id}`, { append_to_response: "credits" });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/series/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const series = await getSeries(id);
    const first = year(series.first_air_date);
    return {
      title: first ? `${series.name} (${first}) — Ensemble` : `${series.name} — Ensemble`,
      description: series.overview?.slice(0, 160),
    };
  } catch {
    return { title: "Ensemble" };
  }
}

/**
 * The standing is the loudest thing on this page by design.
 *
 * TMDB distinguishes "Ended" from "Canceled" and almost no tracker surfaces the
 * difference — but it is the difference between a story that finished and one that was cut
 * off, which is the single fact that decides whether someone starts a series. Cancelled
 * gets the spot colour; a running series gets the green; an ended one is deliberately quiet,
 * because "it finished properly" is reassurance rather than a warning.
 */
function Standing({ standing }: { standing: SeriesStanding }) {
  const tone =
    standing === "cancelled"
      ? "text-accent"
      : standing === "running"
        ? "text-running"
        : "text-ink-muted";

  return <span className={`label ${tone}`}>{standingLabel(standing)}</span>;
}

export default async function SeriesPage({ params }: PageProps<"/series/[id]">) {
  const { id } = await params;
  const series = await getSeries(id);

  const standing = seriesStanding(series.status);
  const first = year(series.first_air_date);
  const last = year(series.last_air_date);

  // A single year for a one-season show, a range for anything longer, and an open range
  // for something still running.
  const run =
    standing === "running"
      ? first && `${first}–`
      : first && last && first !== last
        ? `${first}–${last}`
        : first;

  // Counted by what has aired rather than what is announced. The roll-up, the Finished
  // control and "everything before" all work from this, so none of them can claim an
  // episode that has not gone out yet.
  const census = seasonCensus(series);

  const seasons = `${series.number_of_seasons} ${
    series.number_of_seasons === 1 ? "season" : "seasons"
  }`;
  const episodes = `${series.number_of_episodes} ${
    series.number_of_episodes === 1 ? "episode" : "episodes"
  }`;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <h1 className="editorial text-display text-ink">{series.name}</h1>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="label text-ink-muted">
            {["Series", run, seasons, episodes].filter(Boolean).join(" · ")}
          </p>
          <span className="text-ink-faint" aria-hidden>
            ·
          </span>
          <Standing standing={standing} />
        </div>

        <LibraryControls
          kind="series"
          id={series.id}
          title={series.name}
          year={first}
          posterPath={series.poster_path}
          census={census}
          openEnded={isOpenEnded(standing)}
        />

        <div className="border-rule mt-8 flex gap-6 border-t pt-8 sm:gap-8">
          <Plate
            src={posterUrl(series.poster_path, "w500")}
            size="detail"
            alt={series.name}
            priority
          />

          <div className="min-w-0 flex-1">
            {series.tagline ? (
              <p className="editorial text-subtitle text-ink-muted italic">
                {series.tagline}
              </p>
            ) : null}

            {series.overview ? (
              <p className={`text-body text-ink ${series.tagline ? "mt-5" : ""}`}>
                {series.overview}
              </p>
            ) : (
              <p className="text-body text-ink-faint italic">
                TMDB has no synopsis for this series.
              </p>
            )}

            {series.created_by.length > 0 ? (
              <p className="label text-ink-faint mt-6">
                Created by {series.created_by.map((c) => c.name).join(", ")}
              </p>
            ) : null}

            {series.genres.length > 0 ? (
              <p className="label text-ink-faint mt-2">
                {series.genres.map((g) => g.name).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <SeasonIndex
          seriesId={series.id}
          seriesName={series.name}
          seasons={series.seasons}
          lastAired={series.last_episode_to_air}
        />

        <CastList cast={series.credits?.cast ?? []} />
      </article>
    </div>
  );
}
