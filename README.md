# Ensemble

A film and television tracker built around the **connections** between what you watch —
which films share a franchise, which faces keep recurring across the things you love, and
whether a series you are about to start was cancelled years ago on a cliffhanger.

Watchlists are a solved problem. This is not trying to be a better one.

> **Status: in progress.** Being built in the open, design and engineering by the same
> person. `decisions.md` records what was chosen and what was rejected, written as the
> decisions were made rather than reconstructed afterwards.

## Running it locally

Requires Node 22+ and a free [TMDB](https://www.themoviedb.org/) account.

```bash
npm install
cp .env.example .env.local
```

Add your **API Read Access Token (v4 auth)** from
[TMDB's API settings](https://www.themoviedb.org/settings/api) to `.env.local`, then:

```bash
npm run dev
```

The token is read only on the server. `src/lib/tmdb.ts` imports `server-only`, so the build
fails rather than leaking it into a client bundle if that module is ever imported from a
client component.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · deployed on Vercel.

No accounts, no backend, no database — watch state lives in `localStorage`, and moves
between browsers as an exported file.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Data and images courtesy of [The Movie Database](https://www.themoviedb.org/). Used under
TMDB's [terms of use](https://www.themoviedb.org/api-terms-of-use) for non-commercial
projects.
