"""py test_build.py  -> genera el sitio y verifica los 4 HPM, imágenes con números y QR."""
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

# troubleshooting: una página por máquina con matriz, y el administrador con sus datos
from build import TS_DIR, TS_JSON
import openpyxl
fallas = json.loads((OUT / "fallas.json").read_text(encoding="utf-8"))
assert (OUT / "admin" / "index.html").exists() and len(fallas) == 4, list(fallas)
for m in machines:
    assert m["efectos"], m["slug"]
    page = (OUT / "estacion" / m["slug"] / "troubleshooting" / "index.html").read_text(encoding="utf-8")
    assert page.count('class="panel efecto"') == len(m["efectos"]), m["slug"]
    assert 'href="troubleshooting/"' in (OUT / "estacion" / m["slug"] / "index.html").read_text(encoding="utf-8")
if not TS_JSON.exists():  # leído de las matrices: cada marca ꙩ debe volverse una causa
    marcas = sum(1 for p in TS_DIR.glob("Matriz*.xlsx") for ws in openpyxl.load_workbook(p, data_only=True).worksheets
                 for r in ws.iter_rows(min_row=3, min_col=4) for c in r if c.value not in (None, ""))
    assert marcas == sum(len(e["causas"]) for m in machines for e in m["efectos"]), marcas
print(f"OK troubleshooting: {sum(len(m['efectos']) for m in machines)} efectos")

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
