"""py test_build.py  -> genera el sitio y verifica los 4 HPM, imágenes con números y QR."""
import os
import re

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
        for size in re.findall(r'font-size="([\d.]+)"', f["svg"]):
            assert float(size) < 100, size  # en puntos; tamaños enormes no se pintan en el navegador
        for src in re.findall(r'href="\.\./\.\./(fotos/[^"]+)"', f["svg"]):
            assert (OUT / src).exists(), src
    page = (OUT / "estacion" / m["slug"] / "index.html").read_text(encoding="utf-8")
    assert m["secciones"][0]["nombre"] in page and "Inicio" not in page
    assert (OUT / "qr" / f"{m['slug']}.svg").read_text().startswith("<svg")
    print(f"OK {m['slug']}: {len(nums)} pasos, {len(m['figuras'])} imágenes")
print("Todo OK")
