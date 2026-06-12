# Sidewalk Saints Vending Machine

A one-page website that feels like an old 1950s cigarette vending machine on the internet. Users customize and download printable label sheets for 4 oz herb jars.

## Design Philosophy

**Primary Rule:** If it feels like a website, remove it. If it feels like a machine, keep it.

This is not ecommerce. It's a machine experience.

## Features (Version 1)

✅ **Machine UI**
- Faded powder blue body with worn red accents
- Cream/off-white aged trim
- 12 label slots in 3×4 grid behind glass
- Mechanical odometer (anonymous dispense counter)

✅ **Label Customization**
- Click any slot to open selection modal
- Choose strain → see available label series
- Replace slot with chosen label
- All 12 slots customizable

✅ **Donation Flow**
- INSERT QUARTER button → donation modal
- $1 or custom amount options
- TODO: Connect to real payment system (Stripe/PayPal)

✅ **Shake The Machine**
- 20% dispense on first shake
- 40% on second shake
- 40% on third shake (guaranteed)
- Simple rattle animation

✅ **PDF Dispense**
- Fills the real template (`assets/sidewalk_saints_label_sheet_template.pdf`)
- Stamps the 12 selected labels into the circular spaces at fixed coordinates
- Falls back to strain name + label ID text if a label image is missing
- Uses vendored pdf-lib (`assets/pdf-lib.min.js`), no CDN or build step

✅ **Odometer**
- Displays anonymous dispense count
- Increments only on successful PDF download
- Stores count in localStorage (no tracking)

## File Structure

```
SidewalkSaintsVendingMachine/
├── index.html              # Main machine UI
├── styles.css              # 1950s machine aesthetic
├── script.js               # Machine behavior & interactions
├── labelCatalog.js         # Label data structure (12 strains × 2-4 series)
├── pdfGenerator.js         # PDF generation (placeholder)
├── public/
│   └── labels/             # Label images (placeholder structure)
│       ├── og-kush/
│       ├── blue-dream/
│       └── ...
└── README.md               # This file
```

## Label Catalog

`labelCatalog.js` is a **generated file** — never edit it by hand. It is
built from the manifests in `tools/manifests/` by `tools/build_catalog.py`
(requires `pip install pandas openpyxl`).

**Adding a new collection drop** (a manifest spreadsheet + a zip of PNGs):

1. Save the manifest as `tools/manifests/<series-slug>.xlsx`
   (columns: `id`, `strain`, `file_name`).
2. Register the series name/prefix in the `SERIES` table of
   `tools/build_catalog.py` if it's a brand-new series.
3. Run: `python tools/build_catalog.py --ingest <series-slug> <zip-path>`

That installs the art into `public/labels/[strain-slug]/[series-slug].png`
and regenerates the catalog. A label only enters the catalog when its
artwork exists — `tools/manifests/main-100-strain-roster.xlsx` is the
planned roster for the legacy series, not live catalog data.

The Plain Series covers 256 strains with real artwork. These 12 original
strains also have Cigarette/Calendar/Cartoon/Sinners series (placeholder
art for now, grandfathered in the `LEGACY` table of the build script):

- OG Kush
- Blue Dream
- Granddaddy Purple
- Runtz
- Pineapple Express
- Sour Diesel
- Cereal Milk
- Forbidden Fruit
- Bubba Kush
- Gelato
- Mochi
- AK-47

**Series Options:**
- Cigarette Series
- Calendar Series
- Early Cartoon Series
- Sidewalk Sinners Series
- Plain Series

Images stored as `/public/labels/[strain-slug]/[series-slug].png`

## Development TODOs

### High Priority (Version 1)

- [ ] **Replace placeholder images** with real label artwork
  - Create 50 label images (12 strains × ~4 series average)
  - Store in `/public/labels/[strain-slug]/[series-slug].png`
  
- [x] **Real PDF generation**
  - Done: pdf-lib fills the template at fixed coordinates (see `pdfGenerator.js`)
  - Note: requires serving over HTTP (e.g. `python -m http.server` or GitHub Pages);
    opening `index.html` directly via file:// blocks the template fetch

- [ ] **Payment integration**
  - Connect to Stripe or PayPal
  - Handle real donations
  - Replace TODO comment in `processDonation()`

- [ ] **Odometer backend** (optional for V1)
  - Current: localStorage only (works offline)
  - TODO: Optional—connect to simple backend API
  - Track only: anonymous dispense count (no user data)

### Medium Priority (Version 2+)

- [ ] Add more strains & label series
- [ ] Create alternate label designs
- [ ] Mobile responsiveness refinement
- [ ] Performance optimization

### Nice-to-Have

- [ ] Social sharing (without analytics)
- [ ] Email-free donation receipts (optional)
- [ ] Accessibility audit & improvements

## How to Use

### Local Development

1. Clone the repo
2. Open `index.html` in a browser
3. Customize 12 labels by clicking slots
4. Click INSERT QUARTER → select amount
5. Download placeholder PDF

### Real Deployment

1. Add label images to `/public/labels/`
2. Implement real PDF generator in `pdfGenerator.js`
3. Connect payment system in `processDonation()`
4. Deploy to GitHub Pages or your host

## Key Code Sections

### State Management (`script.js`)
```javascript
let currentSelection = {
    labels: [],           // 12 selected labels
    selectedSlotIndex: null
};

let machineState = {
    shakeCount: 0,
    dispensedCount: 0     // Odometer
};
```

### Label Selection Flow
1. Click slot → `openSelectionModal(slotIndex)`
2. Choose strain → `onStrainSelected()` populates options
3. Click label → `selectLabel(label)` updates slot

### Donation Flow
1. Click INSERT QUARTER → `openDonationModal()`
2. Choose $1 or CUSTOM → `processDonation(amount)`
3. Generate PDF → `dispensePDF()`
4. Increment odometer → `saveOdometerCount()`

### Shake Probability
```javascript
// shakeTheMachine()
Shake 1: 20% dispense probability
Shake 2: 40% dispense probability  
Shake 3: 100% dispense (guaranteed)
```

## Design Notes

### Color Palette
- **Machine Blue:** #9db3c8 (faded, powder-like)
- **Accent Red:** #b84040 (worn, muted)
- **Trim Cream:** #e8dcc8 (aged, off-white)
- **Chrome:** #b8b8b8 (metallic accents)

### Interactions
- All buttons have mechanical button feel (pressed/released)
- Hover states are subtle (slight scale, border change)
- Modals overlay with dark background (no navigation)
- Shake animation is restrained (not gamified)
- No progress bars, achievements, or heavy animations

### No Tracking
- ✅ Anonymous odometer counter (localStorage only)
- ✅ No cookies
- ✅ No user accounts
- ✅ No analytics
- ✅ No email collection
- ✅ No personal data

## Payment System (TODO)

When ready, replace this in `script.js`:

```javascript
// TODO: Connect payment here
function processDonation(amount) {
    // Stripe example:
    // const response = await fetch('/api/create-checkout', {
    //     method: 'POST',
    //     body: JSON.stringify({ amount })
    // });
    // 
    // On success: dispensePDF()
}
```

## Questions?

This is Version 1. The machine works. Placeholder images and PDF generation are stubbed out with clear TODO comments.

Focus: **Make it feel like a real machine first, add polish second.**
