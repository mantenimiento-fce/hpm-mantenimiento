// Asistente de diagnóstico: del síntoma escrito por el técnico a los pasos HPM más relevantes.
// Corre en el navegador (sin servidor ni modelo que descargar) y solo muestra texto literal del Excel.
// Agregar palabras de piso aquí, en SINTOMAS; test_build.py valida la clasificación con `node`.
(function () {
  const VACIAS = new Set(('a al algo como con de del el en es esta este falla fallando hace hay la las le lo los maquina ' +
    'me mi muy no o para pero por problema que se sin su tiene un una y ya estacion equipo').split(' '));

  // frase en palabras del técnico -> vocabulario de las hojas (texto ya sin acentos y en minúsculas)
  const SINTOMAS = [
    [/no (prende|enciende|arranca|inicia)|apagad|sin (energia|corriente|luz)|se apaga/, 'alimentacion voltaje fuente interruptores ups energia'],
    [/caliente|calienta|temperatura|sobrecal/, 'temperatura enfriamiento ventilador ventiladores agua'],
    [/no (conecta|comunica|lee)|comunicacion|desconect|falso contacto/, 'conector conectores cable conexiones pines'],
    [/fuga|pierde aire|sin aire|presion|neumatic|no (sube|baja|avanza|regresa)/, 'fugas presion aire manometro mangueras valvulas cilindro'],
    [/atora|atasc|traba|ruido|rechina|vibra|duro|no (desliza|corre|se mueve)/, 'atoramiento deslizamiento guias carros rieles rodillos grasa lubricante'],
    [/no detecta|sensor/, 'sensores sensor fotoelectricos capacitivos magneticos'],
    [/rechaz|pass rate|\bng\b|no pasa|falla (de |la )?prueba|bajo rendimiento/, 'pass rate pines pin contactos conector'],
    [/flojo|floja|suelto|suelta|se mueve/, 'sueltos apretar apriete tornilleria sujecion'],
    [/sucio|sucia|mugre|polvo/, 'limpieza limpie polvo suciedad'],
    [/engras|lubric/, 'grasa lubricante lubricados'],
    [/\bpc\b|compu|pantalla negra/, 'computadora'],
    [/foco|\bluz\b|lampara|torreta/, 'lamparas iluminacion'],
    [/paro de emergencia|\bparo\b|cortina/, 'cortinas seguridad boton detener'],
    [/relay|relevador|\bplc\b/, 'plc relevadores relevador'],
    [/quemad|roto|rota|dañad|pelad/, 'danados dano reemplazo cables']
  ];

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // shortcut: raíz recortando plural, género y terminaciones comunes; un stemmer completo pesa más de lo que aporta aquí
  function raiz(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    w = w.replace(/s$/, '');
    if (w.length > 5) w = w.replace(/cion$|(ar|er|ir)$/, '');
    return w.length > 4 ? w.replace(/(ad|id)?[aeo]$/, '') : w.replace(/[aeo]$/, '');
  }
  const tokens = s => (norm(s).match(/[a-z0-9]+/g) || []).filter(w => !VACIAS.has(w)).map(raiz);

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

  function crear(docs) {
    // las precauciones no se clasifican: se muestran siempre arriba de los resultados
    const K1 = 1.2, B = 0.5, indice = docs.filter(d => d.sec !== 'PRECAUCIONES DE SEGURIDAD').map(d => {
      const tf = new Map();
      const sumar = (texto, peso) => tokens(texto).forEach(t => tf.set(t, (tf.get(t) || 0) + peso));
      sumar(d.punto, 3); sumar(d.sec, 2); sumar(d.texto, 1);
      return { d, tf, largo: [...tf.values()].reduce((a, b) => a + b, 0) };
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

    return function buscar(consulta, k = 5) {
      const q = norm(consulta), pesos = new Map();
      const agregar = (texto, peso) => tokens(texto).forEach(t => {
        const r = corregir(t);
        if (r) pesos.set(r, Math.max(pesos.get(r) || 0, peso));
      });
      // el peso se reparte entre las palabras del síntoma para que no opaquen la parte que el técnico nombró
      SINTOMAS.forEach(([re, palabras]) => { if (re.test(q)) agregar(palabras, Math.min(0.6, 1.5 / palabras.split(' ').length)); });
      agregar(q, 1);

      const res = [];
      for (const i of indice) {
        let score = 0;
        pesos.forEach((p, t) => {
          const tf = i.tf.get(t) || 0;
          if (!tf) return;
          const n = df.get(t), idf = Math.log(1 + (indice.length - n + 0.5) / (n + 0.5));
          score += p * idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * i.largo / prom));
        });
        if (score) res.push({ d: i.d, score });
      }
      res.sort((a, b) => b.score - a.score);
      return res.filter(r => r.score >= res[0].score * 0.4).slice(0, k).map(r => r.d);
    };
  }

  if (typeof module !== 'undefined') module.exports = { crear };
  if (typeof document === 'undefined') return;

  const docs = [...document.querySelectorAll('article.paso')].map(a => {
    const td = [...a.querySelectorAll('td')].map(c => c.textContent);
    return { n: a.querySelector('.n').textContent, sec: a.dataset.sec, punto: a.querySelector('.punto').textContent,
             contra: td[2], hora: td[7], texto: td.join(' ') };
  });
  const buscar = crear(docs), caja = document.getElementById('diag-q'), salida = document.getElementById('diag-res');
  const seguridad = docs.find(d => d.sec === 'PRECAUCIONES DE SEGURIDAD');
  const el = (tag, clase, texto) => Object.assign(document.createElement(tag), { className: clase, textContent: texto });

  caja.addEventListener('input', () => {
    salida.replaceChildren();
    if (!caja.value.trim()) return;
    const res = buscar(caja.value);
    if (!res.length) {
      salida.append(el('p', 'muted', 'Sin coincidencias en esta hoja. Prueba nombrando la parte (cable, sensor, ventilador…).'));
      return;
    }
    if (seguridad) salida.append(el('p', 'diag-seg', `Antes de intervenir (paso ${seguridad.n}): ${seguridad.contra}`));
    for (const d of res) {
      const a = el('a', 'diag-item', '');
      a.href = '#paso-' + d.n;
      a.append(el('b', 'diag-n', d.n), el('span', 'diag-punto', d.punto), el('span', 'diag-contra', d.contra),
               el('small', 'muted', `${d.sec} · HORA EJEC.: ${d.hora}`));
      salida.append(a);
    }
  });
})();
