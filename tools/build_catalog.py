"""Regenerate labelCatalog.js from the artwork on disk.

The machine site stays dumb: it reads a flat LABEL_CATALOG array from
labelCatalog.js. This script is the only thing that writes that file.

Source of truth = the images under public/labels/:
  public/labels/<strain-slug>/plain.png              one Plain label per strain
  public/labels/<strain-slug>/<series>-<variant>.png real art, one file per
                                                      variant (main, alt1, ...)

Every image on disk becomes one selectable catalog entry, so when a strain
has several variants of a series the machine user can pick the one they want.
Strain display names come from tools/manifests/plain.xlsx (the 256-strain roster).

Usage:
  python tools/build_catalog.py
      Rebuild labelCatalog.js from the images already in public/labels.

  python tools/build_catalog.py --ingest-folder <path>
      Install an art drop whose files are named <strain>-<series>-<variant>.png
      (copies each into public/labels/<strain>/<series>-<variant>.png), then
      rebuild. Junk/unparseable files are skipped; unknown strains are listed.

  python tools/build_catalog.py --ingest plain <zip-path>
      Legacy manifest-based ingest for the Plain collection (uses
      tools/manifests/plain.xlsx: columns id, strain, file_name).

Requires: pip install pandas openpyxl
"""

import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
MANIFESTS = REPO / "tools" / "manifests"
LABELS = REPO / "public" / "labels"
CATALOG = REPO / "labelCatalog.js"

# Collections, in catalog order. Display name + labelId prefix per slug.
SERIES = {
    "cigarette": ("Cigarette Series", "CIGA"),
    "pinup": ("Pin-Up Series", "PIN"),       # replaced the retired Calendar series
    "cartoon": ("Early Cartoon Series", "CART"),
    "sinners": ("Sidewalk Sinners Series", "SIN"),
    "plain": ("Plain Series", "PLAIN"),
}
# Series whose art is real and variant-capable (one entry per file on disk).
VARIANT_SERIES = ["cigarette", "pinup", "cartoon", "sinners"]

# Filename slug typos -> the real catalog strain slug.
SLUG_FIX = {
    "grand-daddy-purple": "granddaddy-purple",
    "candy-land": "candyland",
    "cereal-mil": "cereal-milk",
}

HELPERS = """
// Get all unique strains sorted alphabetically
function getAllStrains() {
    const strains = [...new Set(LABEL_CATALOG.map(label => label.strain))];
    return strains.sort();
}

// Get all label options for a specific strain
function getLabelsByStrain(strainSlug) {
    return LABEL_CATALOG.filter(label => label.strainSlug === strainSlug);
}

// Get a random selection of 12 labels for initial load
function getRandomInitialLabels() {
    const selected = [];
    const used = new Set();

    while (selected.length < 12 && selected.length < LABEL_CATALOG.length) {
        const randomIndex = Math.floor(Math.random() * LABEL_CATALOG.length);
        if (!used.has(randomIndex)) {
            selected.push(LABEL_CATALOG[randomIndex]);
            used.add(randomIndex);
        }
    }

    return selected;
}
"""

VAR = re.compile(r"^(main|alt\d*)$")


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def strain_names():
    """slug -> display name, from the Plain roster."""
    df = pd.read_excel(MANIFESTS / "plain.xlsx")
    return {slugify(r.strain): r.strain for r in df.itertuples()}


def entry_js(strain, slug, series_slug, image, label_id):
    series_name = SERIES[series_slug][0]
    return (
        "    {\n"
        f"        strain: {json.dumps(strain)},\n"
        f'        strainSlug: "{slug}",\n'
        f'        series: "{series_name}",\n'
        f'        seriesSlug: "{series_slug}",\n'
        f'        image: "{image}",\n'
        f'        labelId: "{label_id}"\n'
        "    },"
    )


def ingest_folder(src):
    src = Path(src)
    if not src.is_dir():
        sys.exit(f"not a folder: {src}")
    copied = setaside = skipped = 0
    aside = []
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith(".png"):
            continue
        stem = re.sub(r"\.png$", "", f, flags=re.I).rstrip(".")
        if " " in stem or "ChatGPT" in f or "." in stem or "publiclabels" in stem:
            skipped += 1
            continue
        toks = stem.split("-")
        variant = toks[-1].lower() if VAR.match(toks[-1].lower()) else None
        rest = toks[:-1] if variant else toks
        series = rest[-1].lower() if rest and rest[-1].lower() in SERIES else None
        strain = "-".join(rest[:-1]).lower() if series else "-".join(rest).lower()
        if not series:
            aside.append((f, "no series in name")); setaside += 1; continue
        strain = SLUG_FIX.get(strain, strain)
        if not (LABELS / strain).is_dir():
            aside.append((f, f"unknown strain '{strain}'")); setaside += 1; continue
        shutil.copyfile(src / f, LABELS / strain / f"{series}-{variant or 'main'}.png")
        copied += 1
    print(f"ingested {copied} files, skipped {skipped} junk, set aside {setaside}")
    for f, why in aside:
        print(f"  set aside: {f}  <- {why}")


def ingest_plain(zip_path):
    manifest = MANIFESTS / "plain.xlsx"
    if not manifest.exists():
        sys.exit(f"missing manifest {manifest}")
    df = pd.read_excel(manifest)
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        pngs = {p.name: p for p in Path(tmp).rglob("*.png")}
        n = 0
        for r in df.itertuples():
            s = pngs.get(r.file_name)
            if s is None:
                continue
            dest = LABELS / slugify(r.strain) / "plain.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(s, dest)
            n += 1
        print(f"ingested {n}/{len(df)} plain images")


def build():
    names = strain_names()
    lines = [
        "// ============================================================",
        "// Label Catalog - GENERATED FILE, do not edit by hand.",
        "// Rebuild with: python tools/build_catalog.py",
        "// Source of truth: the PNGs under public/labels/",
        "// ============================================================",
        "",
        "const LABEL_CATALOG = [",
    ]
    seen_ids = set()
    total = 0

    # Real variant art: one entry per file on disk.
    for series_slug in VARIANT_SERIES:
        series_name, prefix = SERIES[series_slug]
        block, count = [], 0
        for strain_dir in sorted(os.listdir(LABELS)):
            d = LABELS / strain_dir
            if not d.is_dir():
                continue
            for fn in sorted(os.listdir(d)):
                m = re.match(rf"^{series_slug}(?:-(.+))?\.png$", fn)
                if not m:
                    continue
                variant = m.group(1) or "main"
                name = names.get(strain_dir, strain_dir.replace("-", " ").title())
                image = f"public/labels/{strain_dir}/{fn}"
                label_id = f"{prefix}-{strain_dir.upper()}-{variant.upper()}"
                if label_id in seen_ids:
                    sys.exit(f"duplicate labelId {label_id}")
                seen_ids.add(label_id)
                block.append(entry_js(name, strain_dir, series_slug, image, label_id))
                count += 1
        if block:
            lines.append("")
            lines.append(f"    // {series_name} ({count})")
            lines.extend(block)
            total += count
        print(f"{series_name}: {count} labels")

    # Plain: one per strain, from the roster manifest.
    df = pd.read_excel(MANIFESTS / "plain.xlsx")
    plain_block, count = [], 0
    for r in df.itertuples():
        slug = slugify(r.strain)
        image = f"public/labels/{slug}/plain.png"
        if not (REPO / image).exists():
            continue
        label_id = f"PLAIN-{r.id:03d}"
        seen_ids.add(label_id)
        plain_block.append(entry_js(r.strain, slug, "plain", image, label_id))
        count += 1
    lines.append("")
    lines.append(f"    // Plain Series ({count})")
    lines.extend(plain_block)
    total += count
    print(f"Plain Series: {count} labels")

    lines.append("];")
    CATALOG.write_text("\n".join(lines) + HELPERS, encoding="utf-8")
    print(f"wrote labelCatalog.js with {total} labels")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--ingest-folder":
        ingest_folder(sys.argv[2]); build()
    elif len(sys.argv) == 4 and sys.argv[1] == "--ingest" and sys.argv[2] == "plain":
        ingest_plain(sys.argv[3]); build()
    elif len(sys.argv) == 1:
        build()
    else:
        sys.exit(__doc__)
