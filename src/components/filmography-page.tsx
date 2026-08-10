import Link from "next/link";
import { type CreditGroup, personHref } from "@/lib/types";
import { type PersonWithCredits } from "@/lib/person";
import { Masthead, SearchField } from "@/components/masthead";
import { CreditList } from "@/components/credit-list";

/**
 * The complete run of one kind of a person's work — what the capped section on the person
 * page hands off to.
 *
 * It is a page rather than an expand-in-place because a filmography is a thing people
 * link to. Expanding in place is cheaper and has no empty state to design, but it leaves
 * "Samuel L. Jackson's 193 films" with no address.
 */
export function FilmographyPage({
  person,
  group,
  eyebrow,
  noun,
}: {
  person: PersonWithCredits;
  group: CreditGroup;
  eyebrow: string;
  /**
   * Both forms, given rather than derived: the plural of "series" is "series", so stripping
   * a trailing "s" would render "1 serie".
   */
  noun: { one: string; many: string };
}) {
  const total = group.released.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <p className="label text-ink-faint">{eyebrow}</p>

        <h1 className="editorial text-display text-ink mt-2">
          <Link href={personHref(person.id, person.name)} className="hover:text-accent">
            {person.name}
          </Link>
        </h1>

        <p className="label text-ink-muted mt-3">
          {total > 0
            ? `${total} ${total === 1 ? noun.one : noun.many} · newest first`
            : `No ${noun.many} credited`}
        </p>

        {group.asSelf > 0 ? (
          <p className="text-meta text-ink-faint mt-4 italic">
            {group.asSelf} further credit{group.asSelf === 1 ? " is" : "s are"} an appearance
            as themselves — talk shows, awards and panels — and {group.asSelf === 1 ? "is" : "are"}{" "}
            not listed here.
          </p>
        ) : null}

        {total > 0 ? (
          <div className="border-rule mt-8 border-t pt-4">
            <CreditList credits={group.released} />
          </div>
        ) : null}

        <p className="border-rule mt-10 border-t pt-8">
          <Link
            href={personHref(person.id, person.name)}
            className="label text-accent hover:underline"
          >
            ← Back to {person.name}
          </Link>
        </p>
      </article>
    </div>
  );
}
