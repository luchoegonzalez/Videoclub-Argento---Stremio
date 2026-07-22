const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const { createApp } = require('../src')

test('expone el protocolo HTTP que consume Stremio', async (context) => {
  const movies = [{
    id: 'pao:1',
    title: 'Película de prueba',
    director: 'Directora',
    year: '1984',
    officialUrl: null,
    sourceUrls: ['https://example.com/pelicula.mp4']
  }]
  const repository = { getMovies: async () => movies }
  const { buildAddon } = require('../src/addon')
  const imdbMatcher = async (id) => id === 'tt1234567' ? movies[0] : null
  const catalogResolver = async (movie) => ({
    id: 'tt1234567',
    type: 'movie',
    name: movie.title,
    poster: 'https://example.com/poster.jpg',
    releaseInfo: movie.year
  })
  const server = createApp({
    addon: buildAddon({ repository, imdbMatcher, catalogResolver })
  }).listen(0, '127.0.0.1')
  context.after(() => server.close())
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const healthResponse = await fetch(`${baseUrl}/health`)
  assert.deepEqual(await healthResponse.json(), { ok: true })

  const manifestResponse = await fetch(`${baseUrl}/manifest.json`)
  assert.equal(manifestResponse.headers.get('access-control-allow-origin'), '*')
  const manifest = await manifestResponse.json()
  assert.equal(manifest.name, 'Videoclub Argento')
  assert.equal(manifest.logo, `${baseUrl}/icon.webp`)
  assert.deepEqual(manifest.stremioAddonsConfig, {
    issuer: 'https://stremio-addons.net',
    signature: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..dP3f3-MXP12hKMBK-Xao9g.g9VkJYzUwHzt7vGISXM6Jhs_MHD-JFE7dsqHiWyQ3teez0sYQoJZUOw2x6fS4j5kbHEkPcZZFTHdwNsoY6VSm6cp4VJNHH8Lj5ogDYTyl6sNydtJZdt0e--QE4ECclQk.DNKJZc2RVYhtTu1nIwM1PA'
  })

  const iconResponse = await fetch(manifest.logo)
  assert.equal(iconResponse.status, 200)
  assert.equal(iconResponse.headers.get('content-type'), 'image/webp')
  assert.ok((await iconResponse.arrayBuffer()).byteLength > 0)

  const catalog = await fetch(`${baseUrl}/catalog/movie/peliculas-argentinas-olvidadas/search=prueba.json`).then((response) => response.json())
  assert.equal(catalog.metas[0].name, 'Película de prueba')
  assert.equal(catalog.metas[0].id, 'tt1234567')

  const stream = await fetch(`${baseUrl}/stream/movie/pao:1.json`).then((response) => response.json())
  assert.equal(stream.streams[0].url, 'https://example.com/pelicula.mp4')

  const imdbStream = await fetch(`${baseUrl}/stream/movie/tt1234567.json`).then((response) => response.json())
  assert.equal(imdbStream.streams[0].url, 'https://example.com/pelicula.mp4')
})
