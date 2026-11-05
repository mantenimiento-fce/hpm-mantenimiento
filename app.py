"""HPM web: consulta de mantenimiento preventivo por estación (vía QR).

Lee los Excel de ./HPM al arrancar. Ejecutar:  py app.py   ->  http://<ip-del-servidor>:5000
"""
import colorsys
import hashlib
import html
import io
import os
import posixpath
import re
import textwrap
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import openpyxl
import qrcode
import qrcode.image.svg
from flask import Flask, Response, abort, render_template, request, url_for
from PIL import Image

BASE = Path(__file__).parent
XLSX_DIR = BASE / "HPM"
FOTOS = BASE / "static" / "fotos"
FIRST, LAST = 15, 33  # filas de pasos en cada hoja HPM; la 34 es la leyenda
COLS = [("n", "AF"), ("punto", "AH"), ("metodo", "AN"), ("norma", "AT"), ("contramedida", "BA"),
        ("hta", "BH"), ("material", "BK"), ("tiempo", "BN"), ("frec", "BP"), ("hora", "BR")]
HEADER = [("equipo", "K6"), ("cliente", "E4"), ("linea", "O4"), ("depto", "U10"),
          ("gerente", "BE9"), ("coordinador", "BJ9"), ("fecha", "BE11")]

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
X = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SHAPES = ("grpSp", "pic", "sp", "cxnSp")


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def txt(v):
    return "" if v is None else str(v).strip()


def local(el):
    return el.tag.rsplit("}", 1)[-1]


# ---------------------------------------------------------------- dibujos del Excel
# openpyxl descarta grupos, llamadas numeradas y flechas, así que se lee el XML del dibujo directo del zip.

def read_drawings(path):
    """{nombre_hoja: (raiz_xml_dibujo, {rId: bytes_imagen})} y colores del tema."""
    z = zipfile.ZipFile(path)
    names = set(z.namelist())

    def rels(p):
        rp = posixpath.join(posixpath.dirname(p), "_rels", posixpath.basename(p) + ".rels")
        if rp not in names:
            return {}
        out = {}
        for r in ET.fromstring(z.read(rp)):
            t = r.get("Target")
            t = t.lstrip("/") if t.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(p), t))
            out[r.get("Id")] = t
        return out

    wb_rels = rels("xl/workbook.xml")
    result = {}
    for sh in ET.fromstring(z.read("xl/workbook.xml")).iter():
        if local(sh) != "sheet":
            continue
        drawing = next((t for t in rels(wb_rels[sh.get(R + "id")]).values() if "/drawings/" in t), None)
        if drawing:
            result[sh.get("name")] = (ET.fromstring(z.read(drawing)),
                                      {k: z.read(v) for k, v in rels(drawing).items() if v in names})

    theme = {}
    if "xl/theme/theme1.xml" in names:
        scheme = next(e for e in ET.fromstring(z.read("xl/theme/theme1.xml")).iter() if local(e) == "clrScheme")
        for c in scheme:
            v = c[0]
            theme[local(c)] = v.get("lastClr") or v.get("val")
    for a, b in (("tx1", "dk1"), ("bg1", "lt1"), ("tx2", "dk2"), ("bg2", "lt2")):
        theme[a] = theme.get(b, "000000" if a.startswith("tx") else "FFFFFF")
    return result, theme


def color(el, theme):
    """Color hex (#rrggbb) del primer hijo de color de `el`, con lumMod/lumOff/shade/tint aplicados."""
    if el is None:
        return None
    for c in el:
        t = local(c)
        if t == "srgbClr":
            rgb = c.get("val")
        elif t == "sysClr":
            rgb = c.get("lastClr", "000000")
        elif t == "schemeClr":
            rgb = theme.get(c.get("val"), "000000")
        elif t == "prstClr":
            rgb = {"white": "FFFFFF", "red": "FF0000", "yellow": "FFFF00", "blue": "0000FF"}.get(c.get("val"), "000000")
        else:
            continue
        r, g, b = (int(rgb[i:i + 2], 16) / 255 for i in (0, 2, 4))
        mods = {local(m): int(m.get("val", 100000)) / 100000 for m in c}
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        l = min(1, l * mods.get("lumMod", 1) + mods.get("lumOff", 0))
        r, g, b = colorsys.hls_to_rgb(h, l, s)
        if "shade" in mods:
            r, g, b = (x * mods["shade"] for x in (r, g, b))
        if "tint" in mods:
            r, g, b = (x + (1 - x) * (1 - mods["tint"]) for x in (r, g, b))
        return "#%02x%02x%02x" % tuple(round(max(0, min(1, x)) * 255) for x in (r, g, b))
    return None


def paint(el, theme):
    """(relleno, borde, ancho_borde) según spPr o, si no lo trae, el estilo por defecto de la figura."""
    sppr, style = el.find(X + "spPr"), el.find(X + "style")
    ref = lambda name: style.find(A + name) if style is not None and style.find(A + name) is not None \
        and style.find(A + name).get("idx") != "0" else None
    if sppr.find(A + "noFill") is not None:
        fill = None
    elif sppr.find(A + "solidFill") is not None:
        fill = color(sppr.find(A + "solidFill"), theme)
    else:
        fill = color(ref("fillRef"), theme)
    ln = sppr.find(A + "ln")
    width = int(ln.get("w", 12700)) if ln is not None else 12700
    if ln is not None and ln.find(A + "noFill") is not None:
        stroke = None
    elif ln is not None and ln.find(A + "solidFill") is not None:
        stroke = color(ln.find(A + "solidFill"), theme)
    else:
        stroke = color(ref("lnRef"), theme)
    return fill, stroke, width


def text_svg(el, x, y, w, h, theme):
    body = el.find(X + "txBody")
    if body is None:
        return ""
    paras = ["".join(t.text or "" for t in p.iter(A + "t")) for p in body.findall(A + "p")]
    if not any(s.strip() for s in paras):
        return ""
    rpr = next(body.iter(A + "rPr"), None)  # Element vacío es falsy: comparar con None, no usar `or`
    rpr = rpr if rpr is not None else next(body.iter(A + "endParaRPr"), None)
    fs = int(rpr.get("sz", 1100)) / 100 * 12700 if rpr is not None else 1100 / 100 * 12700
    bold = rpr is not None and rpr.get("b") == "1"
    fcol = color(rpr.find(A + "solidFill"), theme) if rpr is not None else None
    style = el.find(X + "style")
    fcol = fcol or color(style.find(A + "fontRef") if style is not None else None, theme) or "#000000"
    bp = body.find(A + "bodyPr")
    lins, tins = int(bp.get("lIns", 91440)), int(bp.get("tIns", 45720))
    ppr = next(body.iter(A + "pPr"), None)
    algn = ppr.get("algn", "l") if ppr is not None else "l"
    # ajuste de línea aproximado: ancho medio de carácter ~0.55 del tamaño de letra
    per_line = max(1, int((w - 2 * lins) / (fs * 0.55)))
    lines = [ln for p in paras for ln in (textwrap.wrap(p.strip(), per_line, break_long_words=False) or [""])]
    total = fs * 1.2 * len(lines)
    anchor = bp.get("anchor", "t")
    top = y + h / 2 - total / 2 if anchor == "ctr" else (y + h - tins - total if anchor == "b" else y + tins)
    tx, ta = {"ctr": (x + w / 2, "middle"), "r": (x + w - lins, "end")}.get(algn, (x + lins, "start"))
    spans = "".join(f'<tspan x="{tx:.0f}" y="{top + fs * (1.2 * i + 0.95):.0f}">{html.escape(s)}</tspan>'
                    for i, s in enumerate(lines))
    return (f'<text font-family="Calibri,Arial,sans-serif" font-size="{fs:.0f}" fill="{fcol}" text-anchor="{ta}"'
            f'{' font-weight="bold"' if bold else ""}>{spans}</text>')


def save_photo(data, crop):
    """Guarda la imagen (recortada como en el Excel) en JPG optimizado; nombre = hash, sin duplicados."""
    name = hashlib.sha1(data + repr(crop).encode()).hexdigest()[:16] + ".jpg"
    out = FOTOS / name
    if not out.exists():
        img = Image.open(io.BytesIO(data))
        if img.mode != "RGB":  # transparencia -> fondo blanco
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, "white")
            bg.paste(img, mask=img.split()[3])
            img = bg
        l, t, r, b = crop
        W, H = img.size
        img = img.crop((round(W * l), round(H * t), round(W * (1 - r)), round(H * (1 - b))))
        img.thumbnail((1400, 1400))
        img.save(out, "JPEG", quality=85, optimize=True)
    return name


def parse_items(el, tf, theme, media, out):
    """Aplana una figura (o grupo) a elementos SVG en coordenadas absolutas EMU de la hoja."""
    ox, oy, sx, sy = tf
    kind = local(el)
    pr = el.find(X + ("grpSpPr" if kind == "grpSp" else "spPr"))
    xf = pr.find(A + "xfrm") if pr is not None else None
    if xf is None or xf.find(A + "off") is None:
        return
    off, ext = xf.find(A + "off"), xf.find(A + "ext")
    px, py, pw, ph = (int(off.get("x")), int(off.get("y")), int(ext.get("cx")), int(ext.get("cy")))
    if kind == "grpSp":
        ch_off, ch_ext = xf.find(A + "chOff"), xf.find(A + "chExt")
        kx = pw / (int(ch_ext.get("cx")) or 1)
        ky = ph / (int(ch_ext.get("cy")) or 1)
        child_tf = (ox + (px - int(ch_off.get("x")) * kx) * sx, oy + (py - int(ch_off.get("y")) * ky) * sy,
                    sx * kx, sy * ky)
        for c in el:
            if local(c) in SHAPES:
                parse_items(c, child_tf, theme, media, out)
        return

    x, y, w, h = ox + px * sx, oy + py * sy, pw * sx, ph * sy
    cx, cy = x + w / 2, y + h / 2
    rot = int(xf.get("rot", 0)) / 60000
    fx, fy = (-1 if xf.get("flipH") == "1" else 1), (-1 if xf.get("flipV") == "1" else 1)
    tr = f' transform="rotate({rot:.2f} {cx:.0f} {cy:.0f}) translate({cx:.0f} {cy:.0f}) scale({fx} {fy}) ' \
         f'translate({-cx:.0f} {-cy:.0f})"'
    item = {"box": [x, y, x + w, y + h], "nums": [], "pic": kind == "pic"}

    if kind == "pic":
        blip = el.find(f".//{A}blip")
        data = media.get(blip.get(R + "embed")) if blip is not None else None
        if data is None:
            return
        src = el.find(f".//{A}srcRect")
        crop = tuple(int(src.get(k, 0)) / 100000 if src is not None else 0 for k in "ltrb")
        item["svg"] = (f'<image href="/static/fotos/{save_photo(data, crop)}" x="{x:.0f}" y="{y:.0f}" '
                       f'width="{w:.0f}" height="{h:.0f}" preserveAspectRatio="none"{tr}/>')
    else:
        fill, stroke, sw = paint(el, theme)
        paint_attr = f'fill="{fill or "none"}" stroke="{stroke or "none"}" stroke-width="{sw}"'
        geom = el.find(f"{X}spPr/{A}prstGeom")
        prst = geom.get("prst") if geom is not None else "rect"
        if kind == "cxnSp" or "Connector" in prst or prst == "line":
            # línea de esquina a esquina; punta de flecha si el Excel la tiene
            shape = f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x + w:.0f}" y2="{y + h:.0f}" stroke="{stroke or "#000"}" stroke-width="{sw}"/>'
            ln = el.find(f"{X}spPr/{A}ln")
            for end, (ex, ey, bx, by) in (("tailEnd", (x + w, y + h, x, y)), ("headEnd", (x, y, x + w, y + h))):
                e = ln.find(A + end) if ln is not None else None
                if e is not None and e.get("type", "none") != "none":
                    L = max((ex - bx) ** 2 + (ey - by) ** 2, 1) ** 0.5
                    ux, uy, s = (ex - bx) / L, (ey - by) / L, sw * 4
                    pts = [(ex, ey), (ex - ux * s - uy * s / 2, ey - uy * s + ux * s / 2),
                           (ex - ux * s + uy * s / 2, ey - uy * s - ux * s / 2)]
                    shape += f'<polygon points="{" ".join(f"{a:.0f},{b:.0f}" for a, b in pts)}" fill="{stroke or "#000"}"/>'
        elif prst == "upArrow":
            a = min(w / 2, h)  # cabeza de la flecha
            pts = [(cx, y), (x + w, y + a), (x + w * .75, y + a), (x + w * .75, y + h), (x + w * .25, y + h),
                   (x + w * .25, y + a), (x, y + a)]
            shape = f'<polygon points="{" ".join(f"{p:.0f},{q:.0f}" for p, q in pts)}" {paint_attr}/>'
        elif prst == "wedgeRectCallout":
            adj = {g.get("name"): int(g.get("fmla").split()[-1]) for g in geom.iter(A + "gd")}
            tipx = cx + adj.get("adj1", -20833) / 100000 * w
            tipy = cy + adj.get("adj2", 62500) / 100000 * h
            d = max(min(w, h) * 0.25, 1)
            shape = (f'<polygon points="{tipx:.0f},{tipy:.0f} {cx - d:.0f},{cy:.0f} {cx + d:.0f},{cy:.0f}" {paint_attr}/>'
                     f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" {paint_attr}/>'
                     f'<rect x="{x + sw:.0f}" y="{y + sw:.0f}" width="{max(w - 2 * sw, 0):.0f}" height="{max(h - 2 * sw, 0):.0f}" '
                     f'fill="{fill or "none"}"/>')  # tapa la base del triángulo
            item["box"] = [min(x, tipx), min(y, tipy), max(x + w, tipx), max(y + h, tipy)]
            label = "".join(t.text or "" for t in el.iter(A + "t"))
            for a_, b_, n in re.findall(r"(\d+)\s*~\s*(\d+)|(\d+)", label):
                item["nums"] += list(range(int(a_), int(b_) + 1)) if a_ else [int(n)]
        else:  # rect y cualquier otra forma: rectángulo
            shape = f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" {paint_attr}/>'
        item["svg"] = f"<g{tr}>{shape}{text_svg(el, x, y, w, h, theme)}</g>"
    out.append(item)


def sheet_figures(root, media, theme):
    """Una figura por cada foto/grupo con foto; las llamadas sueltas se unen a la foto sobre la que están."""
    figs, loose = [], []
    for anchor in root:
        items = []
        for c in anchor:
            if local(c) in SHAPES:
                parse_items(c, (0, 0, 1, 1), theme, media, items)
        if any(i["pic"] for i in items):
            figs.append(items)
        else:
            loose += items
    box = lambda its: [min(i["box"][0] for i in its), min(i["box"][1] for i in its),
                       max(i["box"][2] for i in its), max(i["box"][3] for i in its)]
    pic_boxes = [box([i for i in f if i["pic"]]) for f in figs]
    for it in loose:
        mx, my = (it["box"][0] + it["box"][2]) / 2, (it["box"][1] + it["box"][3]) / 2
        if not figs:
            break
        dist = [max(b[0] - mx, 0, mx - b[2]) + max(b[1] - my, 0, my - b[3]) for b in pic_boxes]
        figs[dist.index(min(dist))].append(it)

    result = []
    for f in figs:
        x0, y0, x1, y1 = box(f)
        pad = max(x1 - x0, y1 - y0) * 0.02
        svg = (f'<svg class="fig" viewBox="{x0 - pad:.0f} {y0 - pad:.0f} {x1 - x0 + 2 * pad:.0f} {y1 - y0 + 2 * pad:.0f}" '
               f'xmlns="http://www.w3.org/2000/svg" role="img">{"".join(i["svg"] for i in f)}</svg>')
        result.append({"svg": svg, "nums": sorted({n for i in f for n in i["nums"]})})
    return result


# ---------------------------------------------------------------- hojas HPM

def load_machine(path):
    wb = openpyxl.load_workbook(path, data_only=True)  # data_only: N° viene de fórmulas (=AF15+1)
    drawings, theme = read_drawings(path)
    sheets = [ws for ws in wb.worksheets if ws.title.upper().startswith("HPM")]
    info = {k: txt(sheets[0][c].value) for k, c in HEADER}
    sections, figures, legend = [], [], ""

    for ws in sheets:
        legend = legend or txt(ws["AB34"].value)
        for r in range(FIRST, LAST + 1):
            name = txt(ws[f"AB{r}"].value)
            # celdas combinadas: solo la primera fila trae el nombre; mismo nombre = continuación (incluso entre hojas)
            if name and (not sections or sections[-1]["nombre"] != name):
                sections.append({"nombre": name, "id": f"s{len(sections) + 1}", "pasos": []})
            paso = {k: txt(ws[f"{c}{r}"].value) for k, c in COLS}
            if sections and any(v for k, v in paso.items() if k != "n"):
                sections[-1]["pasos"].append(paso)
        if ws.title in drawings:
            figures += sheet_figures(*drawings[ws.title], theme)

    # cada paso muestra las imágenes cuyas llamadas lo mencionan (ej. "13 ~ 17" -> pasos 13 a 17)
    for s in sections:
        for p in s["pasos"]:
            p["figs"] = list(dict.fromkeys(f["svg"] for f in figures if p["n"].isdigit() and int(p["n"]) in f["nums"]))

    sections = [s for s in sections if s["pasos"]]
    return {"slug": slugify(info["equipo"] or path.stem), "info": info, "archivo": path.name,
            "secciones": sections, "leyenda": legend, "figuras": figures,
            "total": sum(len(s["pasos"]) for s in sections)}


FOTOS.mkdir(parents=True, exist_ok=True)
MACHINES = {m["slug"]: m for m in (load_machine(p) for p in sorted(XLSX_DIR.glob("*.xlsx"))
                                   if not p.name.startswith("~$"))}

app = Flask(__name__)


def station_url(slug):
    # BASE_URL: dirección que los teléfonos usan para llegar al servidor (ej. http://10.0.0.5:5000)
    base = os.environ.get("BASE_URL")
    path = url_for("estacion", slug=slug)
    return base.rstrip("/") + path if base else request.host_url.rstrip("/") + path


@app.route("/")
def index():
    return render_template("index.html", machines=MACHINES.values())


@app.route("/estacion/<slug>")
def estacion(slug):
    m = MACHINES.get(slug) or abort(404)
    return render_template("estacion.html", m=m)


@app.route("/qr/<slug>.svg")
def qr_svg(slug):
    if slug not in MACHINES:
        abort(404)
    img = qrcode.make(station_url(slug), image_factory=qrcode.image.svg.SvgPathImage, box_size=20, border=2)
    return Response(img.to_string(), mimetype="image/svg+xml")


@app.route("/qr")
def qr_page():
    return render_template("qr.html", machines=MACHINES.values(), url=station_url)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
