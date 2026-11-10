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

## Troubleshooting

Cada estación tiene un botón **Troubleshooting** (`/estacion/<estacion>/troubleshooting/`) con sus efectos de falla,
agrupados en EQUIPO / PROCESO / MATERIAL, y las posibles causas de cada uno. Los datos salen de las matrices
causa-efecto de `troubleshooting/` (una marca ꙩ en el cruce = esa causa aplica). Si una hoja nueva no aparece,
agregar su nombre a `TS_ESTACION` en `build.py`.

### Administrador (provisional)

`/admin/` permite añadir, editar y eliminar efectos y causas, y muestra por máquina la lista de fallas del Excel
`troubleshooting/Fallas por Máquina…xlsx` (botón *Crear efecto* para pasar una falla al editor).
Los cambios quedan como borrador en el navegador. **Publicar** guarda `troubleshooting/troubleshooting.json` en el
repositorio con un token personal de GitHub (fine-grained, solo este repositorio, Contents: Read and write) y el sitio
se regenera solo. Sin token, *Descargar JSON* y copiar el archivo a `troubleshooting/` hace lo mismo.
En cuanto existe `troubleshooting.json`, es la fuente de los efectos y las matrices de Excel ya no se leen.
Después de publicar desde el administrador, hacer `git pull` antes de seguir trabajando en local.

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
