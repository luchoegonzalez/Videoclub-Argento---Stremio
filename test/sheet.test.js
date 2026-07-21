const test = require('node:test')
const assert = require('node:assert/strict')
const { parseMovies, normalize } = require('../src/sheet')

test('encuentra los encabezados aunque haya texto antes y una columna vacía', () => {
  const csv = [
    ',EL VIDEOCLUB ARGENTO,,,,',
    ',Nombre,Director,Año,Medios oficiales,Link',
    ',En compañía,Ada Frontini,2021,No hay info,https://ok.ru/video/123',
    ',Película dos,Directora,1999,https://cine.example/ficha,https://drive.google.com/file/d/abc/view'
  ].join('\n')

  const movies = parseMovies(csv)
  assert.equal(movies.length, 2)
  assert.equal(movies[0].title, 'En compañía')
  assert.equal(movies[1].officialUrl, 'https://cine.example/ficha')
  assert.match(movies[0].id, /^pao:[a-f0-9]{20}$/)
})

test('normaliza mayúsculas, espacios y acentos para la búsqueda', () => {
  assert.equal(normalize('  Martín   HACHE '), 'martin hache')
})
