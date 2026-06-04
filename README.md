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
- Generates printable sheet with 12 selected labels
- Includes strain name and label ID
- TODO: Real PDF generation (currently placeholder text file)
- TODO: Add printing instruction page

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
│   └── labels/             # Real label image folders and placement docs
│       ├── README.md       # Exact expected label image paths
│       ├── og-kush/
│       ├── blue-dream/
│       └── ...
└── README.md               # This file
```

## Label Catalog

Currently includes 12 strains with 2-4 label series each:

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

Images are loaded from:

```text
public/labels/[strain-slug]/[series-slug].png
```

Example:

```text
public/labels/og-kush/cigarette.png
```

See `public/labels/README.md` for the exact list of expected label files. If a file is missing, the machine displays a styled placeholder card in that slot or option thumbnail.

## Development TODOs

### High Priority (Version 1)

- [ ] **Replace placeholder images** with real label artwork
  - Add the expected PNG files listed in `public/labels/README.md`
  - Store each file at `public/labels/[strain-slug]/[series-slug].png`
  
- [ ] **Real PDF generation**
  - Install jsPDF + html2canvas
  - Implement label sheet layout (3×4 grid)
  - Add Sidewalk Saints branding/logo
  - Create printing instruction page
  - Generate actual PDF (not text file)

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
