const { SheetRepository, normalize } = require('./sheet')
const { resolveMovieStreams } = require('./streams')
const {
  createCinemetaCatalogResolver,
  createImdbMatcher,
  mapWithConcurrency
} = require('./cinemeta')

const CATALOG_ID = 'peliculas-argentinas-olvidadas'
const PAGE_SIZE = 30

const manifest = {
  id: 'community.videoclub-argento.peliculas-olvidadas',
  version: '1.2.3',
  name: 'Videoclub Argento',
  description: 'Películas argentinas preservadas en la planilla pública de El Videoclub Argento.',
  logo: 'icon.webp',
  resources: [
    { name: 'catalog', types: ['movie'] },
    { name: 'stream', types: ['movie'], idPrefixes: ['tt'] }
  ],
  types: ['movie'],
  idPrefixes: ['tt'],
  catalogs: [{
    type: 'movie',
    id: CATALOG_ID,
    name: 'Videoclub Argento',
    extra: [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false }
    ]
  }],
  stremioAddonsConfig: {
    issuer: 'https://stremio-addons.net',
    signature: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..dP3f3-MXP12hKMBK-Xao9g.g9VkJYzUwHzt7vGISXM6Jhs_MHD-JFE7dsqHiWyQ3teez0sYQoJZUOw2x6fS4j5kbHEkPcZZFTHdwNsoY6VSm6cp4VJNHH8Lj5ogDYTyl6sNydtJZdt0e--QE4ECclQk.DNKJZc2RVYhtTu1nIwM1PA'
  },
  behaviorHints: { configurable: false }
}

function descriptionFor(movie) {
  return [
    movie.director && `Dirección: ${movie.director}`,
    movie.year && `Año: ${movie.year}`,
    movie.officialUrl && `Medio oficial: ${movie.officialUrl}`,
    'Fuente del catálogo: El Videoclub Argento.'
  ].filter(Boolean).join('\n')
}

function previewFor(movie) {
  return {
    id: movie.id,
    type: 'movie',
    name: movie.title,
    releaseInfo: movie.year || undefined,
    description: descriptionFor(movie),
    genres: ['Cine argentino']
  }
}

function buildAddon({
  repository = new SheetRepository(),
  streamOptions = {},
  imdbMatcher = createImdbMatcher(),
  catalogResolver = createCinemetaCatalogResolver()
} = {}) {
  async function catalog({ type, id, extra = {} }) {
    if (type !== 'movie' || id !== CATALOG_ID) return { metas: [] }

    const movies = await repository.getMovies()
    const query = normalize(extra.search || '')
    const filtered = query
      ? movies.filter((movie) => normalize(`${movie.title} ${movie.director} ${movie.year}`).includes(query))
      : movies
    const skip = Math.max(0, Number.parseInt(extra.skip, 10) || 0)

    const page = filtered.slice(skip, skip + PAGE_SIZE)
    const resolved = await mapWithConcurrency(page, catalogResolver)
    return { metas: resolved.filter(Boolean) }
  }

  async function meta({ type, id }) {
    if (type !== 'movie' || !id.startsWith('pao:')) return { meta: null }
    const movie = (await repository.getMovies()).find((item) => item.id === id)
    if (!movie) return { meta: null }

    return {
      meta: {
        ...previewFor(movie),
        director: movie.director ? [movie.director] : [],
        links: movie.officialUrl ? [{ name: 'Ver medio oficial', category: 'official', url: movie.officialUrl }] : []
      }
    }
  }

  async function stream({ type, id }) {
    if (type !== 'movie' || (!id.startsWith('pao:') && !/^tt\d+$/.test(id))) {
      return { streams: [] }
    }
    const movies = await repository.getMovies()
    const movie = id.startsWith('pao:')
      ? movies.find((item) => item.id === id)
      : await imdbMatcher(id, movies)
    if (!movie) return { streams: [] }
    const streams = await resolveMovieStreams(movie, streamOptions)
    if (movie.officialUrl) {
      streams.push({
        name: 'Medio oficial',
        description: 'Abrir la opción oficial indicada en la planilla',
        externalUrl: movie.officialUrl
      })
    }
    return { streams }
  }

  return { manifest, catalog, meta, stream }
}

module.exports = { CATALOG_ID, PAGE_SIZE, buildAddon, descriptionFor, manifest, previewFor }
