#!/usr/bin/env python3
"""Recherche et préparation de photographies Wikimedia Commons sous licence libre.

Seules les licences acceptées par le contrat voyage.json 1.3.0 sont retenues :
domaine public (avec URL de licence publiée), CC0 1.0, CC BY et CC BY-SA
2.0 / 2.5 / 3.0 / 4.0 dans leur version internationale (non transposée).
Toute image sans auteur identifié, sous licence NC, ND, transposée (par exemple
« CC BY-SA 3.0 de »), GFDL seule, ou portant une restriction (droit à l'image,
marque) est écartée.

Commandes :

    python3 commons.py search "<requête>" [--limit 8] [--quality] [--all]
        Candidats acceptables (ou tous avec --all, motif de rejet compris).

    python3 commons.py preview <dossier> "<File:Titre 1>" ["<File:Titre 2>" ...]
        Planche contact numérotée dans <dossier>/.fabrique/ pour comparer les
        candidats visuellement.

    python3 commons.py fetch <dossier> "<File:Titre>" <nom>
        Revérifie la licence, télécharge l'image, la convertit en WebP (1 600 px
        sur le grand côté, 500 Kio au plus) dans <dossier>/assets/<nom>.webp et
        affiche l'entrée `illustrations` à reporter dans voyage.json, provenance
        comprise. Le texte alternatif reste à rédiger.

Domaines nécessaires : commons.wikimedia.org et upload.wikimedia.org.
Dépendance : Pillow (pip install pillow).
"""

from __future__ import annotations

import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "CarnetVoyageFabrique/1.0 (https://github.com/Albannor/carnet-voyage-pwa; "
    "outil personnel de préparation de carnets de voyage)"
)
FETCH_WIDTH = 1920
TARGET_LONG_SIDE = 1600
MAX_BYTES = 500 * 1024
PREVIEW_WIDTH = 330
NAME = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
CC_VERSIONS = {"2.0", "2.5", "3.0", "4.0"}
METADATA_FIELDS = "|".join(
    [
        "Artist",
        "License",
        "LicenseShortName",
        "LicenseUrl",
        "ImageDescription",
        "ObjectName",
        "Restrictions",
        "DateTimeOriginal",
    ]
)


class CommonsError(Exception):
    pass


def http_get(url: str, params: dict | None = None, retries: int = 3) -> bytes:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code in (429, 503) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise CommonsError(f"HTTP {error.code} sur {url}") from error
        except urllib.error.URLError as error:
            raise CommonsError(
                f"Wikimedia injoignable ({error.reason}). Vérifier que commons.wikimedia.org "
                "et upload.wikimedia.org sont autorisés dans Paramètres > Capacités."
            ) from error
    raise CommonsError(f"Échec répété sur {url}")


def api(params: dict) -> dict:
    base = {"format": "json", "formatversion": "2", "action": "query"}
    return json.loads(http_get(API, {**base, **params}))


def plain_text(value: str | None, limit: int = 300) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].rstrip()


def https(url: str) -> str:
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http://"):
        return "https://" + url[len("http://") :]
    return url


def meta(info: dict, key: str) -> str:
    return (info.get("extmetadata", {}).get(key) or {}).get("value", "") or ""


def evaluate(page: dict) -> dict:
    """Retourne la provenance `licensed` ou le motif de rejet d'un fichier Commons."""
    title = page.get("title", "")
    infos = page.get("imageinfo") or []
    if not infos:
        return {"title": title, "accepted": False, "reason": "aucune information de fichier"}
    info = infos[0]
    candidate = {
        "title": title,
        "sourceUrl": https(info.get("descriptionurl", "")),
        "width": info.get("width"),
        "height": info.get("height"),
        "mime": info.get("mime"),
        "description": plain_text(meta(info, "ImageDescription")),
        "date": plain_text(meta(info, "DateTimeOriginal"), 40),
    }

    def reject(reason: str) -> dict:
        return {**candidate, "accepted": False, "reason": reason}

    if candidate["mime"] not in ("image/jpeg", "image/png", "image/webp", "image/tiff"):
        return reject(f"format {candidate['mime']} non retenu")
    if not candidate["sourceUrl"].startswith("https://commons.wikimedia.org/"):
        return reject("page source Commons introuvable")
    if meta(info, "Restrictions").strip():
        return reject(f"restriction déclarée : {plain_text(meta(info, 'Restrictions'), 80)}")

    creator = plain_text(meta(info, "Artist"))
    if not creator:
        return reject("auteur non renseigné")

    code = meta(info, "License").strip().lower()
    license_url = https(meta(info, "LicenseUrl").strip())
    match = re.fullmatch(r"cc-(by|by-sa)-(\d\.\d)", code)
    if match and match.group(2) in CC_VERSIONS:
        kind, version = match.groups()
        license_code = f"CC-{kind.upper()}-{version}"
        expected = f"https://creativecommons.org/licenses/{kind}/{version}/"
        license_url = license_url if license_url.startswith(expected.rstrip("/")) else expected
    elif code == "cc0":
        license_code = "CC0-1.0"
        license_url = "https://creativecommons.org/publicdomain/zero/1.0/"
    elif code == "pd":
        if not license_url.startswith("https://"):
            return reject("domaine public sans URL de licence publiée")
        license_code = "PUBLIC-DOMAIN"
    else:
        short = plain_text(meta(info, "LicenseShortName"), 60) or code or "inconnue"
        return reject(f"licence non acceptée : {short}")

    width, height = candidate["width"] or 0, candidate["height"] or 0
    if max(width, height) < 1000:
        return reject(f"résolution trop faible ({width}×{height})")

    return {
        **candidate,
        "accepted": True,
        "thumbUrl": https(info.get("thumburl") or info.get("url", "")),
        "provenance": {
            "type": "licensed",
            "creator": creator,
            "sourceUrl": candidate["sourceUrl"],
            "licenseCode": license_code,
            "licenseUrl": license_url,
            "modified": True,
        },
    }


def imageinfo_params(width: int) -> dict:
    return {
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": str(width),
        "iiextmetadatafilter": METADATA_FIELDS,
        "iiextmetadatalanguage": "fr",
    }


def search(query: str, limit: int, quality: bool) -> list[dict]:
    terms = f"{query} filetype:bitmap"
    if quality:
        terms += ' incategory:"Quality_images"'
    data = api(
        {
            "generator": "search",
            "gsrsearch": terms,
            "gsrnamespace": "6",
            "gsrlimit": str(max(1, min(limit * 3, 50))),
            **imageinfo_params(FETCH_WIDTH),
        }
    )
    pages = sorted(data.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0))
    return [evaluate(page) for page in pages]


def file_info(title: str, width: int) -> dict:
    if not title.startswith("File:"):
        title = "File:" + title
    data = api({"titles": title, **imageinfo_params(width)})
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        raise CommonsError(f"Fichier introuvable sur Commons : {title}")
    return pages[0]


def to_webp(data: bytes) -> bytes:
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source)
        image = image.convert("RGB")
    image.thumbnail((TARGET_LONG_SIDE, TARGET_LONG_SIDE), Image.Resampling.LANCZOS)
    for quality in (82, 76, 70, 64, 58, 52):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=6)
        if buffer.tell() <= MAX_BYTES:
            return buffer.getvalue()
    scale = 0.8
    while True:
        smaller = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        smaller.save(buffer, "WEBP", quality=60, method=6)
        if buffer.tell() <= MAX_BYTES or scale < 0.3:
            return buffer.getvalue()
        scale -= 0.1


def fetch(workdir: Path, title: str, name: str) -> dict:
    if not NAME.match(name) or len(name) > 50:
        raise CommonsError("Le nom doit être en minuscules et tirets (ex. palais-royal), 50 caractères au plus.")
    verdict = evaluate(file_info(title, FETCH_WIDTH))
    if not verdict["accepted"]:
        raise CommonsError(f"{title} refusé : {verdict['reason']}")
    webp = to_webp(http_get(verdict["thumbUrl"]))
    assets = workdir / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    target = assets / f"{name}.webp"
    target.write_bytes(webp)

    illustration = {
        "id": f"illus-{name}",
        "resourceId": f"image-{name}",
        "alt": "À RÉDIGER : description factuelle de ce que montre l'image.",
        "provenance": verdict["provenance"],
    }
    journal = workdir / ".fabrique" / "images.json"
    journal.parent.mkdir(parents=True, exist_ok=True)
    entries = json.loads(journal.read_text("utf-8")) if journal.exists() else {}
    entries[name] = {
        "title": verdict["title"],
        "description": verdict["description"],
        "file": target.relative_to(workdir).as_posix(),
        "bytes": len(webp),
        "illustration": illustration,
    }
    journal.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", "utf-8")
    return {"ok": True, "file": str(target), "bytes": len(webp), "description": verdict["description"], "illustration": illustration}


def preview(workdir: Path, titles: list[str]) -> dict:
    from PIL import Image, ImageDraw

    tiles = []
    for index, title in enumerate(titles, start=1):
        info = (file_info(title, PREVIEW_WIDTH).get("imageinfo") or [{}])[0]
        url = https(info.get("thumburl") or info.get("url", ""))
        with Image.open(io.BytesIO(http_get(url))) as image:
            tile = image.convert("RGB")
        tile.thumbnail((PREVIEW_WIDTH, PREVIEW_WIDTH))
        tiles.append((index, title, tile))

    columns = min(3, len(tiles))
    rows = (len(tiles) + columns - 1) // columns
    cell = PREVIEW_WIDTH + 10
    sheet = Image.new("RGB", (columns * cell, rows * (cell + 20)), "white")
    draw = ImageDraw.Draw(sheet)
    for position, (index, _, tile) in enumerate(tiles):
        x, y = (position % columns) * cell + 5, (position // columns) * (cell + 20) + 5
        sheet.paste(tile, (x, y + 20))
        draw.text((x, y), str(index), fill="black")
    target = workdir / ".fabrique" / f"preview-{int(time.time())}.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, "JPEG", quality=80)
    return {"ok": True, "file": str(target), "legend": {str(i): t for i, t, _ in tiles}}


def main(argv: list[str]) -> int:
    try:
        if argv[:1] == ["search"] and len(argv) >= 2:
            limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else 8
            results = search(argv[1], limit, "--quality" in argv)
            if "--all" not in argv:
                results = [r for r in results if r["accepted"]][:limit]
            for result in results:
                result.pop("thumbUrl", None)
            print(json.dumps(results, ensure_ascii=False, indent=2))
            return 0
        if argv[:1] == ["preview"] and len(argv) >= 3:
            print(json.dumps(preview(Path(argv[1]), argv[2:]), ensure_ascii=False, indent=2))
            return 0
        if argv[:1] == ["fetch"] and len(argv) == 4:
            print(json.dumps(fetch(Path(argv[1]), argv[2], argv[3]), ensure_ascii=False, indent=2))
            return 0
    except CommonsError as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        return 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
