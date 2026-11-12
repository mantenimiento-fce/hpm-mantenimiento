"""py test_build.py  -> genera el sitio y verifica los 4 HPM, imágenes con números y QR."""
import html
import json
import os
import re
import subprocess

os.environ.setdefault("BASE_URL", "https://ejemplo.github.io/hpm")
from build import BASE, OUT, build

machines = build()
assert len(machines) == 4, [m["slug"] for m in machines]
assert (OUT / "index.html").exists() and (OUT / ".nojekyll").exists()
for m in machines:
    pasos = [p for s in m["secciones"] for p in s["pasos"]]
    nums = [int(p["n"]) for p in pasos]
    assert nums == list(range(1, len(nums) + 1)), (m["slug"], nums)  # numeración continua entre hojas
    for f in m["figuras"]:  # cada imagen trae sus números dibujados y aparece en esos pasos
        assert f["nums"] and "<tspan" in f["svg"], (m["slug"], f["nums"])
        assert any(f["svg"] in p["figs"] for p in pasos), (m["slug"], f["nums"])
        assert ">~</tspan>" not in f["svg"], (m["slug"], f["nums"])  # los rangos no se parten en renglones
        for size in re.findall(r'font-size="([\d.]+)"', f["svg"]):
            assert float(size) < 100, size  # en puntos; tamaños enormes no se pintan en el navegador
        for src in re.findall(r'href="\.\./\.\./(fotos/[^"]+)"', f["svg"]):
            assert (OUT / src).exists(), src
    page = (OUT / "estacion" / m["slug"] / "index.html").read_text(encoding="utf-8")
    assert m["secciones"][0]["nombre"] in page and "Inicio" not in page
    assert f"Consulta sobre {m['info']['equipo']}" in page and "GERENTE" not in page and "COORDINADOR" not in page
    qr = (OUT / "qr" / f"{m['slug']}.svg").read_text()
    assert qr.startswith("<svg") and "data:image/png;base64," in qr  # logo incrustado: <img> no carga archivos externos
    print(f"OK {m['slug']}: {len(nums)} pasos, {len(m['figuras'])} imágenes")

# troubleshooting: una página por máquina con matriz; sin administrador
from build import TS_DIR
import openpyxl
assert not (OUT / "admin").exists() and not (OUT / "fallas.json").exists()
hpm = json.loads((OUT / "hpm.json").read_text(encoding="utf-8"))
for m in machines:
    assert m["efectos"], m["slug"]
    page = (OUT / "estacion" / m["slug"] / "troubleshooting" / "index.html").read_text(encoding="utf-8")
    assert page.count('class="panel efecto"') == len(m["efectos"]), m["slug"]
    assert 'href="troubleshooting/"' in (OUT / "estacion" / m["slug"] / "index.html").read_text(encoding="utf-8")
    # la consulta enlaza a #efecto-n: el n-ésimo efecto de la página debe ser el mismo
    en_pagina = [html.unescape(t) for t in re.findall(r'class="efecto-t"><b>(.*?)</b>', page)]
    assert en_pagina == [f["efecto"] for f in hpm["fallas"] if f["e"] == m["slug"]], m["slug"]
marcas = sum(1 for p in TS_DIR.glob("Matriz*.xlsx") for ws in openpyxl.load_workbook(p, data_only=True).worksheets
             for r in ws.iter_rows(min_row=3, min_col=4) for c in r if c.value not in (None, ""))
assert marcas == sum(len(e["causas"]) for m in machines for e in m["efectos"]), marcas
for pagina in ("index.html", "qr/index.html", "kpi/index.html"):
    texto = (OUT / pagina).read_text(encoding="utf-8")
    assert "admin" not in texto.lower() and "Seleccione la estación" not in texto and "Cada código abre" not in texto, pagina
assert "github.io" not in (OUT / "qr" / "index.html").read_text(encoding="utf-8")
print(f"OK troubleshooting: {sum(len(m['efectos']) for m in machines)} efectos")

# KPIs: solo interrupción = Si, sin línea/máquina N/A ni ADMINISTRADOR DEL SISTEMA; downtime = tiempo de reparación
js = r"""
const A=require('./templates/andon.js'),fs=require('fs'),assert=require('assert');
const regs=JSON.parse(fs.readFileSync('_site/andon.json','utf8')),lineas=JSON.parse(fs.readFileSync('_site/lineas.json','utf8'));
const M=A.crearModelo(regs,lineas),k=M.calcular({anio:2026,mes:10});
assert.strictEqual(regs.length,4814);assert.strictEqual(regs.filter(r=>r.ini.startsWith('2026-01')).length,267);
const vale=r=>r.int==='Si'&&r.lin!=='N/A'&&r.maq!=='N/A'&&r.sol!=='ADMINISTRADOR DEL SISTEMA';
assert(regs.every(r=>'sol' in r));
assert.strictEqual(M.calcular({anio:2026,mes:1}).fallas,regs.filter(r=>vale(r)&&r.ini.startsWith('2026-01')).length);
assert.strictEqual(M.calcular({anio:2026}).fallas,regs.filter(vale).length);
assert(!A.cuenta({int:'Si',lin:'N/A',maq:'x',sol:'y'})&&!A.cuenta({int:'Si',lin:'x',maq:'N/A',sol:'y'})&&!A.cuenta({int:'Si',lin:'x',maq:'y',sol:'ADMINISTRADOR DEL SISTEMA'})&&!A.cuenta({int:'No',lin:'x',maq:'y',sol:'z'})&&A.cuenta({int:'Si',lin:'x',maq:'y',sol:'z'}));
const oct=regs.filter(r=>r.ini.startsWith('2026-10')&&vale(r)),seg=oct.reduce((s,r)=>s+r.rep,0);
assert.deepStrictEqual([k.fallas,k.paro,k.loading],[oct.length,seg/60,lineas.planta]);
assert.strictEqual(k.mttr,seg/60/oct.length);assert.strictEqual(k.mtbf,(lineas.planta-seg/60)/oct.length/60);
const kl=M.calcular({anio:2026,mes:10,linea:'Honda 25SA'});assert.strictEqual(kl.bdr,kl.paro/lineas.lineas['Honda 25SA']*100);
const maq=oct[0].maq;
assert.strictEqual(M.calcular({anio:2026,mes:10,maq}).fallas,oct.filter(r=>r.maq===maq).length);
// combinar: nada se pierde, lo más avanzado gana, lo viejo no pisa lo nuevo
const a={id:1,est:10,tot:60},b={id:1,est:100,tot:90},c={id:2,est:100,tot:5};
let r=A.combinar([b],[a,c]);assert.deepStrictEqual([r.registros,r.agregados,r.actualizados,r.iguales],[[b,c],1,0,1]);
r=A.combinar([a],[b]);assert.deepStrictEqual([r.registros,r.actualizados],[[b],1]);
// CSV con comillas, comas y saltos de línea dentro de un campo
const enc='Número,Orígen,Inicio de la falla,Turno,Estatus del reporte (0=x),Tiempo de localización (segundos),Tiempo de reparacion (segundos),Tiempo total de la parada (segundos),Linea,Maquina,Area que atendio,Falla confirmada,Detalle de la falla (reporte tecnico),Genero interrupcion?,Usuario solicitante';
const csv='SIGMA,,\r\n'+enc+'\r\n7,X,"05/01/2026 09:50",Turno 1,1000,60,120,180,Honda 25SA,"EOL, 2","Mantenimiento Mecanico",Falla,"línea 1\nlínea 2",Si,Juan\r\n';
assert.deepStrictEqual(A.leerCsv(csv),[{id:7,ini:'2026-01-05 09:50',turno:'Turno 1',est:1000,loc:60,rep:120,tot:180,lin:'Honda 25SA',maq:'EOL, 2',area:'Mantenimiento Mecanico',falla:'Falla',int:'Si',sol:'Juan',auto:0}]);
assert.throws(()=>A.leerCsv('a,b\n1,2'),/Número/);
const q=A.crearConsulta(regs,lineas);
assert(A.esKpi('cual es el mttr de octubre') && !A.esKpi('cada cuando se lubrican los carros'));
assert(/^Octubre 2026: MTTR 39.6 min/.test(q('cual es el mttr de octubre').texto), q('cual es el mttr de octubre').texto);
assert(/Honda 25SA/.test(q('bdr de honda en octubre').texto));
assert(/Máquinas/.test(q('maquinas con mas fallas en octubre').texto));
console.log('ok');
"""
kpi = subprocess.run(["node", "-"], input=js, capture_output=True, text=True, encoding="utf-8", cwd=BASE)
assert kpi.stdout.strip() == "ok", kpi.stderr
print("OK KPIs")

# consulta: [estación, pregunta, número de paso entre los primeros 5 o texto que debe traer la respuesta]
CASOS = json.loads((BASE / "casos_consulta.json").read_text(encoding="utf-8"))
js = ("const {crear}=require('./templates/asistente.js');const fs=require('fs');"
      "const r=crear(JSON.parse(fs.readFileSync('_site/hpm.json','utf8')));const casos=JSON.parse(fs.readFileSync(0,'utf8'));"
      "console.log(JSON.stringify(casos.map(([e,q])=>r(q,e||undefined))))")
salida = subprocess.run(["node", "-e", js], input=json.dumps(CASOS), capture_output=True, text=True, encoding="utf-8",
                        check=True, cwd=BASE).stdout
fallas = []
for (estacion, pregunta, esperado), r in zip(CASOS, json.loads(salida)):
    nums = [p["n"] for p in r["pasos"]][:5]
    ok = esperado in nums if esperado.isdigit() else esperado in json.dumps(r, ensure_ascii=False)
    if not ok:
        fallas.append((pregunta, esperado, nums, r["texto"]))
assert not fallas, fallas
print(f"OK consulta: {len(CASOS)} preguntas")
print("Todo OK")
