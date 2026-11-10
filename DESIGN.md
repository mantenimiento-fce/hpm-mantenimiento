# Sistema de diseño · HPM

Dirección: **sobria e industrial, tipo manual técnico.** Papel cálido, tinta azul oscura, el azul FORVIA
para acciones y ámbar de seguridad industrial solo para lo que exige atención (contramedidas, precauciones).
Pensado para técnicos que consultan desde el celular frente a la máquina.

Los tokens viven en `:root` de [templates/base.html](templates/base.html). Ninguna plantilla usa colores,
tamaños ni espacios sueltos: todo sale de estas variables.

## Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Títulos y números | **Barlow Condensed** 600/700 | Encabezados, número de paso, cifras. Señalética industrial, ahorra ancho en móvil. |
| Texto | **IBM Plex Sans** 400/500/600 | Cuerpo, etiquetas, formularios. Muy legible en tamaños chicos y con números tabulares. |

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-xs` | 13 px | Etiquetas en mayúsculas (con tracking) y metadatos secundarios |
| `--fs-sm` | 14 px | Texto auxiliar |
| `--fs-base` | 16 px | Cuerpo (mínimo para lectura), interlineado `--lh-body` 1.5 |
| `--fs-md` | 18 px | Título de paso |
| `--fs-lg` | 22 px | Encabezado de sección, título de cabecera |
| `--fs-xl` | 28 px | Nombre de estación en lista |
| `--fs-2xl` | 40 px | Título de página |

Ancho de lectura: `--measure` 70ch.

## Color

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--c-paper` | `#f4f2ec` | Fondo de página | — |
| `--c-paper-hi` | `#faf9f5` | Inicio del degradado del fondo | — |
| `--c-surface` | `#fffefa` | Paneles, pasos, inputs | — |
| `--c-sunk` | `#ebe8e0` | Zonas hundidas (metadatos del paso) | — |
| `--c-line` | `#dcd8cd` | Divisores | decorativo |
| `--c-line-strong` | `#86826f` | Borde de inputs y botones secundarios | 3.7:1 sobre surface |
| `--c-text` | `#1b1e27` | Texto principal | 16:1 |
| `--c-muted` | `#585c68` | Texto secundario | 6.5:1 sobre surface, 6:1 sobre paper |
| `--c-ink` | `#121a3d` | Base: títulos, cabecera del menú | 16:1 |
| `--c-blue` | `#0023c9` | Marca / acción primaria / enlaces | 9.6:1 |
| `--c-blue-hover` | `#001a96` | Hover de acción primaria | — |
| `--c-blue-tint` | `#eceffb` | Fondo de elemento activo | — |
| `--c-amber` | `#d99a0b` | Acento: borde de contramedida, resaltado de paso | decorativo + icono |
| `--c-amber-tint` | `#fcf4e0` | Fondo de contramedida/precaución | — |
| `--c-amber-ink` | `#6e4a00` | Texto sobre fondo ámbar | 7.4:1 |
| `--c-danger` | `#b42318` | Errores, eliminar | 6.3:1 |
| `--c-danger-tint` | `#fdecea` | Hover de botón de eliminar | — |
| `--c-success` | `#1d6b3a` | Estado publicado / conectado | 6.5:1 |
| `--c-success-tint` | `#e7f4ec` | Reservado para fondos de éxito | — |

Regla: un color base (tinta/azul), un acento (ámbar) y neutros cálidos. Los estados nunca dependen solo del
color: la contramedida lleva icono y etiqueta, el paso activo del menú lleva barra y `aria-current`.

## Espaciado (base 4 px)

`--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48 · `--sp-8` 64

Margen lateral en móvil: `--sp-4` (16 px). `--gutter` lo sube a 32 px en escritorio.

## Radios, sombras, movimiento

| Token | Valor | Uso |
|---|---|---|
| `--r-sm` | 4 px | Chips, número de paso |
| `--r-md` | 6 px | Botones, inputs, imágenes |
| `--r-lg` | 10 px | Paneles y pasos |
| `--sh-1` | borde inferior de 1 px + sombra corta | Paneles (casi plano, sin sombras difusas) |
| `--sh-2` | sombra media | Solo capas flotantes: menú lateral, visor |
| `--dur` | 180 ms | Transiciones de hover/foco |
| `--ease` | `cubic-bezier(.2,.7,.2,1)` | — |

`prefers-reduced-motion: reduce` desactiva transiciones y desplazamiento suave.

## Componentes y estados

**Botón** (`.btn`): alto mínimo 44 px, Plex 600.
- `.btn-primary`: fondo `--c-blue`, texto blanco · hover `--c-blue-hover` · activo baja 1 px · foco anillo `--focus-ring` · deshabilitado opacidad .45 sin puntero.
- `.btn-secondary`: fondo surface, borde `--c-line-strong` · hover borde `--c-ink` y fondo `--c-blue-tint`.
- `.btn-icon`: 44 × 44, solo icono, siempre con `aria-label`.

**Input** (`.input`): alto 48 px, borde `--c-line-strong`, icono a la izquierda · hover borde `--c-ink` ·
foco borde `--c-blue` + anillo · error `aria-invalid` borde `--c-danger` y mensaje debajo. La etiqueta siempre
es visible; el placeholder solo da un ejemplo.

**Foco**: `outline: 3px solid var(--c-blue); outline-offset: 2px` en todo elemento interactivo con `:focus-visible`.

- `.btn-danger`: texto `--c-danger` sin fondo · hover `--c-danger-tint`. Para eliminar; siempre pide confirmación.

**Formularios**: `.campo-form` (etiqueta visible + campo + `.error-msg` debajo, con icono y texto, nunca solo color).
`textarea.input` y `select.input` comparten los estados del input.

**Badge** (`.badge`): ámbar, mayúsculas; marca secciones provisionales.

**Troubleshooting**: efectos como `<details>` (teclado nativo), número `.paso-n`, causas numeradas en azul,
categorías con `h2.sec` igual que las secciones del HPM.

**Consulta**: vacío (ejemplos de preguntas), resultados, sin coincidencias, error de carga (texto del script).

## Iconos

Un solo set: **Lucide** (trazo 2 px, 24 × 24), en línea desde
[templates/_iconos.html](templates/_iconos.html) con `{{ icono("nombre") }}`. Sin emojis.
