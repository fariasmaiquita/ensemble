import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { profileUrl } from "@/lib/tmdb";
import { getPerson } from "@/lib/person";
import { type CreditGroup, bestKnown, filmography, lifespan, personHref } from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { Plate } from "@/components/plate";
import { CreditList } from "@/components/credit-list";

/**
 * How many credits a section shows before it hands off to its own page. Matched to the cast
 * block, so the two lists on a film page and a person page cut off at the same depth.
 */
const PREVIEW_LENGTH = 12;

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

  const work = filmography(person.combined_credits?.cast ?? []);
  const years = lifespan(person);
  const base = personHref(person.id, person.name);

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

        <PreviewSection
          heading="Films"
          group={work.films}
          seeAllHref={`${base}/films`}
          noun="films"
        />

        <PreviewSection
          heading="Series"
          group={work.series}
          seeAllHref={`${base}/series`}
          noun="series"
        />

        {work.announced.length > 0 ? (
          <section className="border-rule mt-10 border-t pt-8">
            <h2 className="label text-ink-faint">Announced</h2>
            <div className="mt-4 opacity-70">
              <CreditList credits={work.announced} showCategory />
            </div>
          </section>
        ) : null}
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

/**
 * A section that shows the head of a list and says plainly how much it is not showing.
 *
 * Both figures in the footer exist to keep the page from lying by omission: the count says
 * how deep the list really goes, and the self-appearance count says that credits were
 * filtered rather than absent.
 */
function PreviewSection({
  heading,
  group,
  seeAllHref,
  noun,
}: {
  heading: string;
  group: CreditGroup;
  seeAllHref: string;
  noun: string;
}) {
  const total = group.released.length;
  if (total === 0 && group.asSelf === 0) return null;

  /*
   * The reordering exists only because of the cap: it is there so that what gets cut is the
   * obscure work rather than the famous work. A section that fits entirely on the page hides
   * nothing, so it keeps the chronology — and stays consistent with the full pages, which
   * are chronological too.
   */
  const capped = total > PREVIEW_LENGTH;
  const preview = capped ? bestKnown(group.released, PREVIEW_LENGTH) : group.released;

  return (
    <section className="border-rule mt-10 border-t pt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="label text-ink-faint">
          {heading}
          {total > 0 ? ` — ${total}` : ""}
        </h2>

        {/* The preview and the full page are ordered differently, so each says which it is. */}
        {capped ? <span className="label text-ink-faint">Best known</span> : null}
      </div>

      {total > 0 ? (
        <div className="mt-4">
          <CreditList credits={preview} />
        </div>
      ) : (
        <p className="text-meta text-ink-faint mt-4 italic">No {noun} credited.</p>
      )}

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {capped ? (
          <Link
            href={seeAllHref}
            className="label text-accent inline-flex items-center gap-1.5 hover:underline"
          >
            See all {total} {noun}
            <ArrowRight size={13} aria-hidden />
          </Link>
        ) : (
          <span />
        )}

        {group.asSelf > 0 ? (
          <span className="label text-ink-faint">
            {group.asSelf} appearance{group.asSelf === 1 ? "" : "s"} as themselves, not listed
          </span>
        ) : null}
      </div>
    </section>
  );
}
