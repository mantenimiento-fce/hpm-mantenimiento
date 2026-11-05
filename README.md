# HPM – Mantenimiento preventivo por estación

Sitio web estático generado desde los Excel de `HPM/`. Cada estación tiene su página
(`/estacion/<estacion>/`) con menú de SECCIÓN / PARTE, todos los pasos tal cual el Excel
y sus imágenes con los números de paso. Se consulta escaneando el QR pegado en la estación.

## Consulta sobre hpm

En inicio y en cada estación, "Consulta sobre hpm" responde preguntas informativas en lenguaje natural con los datos
del Excel: cada cuándo se hace algo, cuánto tarda, con qué herramienta o material, qué criterio aplica, qué toca cada
semana o trimestre, totales de tiempo y qué significa cada sigla. Corre en el navegador, sin servidor, claves ni modelo
que descargar, y no redacta texto propio sobre los procedimientos.
Para que entienda palabras nuevas, agregarlas a `SINONIMOS` en `templates/asistente.js`. Las preguntas que deben
seguir funcionando están en `casos_consulta.json`.

## Publicar en GitHub Pages

1. Crear un repositorio en GitHub y subir esta carpeta a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` (por ejemplo, al actualizar un Excel en `HPM/`) regenera y publica el sitio.
4. Abrir `https://<usuario>.github.io/<repo>/qr/` e imprimir los QR.

## Vista previa local

```
py -m pip install -r requirements.txt
set BASE_URL=https://<usuario>.github.io/<repo>
py build.py
py -m http.server -d _site 8000
```
Abrir http://localhost:8000. `py test_build.py` verifica el parseo de los 4 HPM y la consulta (requiere Node).

## Agregar o cambiar estaciones

Copiar el Excel (mismo formato HPM) a `HPM/` y hacer push. El nombre de la ruta sale de la celda EQUIPO (K6).
