#!/usr/bin/env python3
"""Construction et validation d'un paquet de voyage pour Carnet de voyage PWA.

Le dossier de travail contient :

    voyage.json            obligatoire
    assets/                images PNG, JPEG ou WebP (facultatif)
    documents/             PDF (facultatif)
    guide-standalone.html  facultatif, inclus seulement s'il est présent

Commandes :

    python3 package.py inventory <dossier>
        Liste les ressources et l'identifiant (resourceId) à reporter dans
        voyage.json. Relancer après tout renommage de fichier.

    python3 package.py build <dossier> <sortie.zip>
        Construit manifest.json (tailles, SHA-256), produit le ZIP, le rouvre,
        puis le fait valider par validate-package.mjs, c'est-à-dire par le code
        d'import réel de l'application. Le ZIP n'est conservé que si la
        validation réussit.

Seule la bibliothèque standard de Python est utilisée. Node.js >= 20 est
nécessaire pour la validation finale.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
VALIDATOR = HERE / "validate-package.mjs"
PACKAGE_FORMAT_VERSION = "1.0.0"
STABLE_ID = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
FILE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")

# Répertoire -> extensions autorisées -> type déclaré (docs/IMPORT.md).
ALLOWED = {
    "assets": {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    },
    "documents": {".pdf": "application/pdf"},
}
ID_PREFIX = {"assets": "image", "documents": "document"}

# Repères de taille de la Fabrique (les limites dures sont dans l'application).
WARN_IMAGE_BYTES = 600 * 1024
WARN_TOTAL_BYTES = 15 * 1024 * 1024


class PackageError(Exception):
    pass


def signature_matches(path: Path, media_type: str) -> bool:
    head = path.read_bytes()[:16]
    if media_type == "image/png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if media_type == "image/jpeg":
        return head.startswith(b"\xff\xd8\xff")
    if media_type == "image/webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if media_type == "application/pdf":
        return head.startswith(b"%PDF-")
    return False


def resource_id(directory: str, path: Path) -> str:
    stem = path.stem.lower()
    stem = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")
    candidate = f"{ID_PREFIX[directory]}-{stem}" if stem else ID_PREFIX[directory]
    return candidate[:64].rstrip("-")


def inventory(workdir: Path) -> list[dict]:
    resources: list[dict] = []
    errors: list[str] = []

    for directory, extensions in ALLOWED.items():
        root = workdir / directory
        if not root.exists():
            continue
        for path in sorted(p for p in root.rglob("*")):
            relative = path.relative_to(workdir).as_posix()
            if any(part.startswith(".") for part in path.relative_to(workdir).parts):
                errors.append(f"{relative} : fichier ou dossier caché interdit.")
                continue
            if path.is_dir():
                continue
            if not FILE_NAME.match(path.name):
                errors.append(
                    f"{relative} : nom de fichier invalide (lettres, chiffres, . _ - uniquement)."
                )
                continue
            media_type = extensions.get(path.suffix.lower())
            if media_type is None:
                errors.append(f"{relative} : extension non autorisée dans {directory}/.")
                continue
            if not signature_matches(path, media_type):
                errors.append(f"{relative} : le contenu ne correspond pas à {media_type}.")
                continue
            data = path.read_bytes()
            resources.append(
                {
                    "id": resource_id(directory, path),
                    "path": relative,
                    "mediaType": media_type,
                    "size": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )

    seen: dict[str, str] = {}
    for resource in resources:
        if not STABLE_ID.match(resource["id"]):
            errors.append(f"{resource['path']} : identifiant {resource['id']} invalide.")
        if resource["id"] in seen:
            errors.append(
                f"{resource['path']} et {seen[resource['id']]} produisent le même identifiant "
                f"{resource['id']} : renommer l'un des fichiers."
            )
        seen[resource["id"]] = resource["path"]

    for entry in workdir.iterdir():
        allowed_root = {"voyage.json", "manifest.json", "assets", "documents", "guide-standalone.html"}
        if entry.name not in allowed_root and not entry.name.startswith("."):
            errors.append(f"{entry.name} : élément non autorisé à la racine du dossier.")

    if errors:
        raise PackageError("\n".join(errors))
    return resources


def referenced_resource_ids(travel: dict) -> set[str]:
    ids = set()
    for key in ("illustrations", "documents"):
        for item in travel.get(key, []) or []:
            if isinstance(item, dict) and isinstance(item.get("resourceId"), str):
                ids.add(item["resourceId"])
    return ids


def used_illustration_ids(travel: dict) -> set[str]:
    used = set()
    if isinstance(travel.get("coverIllustrationId"), str):
        used.add(travel["coverIllustrationId"])
    for day in travel.get("days", []) or []:
        used.update(day.get("illustrationIds", []) or [])
        for step in day.get("steps", []) or []:
            used.update(step.get("illustrationIds", []) or [])
    return used


def warnings_for(travel: dict, resources: list[dict]) -> list[str]:
    warnings = []
    referenced = referenced_resource_ids(travel)
    for resource in resources:
        if resource["id"] not in referenced:
            warnings.append(f"Ressource {resource['id']} présente mais référencée nulle part.")
        if resource["mediaType"].startswith("image/") and resource["size"] > WARN_IMAGE_BYTES:
            warnings.append(
                f"Image {resource['path']} : {resource['size'] // 1024} Kio, au-delà du repère de 500 Kio."
            )
    used = used_illustration_ids(travel)
    for illustration in travel.get("illustrations", []) or []:
        if illustration.get("id") not in used:
            warnings.append(
                f"Illustration {illustration.get('id')} déclarée mais affichée nulle part "
                "(couverture, journée ou étape)."
            )
    total = sum(r["size"] for r in resources)
    if total > WARN_TOTAL_BYTES:
        warnings.append(f"Ressources : {total // (1024 * 1024)} Mio au total, au-delà du repère de 15 Mio.")
    return warnings


def run_validator(command: str, target: Path) -> dict:
    if not VALIDATOR.exists():
        raise PackageError(f"Validateur introuvable : {VALIDATOR}")
    completed = subprocess.run(
        ["node", str(VALIDATOR), command, str(target)],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise PackageError(
            f"Réponse illisible du validateur : {completed.stdout}\n{completed.stderr}"
        ) from error


def build(workdir: Path, output: Path) -> dict:
    travel_path = workdir / "voyage.json"
    if not travel_path.exists():
        raise PackageError("voyage.json est absent du dossier de travail.")
    travel_bytes = travel_path.read_bytes()
    try:
        travel = json.loads(travel_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PackageError(f"voyage.json n'est pas un JSON UTF-8 valide : {error}") from error

    travel_check = run_validator("travel", travel_path)
    if not travel_check.get("ok"):
        return {"ok": False, "stage": "voyage.json", "validation": travel_check}

    resources = inventory(workdir)
    manifest = {
        "packageFormatVersion": PACKAGE_FORMAT_VERSION,
        "id": travel["id"],
        "travelModelVersion": travel["contentModelVersion"],
        "travelPath": "voyage.json",
        "allowUndeclaredFiles": False,
        "resources": resources,
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    guide = workdir / "guide-standalone.html"

    entries: list[tuple[str, bytes, int]] = [
        ("manifest.json", manifest_bytes, zipfile.ZIP_DEFLATED),
        ("voyage.json", travel_bytes, zipfile.ZIP_DEFLATED),
    ]
    for resource in resources:
        data = (workdir / resource["path"]).read_bytes()
        method = zipfile.ZIP_DEFLATED if resource["mediaType"] == "application/pdf" else zipfile.ZIP_STORED
        entries.append((resource["path"], data, method))
    if guide.exists():
        entries.append(("guide-standalone.html", guide.read_bytes(), zipfile.ZIP_DEFLATED))

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        candidate = Path(tmp) / output.name
        with zipfile.ZipFile(candidate, "w", allowZip64=False) as archive:
            for name, data, method in entries:
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = method
                info.external_attr = 0o644 << 16
                archive.writestr(info, data)

        with zipfile.ZipFile(candidate) as archive:
            if archive.testzip() is not None:
                raise PackageError("Le ZIP produit est corrompu.")
            names = sorted(archive.namelist())
            if names != sorted(name for name, _, _ in entries):
                raise PackageError("Le contenu du ZIP rouvert ne correspond pas à l'inventaire.")

        validation = run_validator("package", candidate)
        if not validation.get("ok"):
            return {"ok": False, "stage": "paquet", "validation": validation}

        candidate.replace(output)

    return {
        "ok": True,
        "zip": str(output),
        "zipBytes": output.stat().st_size,
        "validation": validation,
        "resources": [{"id": r["id"], "path": r["path"], "size": r["size"]} for r in resources],
        "warnings": warnings_for(travel, resources),
    }


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "inventory":
        try:
            print(json.dumps(inventory(Path(argv[1])), ensure_ascii=False, indent=2))
            return 0
        except PackageError as error:
            print(json.dumps({"ok": False, "errors": str(error).splitlines()}, ensure_ascii=False, indent=2))
            return 1
    if len(argv) >= 3 and argv[0] == "build":
        try:
            result = build(Path(argv[1]), Path(argv[2]))
        except PackageError as error:
            result = {"ok": False, "errors": str(error).splitlines()}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
