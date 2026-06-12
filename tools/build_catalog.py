"""Regenerate labelCatalog.js from the collection manifests.

The machine site stays dumb: it reads a flat LABEL_CATALOG array from
labelCatalog.js. This script is the only thing that writes that file.

Source of truth:
  tools/manifests/<series-slug>.xlsx   one manifest per collection
                                       (columns: id, strain, file_name)
  public/labels/<strain-slug>/<series-slug>.png   the artwork

Rule: a label only enters the catalog when its artwork exists on disk.
(Exception: the 12 original strains keep their legacy placeholder series
until real art for those collections ships.)

Usage:
  python tools/build_catalog.py
      Rebuild labelCatalog.js from manifests + images already in place.

  python tools/build_catalog.py --ingest <series-slug> <zip-path>
      Install a new art drop first: copy each PNG named in
      tools/manifests/<series-slug>.xlsx out of the zip into
      public/labels/<strain-slug>/<series-slug>.png, then rebuild.

Requires: pip install pandas openpyxl
"""

import json
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
MANIFESTS = REPO / "tools" / "manifests"
LABELS = REPO / "public" / "labels"
CATALOG = REPO / "labelCatalog.js"

# Collections, in catalog order. Display name and labelId prefix per slug.
SERIES = {
    "cigarette": ("Cigarette Series", "CIGA"),
    "calendar": ("Calendar Series", "CAL"),
    "cartoon": ("Early Cartoon Series", "CART"),
    "sinners": ("Sidewalk Sinners Series", "SIN"),
    "plain": ("Plain Series", "PLAIN"),
}

# The original hand-made entries for the first 12 strains. Grandfathered
# with placeholder art until real artwork for these collections ships;
# once a manifest + art drop exists for a series, delete its rows here.
LEGACY = [
    ("OG Kush", "og-kush", "cigarette", "OG-CIGA-001"),
    ("OG Kush", "og-kush", "calendar", "OG-CAL-001"),
    ("OG Kush", "og-kush", "cartoon", "OG-CART-001"),
    ("OG Kush", "og-kush", "sinners", "OG-SIN-001"),
    ("Blue Dream", "blue-dream", "cigarette", "BD-CIGA-001"),
    ("Blue Dream", "blue-dream", "calendar", "BD-CAL-001"),
    ("Blue Dream", "blue-dream", "cartoon", "BD-CART-001"),
    ("Blue Dream", "blue-dream", "sinners", "BD-SIN-001"),
    ("Granddaddy Purple", "granddaddy-purple", "cigarette", "GDP-CIGA-001"),
    ("Granddaddy Purple", "granddaddy-purple", "calendar", "GDP-CAL-001"),
    ("Granddaddy Purple", "granddaddy-purple", "cartoon", "GDP-CART-001"),
    ("Runtz", "runtz", "cigarette", "RUNTZ-CIGA-001"),
    ("Runtz", "runtz", "calendar", "RUNTZ-CAL-001"),
    ("Runtz", "runtz", "sinners", "RUNTZ-SIN-001"),
    ("Pineapple Express", "pineapple-express", "cigarette", "PE-CIGA-001"),
    ("Pineapple Express", "pineapple-express", "calendar", "PE-CAL-001"),
    ("Pineapple Express", "pineapple-express", "cartoon", "PE-CART-001"),
    ("Sour Diesel", "sour-diesel", "cigarette", "SD-CIGA-001"),
    ("Sour Diesel", "sour-diesel", "cartoon", "SD-CART-001"),
    ("Sour Diesel", "sour-diesel", "sinners", "SD-SIN-001"),
    ("Cereal Milk", "cereal-milk", "cigarette", "CM-CIGA-001"),
    ("Cereal Milk", "cereal-milk", "calendar", "CM-CAL-001"),
    ("Cereal Milk", "cereal-milk", "sinners", "CM-SIN-001"),
    ("Forbidden Fruit", "forbidden-fruit", "cigarette", "FF-CIGA-001"),
    ("Forbidden Fruit", "forbidden-fruit", "calendar", "FF-CAL-001"),
    ("Forbidden Fruit", "forbidden-fruit", "cartoon", "FF-CART-001"),
    ("Bubba Kush", "bubba-kush", "cigarette", "BK-CIGA-001"),
    ("Bubba Kush", "bubba-kush", "cartoon", "BK-CART-001"),
    ("Bubba Kush", "bubba-kush", "sinners", "BK-SIN-001"),
    ("Gelato", "gelato", "cigarette", "GEL-CIGA-001"),
    ("Gelato", "gelato", "calendar", "GEL-CAL-001"),
    ("Gelato", "gelato", "sinners", "GEL-SIN-001"),
    ("Mochi", "mochi", "cigarette", "MOCH-CIGA-001"),
    ("Mochi", "mochi", "cartoon", "MOCH-CART-001"),
    ("AK-47", "ak-47", "cigarette", "AK47-CIGA-001"),
    ("AK-47", "ak-47", "calendar", "AK47-CAL-001"),
    ("AK-47", "ak-47", "cartoon", "AK47-CART-001"),
]

PLACEHOLDER = "public/labels/placeholder.png"

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


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


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


def ingest(series_slug, zip_path):
    if series_slug not in SERIES:
        sys.exit(f"unknown series slug '{series_slug}'; known: {', '.join(SERIES)}")
    manifest = MANIFESTS / f"{series_slug}.xlsx"
    if not manifest.exists():
        sys.exit(f"missing manifest {manifest}; add it first")
    df = pd.read_excel(manifest)
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        pngs = {p.name: p for p in Path(tmp).rglob("*.png")}
        missing = []
        for r in df.itertuples():
            src = pngs.get(r.file_name)
            if src is None:
                missing.append(r.file_name)
                continue
            dest = LABELS / slugify(r.strain) / f"{series_slug}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
        print(f"ingested {len(df) - len(missing)}/{len(df)} images for '{series_slug}'")
        if missing:
            print("MISSING from zip:", *missing, sep="\n  ")


def build():
    lines = [
        "// ============================================================",
        "// Label Catalog - GENERATED FILE, do not edit by hand.",
        "// Rebuild with: python tools/build_catalog.py",
        "// Sources: tools/manifests/*.xlsx + public/labels/<strain>/<series>.png",
        "// ============================================================",
        "",
        "const LABEL_CATALOG = [",
        "",
        "    // Legacy series for the original 12 strains (placeholder art)",
    ]
    seen_ids = set()
    for strain, slug, series_slug, label_id in LEGACY:
        lines.append(entry_js(strain, slug, series_slug, PLACEHOLDER, label_id))
        seen_ids.add(label_id)

    total = len(LEGACY)
    for series_slug, (series_name, prefix) in SERIES.items():
        manifest = MANIFESTS / f"{series_slug}.xlsx"
        if not manifest.exists():
            continue
        df = pd.read_excel(manifest)
        lines.append("")
        lines.append(f"    // {series_name} - generated from tools/manifests/{series_slug}.xlsx")
        included = skipped = 0
        for r in df.itertuples():
            slug = slugify(r.strain)
            image = f"public/labels/{slug}/{series_slug}.png"
            if not (REPO / image).exists():
                skipped += 1
                continue
            label_id = f"{prefix}-{r.id:03d}"
            if label_id in seen_ids:
                sys.exit(f"duplicate labelId {label_id}")
            seen_ids.add(label_id)
            lines.append(entry_js(r.strain, slug, series_slug, image, label_id))
            included += 1
        total += included
        note = f", skipped {skipped} without art" if skipped else ""
        print(f"{series_name}: {included} labels{note}")

    lines.append("];")
    CATALOG.write_text("\n".join(lines) + HELPERS, encoding="utf-8")
    print(f"wrote labelCatalog.js with {total} labels")


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--ingest":
        ingest(sys.argv[2], sys.argv[3])
        build()
    elif len(sys.argv) == 1:
        build()
    else:
        sys.exit(__doc__)
