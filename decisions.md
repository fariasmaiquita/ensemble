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

## 16. The cast is a credit block, not an avatar carousel

**2026-08-08.** Cast renders as a ruled two-column table — small plate, name, character —
with the first twelve shown and the remainder counted ("and 94 more" on *Avengers: Endgame*).

**Rejected: the horizontally scrolling row of circular avatars** that every media app uses.
It costs two things Ensemble cannot afford: it hides most of the cast behind a gesture, and
it drops the character name because there is no room under a circle.

For an app whose argument is the connections between people and titles, the cast is not
decoration at the bottom of a page — it is the primary content. So it gets read like a
printed credit block, with everything visible at once.

---

## 17. Released and announced work are separated

**2026-08-08.** A person's filmography is split: released work newest-first, then a quieter
"Announced" section for anything dated in the future.

**This was a bug I built and then found.** The first version was straight
reverse-chronological, which is defensible and honest. Rendered against real data it opened
Scarlett Johansson's page on *The Batman: Part II* (2028), *The Exorcist: Martyrs* (2027) and
three more films that do not exist — pushing everything she is actually known for below the
fold. Worse, showing a 2028 announcement in the same treatment as a 1994 film quietly implies
it exists.

**Rejected: sorting by popularity instead**, which is what most apps do and which solves the
vapourware problem by accident. It creates a different one — a career reads as a greatest-hits
list with no shape, and recent work disappears under whatever was most successful a decade
ago.

**Undated credits stay at the end of *released*, not in *announced*.** An undated credit is
unknown, not forthcoming, and putting it under a heading that claims it is coming would be
inventing information TMDB does not have.

---

## 18. One request per page, not two

**2026-08-08.** Detail pages use TMDB's `append_to_response` to inline sub-resources — a
film fetches its credits in the same call as its detail, and a person fetches an entire
combined filmography in one.

**Rejected: separate calls**, parallelised with `Promise.all`. That is the more obvious
shape and reads more cleanly. It was rejected because two round trips to TMDB cost real
latency on a server-rendered page where nothing paints until the data arrives, and because
each extra call is another thing that can fail independently and needs its own error path.

**The tension this creates, noted for later:** `append_to_response` is per-request, so it
cannot help the common-actors feature, which needs credits for *every* favourited title.
That one still has N requests to solve and is deferred to its own block — see #6.

---

## 14. URLs use the product's vocabulary, not the API's

**2026-08-08.** Routes are `/film/348-alien` and `/series/1437-firefly`.

**Rejected: `/movie/348` and `/tv/1437`**, which is what TMDB calls them and would have meant
one less translation layer.

The interface says *Film* and *Series* everywhere a category is shown, and a URL is part of
the interface — it is the one piece of an app people copy, paste and read aloud. Matching the
address bar to the product's own words rather than a vendor's internal naming costs one
mapping function and keeps the whole surface speaking one language.

**The slug is cosmetic and deliberately so.** The id is parsed off the front, so
`/film/348-alien`, `/film/348` and a stale `/film/348-old-title` all resolve to the same
page. A link that has been sitting in someone's notes for a year should not break because a
title was edited upstream.

---

## 15. "Ended" and "Cancelled" are different words, and the difference is the product

**2026-08-08.** TMDB reports series status as `Ended`, `Canceled`, `Returning Series`,
`Planned`, `In Production` or `Pilot`. Ensemble maps those to four standings and gives each
a different typographic weight:

- **Cancelled** takes the spot colour. It is a warning: the story was cut off.
- **Still running** takes the green. It is an invitation, and also a caution about waiting.
- **Ended** is deliberately *quiet*, in muted ink. "It finished properly" is reassurance, and
  reassurance does not need to shout.

**Rejected: one neutral status chip** showing whatever string TMDB returned. That is what
most trackers do when they show status at all, and it flattens the only distinction that
actually changes a decision. *Ended* and *Cancelled* are three letters apart in a database
and worlds apart to someone deciding whether to commit thirty hours.

**Verified against real data:** Firefly renders `Series · 2002 · 1 season · 11 episodes ·
CANCELLED` in rust; Breaking Bad renders `2008–2013 · 5 seasons · 62 episodes · ENDED` in
muted ink; Law & Order: SVU renders `1999– · 28 seasons · 595 episodes · STILL RUNNING` in
green. The open-ended range for running series and the single year for a show that lasted one
year both fall out of the same formatter.

---

## 11. Editorial and light, not dark and cinematic

**2026-08-08.** A repertory cinema programme or a film reference book: warm paper ground,
Newsreader carrying titles, Archivo carrying metadata, one spot colour, generous whitespace.

**Rejected: dark cinematic** — near-black ground, poster-forward, gradient scrims over hero
art. It is a genuinely good option. TMDB's artwork looks superb on black for no effort, and
it is instantly legible to anyone who has used a streaming service.

**It was rejected because that familiarity is the problem, in two ways.**

First, it is what the entire category already does, so it demonstrates no judgement. Against
someone who has seen many of these, "the same, slightly nicer" is not an argument.

Second and more importantly, **the tile grid fights the thesis.** A wall of posters says
*browse content*. Every item becomes an interchangeable rectangle, and structure — which
film precedes which, which face recurs, which series stopped — becomes invisible. An app
whose whole claim is about connections cannot use the layout that flattens them.

**Known risk, accepted:** light editorial is harder to make feel media-native, and posters on
warm white can read clinical if the spacing is wrong. Mitigated by treating images as plates
with a rule around them rather than as bleed-to-edge tiles.

---

## 12. Light first, dark deferred to last

**2026-08-08.** No `prefers-color-scheme` branch for now. The scaffold's dark-mode block was
removed rather than extended.

**Rejected: designing both at once.** The direction in #11 is *specifically* a paper ground,
and a printed programme has no dark variant — so a dark Ensemble is a **second design**, not
this one inverted. Building both in parallel means every token decision gets litigated twice
before either is settled, and the cheap escape (an automatic inversion) would undermine the
one thing the visual design exists to prove.

**Also rejected: cutting it entirely**, which was the original call. Overruled by the person
who will actually use this every day and reads everything in dark mode. That is the right
reason to overrule it — the app has a real user with a real preference, and designing against
that to protect a purist argument about paper would be precious.

**So: scheduled, not parked.** Dark mode ships as one of the last pieces before launch, once
the light design has stopped moving and there is a fixed thing to translate rather than a
moving one. Roughly an hour; the token layer is built so it is a second set of values, not a
rewrite.

---

## 13. Search results are a catalogue, not a grid

**2026-08-08.** Results render as a ruled vertical list — plate, title, category, year,
two lines of synopsis — rather than as a poster grid.

**Rejected: the poster grid**, which is the category default and fits more results per
screen.

The list won because it shows *more per item* rather than more items: category, year and
synopsis are all visible without a hover or a tap, which is what makes the thing feel like a
reference tool instead of a storefront. It also scales down to narrow screens without a
breakpoint, since a single column is already the layout.

**The honest tradeoff:** scanning twenty results takes more scrolling than a grid would. For
a tool where you usually know what you are looking for, that is the right side of the trade —
but it would be the wrong one for a browse-first product.

---

## 10. Deliberately ugly until the design block

**2026-08-08.** The scaffold's search page uses unstyled defaults on purpose. Design
decisions get made in one dedicated pass with the whole surface in view, not accreted while
wiring up data.

**Rejected: styling as I go**, which feels faster and produces a design that is the sum of
whatever seemed reasonable at each step. The visual identity is one of the two things this
project exists to demonstrate; it does not get made by accident.
