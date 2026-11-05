"""py test_app.py  -> verifica parseo de los 4 HPM y que todas las rutas respondan."""
from app import MACHINES, app

assert len(MACHINES) == 4, MACHINES.keys()
c = app.test_client()
assert c.get("/").status_code == 200
assert c.get("/qr").status_code == 200
for slug, m in MACHINES.items():
    pasos = [p for s in m["secciones"] for p in s["pasos"]]
    nums = [int(p["n"]) for p in pasos]
    assert nums == list(range(1, len(nums) + 1)), (slug, nums)  # numeración continua entre hojas
    assert all(p["punto"] for p in pasos), slug
    for f in m["figuras"]:  # toda imagen del Excel tiene número(s) de paso y aparece en ese paso
        assert f["nums"], (slug, f["svg"][:200])
        assert any(f["svg"] in p["figs"] for p in pasos), (slug, f["nums"])
    r = c.get(f"/estacion/{slug}")
    assert r.status_code == 200 and m["secciones"][0]["nombre"].encode() in r.data
    assert c.get(f"/qr/{slug}.svg").data.startswith(b"<svg")
    print(f"OK {slug}: {len(m['secciones'])} secciones, {len(nums)} pasos, {len(m['figuras'])} imágenes, "
          f"pasos con imagen: {sum(1 for p in pasos if p['figs'])}")
assert c.get("/estacion/no-existe").status_code == 404
print("Todo OK")
