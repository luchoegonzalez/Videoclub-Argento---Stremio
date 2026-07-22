const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createImdbMatcher,
  extractTmdbOriginalTitle,
  findMatchingMovie
} = require('../src/cinemeta')

const movies = [{
  id: 'pao:secreto',
  title: 'El secreto de sus ojos',
  director: 'Juan José Campanella',
  year: '2009',
  sourceUrls: ['https://example.com']
}]

test('relaciona títulos traducidos usando director y año', () => {
  const result = findMatchingMovie({
    name: 'The Secret in Their Eyes',
    year: '2009',
    director: ['Juan José Campanella']
  }, movies)
  assert.equal(result.id, 'pao:secreto')
})

test('extrae el título original en español de TMDB', () => {
  const html = '<p class="wrap"><strong>Título original</strong> El secreto de sus ojos</p>'
  assert.equal(extractTmdbOriginalTitle(html), 'El secreto de sus ojos')
})

test('consulta Cinemeta por ID de IMDb y devuelve la película local', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /tt1305806/)
    return new Response(JSON.stringify({
      meta: {
        id: 'tt1305806',
        name: 'The Secret in Their Eyes',
        year: '2009',
        director: ['Juan José Campanella']
      }
    }))
  }
  const matcher = createImdbMatcher({ fetchImpl })
  assert.equal((await matcher('tt1305806', movies)).id, 'pao:secreto')
})
