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
  const server = createApp({ addon: buildAddon({ repository, imdbMatcher }) }).listen(0, '127.0.0.1')
  context.after(() => server.close())
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const manifestResponse = await fetch(`${baseUrl}/manifest.json`)
  assert.equal(manifestResponse.headers.get('access-control-allow-origin'), '*')
  assert.equal((await manifestResponse.json()).name, 'Videoclub Argento')

  const catalog = await fetch(`${baseUrl}/catalog/movie/peliculas-argentinas-olvidadas/search=prueba.json`).then((response) => response.json())
  assert.equal(catalog.metas[0].name, 'Película de prueba')

  const stream = await fetch(`${baseUrl}/stream/movie/pao:1.json`).then((response) => response.json())
  assert.equal(stream.streams[0].url, 'https://example.com/pelicula.mp4')

  const imdbStream = await fetch(`${baseUrl}/stream/movie/tt1234567.json`).then((response) => response.json())
  assert.equal(imdbStream.streams[0].url, 'https://example.com/pelicula.mp4')
})
