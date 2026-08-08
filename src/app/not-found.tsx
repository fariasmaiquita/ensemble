import { Masthead, SearchField } from "@/components/masthead";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />
      <p className="text-body text-ink-muted max-w-md pt-10 italic">
        Nothing here. Either the link is wrong, or TMDB has no record of it.
      </p>
    </div>
  );
}
