const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractGoogleDriveId(value) {
  try {
    const url = new URL(value)
    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
    return pathMatch?.[1] || url.searchParams.get('id')
  } catch {
    return null
  }
}

function extractYouTubeId(value) {
  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || null
    }
  } catch {
    return null
  }
  return null
}

function extractOkVideoId(value) {
  try {
    const url = new URL(value)
    if (!/(^|\.)ok\.ru$/i.test(url.hostname)) return null
    return url.pathname.match(/\/video(?:embed)?\/(\d+)/)?.[1] || null
  } catch {
    return null
  }
}

async function resolveOkVideo(value, { fetchImpl = fetch } = {}) {
  const videoId = extractOkVideoId(value)
  if (!videoId) throw new Error('URL de OK.ru no reconocida')

  const response = await fetchImpl(`https://ok.ru/video/${videoId}`, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`OK.ru respondió HTTP ${response.status}`)

  const html = await response.text()
  const attributes = [...html.matchAll(/data-options="([\s\S]*?)"/g)]
  for (const match of attributes) {
    if (!match[1].includes('hlsManifestUrl')) continue
    try {
      const options = JSON.parse(decodeHtmlAttribute(match[1]))
      const metadata = JSON.parse(options.flashvars?.metadata || '{}')
      if (metadata.hlsManifestUrl) {
        return {
          hlsUrl: metadata.hlsManifestUrl,
          poster: metadata.movie?.poster || null,
          duration: metadata.movie?.duration || null
        }
      }
    } catch {
      // Puede haber otros widgets data-options en la página; se prueban todos.
    }
  }

  throw new Error('OK.ru no publicó un stream HLS para este video')
}

async function sourceToStreams(sourceUrl, options = {}) {
  const okId = extractOkVideoId(sourceUrl)
  if (okId) {
    try {
      const resolved = await resolveOkVideo(sourceUrl, options)
      return [{
        name: 'OK.ru',
        description: 'HLS · El Videoclub Argento',
        url: resolved.hlsUrl,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: {
              'User-Agent': USER_AGENT,
              Referer: `https://ok.ru/video/${okId}`
            }
          }
        }
      }]
    } catch (error) {
      return [{
        name: 'OK.ru',
        description: `Abrir fuente original (${error.message})`,
        externalUrl: sourceUrl
      }]
    }
  }

  const driveId = extractGoogleDriveId(sourceUrl)
  if (driveId && /(^|\.)drive\.google\.com$/i.test(new URL(sourceUrl).hostname)) {
    return [{
      name: 'Google Drive',
      description: 'Archivo de video',
      url: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`,
      behaviorHints: { notWebReady: true }
    }]
  }

  const ytId = extractYouTubeId(sourceUrl)
  if (ytId) {
    return [{ name: 'YouTube', description: 'Fuente de la planilla', ytId }]
  }

  if (/\.(?:m3u8|mp4|mkv|webm|avi)(?:$|[?#])/i.test(sourceUrl)) {
    return [{
      name: 'Video directo',
      description: 'Fuente de la planilla',
      url: sourceUrl,
      behaviorHints: { notWebReady: !/\.mp4(?:$|[?#])/i.test(sourceUrl) }
    }]
  }

  return [{
    name: new URL(sourceUrl).hostname.replace(/^www\./, ''),
    description: 'Abrir fuente original en el navegador',
    externalUrl: sourceUrl
  }]
}

async function resolveMovieStreams(movie, options = {}) {
  const settled = await Promise.all(movie.sourceUrls.map((url) => sourceToStreams(url, options)))
  return settled.flat()
}

module.exports = {
  decodeHtmlAttribute,
  extractGoogleDriveId,
  extractOkVideoId,
  extractYouTubeId,
  resolveMovieStreams,
  resolveOkVideo,
  sourceToStreams
}
