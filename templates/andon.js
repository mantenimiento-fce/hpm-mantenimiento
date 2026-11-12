// Indicadores de mantenimiento (BDR, MTTR, MTBF) desde la exportación "Reportes de mantenimiento" de ANDON.
// Solo cuentan los reportes con "Genero interrupcion?" = Si, con línea y máquina (no "N/A") y que no pidió
// "ADMINISTRADOR DEL SISTEMA"; cada uno es una falla. Downtime (breakdown time) =
// "Tiempo de reparacion (segundos)"; espera = "Tiempo de localización"; la fecha es "Inicio de la falla" (día/mes/año). El tiempo disponible (loading)
// es fijo por línea y mes, de la hoja Datos Maestros Actual del Excel (lineas.json, lo genera build.py).
// Unidades: downtime, espera, loading y MTTR en minutos; MTBF en horas; BDR en %.
// Lo usan el dashboard, las consultas y test_build.py (con node).
(function () {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const AUTO = /^Reporte cerrado autom/i;
  // columna de ANDON -> campo del registro (se busca por inicio del nombre: "Estatus del reporte (0=...)")
  const COLS = { id: 'Número', ini: 'Inicio de la falla', turno: 'Turno', est: 'Estatus del reporte', loc: 'Tiempo de localización',
                 rep: 'Tiempo de reparacion', tot: 'Tiempo total de la parada', lin: 'Linea', maq: 'Maquina', area: 'Area que atendio',
                 falla: 'Falla confirmada', det: 'Detalle de la falla', int: 'Genero interrupcion', sol: 'Usuario solicitante' };

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
                 lin: v('lin'), maq: v('maq'), area: v('area'), falla: v('falla'), int: v('int'), sol: v('sol'), auto: AUTO.test(v('det')) ? 1 : 0 });
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

  const NA = /^(n\/?a|)$/i;
  const cuenta = r => r.int === 'Si' && !NA.test(r.lin) && !NA.test(r.maq) && r.sol !== 'ADMINISTRADOR DEL SISTEMA';
  const mesDe = r => +r.ini.slice(5, 7), anioDe = r => +r.ini.slice(0, 4);

  function crearModelo(todos, lineas) {
    const registros = todos.filter(cuenta);
    const ultima = registros.reduce((a, r) => r.ini > a ? r.ini : a, '');
    const anios = [...new Set(registros.map(anioDe))].sort();
    const conDatos = new Set(registros.map(r => r.ini.slice(0, 7)));  // "2026-01"
    const hayDatos = (a, m) => conDatos.has(`${a}-${String(m).padStart(2, '0')}`);

    // loading fijo por mes (min); el año suma solo los meses con reportes
    function loading(anio, mes, linea) {
      const porMes = linea ? lineas.lineas[linea] : lineas.planta;
      if (!porMes) return null;
      return porMes * (mes ? 1 : MESES.filter((_, i) => hayDatos(anio, i + 1)).length);
    }

    const filtrar = ({ anio, mes, linea, maq }) => registros.filter(r => anioDe(r) === anio && (!mes || mesDe(r) === mes)
      && (!linea || r.lin === linea) && (!maq || r.maq === maq));

    function kpis(regs, L) {
      const n = regs.length, suma = k => regs.reduce((s, r) => s + r[k], 0) / 60;  // segundos -> min
      const paro = suma('rep');  // breakdown time: solo el tiempo de reparación
      return { fallas: n, paro, loc: suma('loc'), rep: suma('rep'), loading: L,
               bdr: L ? paro / L * 100 : null, mttr: n ? paro / n : null, mtbf: L && n ? (L - paro) / n / 60 : null };
    }
    const calcular = f => kpis(filtrar(f), loading(f.anio, f.mes, f.linea));
    const serie = (anio, linea, maq) => MESES.map((_, i) => ({ mes: i + 1, ...calcular({ anio, mes: i + 1, linea, maq }), conDatos: hayDatos(anio, i + 1) }));

    // por línea, máquina, falla o turno; ordenado por tiempo de paro
    function grupos(f, campo) {
      const g = new Map();
      for (const r of filtrar(f)) { const k = r[campo] || 'Sin dato'; (g.get(k) || g.set(k, []).get(k)).push(r); }
      return [...g].map(([nombre, regs]) => ({ nombre, lin: regs[0].lin,
        ...kpis(regs, campo === 'lin' ? loading(f.anio, f.mes, nombre) : null) })).sort((a, b) => b.paro - a.paro);
    }
    const orden = l => [...new Set(l)].sort((a, b) => a.localeCompare(b));
    const lineasConDatos = orden(registros.map(r => r.lin));
    const maquinas = linea => orden(registros.filter(r => !linea || r.lin === linea).map(r => r.maq));
    return { calcular, serie, grupos, anios, ultima, lineasConDatos, maquinas, hayDatos };
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
        bdr: 'BDR (Breakdown Rate): % del tiempo disponible que se perdió por fallas. BDR (%) = tiempo de reparación ÷ tiempo disponible × 100.',
        mttr: 'MTTR (Mean Time To Repair): tiempo promedio que el técnico tarda en reparar cada falla. MTTR (min) = tiempo de reparación ÷ número de fallas.',
        mtbf: 'MTBF (Mean Time Between Failures): tiempo promedio que el equipo opera entre una falla y la siguiente. MTBF (h) = (tiempo disponible − tiempo de reparación) ÷ número de fallas ÷ 60.'
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
      const periodo = `${mes ? MESES[mes - 1] + ' ' : ''}${anio}`;
      const donde = `${periodo}${linea ? ' · ' + linea : ''}`;
      const k = M.calcular(f);
      if (!k.fallas) return { texto: `Sin fallas registradas en ${donde}.` };

      const porParo = /tiempo|paro|downtime|minutos|duracion/.test(q);
      const top = (campo, titulo) => {
        const g = M.grupos(f, campo).filter(x => x.fallas);
        if (!porParo) g.sort((a, b) => b.fallas - a.fallas);
        return { texto: `${titulo} en ${donde}${porParo ? ' (por tiempo de paro)' : ' (por número de fallas)'}:`,
                 valores: g.slice(0, 5).map(x => [`${x.nombre}${campo === 'maq' && !linea ? ' · ' + x.lin : ''}: ${x.fallas} fallas, ${ent(x.paro)} min de downtime, MTTR ${f1(x.mttr)} min`]) };
      };
      if (/(maquina|equipo|estacion)s? (con )?(mas|peor)|top maquinas/.test(q)) return top('maq', 'Máquinas con más fallas');
      if (/lineas? (con )?(mas|peor)/.test(q)) return top('lin', 'Líneas con más fallas');
      if (/turno/.test(q)) return top('turno', 'Fallas por turno');
      if (/pareto|causa|tipo de falla|fallas? mas (comun|frecuente)/.test(q)) return top('falla', 'Fallas más frecuentes');

      const partes = {
        bdr: k.bdr == null ? `BDR sin calcular (${linea} no tiene tiempo disponible en Datos Maestros)` : `BDR ${f1(k.bdr, 2)} %`,
        mttr: `MTTR ${f1(k.mttr)} min`,
        mtbf: k.mtbf == null ? 'MTBF sin calcular' : `MTBF ${f1(k.mtbf)} h`
      };
      const pedidos = ['bdr', 'mttr', 'mtbf'].filter(x => q.includes(x));
      const valores = [[`${ent(k.fallas)} fallas · ${ent(k.paro)} min de downtime`]];
      valores.push([`Espera del técnico ${ent(k.loc)} min`]);
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

  const api = { leerCsv, combinar, crearModelo, crearConsulta, esKpi, cuenta, cargar, locales, guardarLocales, masReciente, MESES };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ANDON = api;
})();
