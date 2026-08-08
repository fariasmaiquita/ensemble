import Link from "next/link";

export function Masthead({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`border-rule border-b ${compact ? "pt-8 pb-4" : "pt-16 pb-6"}`}>
      <Link href="/" className="inline-block">
        <span
          className={`editorial text-ink ${compact ? "text-title" : "text-display"} block`}
        >
          Ensemble
        </span>
      </Link>
      {compact ? null : (
        <p className="label text-ink-muted mt-3">
          Films &amp; television, by what connects them
        </p>
      )}
    </header>
  );
}

export function SearchField({ query = "" }: { query?: string }) {
  return (
    <form action="/" className="border-rule flex items-baseline gap-4 border-b py-5">
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
