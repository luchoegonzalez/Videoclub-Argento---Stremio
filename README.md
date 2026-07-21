# El Videoclub Argento para Stremio

Addon comunitario que convierte la planilla pública de **El Videoclub Argento** en un catálogo de Stremio. La lista se vuelve a consultar cada 10 minutos, por lo que las altas y correcciones aparecen sin modificar el addon.

## Ejecutarlo

Requiere Node.js 20 o superior.

```powershell
npm install
npm start
```

Después, abrí esta dirección en Stremio:

```text
http://127.0.0.1:7000/manifest.json
```

El addon ofrece catálogo paginado, búsqueda por título/director/año, ficha básica y streams. Convierte los enlaces públicos de Google Drive en descargas directas y resuelve los videos de OK.ru a HLS en el momento de reproducirlos. También muestra la opción de “Medio oficial” cuando existe en la planilla. YouTube y archivos directos son compatibles; otros proveedores se abren en el navegador.

## Configuración opcional

Copiá `.env.example` como referencia y definí las variables en el entorno antes de iniciar:

- `PORT`: puerto HTTP (predeterminado: `7000`).
- `HOST`: interfaz de escucha (predeterminada: `0.0.0.0`).
- `SHEET_ID` y `SHEET_GID`: permiten apuntar a otra hoja con las mismas columnas.
- `CACHE_TTL_MS`: tiempo de caché de la planilla (predeterminado: 10 minutos).

Para instalarlo desde otro dispositivo de la red, reemplazá `127.0.0.1` por la IP local de la computadora que ejecuta el addon. Para publicarlo en internet hace falta HTTPS; el repositorio incluye un `Dockerfile` para desplegarlo en un servicio compatible con contenedores.

## Notas

- La planilla y los archivos pertenecen a sus respectivos responsables; este proyecto no copia ni aloja las películas.
- Los enlaces pueden dejar de funcionar o cambiar de permisos.
- Las URLs HLS de OK.ru son temporales y se obtienen al elegir una película.

## Verificación

```powershell
npm test
```
