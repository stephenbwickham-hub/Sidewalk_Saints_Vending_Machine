// ============================================================
// PDF Generator - Creates printable label sheets
// Uses the fixed template at assets/sidewalk_saints_label_sheet_template.pdf
// and stamps the 12 selected labels into its circular spaces.
// Requires assets/pdf-lib.min.js (loaded in index.html).
// ============================================================

// Fixed slot coordinates on the template page (PDF points, y measured
// from the TOP of the page). Template page is 792 x 612 pt (US Letter
// landscape); each guide is a perfect 1 7/8" (135 pt) circle. Each label
// is drawn as a 135 pt square centered in its circle, so the round art
// stays a perfect circle (never stretched).
// Slot order matches the machine grid: left to right, top to bottom.
const LABEL_SHEET_SLOTS = [
    // Row 1
    { x: 19.6,  y: 59.2,  size: 135 },
    { x: 155.8, y: 59.2,  size: 135 },
    { x: 501.2, y: 59.2,  size: 135 },
    { x: 636.6, y: 59.2,  size: 135 },
    // Row 2
    { x: 19.6,  y: 225.0, size: 135 },
    { x: 155.8, y: 225.0, size: 135 },
    { x: 501.2, y: 225.0, size: 135 },
    { x: 636.6, y: 225.0, size: 135 },
    // Row 3
    { x: 19.6,  y: 392.7, size: 135 },
    { x: 155.8, y: 392.7, size: 135 },
    { x: 501.2, y: 392.7, size: 135 },
    { x: 636.6, y: 392.7, size: 135 }
];

const LABEL_SHEET_TEMPLATE = 'assets/sidewalk_saints_label_sheet_template.pdf';

// Build the filled label sheet and return its bytes (Uint8Array)
async function buildLabelSheetPdf(selectedLabels) {
    const templateResponse = await fetch(LABEL_SHEET_TEMPLATE);
    if (!templateResponse.ok) {
        throw new Error('Could not load label sheet template: ' + templateResponse.status);
    }
    const templateBytes = await templateResponse.arrayBuffer();

    const pdfDoc = await PDFLib.PDFDocument.load(templateBytes);
    const page = pdfDoc.getPage(0);
    const pageHeight = page.getHeight();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const embeddedImages = {};  // cache so the same image file is embedded once

    for (let i = 0; i < LABEL_SHEET_SLOTS.length; i++) {
        const slot = LABEL_SHEET_SLOTS[i];
        const label = selectedLabels[i];
        if (!label) continue;

        // Convert top-based y to PDF bottom-based y
        const drawY = pageHeight - slot.y - slot.size;

        let image = null;
        try {
            if (label.image in embeddedImages) {
                image = embeddedImages[label.image];
            } else {
                const imageResponse = await fetch(label.image);
                if (imageResponse.ok) {
                    const imageBytes = await imageResponse.arrayBuffer();
                    image = await pdfDoc.embedPng(imageBytes);
                }
                embeddedImages[label.image] = image;
            }
        } catch (err) {
            image = null;
        }

        if (image) {
            page.drawImage(image, {
                x: slot.x,
                y: drawY,
                width: slot.size,
                height: slot.size
            });
        } else {
            // Image missing: print the label name inside the circle instead
            const lines = [label.strain, label.labelId];
            const fontSize = 6;
            lines.forEach((line, lineIndex) => {
                const textWidth = font.widthOfTextAtSize(line, fontSize);
                page.drawText(line, {
                    x: slot.x + (slot.size - textWidth) / 2,
                    y: drawY + slot.size / 2 + 2 - lineIndex * 9,
                    size: fontSize,
                    font: font,
                    color: PDFLib.rgb(0.1, 0.1, 0.1)
                });
            });
        }
    }

    return pdfDoc.save();
}

// Generate the PDF and trigger the download
async function generatePDF(selectedLabels) {
    try {
        const pdfBytes = await buildLabelSheetPdf(selectedLabels);

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sidewalk-saints-labels.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    } catch (err) {
        console.error('PDF generation failed:', err);
        alert('The machine jammed. Please try again.');
        return false;
    }
}
