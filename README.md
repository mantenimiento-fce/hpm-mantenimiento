# Mantenimiento – sitio del departamento

Sitio web estático (GitHub Pages) generado con `build.py`:

- **Estaciones** (`/estacion/<estacion>/`): hoja HPM desde los Excel de `HPM/`, con menú de SECCIÓN / PARTE, todos los
  pasos tal cual el Excel y sus imágenes con los números de paso. Se abre escaneando el QR pegado en la estación.
- **Troubleshooting** (`/estacion/<estacion>/troubleshooting/`): efectos de falla agrupados en EQUIPO / PROCESO /
  MATERIAL y sus posibles causas, de las matrices causa-efecto de `troubleshooting/` (una marca ꙩ en el cruce = esa
  causa aplica). Si una hoja nueva no aparece, agregar su nombre a `TS_ESTACION` en `build.py`.
- **Indicadores** (`/kpi/`): dashboard de BDR, MTTR y MTBF por año, mes y línea.

## Consulta

- En cada estación: pasos del HPM (cada cuándo, cuánto tarda, herramienta, material, criterio, siglas) y efectos de
  troubleshooting de esa estación.
- En inicio: lo mismo para todas las estaciones y, si la pregunta es de indicadores ("MTTR de octubre en Honda 25SA",
  "máquinas con más fallas"), responde con los KPIs.
- En indicadores: solo KPIs.

Corre en el navegador, sin servidor ni modelo. Para que entienda palabras nuevas, agregarlas a `SINONIMOS` en
`templates/asistente.js`. Las preguntas que deben seguir funcionando están en `casos_consulta.json`.

## Indicadores (BDR, MTTR, MTBF)

Fórmulas y reglas de filtrado: `Maintenance 2026/KPIs_Mantenimiento_BDR_MTTR_MTBF.md`, implementadas en
`templates/andon.js`. Cuentan los reportes de Mantenimiento Mecánico/Eléctrico con interrupción = Si, sin cierres
automáticos ni líneas SMD / LINEA PRUEBA; los de más de 8 h se separan como "por validar".

- **Reportes**: `Maintenance 2026/andon.json` (todos los reportes ANDON acumulados).
- **Tiempo disponible**: hoja *Datos Maestros Actual* de `Maintenance 2026/KPI*.xlsx`. La relación entre los nombres de
  línea de ANDON y los de Datos Maestros está en `LINEAS_ANDON` (`build.py`). El mes en curso usa tiempo proporcional.
- **Metas**: `METAS` en `templates/andon.js`.

### Actualizar con un CSV de ANDON

En `/kpi/` → *Actualizar datos*, subir el CSV "Reportes de mantenimiento" exportado de ANDON. Los reportes se combinan por
**Número**: los nuevos se agregan, los que cambiaron se actualizan (gana el de mayor estatus; con el mismo, el de mayor
tiempo) y **los que no vienen en el archivo se conservan**. Sirve también para recuperar reportes de exportaciones viejas.

Lo subido se ve de inmediato en ese navegador. **Publicar** lo guarda en `Maintenance 2026/andon.json` del repositorio
(partiendo de lo que ya esté publicado, así no se pierde lo que subió otra persona) y el sitio se regenera en 1–2 min.

**Token de publicación**: secret del repositorio `ANDON_TOKEN` (Settings → Secrets and variables → Actions).
Usar un token *fine-grained* con acceso **solo a este repositorio** y permiso **Contents: Read and write**, nada más.
El token queda visible para cualquiera que abra la página: quien lo copie puede modificar el repositorio. El historial
de git permite revertir. Sin el secret, el botón cambia a *Descargar andon.json* para copiarlo a mano a `Maintenance 2026/`.
Después de una publicación desde el sitio, hacer `git pull` antes de seguir trabajando en local.

## Publicar en GitHub Pages

1. Crear un repositorio en GitHub y subir esta carpeta a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` (por ejemplo, al actualizar un Excel) regenera y publica el sitio.
4. Abrir `https://<usuario>.github.io/<repo>/qr/` e imprimir los QR.

## Vista previa local

```
py -m pip install -r requirements.txt
set BASE_URL=https://<usuario>.github.io/<repo>
py build.py
py -m http.server -d _site 8000
```
Abrir http://localhost:8000. `py test_build.py` verifica el parseo de los 4 HPM, troubleshooting, KPIs y la consulta (requiere Node).

## Agregar o cambiar estaciones

Copiar el Excel (mismo formato HPM) a `HPM/` y hacer push. El nombre de la ruta sale de la celda EQUIPO (K6).
