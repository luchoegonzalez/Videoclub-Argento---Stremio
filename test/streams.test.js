const test = require('node:test')
const assert = require('node:assert/strict')
const {
  extractGoogleDriveId,
  extractOkVideoId,
  extractYouTubeId,
  resolveOkVideo,
  sourceToStreams
} = require('../src/streams')

test('extrae IDs de los proveedores conocidos', () => {
  assert.equal(extractGoogleDriveId('https://drive.google.com/file/d/drive-id/view'), 'drive-id')
  assert.equal(extractOkVideoId('https://ok.ru/video/123456'), '123456')
  assert.equal(extractYouTubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk')
})

test('extrae el HLS del atributo escapado de OK.ru', async () => {
  const metadata = JSON.stringify({ hlsManifestUrl: 'https://cdn.example/master.m3u8', movie: {} })
  const options = JSON.stringify({ flashvars: { metadata } }).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const fetchImpl = async () => new Response(`<div data-options="${options}"></div>`, { status: 200 })
  const result = await resolveOkVideo('https://ok.ru/video/123', { fetchImpl })
  assert.equal(result.hlsUrl, 'https://cdn.example/master.m3u8')
})

test('convierte Google Drive en una descarga reproducible', async () => {
  const [stream] = await sourceToStreams('https://drive.google.com/file/d/drive-id/view')
  assert.match(stream.url, /^https:\/\/drive\.usercontent\.google\.com\/download\?id=drive-id/)
})
