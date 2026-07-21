const express = require('express')
const { buildAddon } = require('./addon')

function decodeExtra(value = '') {
  return Object.fromEntries(new URLSearchParams(value))
}

function createApp({ addon = buildAddon() } = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    })
    next()
  })
  app.get('/health', (_request, response) => response.json({ ok: true }))
  app.get('/manifest.json', (_request, response) => response.json(addon.manifest))

  function resourceHandler(handler, hasExtra = false) {
    return async (request, response) => {
      try {
        const result = await handler({
          type: request.params.type,
          id: request.params.id,
          extra: hasExtra ? decodeExtra(request.params.extra) : {}
        })
        response.set('Cache-Control', 'public, max-age=300')
        response.json(result)
      } catch (error) {
        console.error(error)
        response.status(500).json({ error: 'No se pudo consultar la fuente del catálogo' })
      }
    }
  }

  app.get('/catalog/:type/:id.json', resourceHandler(addon.catalog, true))
  app.get('/catalog/:type/:id/:extra.json', resourceHandler(addon.catalog, true))
  app.get('/meta/:type/:id.json', resourceHandler(addon.meta))
  app.get('/stream/:type/:id.json', resourceHandler(addon.stream))
  app.get('/', (_request, response) => {
    response.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><title>El Videoclub Argento</title><body><h1>El Videoclub Argento</h1><p>Addon para Stremio listo.</p><p><a href="/manifest.json">Abrir manifest.json</a></p></body></html>`)
  })

  return app
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 7000
  const host = process.env.HOST || '0.0.0.0'
  createApp().listen(port, host, () => {
    const installUrl = `http://127.0.0.1:${port}/manifest.json`
    console.log(`El Videoclub Argento está disponible en ${installUrl}`)
  })
}

module.exports = { createApp, decodeExtra }
