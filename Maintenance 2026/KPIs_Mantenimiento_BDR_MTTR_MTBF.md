# KPIs de Mantenimiento: BDR, MTTR y MTBF
### Definición, fórmulas y aplicación al reporte *ANDON – Reportes de mantenimiento*

**Planta:** Forvia San Juan del Río  
**Fuentes analizadas:**
- Definiciones 3014, 3016 y 3017 del glosario de términos (imágenes de referencia)
- `KPI Registro de Fallas Total Planta 2026 REV3.xlsx` (hojas *KPI Mantto*, *BDR & DT*, *Datos Maestros Actual*)
- `reportes_de_mantenimiento_2026 (2).csv` (exportación de SIGMA ANDON del 11-nov-2026, 4,815 reportes)

---

## Índice
1. [Los tres datos base](#1-los-tres-datos-base)
2. [BDR – Breakdown Rate](#2-bdr--breakdown-rate-tasa-de-paro-por-falla)
3. [MTTR – Mean Time To Repair](#3-mttr--mean-time-to-repair-tiempo-medio-de-reparación)
4. [MTBF – Mean Time Between Failure](#4-mtbf--mean-time-between-failure-tiempo-medio-entre-fallas)
5. [Cómo se relacionan los tres KPIs](#5-cómo-se-relacionan-los-tres-kpis)
6. [Cómo se calculan hoy en el Excel](#6-cómo-se-calculan-hoy-en-el-excel-kpi-mantto)
7. [Aplicación al reporte ANDON](#7-aplicación-al-reporte-andon)
8. [Resultados de ejemplo con los datos ANDON 2026](#8-resultados-de-ejemplo-con-los-datos-andon-2026)
9. [Hallazgos y riesgos de calidad de datos](#9-hallazgos-y-riesgos-de-calidad-de-datos)
10. [Recomendaciones](#10-recomendaciones)
11. [Resumen de una página](#11-resumen-de-una-página)

---

## 1. Los tres datos base

Los tres KPIs del glosario se calculan con **solo tres datos**. Si cualquiera de ellos está mal, los tres indicadores salen mal.

| Término del glosario | Significado | En el Excel | En ANDON |
|---|---|---|---|
| **Breakdown time** (tiempo de falla) | Tiempo que el equipo estuvo **parado por una falla**, desde que se detiene hasta que vuelve a operar | *Downtime* (fila 33 de *KPI Mantto*) | `Tiempo total de la parada (segundos)` |
| **Number of failure stoppages** (número de paros por falla) | Cuántas veces se detuvo el equipo por falla | *Cantidad de fallas* (fila 24) | Número de reportes que pasan los filtros (sección 7) |
| **Loading hours** (horas de carga) | Tiempo en que el equipo **debía estar produciendo**: tiempo calendario menos paros planeados (turnos sin producción, comida, juntas, preventivo programado) | *Tiempo disponible* (fila 66 = 373,132 min/mes) | **No existe en ANDON**: se toma de *Datos Maestros* |

> **Importante:** Un paro planeado (cambio de modelo, mantenimiento preventivo, falta de material, junta) **no es breakdown time**. Solo cuentan los paros causados por **falla del equipo**.

---

## 2. BDR – Breakdown Rate (tasa de paro por falla)

### Definición (glosario 3014)
> Índice que mide el grado de pérdida de tiempo por paros debidos a falla de equipo. Se expresa como la fracción del tiempo de falla respecto a las horas de carga.

### Fórmula
```
                Breakdown time
BDR (%)  =  ──────────────────────  × 100
                Loading hours
```

### Cómo leerlo
- Es el **porcentaje del tiempo productivo que se perdió por fallas**.
- **Menor es mejor.** Un BDR de 0.54% significa que de cada 100 minutos que la línea debía producir, se perdieron 0.54 minutos por fallas.
- No depende de cuántas fallas hubo ni de cuánto duró cada una por separado. Solo mide el **total perdido**.
- Es el KPI "de resultado". MTTR y MTBF explican **por qué** el BDR sube o baja.

### Ejemplo (Excel, enero 2026)
```
BDR = 2,014 min / 373,132 min × 100 = 0.54 %
```

### Meta actual en el Excel
- Mensual: **1.9%**. Diaria: **1.56%**.

---

## 3. MTTR – Mean Time To Repair (tiempo medio de reparación)

### Definición (glosario 3017)
> Índice que indica el periodo promedio de reparación **entre el paro del equipo por falla y la siguiente operación**.

### Fórmula
```
                         Breakdown time
MTTR (horas)  =  ──────────────────────────────
                  Number of failure stoppages
```

### Cómo leerlo
- Es **cuánto dura en promedio cada falla**, desde que el equipo se para hasta que vuelve a producir.
- **Menor es mejor.**
- Según la definición, el MTTR **incluye todo lo que pasa entre el paro y el arranque**, no solo el tiempo con la herramienta en la mano:

```
 Paro del equipo ──► Llega el técnico ──► Termina la reparación ──► Equipo opera
       │◄─── tiempo de localización ───►│◄──── tiempo de reparación ────►│
       │◄──────────────────────── MTTR (breakdown time) ────────────────►│
```

  Por eso el MTTR mejora atacando **dos frentes distintos**:
  1. **Respuesta**: que el técnico llegue más rápido (disponibilidad de personal, escalamiento, cercanía).
  2. **Reparación**: que se repare más rápido (refacciones a la mano, capacitación, estándares de trabajo, diagnóstico).

- La definición está en **horas**. El Excel lo reporta en **minutos**, lo cual es válido siempre que la meta use la misma unidad.

### Ejemplo (Excel, enero 2026)
```
MTTR = 2,014 min / 150 fallas = 13.4 min por falla  (= 0.22 h)
```

### Meta actual en el Excel
- **≤ 15 min.**

---

## 4. MTBF – Mean Time Between Failure (tiempo medio entre fallas)

### Definición (glosario 3016)
> Índice que indica el periodo promedio de **tiempo de operación** entre la reparación de una falla y la ocurrencia de la siguiente falla.

### Fórmula
```
                  Loading hours − Breakdown time
MTBF (horas)  =  ────────────────────────────────
                   Number of failure stoppages
```

### Por qué se resta el breakdown time
El MTBF mide **tiempo operando**, no tiempo calendario. Mientras el equipo está en falla no está operando, así que ese tiempo se descuenta:

```
 ──[opera]──X──falla──┤──[opera]──X──falla──┤──[opera]──X ...
   ◄─ MTBF ─►          ◄─ MTBF ─►
              ◄MTTR►               ◄MTTR►
```

### Cómo leerlo
- Es **cuánto tiempo produce el equipo en promedio antes de volver a fallar**.
- **Mayor es mejor.**
- Mide la **confiabilidad** del equipo. Se mejora con mantenimiento preventivo, eliminación de causa raíz y prevención de recurrencia.

### ⚠️ Cuidado con la interpretación a nivel planta
Cuando el *loading hours* es la **suma de todas las líneas** (como los 373,132 min del Excel), el MTBF resultante está en **horas-línea**, no en horas de reloj.

- Enero: MTBF = 41.2 h significa que **cada línea**, en promedio, opera ~41 horas entre fallas.
- **No** significa que la planta pase 41 horas sin una falla. Con 150 fallas en 31 días, en algún punto de la planta ocurre una falla **cada ~5 horas de reloj**.

### Ejemplo (Excel, enero 2026)
```
MTBF = (373,132 − 2,014) min / 150 fallas / 60 = 41.2 horas
```

### Meta actual en el Excel
- **≥ 32 h.**

---

## 5. Cómo se relacionan los tres KPIs

### Relación exacta
Con las fórmulas del glosario (y MTTR y MTBF en la misma unidad):

```
              MTTR                                    MTBF
BDR  =  ─────────────────          Disponibilidad = ─────────────── = 1 − BDR
         MTTR  +  MTBF                               MTBF + MTTR
```

**Demostración:** si `D` = breakdown time, `L` = loading hours y `N` = número de fallas:
`MTTR = D/N`, `MTBF = (L−D)/N`, entonces `MTTR / (MTTR + MTBF) = D / (D + L − D) = D / L = BDR`.

**Verificación con enero:** MTTR = 0.2238 h, MTBF = 41.235 h → 0.2238 / (0.2238 + 41.235) = **0.54%** ✔

### Qué significa en la práctica
El BDR solo puede bajar de dos maneras:

| Palanca | KPI que se mueve | Acciones típicas |
|---|---|---|
| **Que falle menos seguido** | ↑ MTBF (↓ cantidad de fallas) | Preventivo, análisis de causa raíz (5 porqués), contramedidas de recurrencia, inspecciones |
| **Que cuando falle, se arregle más rápido** | ↓ MTTR | Tiempo de respuesta, refacciones críticas, capacitación, estándares de reparación |

**Ejemplo con datos del Excel:** agosto y septiembre tienen el BDR más alto del año (0.62% y 0.69%). El MTTR de esos meses (12.1 y 14.3 min) está dentro de meta. Lo que empeoró fue el **número de fallas** (190 y 179, con MTBF de 32.5 y 34.5 h). El problema fue de **confiabilidad**, no de velocidad de reparación.

---

## 6. Cómo se calculan hoy en el Excel (*KPI Mantto*)

| KPI | Celda (ene.) | Fórmula en el Excel | Coincide con el glosario |
|---|---|---|---|
| Cantidad de fallas | D24 | Captura manual | — |
| Downtime | D33 | Captura manual (min) | — |
| Tiempo disponible | D66 | Captura manual (373,132 min) | Ver nota ⚠️ |
| **BDR** | D6 | `=D33/D66` | ✔ (sin ×100 porque la celda tiene formato %) |
| **MTTR** | D41 | `=D33/D24` | ✔ (en minutos) |
| **MTBF** | D50 | `=((D66-D33)/D24)/60` | ✔ (en horas) |

### Valores 2026 del Excel

| Mes | Fallas | Downtime (min) | BDR | MTTR (min) | MTBF (h) |
|---|---:|---:|---:|---:|---:|
| Ene | 150 | 2,014 | 0.54% | 13.4 | 41.2 |
| Feb | 180 | 2,257 | 0.60% | 12.5 | 34.3 |
| Mar | 114 | 1,415 | 0.38% | 12.4 | 54.3 |
| Abr | 95 | 1,184 | 0.32% | 12.5 | 65.3 |
| May | 147 | 2,076 | 0.56% | 14.1 | 42.1 |
| Jun | 150 | 2,240 | 0.60% | 14.9 | 41.2 |
| Jul | 130 | 1,900 | 0.51% | 14.6 | 47.6 |
| Ago | 190 | 2,300 | 0.62% | 12.1 | 32.5 |
| Sep | 179 | 2,560 | 0.69% | 14.3 | 34.5 |
| Oct | 103 | 621 | 0.17% | 6.0 | 60.3 |
| **Meta** | 230 | 300 | 1.9% | 15 | 32 |

### ⚠️ Notas sobre el Excel
1. **Loading hours con factor de eficiencia.** En *Datos Maestros Actual* el tiempo de cada línea se calcula como `horas/semana × eficiencia (0.85–0.95) × 60 × 4`. Según el glosario, las *loading hours* son el tiempo **programado para producir**, sin descontar eficiencia. La eficiencia es otra pérdida que se mide en el OEE. El factor achica el denominador ~10–15% y el BDR sale un poco más alto de lo real.
2. **La base no está actualizada.** La suma de *Datos Maestros Actual* (E7:E31) da **436,781 min**, pero el KPI usa **373,132 min** (el valor que aparece en *Fallas Julio*!F2). Hay que definir cuál es la vigente.
3. **Las metas se contradicen.** Una meta de BDR de 1.9% equivale a ~7,090 min de paro al mes, pero la meta de Downtime es de 300 min (≈ 0.08% de BDR). Una de las dos está mal calibrada.
4. **Octubre está incompleto.** Tiene 103 fallas y 621 min, y aparenta ser el mejor mes (BDR 0.17%, MTBF 60 h). El denominador sí es un mes completo, así que los KPIs salen artificialmente buenos.
5. **Los valores "REAL" se capturan a mano** y no se pueden rastrear al reporte ANDON (ver sección 9).

---

## 7. Aplicación al reporte ANDON

### 7.1 Estructura del reporte
El CSV trae **4 líneas de encabezado** (SIGMA, planta, título, fecha del reporte). Los nombres de columna empiezan en la **línea 5**. Cada fila es **un reporte de mantenimiento** (una llamada ANDON).

### 7.2 Mapeo de columnas a los KPIs

| Necesito | Columna ANDON | Uso |
|---|---|---|
| Fecha del evento | `Inicio de la falla` / `Fecha a reportar` | Agrupar por mes, semana o día |
| Línea / equipo | `Linea`, `Maquina` | Estratificar por línea y por máquina |
| Tiempo hasta que llega el técnico | `Tiempo de localización (segundos)` | Componente de **respuesta** del MTTR |
| Tiempo de reparación | `Tiempo de reparacion (segundos)` | Componente de **reparación** del MTTR |
| **Breakdown time** | `Tiempo total de la parada (segundos)` | Numerador de BDR y MTTR |
| ¿Paró producción? | `Genero interrupcion?` (Si/No) | Filtro: solo cuenta si = **Si** |
| ¿Lo atendió Mantenimiento? | `Area que atendio` | Filtro: Mantenimiento Mecánico / Eléctrico |
| Tipo de falla | `Falla confirmada` | Pareto de causas |
| Turno | `Turno` | Comparación entre turnos |
| Análisis | `Primer…Quinto por que`, `5M-…`, `Plan` | Seguimiento de causa raíz para fallas repetitivas |

**Verificado en los datos:** en el **100% de los 4,815 reportes**:
```
Tiempo total de la parada = Tiempo de localización + Tiempo de reparación
```
El *tiempo de confirmación* **no** se suma. Esto coincide con la definición del glosario: el MTTR va "del paro a la siguiente operación", y la línea arranca al terminar la reparación, no cuando el operador confirma.

### 7.3 Reglas de filtrado propuestas

No todo reporte ANDON es un *failure stoppage*. Estos son los filtros, en orden:

| # | Regla | Motivo |
|---|---|---|
| 1 | `Area que atendio` ∈ {Mantenimiento Mecanico, Mantenimiento Electrico} | El KPI es de Mantenimiento. Excluye GAP Líder, Almacén, Calidad, etc. |
| 2 | `Genero interrupcion?` = **Si** | El glosario habla de **paro** del equipo. Un reporte sin interrupción no es breakdown time |
| 3 | Excluir los reportes con `Detalle de la falla` = "Reporte cerrado automáticamente…" | Son cierres administrativos del sistema, no fallas reales (406 reportes en el año) |
| 4 | Excluir las líneas `SMD…` y `LINEA PRUEBA` del KPI de ensamble | SMT tiene su propio tiempo disponible, que no está en los 373,132 min |
| 5 | Separar los reportes con paro **> 480 min (1 turno)** para **validación manual** | Son reportes que se dejaron abiertos (hay casos de hasta 18 días). Si se suman sin revisar, distorsionan todo |
| 6 | **A nivel línea:** fusionar los reportes que se traslapan en el tiempo | Si dos máquinas de la misma línea fallan al mismo tiempo, la línea no estuvo parada el doble (ver 9.3) |

Resultado de aplicar las reglas 1–4 a todo 2026: **2,944 reportes**. La regla 5 separa **192** para validación y quedan **2,752 válidos**.

### 7.4 Fórmulas en Excel sobre el CSV

Importar el CSV como tabla llamada `Andon` (Datos → Desde texto/CSV, omitiendo las 4 primeras filas). Después agregar tres columnas auxiliares:

```excel
Min_paro  =[@[Tiempo total de la parada (segundos)]]/60

Mes       =TEXTO([@[Inicio de la falla]],"aaaa-mm")

Valida    =Y( O([@[Area que atendio]]="Mantenimiento Mecanico",
                [@[Area que atendio]]="Mantenimiento Electrico"),
              [@[Genero interrupcion?]]="Si",
              IZQUIERDA([@[Detalle de la falla (reporte tecnico)]],20)<>"Reporte cerrado auto",
              IZQUIERDA([@Linea],3)<>"SMD",
              [@Min_paro]<=480 )
```

Tabla de KPIs mensual (celda `A2` = "2026-10", `B2` = loading hours en minutos):

```excel
Fallas     =CONTAR.SI.CONJUNTO(Andon[Mes],A2, Andon[Valida],VERDADERO)
Downtime   =SUMAR.SI.CONJUNTO(Andon[Min_paro], Andon[Mes],A2, Andon[Valida],VERDADERO)
BDR        =Downtime / B2                       → formato %
MTTR (min) =Downtime / Fallas
MTBF (h)   =(B2 - Downtime) / Fallas / 60
```

Para un KPI **por línea**, agregar el criterio `Andon[Linea], "<línea>"` y usar el loading de esa línea en `B2`.

> En Excel en inglés: `COUNTIFS`, `SUMIFS`, `AND`, `OR`, `LEFT`, `TEXT(...,"yyyy-mm")`, `TRUE`. El separador de argumentos (`,` o `;`) depende de la configuración regional.

### 7.5 Loading hours por línea (de *Datos Maestros Actual*)

ANDON no trae tiempo disponible, así que hay que relacionar sus nombres de línea con *Datos Maestros*:

| Línea en ANDON | Línea en Datos Maestros | Loading actual (min/mes)* |
|---|---|---:|
| Honda 25SA | Honda 25SA | 40,128 |
| Ford U625 | Ford U625 | 26,928 |
| Ford P708 | Ford 708 | 17,340 |
| Ford P702-1 / P702-2 | Ford 702 (¿una o dos líneas?) | 28,512 |
| CWL-17 SCANIA | Scania Camera | 26,928 |
| P13C Display RTV | Nissan P13C | 26,928 |
| A IVI | Nissan AVI | 9,293 |
| Nissan H61P | Nissan H61P | 17,952 |
| Mitsuba | Mitsuba | 8,976 |
| Stellantis | Stellantis ECU / Display / RVC (ambiguo) | — |
| Nissan HJ | (¿Humax?) sin equivalente claro | — |
| Rivian | Rivian Display / Remoute (ambiguo) | — |

\* Incluye el factor de eficiencia (ver sección 6, nota 1). **Se recomienda crear un catálogo oficial ANDON ↔ Datos Maestros** para que el cálculo por línea no dependa de interpretaciones.

---

## 8. Resultados de ejemplo con los datos ANDON 2026

> Estos números muestran **cómo** se aplican las fórmulas. **No deben reportarse todavía como KPI oficial**, porque la sección 9 muestra que los tiempos de ANDON no se pueden interpretar directamente como paro de línea.

### 8.1 Planta (sin SMD), loading = 373,132 min/mes

| Mes | Reportes (reglas 1–4) | Downtime crudo (min) | BDR crudo | Excluidos > 480 min | Fallas válidas | Downtime válido (min) | **BDR** | **MTTR (min)** | **MTBF (h)** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ene | 27 | 140,443 | 37.6% | 21 | 6 | 833 | 0.22% | 138.9 | 1,034 |
| Feb | 30 | 183,234 | 49.1% | 26 | 4 | 543 | 0.15% | 135.7 | 1,553 |
| Mar | 51 | 287,050 | 76.9% | 23 | 28 | 2,204 | 0.59% | 78.7 | 221 |
| Abr | 195 | 63,907 | 17.1% | 25 | 170 | 9,749 | 2.61% | 57.3 | 35.6 |
| May | 307 | 31,156 | 8.4% | 12 | 295 | 16,321 | 4.37% | 55.3 | 20.2 |
| Jun | 264 | 35,093 | 9.4% | 15 | 249 | 17,564 | 4.71% | 70.5 | 23.8 |
| Jul | 268 | 57,305 | 15.4% | 22 | 246 | 19,457 | 5.21% | 79.1 | 24.0 |
| Ago | 274 | 36,427 | 9.8% | 16 | 258 | 15,462 | 4.14% | 59.9 | 23.1 |
| Sep | 672 | 46,988 | 12.6% | 11 | 661 | 38,454 | 10.31% | 58.2 | 8.4 |
| Oct | 718 | 59,031 | 15.8% | 17 | 701 | 38,247 | 10.25% | 54.6 | 8.0 |
| Nov* | 138 | 13,626 | 3.7% | 4 | 134 | 8,978 | 2.41% | 67.0 | 45.3 |

\* Noviembre parcial (hasta el día 11).

**Lectura:**
- La columna "BDR crudo" muestra el efecto de **no filtrar** los reportes abiertos por días: en marzo daría un absurdo 77%.
- De enero a marzo hay muy pocos reportes. ANDON se empezó a usar de forma generalizada en **abril** y el volumen vuelve a brincar en **septiembre**. Las tendencias de todo el año **no son comparables**.

### 8.2 Octubre 2026 por línea (reportes válidos)

| Línea | Fallas | Downtime (min) | Loading (min) | BDR | MTTR (min) | MTBF (h) |
|---|---:|---:|---:|---:|---:|---:|
| Honda 25SA | 432 | 21,917 | 40,128 | 54.6% | 50.7 | 0.7 |
| Ford U625 | 58 | 3,404 | 26,928 | 12.6% | 58.7 | 6.8 |
| Ford P708 | 49 | 2,952 | 17,340 | 17.0% | 60.2 | 4.9 |
| CWL-17 SCANIA | 28 | 1,832 | 26,928 | 6.8% | 65.4 | 14.9 |
| P13C Display RTV | 28 | 1,790 | 26,928 | 6.6% | 63.9 | 15.0 |
| Mitsuba | 19 | 1,385 | 8,976 | 15.4% | 72.9 | 6.7 |
| Nissan H61P | 10 | 705 | 17,952 | 3.9% | 70.5 | 28.7 |
| A IVI | 21 | 496 | 9,293 | 5.3% | 23.6 | 7.0 |

Honda 25SA concentra el **62% de los reportes** del mes (≈14 al día). Las máquinas con más reportes son *Assembly 6* (37), *Assembly 4-B* (29) y *EOL 2* (27).

### 8.3 Desglose del MTTR (octubre)

| Componente | Minutos | % |
|---|---:|---:|
| Localización (espera al técnico) | 21,621 | **57%** |
| Reparación | 16,626 | 43% |

En todo el año, la **mediana** de localización es de ~16 min y la de reparación de ~4 min. **Más de la mitad del MTTR es espera, no reparación.** Este dato solo se puede obtener de ANDON, no del Excel, y es probablemente la palanca más rápida para bajar el MTTR.

### 8.4 Pareto de fallas (octubre, por downtime)

| Falla confirmada | Fallas | Downtime (min) |
|---|---:|---:|
| Fallo de herramientas o equipo | 290 | 16,329 |
| FALLA EN GENERAL | 260 | 12,976 |
| Falso rechazo en equipo | 44 | 3,406 |
| Fallo/apagado o reinicio de equipo | 18 | 1,131 |
| Falla JIG / Pallet | 17 | 1,010 |
| Falla en spot flow | 12 | 967 |

Las dos primeras categorías son **genéricas** y suman el 77% del downtime, así que no sirven para encontrar la causa raíz (ver recomendación 4).

### 8.5 Por turno (octubre)

| Turno | Fallas | Downtime (min) |
|---|---:|---:|
| Turno 1 | 372 | 18,685 |
| Turno 2 | 329 | 19,561 |

El Turno 2 tiene menos fallas pero más minutos. Sus fallas duran más en promedio (59 vs 50 min), lo que puede indicar menor cobertura de técnicos.

---

## 9. Hallazgos y riesgos de calidad de datos

### 9.1 ANDON y el Excel no cuadran
| Octubre 2026 | Excel (*KPI Mantto*) | ANDON (filtrado) |
|---|---:|---:|
| Fallas | 103 | 701 |
| Downtime | 621 min | 38,247 min |
| BDR | 0.17% | 10.25% |

Una diferencia de **60 veces** en downtime no se explica por los filtros. Los valores del Excel se capturan a mano desde otra fuente: la hoja *Fallas Julio* tiene solo 19 registros y tampoco coincide.

### 9.2 El tiempo ANDON no es igual al tiempo de paro de línea
Aun filtrando, Honda 25SA daría un BDR de **55%**: más de la mitad de su tiempo programado parada por fallas. No es creíble si la línea cumplió producción. Causas probables:
- **`Genero interrupcion?` = "Si" se marca por defecto** o sin verificar. El 67% de todos los reportes dice "Si".
- **Los reportes se cierran tarde.** El reloj de ANDON sigue corriendo después de que la línea ya arrancó.
- **Una máquina detenida no siempre detiene la línea**, por ejemplo cuando hay estaciones en paralelo o buffer.

### 9.3 Reportes que se traslapan
Cuando dos máquinas de la misma línea están en falla al mismo tiempo, sumar sus tiempos **cuenta dos veces** el paro de línea. En octubre:

| Línea | Suma de reportes (min) | Tiempo real con intervalos fusionados (min) | Doble conteo |
|---|---:|---:|---:|
| Honda 25SA | 21,917 | 16,589 | 24% |
| Ford U625 | 3,404 | 2,909 | 15% |
| Ford P708 | 2,952 | 2,748 | 7% |

- **BDR por equipo/máquina:** sumar normal. Así lo plantea el glosario, que habla de "equipment".
- **BDR por línea:** fusionar los intervalos de tiempo (`Inicio de la falla` → `Inicio + Tiempo total`) antes de sumar.

### 9.4 Reportes abiertos por días
En 2026, ~190 reportes de Mantenimiento superan 8 horas y ~100 superan 24 horas. El máximo es de ~18 días. Sin filtrarlos, un solo reporte puede valer más que todas las fallas del mes.

### 9.5 Adopción de ANDON
| Periodo | Reportes de Mantenimiento por mes |
|---|---|
| Ene–Mar | 29 – 65 |
| Abr–Ago | 256 – 385 |
| Sep–Oct | 944 – 1,150 |

Un aumento de reportes **no significa** necesariamente más fallas. Puede significar que se reporta más. Las comparaciones mes contra mes solo son válidas a partir de que el uso de ANDON se estabilice.

---

## 10. Recomendaciones

1. **Definir una sola fuente oficial.** ANDON ya tiene marca de tiempo, línea, máquina, técnico y causa. Conviene que el Excel se alimente de ANDON (con las reglas de la sección 7.3) en lugar de capturar a mano.
2. **Validar el campo `Genero interrupcion?`.** Que el supervisor o líder de línea confirme si realmente paró la producción, y auditar una muestra semanal contra el registro de producción.
3. **Disciplina de cierre.** Cerrar el reporte **cuando la línea arranca**. Configurar una alarma para reportes abiertos más de 2 horas: ANDON ya tiene los campos `Alarmado por reporte no cerrado a tiempo` y `Nivel de escalamiento`.
4. **Eliminar las categorías genéricas** ("FALLA EN GENERAL", "Fallo de herramientas o equipo") del catálogo de *Falla confirmada*, o hacerlas obligatoriamente más específicas. Con el 77% del downtime en categorías genéricas, el Pareto no apunta a ninguna causa raíz.
5. **Reportar el MTTR dividido en dos:** *tiempo de respuesta* (localización) y *tiempo de reparación*. Cada uno tiene su propio dueño y sus propias acciones.
6. **Corregir el denominador (loading hours).** Usar el tiempo programado sin factor de eficiencia, actualizado con el calendario real de cada mes (días laborables, turnos, paros planeados). Definir si la base vigente es 373,132 o 436,781 min.
7. **Recalibrar las metas** para que sean coherentes entre sí: con `Meta Downtime = Meta BDR × Loading` y `Meta MTBF = (Loading − Meta Downtime) / Meta Fallas / 60`, las metas quedan alineadas por construcción.
8. **Calcular los KPIs en dos niveles:**
   - **Por máquina** (suma simple): para confiabilidad y planes de preventivo.
   - **Por línea** (intervalos fusionados): para impacto en producción y OEE.
9. **Crear un catálogo ANDON ↔ Datos Maestros** de nombres de línea (sección 7.5).

---

## 11. Resumen de una página

| KPI | Pregunta que responde | Fórmula | Unidad | Mejor si | Meta actual |
|---|---|---|---|---|---|
| **Cantidad de fallas** | ¿Cuántas veces falló? | Conteo de paros por falla | eventos | ↓ | 230/mes |
| **Downtime** | ¿Cuánto tiempo se perdió? | Σ breakdown time | min | ↓ | 300 min/mes |
| **BDR** | ¿Qué % del tiempo productivo se perdió por fallas? | Breakdown time / Loading hours × 100 | % | ↓ | 1.9% |
| **MTTR** | ¿Cuánto dura cada falla? | Breakdown time / N° de fallas | h o min | ↓ | 15 min |
| **MTBF** | ¿Cada cuánto falla? | (Loading − Breakdown time) / N° de fallas | h | ↑ | 32 h |

```
BDR = MTTR / (MTTR + MTBF)          Disponibilidad = 1 − BDR
```

**Para aplicarlo a ANDON:** Mantenimiento Mecánico/Eléctrico + `Genero interrupcion?` = Si + sin cierres automáticos + sin SMD + validar los > 480 min + fusionar traslapes a nivel línea + loading hours de *Datos Maestros*.

---
*Notas:*
- *Los símbolos ● / ▲ y el triángulo con "B" que aparecen junto a las definiciones son marcas propias del documento de origen y no forman parte de las fórmulas. No se pudo confirmar su significado.*
- *Cálculos hechos sobre la exportación ANDON del 11-nov-2026.*
