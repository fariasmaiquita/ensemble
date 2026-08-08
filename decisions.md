# Decisions

Written as the decisions are made, not reconstructed afterwards. Each entry records what
was chosen **and what was rejected**, because the rejected option is the part that shows
the thinking.

---

## 1. The product is about connections, not logging

**2026-08-08.** Ensemble is not trying to be a better watchlist. Watchlists are solved —
Trakt, Simkl, Serializd, Moviebase and a dozen others do it competently. The thing none of
them do well is show you the **shape** of what you watch: which films belong to the same
franchise, which faces keep recurring across the things you love, and whether a series you
are about to start was cancelled three years ago on a cliffhanger.

**Rejected: building a general-purpose tracker with these as features.** That framing puts
Ensemble in a category where it loses on completeness to apps with years of work behind
them, and it buries the only interesting part. Leading with the connections makes the
feature set a consequence of a position rather than a list.

**Consequence for scope:** anything that does not serve "see the connections" is out, even
when it is cheap. That rule has already cut ratings aggregation, social features and
recommendations-as-a-product.

---

## 2. Name: Ensemble

**2026-08-08.** Shortlisted Throughline, Canon, Ensemble, Runtime and Bingeworthy, then
checked registration status for each across `.com`, `.tv`, `.app`, `.watch`, `.show`,
`.film` and `.directory` via RDAP, and checked for existing products in the category.

*Ensemble* carries both differentiators in one word: an ensemble is a cast, and an ensemble
is also a set of things regarded as a whole — which is exactly what a franchise view does.

**Rejected:**

- **Throughline** — the best fit to the thesis and by far the most crowded name. It is
  already a screenwriting and story-structure app, which is a *film-adjacent* collision, plus
  a therapy app, a crisis-support platform and an enterprise AI product. `.com`, `.tv`,
  `.app` and `.film` all registered.
- **Canon** — franchise-native vocabulary and an unusually clean domain sweep, but it only
  covers the franchise half of the thesis, carries a famous-mark trademark complication, and
  a five-letter dictionary word is the most likely of the set to sit in a registry premium
  tier.
- **Bingeworthy** — the front-runner going in, rejected on category saturation. Binged,
  BingeBoxd, Bingers, BingeList and Watchworthy already exist; a name in that convention
  reads as the fifth variation on a theme before anyone opens the app. `bingeworthy.com` is
  also a live media product.
- **Runtime** — a genuine three-way pun (film runtime, program runtime, "is it still
  running") but `.tv`, `.watch`, `.show` and `.app` are all taken.

---

## 3. No accounts, no backend, no database

**Carried from the project spec, 2026-07-28.** Watch status, favourites and episode progress
live in `localStorage`.

**Rejected: auth plus a hosted database.** It is the single largest block of work available
and it proves nothing anyone is asking about. Nobody assessing this cares that state is
local; they care whether the interactions are right.

**The interesting consequence:** with no account, there is no sync — so the answer to "how do
I move my data" has to be **export and import as a file**. That is the design answer to the
constraint, not a consolation prize, and it happens to put file handling, parsing, schema
validation and error states on the board for a few hours of work.

---

## 4. Every TMDB call runs on the server

**2026-08-08.** `src/lib/tmdb.ts` imports `server-only`, so if a client component ever
imports it the **build fails** rather than shipping the access token to a browser. Data is
fetched in server components; the token never enters the client bundle.

**Rejected: calling TMDB directly from the browser** with the key in
`NEXT_PUBLIC_TMDB_KEY`. This is what most tutorial builds of this app do, and it works —
TMDB read tokens are low-privilege. It was rejected because a key in a public repo's client
bundle is a bad habit made visible, and because server-side fetching unlocks Next's data
cache (see 6) which the client approach cannot use.

**Consequence:** this is the decision that ruled out static export to the existing Namecheap
pipeline, and it is why the app deploys to Vercel.

---

## 5. Search state lives in the URL

**2026-08-08.** The query is a `?q=` search param read by a server component, not React
state in a client component.

**Rejected: a client component holding query state and fetching as you type.** It gives
instant feedback, which is genuinely better, and it is the obvious way to build this.

**Why the URL won anyway:** a result set becomes shareable, the back button behaves the way
users expect rather than exiting the search entirely, and the page can render on the server —
which is what makes decision 4 possible at all. The instant-feedback loss is recoverable: a
debounced client input that pushes to the same URL gets both, and can be added later without
changing the data layer. Building it the other way round would have meant rewriting the
data layer to add server rendering.

**This is a case where an implementation constraint improved the design** rather than
compromising it, which is worth saying plainly because it usually goes the other way.

---

## 6. Caching at the fetch layer, not the client

**2026-08-08.** `tmdb()` sets `next: { revalidate: 3600 }`. Film and series metadata changes
rarely, so an hour-long window costs nothing in freshness and removes almost all repeat calls
to TMDB.

**Rejected: a client-side cache (React Query or SWR).** Both are good, and both solve a
problem this app does not have — they cache *in the browser*, which requires the browser to
be the thing making the requests, which contradicts decision 4.

**Known tension, unresolved:** the common-actors feature (see 8) needs credits for every
favourited title, which is N requests. An hour-long cache helps a lot but does not answer
whether those are fetched on demand or at favourite-time. Deferred to that block.

---

## 7. Self-hosted fonts via `next/font`

**2026-08-08.** Fonts are downloaded at build time and served from the app's own origin.

This looks like it contradicts the standing rule to avoid Google Fonts (Google Fonts loaded
from Google's CDN set cookies, which triggers a consent banner). It does not: `next/font`
self-hosts the files, so the browser makes **zero third-party requests**. The rule's intent —
no third-party tracking, no cookie banner — is satisfied. The rule's letter is about the CDN,
which is not what is happening here.

**Rejected: linking Google Fonts from `fonts.googleapis.com`**, which would have required a
consent banner for a portfolio app that otherwise sets no cookies at all.

---

## 8. Episode-level watch tracking, not season-level

**2026-08-08.** Marking progress works per episode, not just per series or per season.

**Rejected: season-level only**, which was the recommendation. Season-level costs ~2h;
episode-level costs ~5h, because it needs a season endpoint per season, an episode-list
screen, a three-level state tree (series → season → episode), roll-up logic for partial
seasons, and a correspondingly larger export schema.

**Chosen anyway, with the cost stated up front**, on the grounds that partial progress is the
actual experience of watching television and rounding it to whole seasons is the kind of
simplification that makes an app feel like a demo.

---

## 9. Tailwind, but never stock Tailwind

**2026-08-08.** Styling is Tailwind 4 with a **bespoke token layer** — colour, type and
spacing defined once as CSS custom properties that Tailwind consumes — rather than reaching
for the framework's default scales.

**Rejected: CSS Modules.** A hand-written stylesheet would have produced the same visual
result and is arguably a purer demonstration of CSS ability. Tailwind won because it is what
a frontend team at a product company actually uses, so the code reads as employable rather
than as a personal preference.

**Rejected more emphatically: stock Tailwind defaults.** `bg-slate-50`, `text-gray-900`, the
default type scale — these are the visual signature of a tutorial project, and they are
recognisable at a glance to exactly the people this project is meant to persuade. Using a
framework is fine; letting the framework make the design decisions is the thing to avoid.
The tokens are where the design lives; Tailwind is only the delivery mechanism.

---

## 10. Deliberately ugly until the design block

**2026-08-08.** The scaffold's search page uses unstyled defaults on purpose. Design
decisions get made in one dedicated pass with the whole surface in view, not accreted while
wiring up data.

**Rejected: styling as I go**, which feels faster and produces a design that is the sum of
whatever seemed reasonable at each step. The visual identity is one of the two things this
project exists to demonstrate; it does not get made by accident.
