const express = require('express')
const path = require('node:path')
const { buildAddon } = require('./addon')

const ICON_PATH = path.join(__dirname, '..', 'assets', 'videoclub-argento.webp')

function decodeExtra(value = '') {
  return Object.fromEntries(new URLSearchParams(value))
}

function publicUrl(request, pathname) {
  const forwardedProtocol = request.get('x-forwarded-proto')
  const forwardedHost = request.get('x-forwarded-host')
  const protocol = forwardedProtocol ? forwardedProtocol.split(',')[0].trim() : request.protocol
  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : request.get('host')
  return `${protocol}://${host}${pathname}`
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
  app.get('/manifest.json', (request, response) => response.json({
    ...addon.manifest,
    logo: publicUrl(request, '/icon.webp')
  }))
  app.get('/icon.webp', (_request, response) => response.sendFile(ICON_PATH))

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
    response.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Videoclub Argento</title><body><h1>Videoclub Argento</h1><p>Addon para Stremio listo.</p><p><a href="/manifest.json">Abrir manifest.json</a></p></body></html>`)
  })

  return app
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 7000
  const host = process.env.HOST || '0.0.0.0'
  createApp().listen(port, host, () => {
    const installUrl = `http://127.0.0.1:${port}/manifest.json`
    console.log(`Videoclub Argento está disponible en ${installUrl}`)
  })
}

module.exports = { createApp, decodeExtra, publicUrl }
