import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmdb, posterUrl, profileUrl, TmdbError } from "@/lib/tmdb";
import {
  type CombinedCredits,
  type CreditItem,
  type PersonDetail,
  creditHref,
  creditTitle,
  creditYear,
  lifespan,
  parseId,
  tidyFilmography,
} from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { Plate } from "@/components/plate";

interface PersonWithCredits extends PersonDetail {
  combined_credits: CombinedCredits;
}

async function getPerson(param: string): Promise<PersonWithCredits> {
  const id = parseId(param);
  if (id === null) notFound();

  try {
    // One request rather than two: TMDB will inline a sub-resource on the detail response.
    return await tmdb<PersonWithCredits>(`/person/${id}`, {
      append_to_response: "combined_credits",
    });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/person/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const person = await getPerson(id);
    return {
      title: `${person.name} — Ensemble`,
      description: person.biography?.slice(0, 160) || undefined,
    };
  } catch {
    return { title: "Ensemble" };
  }
}

export default async function PersonPage({ params }: PageProps<"/person/[id]">) {
  const { id } = await params;
  const person = await getPerson(id);

  const filmography = tidyFilmography(person.combined_credits?.cast ?? []);
  const years = lifespan(person);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <h1 className="editorial text-display text-ink">{person.name}</h1>

        <p className="label text-ink-muted mt-3">
          {[person.known_for_department, years, person.place_of_birth]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="border-rule mt-8 flex gap-6 border-t pt-8 sm:gap-8">
          <Plate
            src={profileUrl(person.profile_path, "h632")}
            size="detail"
            alt={person.name}
            priority
          />

          <div className="min-w-0 flex-1">
            {person.biography ? (
              <Biography text={person.biography} />
            ) : (
              <p className="text-body text-ink-faint italic">
                TMDB has no biography for {person.name}.
              </p>
            )}
          </div>
        </div>

        <CreditSection
          heading={`Appears in — ${filmography.released.length} ${
            filmography.released.length === 1 ? "title" : "titles"
          }`}
          credits={filmography.released}
        />
        <CreditSection heading="Announced" credits={filmography.upcoming} quiet />
      </article>
    </div>
  );
}

/**
 * TMDB biographies are one long string with blank-line paragraph breaks, and some run to
 * a dozen paragraphs. Only the first two are shown — the page is about the work, and a
 * full biography would push the filmography off the screen entirely.
 */
function Biography({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const shown = paragraphs.slice(0, 2);

  return (
    <div className="space-y-4">
      {shown.map((paragraph, i) => (
        <p key={i} className="text-body text-ink">
          {paragraph}
        </p>
      ))}
      {paragraphs.length > shown.length ? (
        <p className="label text-ink-faint">Biography abridged</p>
      ) : null}
    </div>
  );
}

function CreditSection({
  heading,
  credits,
  quiet = false,
}: {
  heading: string;
  credits: CreditItem[];
  quiet?: boolean;
}) {
  if (credits.length === 0) return null;

  return (
    <section className="border-rule mt-10 border-t pt-8">
      <h2 className="label text-ink-faint">{heading}</h2>

      <ul className={`divide-rule mt-4 divide-y ${quiet ? "opacity-70" : ""}`}>
        {credits.map((credit) => (
          <li key={`${credit.media_type}-${credit.id}`}>
            <Link
              href={creditHref(credit)}
              className="hover:bg-paper-sunk/60 -mx-3 flex items-center gap-4 px-3 py-3 transition-colors"
            >
              <Plate src={posterUrl(credit.poster_path)} size="mini" alt="" />

              <div className="min-w-0 flex-1">
                <p className="text-body text-ink truncate">{creditTitle(credit)}</p>
                {credit.character ? (
                  <p className="text-meta text-ink-faint truncate italic">
                    {credit.character}
                  </p>
                ) : null}
              </div>

              <span className="label text-ink-faint shrink-0 tabular-nums">
                {creditYear(credit) ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
