const { createHash } = require('node:crypto')
const { parse } = require('csv-parse/sync')

const DEFAULT_SHEET_ID = '158Jjw_BMEcVgqeVwjGFwLtbnQm2EPg20P2Z5SDUBW_c'

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

function extractUrls(value) {
  return clean(value)
    .match(/https?:\/\/[^\s]+/gi)?.map((url) => url.replace(/[),.;]+$/, '')) ?? []
}

function makeId({ title, director, year }) {
  const fingerprint = [title, director, year].map(normalize).join('\0')
  const hash = createHash('sha256').update(fingerprint).digest('hex').slice(0, 20)
  return `pao:${hash}`
}

function parseMovies(csv) {
  const rows = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false
  })

  const headerIndex = rows.findIndex((row) => {
    const names = row.map(normalize)
    return names.includes('nombre') && names.includes('director') && names.includes('link')
  })

  if (headerIndex < 0) {
    throw new Error('No se encontró la fila de encabezados (Nombre, Director, Link)')
  }

  const headers = rows[headerIndex].map(normalize)
  const column = (name) => headers.indexOf(normalize(name))
  const titleColumn = column('Nombre')
  const directorColumn = column('Director')
  const yearColumn = column('Año')
  const officialColumn = column('Medios oficiales')
  const linkColumn = column('Link')
  const seenIds = new Set()

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const title = clean(row[titleColumn])
    const director = clean(row[directorColumn])
    const year = clean(row[yearColumn])
    const sourceUrls = extractUrls(row[linkColumn])

    if (!title || sourceUrls.length === 0) return []

    const movie = {
      id: makeId({ title, director, year }),
      title,
      director,
      year,
      officialUrl: extractUrls(row[officialColumn])[0] ?? null,
      sourceUrls
    }

    // Evita duplicados exactos de la planilla sin desestabilizar los IDs.
    if (seenIds.has(movie.id)) return []
    seenIds.add(movie.id)
    return [movie]
  })
}

class SheetRepository {
  constructor({
    sheetId = process.env.SHEET_ID || DEFAULT_SHEET_ID,
    gid = process.env.SHEET_GID || '0',
    ttlMs = Number(process.env.CACHE_TTL_MS) || 10 * 60 * 1000,
    fetchImpl = fetch,
    now = Date.now
  } = {}) {
    this.csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
    this.ttlMs = ttlMs
    this.fetchImpl = fetchImpl
    this.now = now
    this.cache = null
    this.refreshing = null
  }

  async getMovies() {
    if (this.cache && this.now() - this.cache.loadedAt < this.ttlMs) {
      return this.cache.movies
    }

    if (!this.refreshing) {
      this.refreshing = this.#refresh().finally(() => {
        this.refreshing = null
      })
    }

    try {
      return await this.refreshing
    } catch (error) {
      if (this.cache) return this.cache.movies
      throw error
    }
  }

  async #refresh() {
    const response = await this.fetchImpl(this.csvUrl, {
      headers: { 'user-agent': 'PeliculasArgentinasStremio/1.0' },
      signal: AbortSignal.timeout(20_000)
    })

    if (!response.ok) {
      throw new Error(`La planilla respondió HTTP ${response.status}`)
    }

    const movies = parseMovies(await response.text())
    if (movies.length === 0) throw new Error('La planilla no contiene películas reproducibles')

    this.cache = { movies, loadedAt: this.now() }
    return movies
  }
}

module.exports = {
  DEFAULT_SHEET_ID,
  SheetRepository,
  extractUrls,
  makeId,
  normalize,
  parseMovies
}
