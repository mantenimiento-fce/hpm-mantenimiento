// Consulta sobre HPM: entiende preguntas en lenguaje natural y responde solo con datos de los Excel.
// Corre en el navegador (GitHub Pages no tiene servidor). Un modelo semántico de 118 MB no acertó más que esto
// en la medición con preguntas reales, así que el conocimiento vive aquí: SINONIMOS, FRECUENCIAS y CAMPOS.
// Para que entienda palabras nuevas, agregarlas a SINONIMOS; test_build.py valida las respuestas con `node`.
(function () {
  const VACIAS = new Set(('a acerca al algo alguna alguno ante aqui asi cada como con cual cuales cuando cuanto cuanta ' +
    'cuantos cuantas da dar de debe debo deben del dime donde el ella en entonces equipo es esa ese esta estacion estan ' +
    'hacen haga ocupa ocupan usa usan usar utiliza utilizan ' +
    'este esto favor falla hace hacer hago hay hpm informacion la las le lo los mantenimiento manto maquina me mi ' +
    'muestrame muy necesito no o para pero por problema puede puedo punto puntos paso pasos que quiero realiza realizar ' +
    'requiere revisa revisar revision reviso se segun ser si sin sobre son su sus tarea tareas tiene todas todo todos ' +
    'toca tengo un una unos uso verifica verificar verifico checar checo y ya actividad actividades').split(' '));

  // palabra del técnico -> vocabulario de las hojas (sin acentos); la clave se compara por raíz, así cubre plurales
  const SINONIMOS = {
    raton: 'mouse', alarma: 'torreta', semaforo: 'torreta', baliza: 'torreta', camara: 'vision sensores',
    piston: 'cilindros vastago camisa', servo: 'servomotores', engrasar: 'grasa lubricante lubricados',
    engraso: 'grasa lubricante lubricados', engrase: 'grasa lubricante lubricados', lubricar: 'grasa lubricante',
    lubrico: 'grasa lubricante', aceite: 'grasa lubricante', compu: 'computadora', pc: 'computadora', cpu: 'computadora',
    ordenador: 'computadora', foco: 'lamparas iluminacion', luz: 'lamparas iluminacion torreta', lampara: 'lamparas iluminacion',
    emergencia: 'botones seguridad', estatica: 'ionizador descarga', electrostatica: 'ionizador descarga',
    correa: 'bandas', multimetro: 'voltimetro', volts: 'voltaje', voltios: 'voltaje', entrada: 'alimentacion suministro',
    red: 'ethernet', internet: 'ethernet', tubo: 'tuberia mangueras', escape: 'fugas', escapando: 'fugas', fuga: 'fugas',
    drive: 'motor drivers', variador: 'motor drivers', nobreak: 'ups', relay: 'relevadores', calienta: 'temperatura sobrecalentamiento',
    caliente: 'temperatura sobrecalentamiento', sobrecalienta: 'sobrecalentamiento temperatura', enfriador: 'enfriamiento temperatura',
    chiller: 'enfriamiento temperatura', cambiar: 'reemplazo reemplace', sustituir: 'reemplazo reemplace', aspirar: 'aspiradora',
    flojo: 'sueltos apretados apriete tornilleria', floja: 'sueltos apretados apriete tornilleria', suelto: 'sueltos apretar apriete',
    apretar: 'apriete apretados tornilleria', tornillo: 'tornilleria', sucio: 'limpieza limpio', mugre: 'limpieza limpio',
    rendimiento: 'pass rate', rechazo: 'pass rate', presion: 'manometro mpa', drenar: 'filtro frl agua', purgar: 'filtro frl agua',
    agua: 'filtro frl', pantalla: 'display', monitor: 'display', gabinete: 'tablero', cable: 'cableado', cadena: 'portacables',
    boton: 'botones botoneras', abanico: 'ventilador ventiladores', grados: 'temperatura', ruido: 'ruidos estetoscopio'
  };

  // FREC. del Excel son semanas: lo confirma el intervalo en días de la hoja "Tareas SAP" (1=7, 4=30, 13=90, 17=120, 26=182, 34=240)
  const FRECUENCIAS = [
    [/\bdiari[oa]s?\b|cada dia|todos los dias/, 'DIARIO', 'diarios'],
    [/cuando se requiera|cuando sea necesario|por desgaste/, 'CUANDO SE REQUIERA', 'que se hacen cuando se requiere'],
    [/semanal(es)?\b|cada semana/, '1', 'semanales'], [/mensual(es)?\b|cada mes\b/, '4', 'mensuales'],
    [/bimestral(es)?\b/, '9', 'bimestrales'], [/cuatrimestral(es)?\b/, '17', 'cuatrimestrales'],
    [/trimestral(es)?\b/, '13', 'trimestrales'], [/semestral(es)?\b/, '26', 'semestrales']
  ];
  const MESES = { 1: '4', 2: '9', 3: '13', 4: '17', 6: '26', 8: '34' };
  const NUMEROS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, seis: 6, ocho: 8, nueve: 9 };

  const CAMPOS = [
    ['hora', /funcionando o parad[oa]|parad[oa] o funcionando|prendid[oa] o apagad[oa]|apagad[oa] o prendid[oa]|hora de ejecucion/],
    ['tiempo', /cuanto (tiempo )?(se )?(tarda|tardo|dura|toma|lleva|demora)|cuanto tiempo|duracion|cuantos minutos|tiempo (de ejecucion|total)/],
    ['frec', /cada cuando|cada cuanto|cuando (se|toca|hay que)|frecuencia|que tan seguido|periodicidad/],
    ['hta', /herramientas?|con que|que (ocupo|necesito|uso|utilizo|se usa|se ocupa)|instrumento/],
    ['material', /materiale?s?|refaccion(es)?|consumibles?|repuestos?|con que|que (necesito|ocupo|grasa|lubricante)/],
    ['norma', /criterio|norma|a cuant[oa]s?|cuant[oa]s? (volts?|voltios|voltaje|grados|presion|mpa)|debe (estar|dar|tener|medir|marcar)|maxim[oa]|minim[oa]|rango|especificacion/],
    ['metodo', /metodo|como se (revisa|inspecciona|verifica)/]
  ];
  const ETIQUETAS = { norma: 'Norma / criterio', contramedida: 'Contramedida', metodo: 'Método', hta: 'Herramienta',
                      material: 'Material', tiempo: 'Tiempo', frec: 'Frecuencia', hora: 'Hora ejec.' };
  const NADA = 'Sin coincidencias en las hojas HPM. Prueba nombrando la parte (cable, sensor, ventilador…) o pregunta cada cuándo, cuánto tarda o con qué herramienta.';

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // shortcut: raíz recortando plural, género y terminaciones comunes; un stemmer completo pesa más de lo que aporta aquí
  function raiz(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    w = w.replace(/s$/, '');
    if (w.length > 5) w = w.replace(/cion$|(ar|er|ir|an|en)$/, '');
    return w.length > 4 ? w.replace(/(ad|id)?[aeo]$/, '') : w.replace(/[aeo]$/, '');
  }
  const tokens = s => (norm(s).match(/[a-z0-9]+/g) || []).filter(w => !VACIAS.has(w)).map(raiz);
  const SINONIMOS_RAIZ = new Map(Object.entries(SINONIMOS).map(([k, v]) => [raiz(k), v]));

  function distancia(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1]));
      prev = cur;
    }
    return prev[b.length];
  }

  const minutos = n => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`;

  function valor(p, campo) {
    const v = p[campo];
    if (campo === 'tiempo') return /^\d+$/.test(v) ? `${v} min` : 'Sin especificar';
    if (campo === 'frec') {
      if (v === 'DIARIO') return 'Diario';
      if (v === 'CUANDO SE REQUIERA') return 'Cuando se requiera';
      return /^\d+$/.test(v) ? (v === '1' ? 'Cada semana' : `Cada ${v} semanas`) : 'Sin especificar';
    }
    if (campo === 'hora') return { ON: 'Equipo funcionando', OFF: 'Equipo parado', 'ON/OFF': 'Equipo funcionando o parado' }[v] || 'Sin especificar';
    return /^[-_\s]*$/.test(v) ? 'Sin especificar' : v;
  }

  function crear(hpm) {
    const K1 = 1.2, B = 0.5, indice = hpm.pasos.map(p => {
      const tf = new Map();
      const sumar = (texto, peso) => tokens(texto).forEach(t => tf.set(t, (tf.get(t) || 0) + peso));
      sumar(p.punto, 3); sumar(p.sec, 2); sumar([p.norma, p.contramedida, p.hta, p.material].join(' '), 1);
      return { p, tf, largo: [...tf.values()].reduce((a, b) => a + b, 0) };
    });
    const df = new Map();
    indice.forEach(i => i.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    const prom = indice.reduce((a, i) => a + i.largo, 0) / (indice.length || 1);

    // error de dedo: la raíz conocida más cercana; las palabras cortas se quedan exactas para no confundirlas
    function corregir(t) {
      if (df.has(t)) return t;
      const max = t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0;
      let mejor = null, dist = max + 1;
      if (max) for (const v of df.keys()) {
        const x = distancia(t, v, max);
        if (x < dist) { mejor = v; dist = x; }
      }
      return mejor;
    }

    function ranquear(texto, permitidos) {
      const pesos = new Map();
      const agregar = (t, peso) => { const r = corregir(t); if (r) pesos.set(r, Math.max(pesos.get(r) || 0, peso)); };
      for (const t of tokens(texto)) {
        const extra = SINONIMOS_RAIZ.get(t);
        // el peso se reparte para que los sinónimos no opaquen la palabra que escribió el técnico
        if (extra) tokens(extra).forEach((s, _, l) => agregar(s, Math.min(0.6, 1.5 / l.length)));
      }
      tokens(texto).forEach(t => agregar(t, 1));
      const res = [];
      for (const i of indice) {
        if (!permitidos.has(i.p)) continue;
        let score = 0;
        pesos.forEach((peso, t) => {
          const tf = i.tf.get(t) || 0;
          if (!tf) return;
          const n = df.get(t), idf = Math.log(1 + (indice.length - n + 0.5) / (n + 0.5));
          score += peso * idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * i.largo / prom));
        });
        if (score) res.push({ p: i.p, score });
      }
      res.sort((a, b) => b.score - a.score);
      return res.filter(r => r.score >= res[0].score * 0.4).map(r => r.p);
    }

    // "display" es también una parte de la máquina: si otra estación la nombra, exige "estacion display" o "display tester"
    function estacionEn(q) {
      return hpm.estaciones.find(e => {
        const nombre = norm(e.nombre), alias = nombre.replace(/( tester)?( station)?$/, '');
        const ambigua = hpm.pasos.some(p => p.e !== e.slug && norm(p.punto).includes(alias));
        return q.includes(nombre) || new RegExp(`estacion (de )?${alias}\\b|${alias} tester`).test(q) ||
               (!ambigua && new RegExp(`\\b${alias}\\b`).test(q));
      });
    }

    function glosario(q) {
      if (!/signific|que es\b|que son\b|quiere decir|definicion/.test(q)) return null;
      if (/\bfrec/.test(q)) return 'FREC. indica cada cuántas semanas se hace el punto (13 = cada 13 semanas).';
      if (/\bhpm\b/.test(q)) return 'HPM es la Hoja de Mantenimiento Preventivo de cada estación.';
      const sigla = /\b(tpm|gtf|on|off)\b/.exec(q);
      const def = sigla && new RegExp(`\\b${sigla[1]}=([^,]+)`, 'i').exec(hpm.leyenda);
      return def ? `${sigla[1].toUpperCase()}: ${def[1].trim()}` : null;
    }

    return function responder(consulta, estacion) {
      let q = norm(consulta).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/\b(un|una|dos|tres|cuatro|seis|ocho|nueve) (mes|meses|semana|semanas)\b/g, (_, n, u) => `${NUMEROS[n]} ${u}`);
      if (!q) return null;
      const definicion = glosario(q);
      if (definicion) return { texto: definicion, pasos: [], campos: [] };

      const nombrada = estacionEn(q);
      const slug = nombrada ? nombrada.slug : estacion;
      const dondeTxt = slug ? ` en ${hpm.estaciones.find(e => e.slug === slug).nombre}` : ' en todas las estaciones';
      let base = hpm.pasos.filter(p => !slug || p.e === slug);
      const directo = /\b(?:paso|punto|numero)\s*(\d+)\b/.exec(q);
      if (directo) {
        const pasos = base.filter(p => p.n === directo[1]);
        return pasos.length ? { texto: null, pasos, campos: ['norma', 'contramedida', 'hta', 'material'] }
                            : { texto: NADA, pasos: [], campos: [] };
      }
      if (!/precaucion/.test(q)) base = base.filter(p => p.sec !== 'PRECAUCIONES DE SEGURIDAD');

      // filtros: se quitan de la frase y lo que sobra es lo que se busca
      let filtro = null, frec = null;
      const n = /cada (\d+) (semana|mes)/.exec(q);
      if (n) { frec = n[2] === 'mes' ? MESES[n[1]] : n[1]; filtro = `cada ${n[1]} ${n[2] === 'mes' ? 'meses' : 'semanas'}`; q = q.replace(/cada \d+ (semanas?|mes(es)?)/, ' '); }
      else for (const [re, valorFrec, nombre] of FRECUENCIAS) if (re.test(q)) { frec = valorFrec; filtro = nombre; q = q.replace(re, ' '); break; }

      const campos = [];
      for (const [campo, re] of CAMPOS) if (re.test(q)) campos.push(campo);
      for (const [, re] of CAMPOS) q = q.replace(re, ' ');

      let hora = null;
      const PARADO = /\b(parad[oa]|apagad[oa]|detenid[oa]|off)\b/g, MARCHA = /\b(funcionando|encendid[oa]|prendid[oa]|corriendo|en marcha|on)\b/g;
      if (q.search(PARADO) >= 0) hora = 'OFF';
      else if (q.search(MARCHA) >= 0) hora = 'ON';
      if (hora) q = q.replace(hora === 'OFF' ? PARADO : MARCHA, ' ');

      const quiereSecciones = /seccion(es)?|partes/.test(q);
      const quiereConteo = /cuant[oa]s/.test(q);
      const quiereTotal = /\b(total|suma|sumado|completo|entero|todo|todos|todas)\b/.test(q);
      const resto = q.replace(/seccion(es)?|partes|\b(total|suma|sumado|completo|entero)\b/g, ' ');
      const sinEstacion = nombrada ? resto.replace(new RegExp(norm(nombrada.nombre).replace(/( tester)?( station)?$/, '') + '( tester)?( station)?', 'g'), ' ') : resto;
      const busca = tokens(sinEstacion).length > 0;

      const permitidos = base.filter(p => (frec === null || p.frec === frec) && (!hora || p.hora.includes(hora)));
      const filtrado = frec !== null || hora;
      const puntos = ['puntos', filtro, hora && (hora === 'ON' ? 'con equipo funcionando' : 'con equipo parado')].filter(Boolean).join(' ');

      if (!busca && quiereSecciones) {
        const nombres = [...new Set(permitidos.map(p => p.sec))];
        return { texto: `${nombres.length} secciones${dondeTxt}.`, valores: nombres.map(s => [s]), pasos: [], campos: [] };
      }
      if (!busca && !filtrado && (campos.includes('hta') || campos.includes('material'))) {
        const campo = campos.includes('hta') ? 'hta' : 'material', cuenta = new Map();
        for (const p of permitidos) for (let v of p[campo].split(/[,/]| Y /)) {
          v = v.trim().toUpperCase().replace('BÁSICA', 'BASICA').replace(/^HERRAMIENTA BASICA$/, 'BASICA');
          if (v && !/^[-_]+$/.test(v) && !/DE ACUERDO/.test(v)) cuenta.set(v, (cuenta.get(v) || 0) + 1);
        }
        const valores = [...cuenta].sort((a, b) => b[1] - a[1]);
        return { texto: `${campo === 'hta' ? 'Herramientas' : 'Materiales'} que piden las hojas${dondeTxt}:`, valores, pasos: [], campos: [] };
      }
      if (!busca && !filtrado && !quiereTotal && !quiereConteo && !campos.includes('tiempo')) return { texto: NADA, pasos: [], campos: [] };

      const pasos = busca ? ranquear(sinEstacion, new Set(permitidos)) : permitidos;
      if (!pasos.length) return { texto: NADA, pasos: [], campos: [] };
      const verTodo = !busca || filtrado;
      const campoVista = campos.length ? campos : ['norma', 'contramedida'];

      if (campos.includes('tiempo') && (!busca || quiereTotal)) {
        const conTiempo = pasos.filter(p => /^\d+$/.test(p.tiempo)), suma = conTiempo.reduce((a, p) => a + +p.tiempo, 0);
        return { texto: `Tiempo total de ${puntos}${dondeTxt}: ${minutos(suma)} (${conTiempo.length} con tiempo definido).`,
                 pasos, campos: ['tiempo'], todos: true };
      }
      if (quiereConteo && !campos.length) {
        return { texto: `${pasos.length} ${puntos}${dondeTxt}.`, pasos, campos: campoVista, todos: true };
      }
      return { texto: filtrado ? `${pasos.length} ${puntos}${dondeTxt}.` : null, pasos: verTodo ? pasos : pasos.slice(0, 5),
               campos: campoVista, todos: verTodo };
    };
  }

  if (typeof module !== 'undefined') module.exports = { crear, valor };
  if (typeof document === 'undefined') return;

  const caja = document.getElementById('consulta-q'), salida = document.getElementById('consulta-res');
  const seccion = caja.closest('.consulta'), raizSitio = seccion.dataset.raiz, estacion = seccion.dataset.estacion || undefined;
  const el = (tag, clase, texto) => Object.assign(document.createElement(tag), { className: clase, textContent: texto });
  const datos = fetch(raizSitio + 'hpm.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(hpm => ({ hpm, responder: crear(hpm) }));

  function pintar(r, hpm) {
    salida.replaceChildren();
    if (!r) return;
    if (r.texto) salida.append(el('p', 'consulta-txt', r.texto));
    if (r.valores) {
      const ul = el('ul', 'consulta-lista', '');
      for (const [v, n] of r.valores) ul.append(el('li', '', n ? `${v} (${n})` : v));
      salida.append(ul);
    }
    const seguridad = r.pasos[0] && hpm.pasos.find(p => p.e === r.pasos[0].e && p.sec === 'PRECAUCIONES DE SEGURIDAD');
    if (seguridad) salida.append(el('p', 'consulta-seg', `Precaución (paso ${seguridad.n}): ${seguridad.contramedida}`));
    const nombre = slug => hpm.estaciones.find(e => e.slug === slug).nombre;
    for (const p of r.pasos) {
      const a = el('a', 'consulta-item', '');
      a.href = `${raizSitio}estacion/${p.e}/#paso-${p.n}`;
      a.append(el('b', 'consulta-n', p.n), el('span', 'consulta-punto', p.punto));
      const caja2 = el('div', 'consulta-datos', '');
      for (const c of r.campos) {
        const fila = el('div', '', '');
        fila.append(el('b', '', `${ETIQUETAS[c]}: `), document.createTextNode(valor(p, c)));
        caja2.append(fila);
      }
      caja2.append(el('small', 'muted', [estacion ? null : nombre(p.e), ...['frec', 'tiempo', 'hora'].filter(c => !r.campos.includes(c)).map(c => valor(p, c))].filter(Boolean).join(' · ')));
      a.append(caja2);
      salida.append(a);
    }
  }

  caja.addEventListener('input', async () => {
    try {
      const { hpm, responder } = await datos;
      pintar(responder(caja.value, estacion), hpm);
    } catch (e) {
      salida.replaceChildren(el('p', 'muted', 'No se pudieron cargar los datos de consulta. Revisa la conexión y recarga la página.'));
    }
  });
})();
