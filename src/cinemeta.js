const { normalize } = require('./sheet')

const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io'
const TMDB_BASE_URL = 'https://www.themoviedb.org'

function yearOf(value) {
  return String(value ?? '').match(/\b(?:18|19|20)\d{2}\b/)?.[0] || ''
}

function normalizeTitle(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function findMatchingMovie(metadata, movies, aliases = []) {
  const wantedYear = yearOf(metadata.year || metadata.releaseInfo || metadata.released)
  const titles = [metadata.name, ...aliases].map(normalizeTitle).filter(Boolean)
  const exactTitleMatches = movies.filter((movie) => titles.includes(normalizeTitle(movie.title)))
  const titleAndYear = exactTitleMatches.filter((movie) => !wantedYear || yearOf(movie.year) === wantedYear)

  if (titleAndYear.length === 1) return titleAndYear[0]
  if (exactTitleMatches.length === 1) return exactTitleMatches[0]

  const directors = (metadata.director || []).map(normalize).filter(Boolean)
  if (directors.length && wantedYear) {
    const directorAndYear = movies.filter((movie) => {
      const localDirector = normalize(movie.director)
      return yearOf(movie.year) === wantedYear && directors.some((director) => (
        localDirector.includes(director) || director.includes(localDirector)
      ))
    })
    if (directorAndYear.length === 1) return directorAndYear[0]
  }

  return null
}

function extractTmdbOriginalTitle(html) {
  const match = html.match(/<strong>\s*(?:Título original|Original Title)\s*<\/strong>\s*([^<]+)/i)
  return match ? decodeHtml(match[1]).trim() : null
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'VideoclubArgentoStremio/1.1' },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} respondió HTTP ${response.status}`)
  return response.json()
}

function createImdbMatcher({ fetchImpl = fetch, ttlMs = 24 * 60 * 60 * 1000, now = Date.now } = {}) {
  const cache = new Map()

  return async function findMovieForImdbId(imdbId, movies) {
    if (!/^tt\d+$/.test(imdbId)) return null

    const cached = cache.get(imdbId)
    if (cached && now() - cached.loadedAt < ttlMs) {
      return movies.find((movie) => movie.id === cached.movieId) || null
    }

    const payload = await fetchJson(
      `${CINEMETA_BASE_URL}/meta/movie/${encodeURIComponent(imdbId)}.json`,
      fetchImpl
    )
    const metadata = payload.meta
    if (!metadata) return null

    let movie = findMatchingMovie(metadata, movies)
    if (!movie && metadata.moviedb_id) {
      const response = await fetchImpl(
        `${TMDB_BASE_URL}/movie/${encodeURIComponent(metadata.moviedb_id)}?language=es-AR`,
        {
          headers: { 'user-agent': 'Mozilla/5.0 VideoclubArgentoStremio/1.1' },
          signal: AbortSignal.timeout(15_000)
        }
      )
      if (response.ok) {
        const originalTitle = extractTmdbOriginalTitle(await response.text())
        movie = findMatchingMovie(metadata, movies, originalTitle ? [originalTitle] : [])
      }
    }

    cache.set(imdbId, { movieId: movie?.id || null, loadedAt: now() })
    return movie
  }
}

function previewFromCinemeta(meta) {
  return {
    id: meta.id,
    type: 'movie',
    name: meta.name,
    poster: meta.poster,
    background: meta.background,
    logo: meta.logo,
    releaseInfo: meta.releaseInfo || meta.year,
    description: meta.description,
    genres: meta.genres || meta.genre
  }
}

function chooseSearchResult(movie, metas) {
  const wantedYear = yearOf(movie.year)
  const wantedTitle = normalizeTitle(movie.title)
  const candidates = metas.filter((meta) => /^tt\d+$/.test(meta.id || ''))
  const exactTitle = candidates.filter((meta) => normalizeTitle(meta.name) === wantedTitle)
  const exactTitleAndYear = exactTitle.find((meta) => !wantedYear || yearOf(meta.releaseInfo || meta.year) === wantedYear)
  if (exactTitleAndYear) return exactTitleAndYear

  const sameYear = candidates.filter((meta) => yearOf(meta.releaseInfo || meta.year) === wantedYear)
  if (sameYear.length) return sameYear[0]
  if (exactTitle.length === 1) return exactTitle[0]
  return null
}

function createCinemetaCatalogResolver({
  fetchImpl = fetch,
  ttlMs = 7 * 24 * 60 * 60 * 1000,
  now = Date.now
} = {}) {
  const cache = new Map()

  return async function resolveCatalogMovie(movie) {
    const cached = cache.get(movie.id)
    if (cached && now() - cached.loadedAt < ttlMs) return cached.preview

    try {
      const query = encodeURIComponent(movie.title)
      const payload = await fetchJson(
        `${CINEMETA_BASE_URL}/catalog/movie/top/search=${query}.json`,
        fetchImpl
      )
      const result = chooseSearchResult(movie, payload.metas || [])
      const preview = result ? previewFromCinemeta(result) : null
      cache.set(movie.id, { preview, loadedAt: now() })
      return preview
    } catch {
      return null
    }
  }
}

async function mapWithConcurrency(items, mapper, concurrency = 6) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

module.exports = {
  chooseSearchResult,
  createCinemetaCatalogResolver,
  createImdbMatcher,
  decodeHtml,
  extractTmdbOriginalTitle,
  findMatchingMovie,
  mapWithConcurrency,
  normalizeTitle,
  previewFromCinemeta,
  yearOf
}
