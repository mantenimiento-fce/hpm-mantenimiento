# HPM – Mantenimiento preventivo por estación

Sitio web estático generado desde los Excel de `HPM/`. Cada estación tiene su página
(`/estacion/<estacion>/`) con menú de SECCIÓN / PARTE, todos los pasos tal cual el Excel
y sus imágenes con los números de paso. Se consulta escaneando el QR pegado en la estación.

## Asistente de diagnóstico

En cada estación, "¿Qué falla en esta estación?" recibe un síntoma en palabras del técnico y muestra hasta 5
pasos con su contramedida, siempre con el aviso de seguridad. Corre en el navegador: sin servidor, sin claves y
sin modelo que descargar, y solo muestra texto del Excel, así que no puede inventar procedimientos.
Para que entienda palabras nuevas, agregarlas a `SINTOMAS` en `templates/asistente.js`.

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
Abrir http://localhost:8000. `py test_build.py` verifica el parseo de los 4 HPM y el asistente (requiere Node).

## Agregar o cambiar estaciones

Copiar el Excel (mismo formato HPM) a `HPM/` y hacer push. El nombre de la ruta sale de la celda EQUIPO (K6).
