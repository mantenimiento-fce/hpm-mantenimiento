"""py test_build.py  -> genera el sitio y verifica los 4 HPM, imágenes con números y QR."""
import json
import os
import re
import subprocess

os.environ.setdefault("BASE_URL", "https://ejemplo.github.io/hpm")
from build import OUT, build

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
    assert (OUT / "qr" / f"{m['slug']}.svg").read_text().startswith("<svg")
    print(f"OK {m['slug']}: {len(nums)} pasos, {len(m['figuras'])} imágenes")

# asistente: (estación, síntoma, número de paso esperado entre los 5 resultados; None = sin resultados)
CASOS = [("display-tester-station", "no prende", "36"), ("display-tester-station", "se calienta mucho", "5"),
         ("display-tester-station", "fuga de aire", "14"), ("display-tester-station", "los carros se atoran", "28"),
         ("display-tester-station", "la compu no arranca", "70"), ("display-tester-station", "ventilador con ruido", "9"),
         ("display-tester-station", "tornillo flojo", "23"), ("display-tester-station", "conctor dañado", "10"),
         ("display-tester-station", "xyzzy foo", None), ("flashing-station", "muchos rechazos, bajo pass rate", "24"),
         ("flashing-station", "fuga de aire", None)]  # Flashing no tiene neumática: mejor nada que algo irrelevante
docs = {m["slug"]: [{"n": p["n"], "sec": s["nombre"], "punto": p["punto"],
                     "texto": " ".join(p[k] for k in ("metodo", "norma", "contramedida", "hta", "material"))}
                    for s in m["secciones"] for p in s["pasos"]] for m in machines}
js = ("const {crear}=require('./templates/asistente.js');const {docs,casos}=JSON.parse(require('fs').readFileSync(0,'utf8'));"
      "console.log(JSON.stringify(casos.map(([s,q])=>crear(docs[s])(q).map(d=>d.n))))")
salida = subprocess.run(["node", "-e", js], input=json.dumps({"docs": docs, "casos": CASOS}), capture_output=True,
                        text=True, encoding="utf-8", check=True, cwd=os.path.dirname(os.path.abspath(__file__))).stdout
for (estacion, sintoma, esperado), res in zip(CASOS, json.loads(salida)):
    assert (esperado in res) if esperado else not res, (estacion, sintoma, res)
    assert not {"1", "2"} & set(res), (estacion, sintoma, res)  # precauciones: siempre en el aviso, nunca como resultado
print(f"OK asistente: {len(CASOS)} síntomas")
print("Todo OK")
