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

  python tools/build_catalog.py --ingest-folder <path> --dry-run
      Preview a drop WITHOUT changing anything: lists what would be imported,
      what would be skipped, and warnings (missing/unknown series, likely
      typos, accidental new strains, duplicate destinations). Run this first.

  python tools/build_catalog.py --ingest-folder <path>
      Install an art drop whose files are named <strain>-<series>-<variant>.png
      (copies each into public/labels/<strain>/<series>-<variant>.png), then
      rebuild. Junk/unparseable files are skipped; unknown strains are listed.

  python tools/build_catalog.py --ingest plain <zip-path>
      Legacy manifest-based ingest for the Plain collection (uses
      tools/manifests/plain.xlsx: columns id, strain, file_name).

Requires: pip install pandas openpyxl
"""

import difflib
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

# Series that no longer exist, kept only for friendlier dry-run messages.
RETIRED_SERIES = {"calendar"}

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


def top100_slugs():
    """Slugs of the Top-100 roster. Plain labels are limited to this set so
    they don't overpower the machine; custom (real-art) series are not gated."""
    df = pd.read_excel(MANIFESTS / "main-100-strain-roster.xlsx")
    col = next(c for c in df.columns if "strain" in c.lower())
    return {slugify(x) for x in df[col]}


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


def analyze_drop(src):
    """Parse a drop folder WITHOUT touching disk.

    Shared by the real ingest and --dry-run so both classify files identically.
    Returns (imports, warnings, skips):
      imports  list of dicts {file, src, strain, series, variant, dest,
               label_id, replaces, note} -- exactly the files the real ingest
               would copy (existing strain + recognized series).
      warnings list of (file, message) -- parsed but NOT imported (missing/
               unknown series, unknown strain / likely typo), plus auto-correct
               notices and duplicate-destination collisions.
      skips    list of (file, message) -- junk / non-PNG, ignored entirely.
    """
    src = Path(src)
    if not src.is_dir():
        sys.exit(f"not a folder: {src}")
    existing = sorted(d for d in os.listdir(LABELS) if (LABELS / d).is_dir())
    series_words = set(SERIES) | RETIRED_SERIES
    imports, warnings, skips = [], [], []

    for f in sorted(os.listdir(src)):
        if not f.lower().endswith(".png"):
            skips.append((f, "not a PNG"))
            continue
        stem = re.sub(r"\.png$", "", f, flags=re.I).rstrip(".")
        if " " in stem or "ChatGPT" in f or "." in stem or "publiclabels" in stem:
            skips.append((f, "junk/unrecognized filename"))
            continue
        toks = stem.split("-")
        variant = toks[-1].lower() if VAR.match(toks[-1].lower()) else None
        rest = toks[:-1] if variant else toks
        series = rest[-1].lower() if rest and rest[-1].lower() in SERIES else None
        strain = "-".join(rest[:-1]).lower() if series else "-".join(rest).lower()

        if not series:
            cand = rest[-1].lower() if rest else ""
            if cand in RETIRED_SERIES:
                warnings.append((f, f"retired series '{cand}' (Calendar was replaced by Pin-Up)"))
            else:
                near = difflib.get_close_matches(cand, series_words, n=1, cutoff=0.7) if cand else []
                if near:
                    warnings.append((f, f"unknown series '{cand}'; did you mean '{near[0]}'?"))
                else:
                    warnings.append((f, "missing series"))
            continue

        note = None
        if strain in SLUG_FIX:
            corrected = SLUG_FIX[strain]
            note = f"name auto-corrected '{strain}' -> '{corrected}'"
            warnings.append((f, note))
            strain = corrected

        if strain not in existing:
            near = difflib.get_close_matches(strain, existing, n=1, cutoff=0.75)
            if near:
                warnings.append((f, f"possible typo; did you mean '{near[0]}'? (set aside)"))
            else:
                warnings.append((f, f"would create NEW strain '{strain}' (not in catalog) -- set aside"))
            continue

        v = variant or "main"
        dest = LABELS / strain / f"{series}-{v}.png"
        imports.append({
            "file": f, "src": src / f, "strain": strain, "series": series,
            "variant": v, "dest": dest,
            "label_id": f"{SERIES[series][1]}-{strain.upper()}-{v.upper()}",
            "replaces": dest.exists(), "note": note,
        })

    # duplicate destinations within the drop (would silently overwrite each other)
    by_dest = defaultdict(list)
    for imp in imports:
        by_dest[imp["dest"]].append(imp["file"])
    for dest, fs in by_dest.items():
        if len(fs) > 1:
            warnings.append((" & ".join(fs), f"map to the same label ({dest.parent.name}/{dest.name}) -- last one would win"))

    return imports, warnings, skips


def ingest_folder(src, dry_run=False):
    imports, warnings, skips = analyze_drop(src)

    if dry_run:
        print("DRY RUN -- no files will be changed.\n")
        print(f"Would import ({len(imports)}):")
        for imp in imports:
            tag = "  (replaces existing)" if imp["replaces"] else ""
            print(f"  - {imp['strain']} / {imp['series']} / {imp['variant']}{tag}")
        if not imports:
            print("  (none)")
        print(f"\nWarnings ({len(warnings)}):")
        for f, msg in warnings:
            print(f"  - {f}: {msg}")
        if not warnings:
            print("  (none)")
        print(f"\nSkipped ({len(skips)}):")
        for f, msg in skips:
            print(f"  - {f}: {msg}")
        if not skips:
            print("  (none)")
        print("\nNothing was written. Re-run without --dry-run to import.")
        return

    for imp in imports:
        imp["dest"].parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(imp["src"], imp["dest"])
    print(f"ingested {len(imports)} files, skipped {len(skips)} junk, {len(warnings)} warning(s)")
    for f, msg in warnings:
        print(f"  warning: {f}: {msg}")


def ingest_plain(zip_path):
    manifest = MANIFESTS / "plain.xlsx"
    if not manifest.exists():
        sys.exit(f"missing manifest {manifest}")
    df = pd.read_excel(manifest)
    top = top100_slugs()
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        pngs = {p.name: p for p in Path(tmp).rglob("*.png")}
        n = 0
        for r in df.itertuples():
            if slugify(r.strain) not in top:    # Plain limited to the Top-100
                continue
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
                m = re.match(rf"^{series_slug}(?:-(.+))?\.(?:png|jpe?g)$", fn)
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

    # Plain: one per strain, from the roster manifest — limited to the Top-100.
    df = pd.read_excel(MANIFESTS / "plain.xlsx")
    top = top100_slugs()
    plain_block, count = [], 0
    for r in df.itertuples():
        slug = slugify(r.strain)
        if slug not in top:
            continue
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
    args = sys.argv[1:]
    if args and args[0] == "--ingest-folder":
        rest = args[1:]
        dry = "--dry-run" in rest
        paths = [a for a in rest if a != "--dry-run"]
        if len(paths) != 1:
            sys.exit(__doc__)
        if dry:
            ingest_folder(paths[0], dry_run=True)   # preview only, repo untouched
        else:
            ingest_folder(paths[0]); build()
    elif len(args) == 3 and args[0] == "--ingest" and args[1] == "plain":
        ingest_plain(args[2]); build()
    elif not args:
        build()
    else:
        sys.exit(__doc__)
