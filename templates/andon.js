// Indicadores de mantenimiento (BDR, MTTR, MTBF) desde la exportación "Reportes de mantenimiento" de ANDON.
// Reglas: Maintenance 2026/KPIs_Mantenimiento_BDR_MTTR_MTBF.md (sección 7.3). Lo usan el dashboard, las consultas
// y test_build.py (con node). El tiempo disponible por línea sale del Excel (lineas.json, lo genera build.py).
(function () {
  const AREAS = new Set(['Mantenimiento Mecanico', 'Mantenimiento Electrico']);
  const MAX_MIN = 480;  // > 1 turno: reporte que se dejó abierto, se separa para validar
  const METAS = { bdr: 1.9, mttr: 15, mtbf: 32 };  // hoja KPI Mantto 2026
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const AUTO = /^Reporte cerrado autom/i;
  // columna de ANDON -> campo del registro (se busca por inicio del nombre: "Estatus del reporte (0=...)")
  const COLS = { id: 'Número', ini: 'Inicio de la falla', turno: 'Turno', est: 'Estatus del reporte', loc: 'Tiempo de localización',
                 rep: 'Tiempo de reparacion', tot: 'Tiempo total de la parada', lin: 'Linea', maq: 'Maquina', area: 'Area que atendio',
                 falla: 'Falla confirmada', det: 'Detalle de la falla', int: 'Genero interrupcion' };

  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function filasCsv(texto) {
    const filas = [];
    let fila = [], campo = '', comillas = false;
    texto = texto.replace(/^﻿/, '');
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ',') { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  // "05/01/2026 09:50" (día/mes) -> "2026-01-05 09:50"; también acepta "2026-01-05 09:50"
  function fecha(s) {
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(s.trim());
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5]}`;
    m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : null;
  }

  // CSV de ANDON -> registros compactos. Lanza Error con un mensaje para el usuario si no es el reporte esperado.
  function leerCsv(texto) {
    const filas = filasCsv(texto);
    const h = filas.findIndex(f => f[0].trim() === COLS.id);
    if (h < 0) throw new Error('El archivo no parece ser el reporte de mantenimiento de ANDON: no tiene la columna «Número».');
    const enc = filas[h].map(c => c.trim());
    const idx = {};
    for (const [k, nombre] of Object.entries(COLS)) {
      idx[k] = enc.findIndex(c => c.startsWith(nombre));
      if (idx[k] < 0) throw new Error(`Al archivo le falta la columna «${nombre}». Exporte el reporte completo desde ANDON.`);
    }
    const out = [];
    for (const f of filas.slice(h + 1)) {
      const v = k => (f[idx[k]] || '').trim();
      const id = parseInt(v('id'), 10), ini = fecha(v('ini'));
      if (!id || !ini) continue;
      out.push({ id, ini, turno: v('turno'), est: +v('est') || 0, loc: +v('loc') || 0, rep: +v('rep') || 0, tot: +v('tot') || 0,
                 lin: v('lin'), maq: v('maq'), area: v('area'), falla: v('falla'), int: v('int'), auto: AUTO.test(v('det')) ? 1 : 0 });
    }
    if (!out.length) throw new Error('El archivo no trae reportes con número y fecha de inicio.');
    return out;
  }

  // la versión más avanzada del mismo reporte: mayor estatus; con el mismo, mayor tiempo (sigue abierto y corriendo)
  const masReciente = (a, b) => a.est !== b.est ? a.est > b.est : a.tot >= b.tot;

  // une sin perder nada: los que no vienen en el archivo se conservan, los que vienen se agregan o actualizan
  function combinar(base, nuevos) {
    const m = new Map(base.map(r => [r.id, r]));
    let agregados = 0, actualizados = 0, iguales = 0;
    for (const r of nuevos) {
      const viejo = m.get(r.id);
      if (!viejo) { m.set(r.id, r); agregados++; }
      else if (JSON.stringify(viejo) === JSON.stringify(r) || !masReciente(r, viejo)) iguales++;
      else { m.set(r.id, r); actualizados++; }
    }
    return { registros: [...m.values()].sort((a, b) => a.id - b.id), agregados, actualizados, iguales };
  }

  // reportes que cuentan como paro por falla de Mantenimiento (sin el límite de duración)
  const cuenta = r => AREAS.has(r.area) && r.int === 'Si' && !r.auto && !/^(SMD|LINEA PRUEBA)/i.test(r.lin);
  const mesDe = r => +r.ini.slice(5, 7), anioDe = r => +r.ini.slice(0, 4);

  function crearModelo(registros, lineas) {
    const base = registros.filter(cuenta);
    const ultima = registros.reduce((a, r) => r.ini > a ? r.ini : a, '');
    const [uA, uM, uD] = [+ultima.slice(0, 4), +ultima.slice(5, 7), +ultima.slice(8, 10)];
    const anios = [...new Set(registros.map(anioDe))].sort();

    // fracción del mes con datos: el mes en curso solo cuenta hasta el último reporte
    function fraccion(a, m) {
      if (a < uA || (a === uA && m < uM)) return 1;
      if (a === uA && m === uM) return uD / new Date(a, m, 0).getDate();
      return 0;
    }
    const disponible = (linea) => linea ? lineas.lineas[linea] : lineas.planta;
    function loading(anio, mes, linea) {
      const porMes = disponible(linea);
      if (!porMes) return null;
      const meses = mes ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      return porMes * meses.reduce((s, m) => s + fraccion(anio, m), 0);
    }

    const filtrar = ({ anio, mes, linea }) => base.filter(r => anioDe(r) === anio && (!mes || mesDe(r) === mes) && (!linea || r.lin === linea));

    function kpis(regs, L) {
      const validos = regs.filter(r => r.tot / 60 <= MAX_MIN);
      const paro = validos.reduce((s, r) => s + r.tot, 0) / 60, n = validos.length;
      return { fallas: n, paro, loc: validos.reduce((s, r) => s + r.loc, 0) / 60, rep: validos.reduce((s, r) => s + r.rep, 0) / 60,
               porValidar: regs.length - n, loading: L,
               bdr: L ? paro / L * 100 : null, mttr: n ? paro / n : null, mtbf: L && n ? (L - paro) / n / 60 : null };
    }
    const calcular = f => kpis(filtrar(f), loading(f.anio, f.mes, f.linea));
    const serie = (anio, linea) => MESES.map((_, i) => ({ mes: i + 1, ...calcular({ anio, mes: i + 1, linea }), conDatos: fraccion(anio, i + 1) > 0 }));

    // por línea, máquina, falla o turno; ordenado por tiempo de paro
    function grupos(f, campo) {
      const g = new Map();
      for (const r of filtrar(f)) { const k = r[campo] || 'Sin dato'; (g.get(k) || g.set(k, []).get(k)).push(r); }
      return [...g].map(([nombre, regs]) => ({ nombre, lin: regs[0].lin,
        ...kpis(regs, campo === 'lin' ? loading(f.anio, f.mes, nombre) : null) })).sort((a, b) => b.paro - a.paro);
    }
    const lineasConDatos = [...new Set(base.map(r => r.lin))].sort((a, b) => a.localeCompare(b));
    return { calcular, serie, grupos, anios, ultima, lineasConDatos, fraccion };
  }

  // ------------------------------------------------------------ consulta en lenguaje natural sobre los KPIs
  const MES_RE = [/\benero\b|\bene\b/, /\bfebrero\b|\bfeb\b/, /\bmarzo\b/, /\babril\b|\babr\b/, /\bmayo\b/, /\bjunio\b|\bjun\b/,
                  /\bjulio\b|\bjul\b/, /\bagosto\b|\bago\b/, /\bseptiembre\b|\bsetiembre\b|\bsept?\b/, /\boctubre\b|\boct\b/,
                  /\bnoviembre\b|\bnov\b/, /\bdiciembre\b|\bdic\b/];
  const KPI_RE = /\b(bdr|mttr|mtbf|kpis?|indicador(es)?|downtime|tiempo muerto|disponibilidad|breakdown)\b|(cuant[oa]s|numero de) (fallas|paros|reportes)|(fallas|paros|tiempo de paro) (de|en|del) |(maquinas?|equipos?|lineas?|turnos?) (con )?(mas|peor)|\bmas fallas\b|\bpareto\b|tiempo de (respuesta|localizacion)/;
  const esKpi = q => KPI_RE.test(norm(q));

  const f1 = (x, d = 1) => x == null ? '—' : x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ent = x => Math.round(x).toLocaleString('es-MX');

  function crearConsulta(registros, lineas) {
    const M = crearModelo(registros, lineas);
    const uA = +M.ultima.slice(0, 4), uM = +M.ultima.slice(5, 7);
    // línea nombrada: el nombre completo (de 2+ palabras) gana; si solo coincide una palabra ("honda"), la línea con más reportes
    const cuantos = new Map();
    registros.filter(cuenta).forEach(r => cuantos.set(r.lin, (cuantos.get(r.lin) || 0) + 1));
    const alias = M.lineasConDatos.map(l => {
      const n = norm(l), propios = n.split(/[\s-]+/).filter(t => t.length >= 3 && !/^(ford|nissan|display)$/.test(t));
      return { l, n, propios, completo: n.includes(' ') };
    });
    const lineaEn = q => alias.map(a => ({ a, s: (a.completo && q.includes(a.n) ? 1e9 : 0) + (cuantos.get(a.l) || 0),
      ok: q.includes(a.n) || a.propios.some(t => new RegExp(`\\b${t}\\b`).test(q)) })).filter(x => x.ok).sort((x, y) => y.s - x.s)[0]?.a.l || null;

    return function responder(consulta) {
      const q = norm(consulta).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!q) return null;
      const def = /que (es|son|significa)|definicion|como se calcula|formula/.test(q) && /\b(bdr|mttr|mtbf)\b/.exec(q);
      if (def) return { texto: {
        bdr: 'BDR (Breakdown Rate): % del tiempo disponible que se perdió por fallas. BDR = tiempo de paro ÷ tiempo disponible × 100. Menor es mejor; meta ≤ 1.9 %.',
        mttr: 'MTTR (Mean Time To Repair): duración promedio de cada falla, del paro hasta que el equipo vuelve a operar (espera del técnico + reparación). MTTR = tiempo de paro ÷ número de fallas. Menor es mejor; meta ≤ 15 min.',
        mtbf: 'MTBF (Mean Time Between Failures): tiempo promedio que el equipo opera entre una falla y la siguiente. MTBF = (tiempo disponible − tiempo de paro) ÷ número de fallas. Mayor es mejor; meta ≥ 32 h.'
      }[def[1]] };

      // periodo: mes y año nombrados; "este año" = año completo; sin periodo = mes más reciente
      const anioQ = /\b(20\d\d)\b/.exec(q);
      let mes = MES_RE.findIndex(re => re.test(q)) + 1 || null;
      let anio = anioQ ? +anioQ[1] : uA;
      if (mes && !anioQ && (anio > uA || (anio === uA && mes > uM))) anio--;
      if (/mes pasado|mes anterior/.test(q)) { mes = uM === 1 ? 12 : uM - 1; anio = uM === 1 ? uA - 1 : uA; }
      else if (!mes && !anioQ && !/\b(ano|anual|acumulado)\b/.test(q)) mes = uM;
      const linea = lineaEn(q);
      const f = { anio, mes, linea };
      const periodo = `${mes ? MESES[mes - 1] + ' ' : ''}${anio}${mes && M.fraccion(anio, mes) < 1 && M.fraccion(anio, mes) > 0 ? ' (mes en curso)' : ''}`;
      const donde = `${periodo}${linea ? ' · ' + linea : ''}`;
      const k = M.calcular(f);
      if (!k.fallas && !k.porValidar) return { texto: `Sin fallas registradas en ${donde}.` };

      const porParo = /tiempo|paro|downtime|minutos|duracion/.test(q);
      const top = (campo, titulo) => {
        const g = M.grupos(f, campo).filter(x => x.fallas);
        if (!porParo) g.sort((a, b) => b.fallas - a.fallas);
        return { texto: `${titulo} en ${donde}${porParo ? ' (por tiempo de paro)' : ' (por número de fallas)'}:`,
                 valores: g.slice(0, 5).map(x => [`${x.nombre}${campo === 'maq' && !linea ? ' · ' + x.lin : ''}: ${x.fallas} fallas, ${ent(x.paro)} min de paro, MTTR ${f1(x.mttr)} min`]) };
      };
      if (/(maquina|equipo|estacion)s? (con )?(mas|peor)|top maquinas/.test(q)) return top('maq', 'Máquinas con más fallas');
      if (/lineas? (con )?(mas|peor)/.test(q)) return top('lin', 'Líneas con más fallas');
      if (/turno/.test(q)) return top('turno', 'Fallas por turno');
      if (/pareto|causa|tipo de falla|fallas? mas (comun|frecuente)/.test(q)) return top('falla', 'Fallas más frecuentes');

      const partes = {
        bdr: k.bdr == null ? `BDR sin calcular (${linea} no tiene tiempo disponible en Datos Maestros)` : `BDR ${f1(k.bdr, 2)} % (meta ≤ ${METAS.bdr} %)`,
        mttr: `MTTR ${f1(k.mttr)} min (meta ≤ ${METAS.mttr})`,
        mtbf: k.mtbf == null ? 'MTBF sin calcular' : `MTBF ${f1(k.mtbf)} h (meta ≥ ${METAS.mtbf})`
      };
      const pedidos = ['bdr', 'mttr', 'mtbf'].filter(x => q.includes(x));
      const valores = [[`${ent(k.fallas)} fallas · ${ent(k.paro)} min de paro`]];
      if (k.fallas) valores.push([`Espera del técnico ${f1(k.loc / k.paro * 100, 0)} % · reparación ${f1(k.rep / k.paro * 100, 0)} %`]);
      if (k.porValidar) valores.push([`${k.porValidar} reportes de más de 8 h quedan fuera, por validar`]);
      return { texto: `${donde}: ${(pedidos.length ? pedidos : ['bdr', 'mttr', 'mtbf']).map(x => partes[x]).join(' · ')}.`, valores };
    };
  }

  // datos publicados + los subidos en este navegador que aún no se publican
  const LOCAL = 'andon-locales';
  function locales() { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { return []; } }
  function guardarLocales(regs) {
    try { regs.length ? localStorage.setItem(LOCAL, JSON.stringify(regs)) : localStorage.removeItem(LOCAL); return true; }
    catch { return false; }
  }
  let cache = null;
  function cargar(raiz) {
    return cache = cache || Promise.all(['andon.json', 'lineas.json'].map(u =>
      fetch(raiz + u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })))
      .then(([publicados, lineas]) => {
        // lo local que ya quedó publicado (igual o más viejo) se descarta solo
        const pub = new Map(publicados.map(r => [r.id, r]));
        const pendientes = locales().filter(r => !pub.has(r.id) || (JSON.stringify(pub.get(r.id)) !== JSON.stringify(r) && masReciente(r, pub.get(r.id))));
        guardarLocales(pendientes);
        return { publicados, pendientes, lineas, registros: combinar(publicados, pendientes).registros };
      });
  }

  const api = { leerCsv, combinar, crearModelo, crearConsulta, esKpi, cuenta, cargar, locales, guardarLocales, masReciente, METAS, MESES, MAX_MIN };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ANDON = api;
})();
