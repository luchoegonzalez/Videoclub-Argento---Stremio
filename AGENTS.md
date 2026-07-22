# AGENTS.md

## Objetivo del proyecto

Este repositorio contiene **Videoclub Argento**, un addon comunitario de Stremio que lee una planilla pública de Google Sheets y expone catálogo, metadatos y streams mediante el protocolo HTTP de Stremio.

El proyecto debe seguir siendo autocontenido y portable. No dependas de rutas absolutas, archivos fuera de esta carpeta ni herramientas instaladas globalmente, salvo Node.js.

## Entorno y comandos

- Requisito: Node.js 20 o superior.
- Instalación reproducible: `npm ci`.
- Desarrollo con reinicio automático: `npm run dev`.
- Ejecución normal: `npm start`.
- Suite completa: `npm test`.
- Comprobación manual: abrir `http://127.0.0.1:7000/health` y esperar `{"ok":true}`.
- Manifest de Stremio: `http://127.0.0.1:7000/manifest.json`.

Después de mover o copiar la carpeta a otra computadora, no reutilices `node_modules`: eliminá esa carpeta si fue copiada, ejecutá `npm ci` dentro del proyecto y luego `npm test`.

## Configuración

La aplicación lee la configuración directamente desde variables de entorno; no carga `.env` por sí sola.

- `PORT`: puerto HTTP; valor predeterminado `7000`.
- `HOST`: interfaz de escucha; valor predeterminado `0.0.0.0`.
- `SHEET_ID`: ID de una planilla compatible.
- `SHEET_GID`: pestaña de la planilla; valor predeterminado `0`.
- `CACHE_TTL_MS`: duración de la caché de la planilla; valor predeterminado `600000` ms.

Usá `.env.example` sólo como referencia y nunca confirmes secretos ni un archivo `.env`. La planilla predeterminada es pública y no requiere credenciales.

## Mapa del código

- `src/index.js`: servidor Express, CORS y rutas HTTP de Stremio.
- `src/addon.js`: manifest y handlers de catálogo, ficha y stream.
- `src/sheet.js`: descarga, parseo, normalización, IDs estables y caché de la planilla.
- `src/streams.js`: resolución de Google Drive, OK.ru, YouTube y archivos directos.
- `src/cinemeta.js`: asociación de IDs de IMDb con películas locales mediante Cinemeta y TMDB.
- `test/*.test.js`: tests unitarios y de integración HTTP con `node:test`.
- `Dockerfile`: imagen de producción basada en Node Alpine.

## Reglas para modificarlo

- Conservá CommonJS (`require`/`module.exports`) y el estilo existente: dos espacios, comillas simples y sin punto y coma.
- No agregues un paso de compilación ni dependencias nuevas si la plataforma estándar de Node resuelve el problema.
- Mantené los IDs `pao:` deterministas. Cambiar `makeId` puede romper bibliotecas o enlaces ya guardados en Stremio.
- Conservá el ID del addon, el ID del catálogo y los prefijos declarados en el manifest salvo que el cambio sea intencional y esté documentado.
- La detección de columnas de la planilla debe tolerar texto previo, columnas vacías, espacios y acentos.
- No registres ni almacenes el contenido audiovisual. El addon sólo transforma enlaces publicados por la fuente.
- Toda solicitud externa debe tener timeout, comprobar `response.ok` y degradar de forma segura cuando sea posible.
- No hagas tests dependientes de la red pública. Inyectá `fetchImpl`, repositorios, relojes o matchers falsos como hacen los tests actuales.
- Si cambia el comportamiento visible, actualizá también `README.md`, la versión del manifest cuando corresponda y los tests relevantes.

## Criterio de terminado

Antes de entregar un cambio:

1. Ejecutá `npm test` y confirmá que todos los tests pasan.
2. Agregá o ajustá tests para cada comportamiento modificado.
3. Si tocaste rutas HTTP, comprobá `/health`, `/manifest.json` y el recurso afectado.
4. Si tocaste dependencias, mantené sincronizados `package.json` y `package-lock.json` y verificá una instalación con `npm ci`.
5. Evitá incluir `node_modules`, `.env`, logs o artefactos locales al copiar o versionar el proyecto.

## Despliegue y portabilidad

- Para ejecución local, usá `npm ci && npm start` desde la raíz del proyecto.
- Para contenedores, construí desde esta misma raíz para que el `Dockerfile` encuentre `package.json`, `package-lock.json` y `src/`.
- Stremio en otro dispositivo de la red debe apuntar a la IP de la máquina anfitriona, no a `127.0.0.1`.
- Una instalación pública de Stremio necesita una URL HTTPS estable; el servidor incluido sólo expone HTTP y espera que la plataforma de despliegue termine TLS.
