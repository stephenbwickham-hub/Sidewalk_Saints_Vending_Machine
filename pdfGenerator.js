// ============================================================
// PDF Generator - Creates printable 8.5x11 label sheets
// ============================================================

const PDF_PAGE = {
    widthInches: 8.5,
    heightInches: 11,
    widthPoints: 612,
    heightPoints: 792,
    dpi: 144
};

async function generatePDF(selectedLabels) {
    const labels = selectedLabels.slice(0, 12);
    const labelSheet = await createLabelSheetCanvas(labels);
    const instructions = createInstructionsCanvas();
    const pdfBlob = await createPdfFromCanvases([labelSheet, instructions]);

    downloadBlob(pdfBlob, 'sidewalk-saints-labels.pdf');
}

async function createLabelSheetCanvas(labels) {
    const canvas = createPageCanvas();
    const ctx = canvas.getContext('2d');
    drawPageBackground(ctx, canvas);

    const marginX = 72;
    const titleTop = 52;
    const gridTop = 138;
    const gridBottom = 72;
    const columnGap = 28;
    const columns = 3;
    const rows = 4;
    const cellWidth = (canvas.width - (marginX * 2) - (columnGap * (columns - 1))) / columns;
    const rowHeight = (canvas.height - gridTop - gridBottom) / rows;
    const labelSize = Math.min(cellWidth, rowHeight - 44);

    drawCenteredText(ctx, 'SIDEWALK SAINTS', canvas.width / 2, titleTop, {
        size: 34,
        weight: 'bold',
        color: '#8a3030',
        letterSpacing: 2
    });
    drawCenteredText(ctx, 'PRINTABLE LABEL SHEET', canvas.width / 2, titleTop + 34, {
        size: 14,
        weight: 'bold',
        color: '#333333',
        letterSpacing: 1
    });

    ctx.strokeStyle = '#d4c4a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginX, titleTop + 56);
    ctx.lineTo(canvas.width - marginX, titleTop + 56);
    ctx.stroke();

    for (let index = 0; index < 12; index++) {
        const label = labels[index];
        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellX = marginX + column * (cellWidth + columnGap);
        const cellY = gridTop + row * rowHeight;
        const labelX = cellX + (cellWidth - labelSize) / 2;
        const labelY = cellY;

        if (label) {
            const image = await loadLabelImage(label.image);
            if (image) {
                drawLabelImage(ctx, image, labelX, labelY, labelSize, labelSize);
            } else {
                drawPlaceholderLabel(ctx, label, labelX, labelY, labelSize, labelSize);
            }

            drawCenteredText(ctx, label.strain, cellX + cellWidth / 2, labelY + labelSize + 20, {
                size: 12,
                weight: 'bold',
                color: '#1a1a1a'
            });
            drawCenteredText(ctx, label.labelId, cellX + cellWidth / 2, labelY + labelSize + 36, {
                size: 9,
                weight: 'normal',
                color: '#555555'
            });
        }
    }

    return canvas;
}

function createInstructionsCanvas() {
    const canvas = createPageCanvas();
    const ctx = canvas.getContext('2d');
    drawPageBackground(ctx, canvas);

    const left = 112;
    const top = 118;
    const maxWidth = canvas.width - left * 2;

    drawCenteredText(ctx, 'SIDEWALK SAINTS', canvas.width / 2, 86, {
        size: 34,
        weight: 'bold',
        color: '#8a3030',
        letterSpacing: 2
    });
    drawCenteredText(ctx, 'PRINTING INSTRUCTIONS', canvas.width / 2, 124, {
        size: 17,
        weight: 'bold',
        color: '#333333',
        letterSpacing: 1
    });

    ctx.strokeStyle = '#d4c4a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, 154);
    ctx.lineTo(canvas.width - left, 154);
    ctx.stroke();

    const instructions = [
        'Print this PDF on standard 8.5 x 11 inch paper or matte label stock.',
        'Use 100% scale / Actual Size. Do not use Fit to Page unless you are making a test print.',
        'For best results, use high-quality matte finish label paper and let the ink dry before cutting.',
        'Cut each label cleanly after printing, then apply to clean, dry 4 oz jars.',
        'If a label prints as a placeholder card, add the matching PNG file to public/labels/[strain-slug]/[series-slug].png and dispense again.'
    ];

    let y = top + 86;
    instructions.forEach((instruction, index) => {
        drawInstructionNumber(ctx, index + 1, left, y - 18);
        y = drawWrappedText(ctx, instruction, left + 50, y, maxWidth - 50, {
            size: 17,
            lineHeight: 26,
            color: '#1f1f1f'
        }) + 26;
    });

    ctx.fillStyle = '#6a7d94';
    ctx.fillRect(left, canvas.height - 180, maxWidth, 2);
    drawWrappedText(ctx, 'Missing artwork does not stop the machine. The PDF uses the same fallback placeholder labels shown in the vending machine display until the real image files are added.', left, canvas.height - 142, maxWidth, {
        size: 13,
        lineHeight: 21,
        color: '#4a4a4a'
    });

    return canvas;
}

function createPageCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = PDF_PAGE.widthInches * PDF_PAGE.dpi;
    canvas.height = PDF_PAGE.heightInches * PDF_PAGE.dpi;
    return canvas;
}

function drawPageBackground(ctx, canvas) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f7f1e8';
    ctx.fillRect(34, 34, canvas.width - 68, canvas.height - 68);
    ctx.strokeStyle = '#d4c4a8';
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
}

function drawLabelImage(ctx, image, x, y, width, height) {
    drawLabelFrame(ctx, x, y, width, height);

    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 8, width - 16, height - 16);
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawPlaceholderLabel(ctx, label, x, y, width, height) {
    drawLabelFrame(ctx, x, y, width, height);

    const inner = 10;
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#f4ead8');
    gradient.addColorStop(1, '#d9c7a8');
    ctx.fillStyle = gradient;
    ctx.fillRect(x + inner, y + inner, width - inner * 2, height - inner * 2);

    ctx.strokeStyle = 'rgba(184, 64, 64, 0.32)';
    ctx.lineWidth = 2;
    for (let lineY = y + inner + 18; lineY < y + height - inner; lineY += 22) {
        ctx.beginPath();
        ctx.moveTo(x + inner, lineY);
        ctx.lineTo(x + width - inner, lineY);
        ctx.stroke();
    }

    drawCenteredText(ctx, 'SIDEWALK SAINTS', x + width / 2, y + height * 0.28, {
        size: 16,
        weight: 'bold',
        color: '#8a3030',
        letterSpacing: 1
    });
    drawCenteredText(ctx, label.strain, x + width / 2, y + height * 0.49, {
        size: 20,
        weight: 'bold',
        color: '#2a1d16'
    });
    drawCenteredText(ctx, label.series, x + width / 2, y + height * 0.63, {
        size: 13,
        weight: 'normal',
        color: '#2a1d16'
    });
    drawCenteredText(ctx, label.labelId, x + width / 2, y + height * 0.77, {
        size: 11,
        weight: 'normal',
        color: '#5d5048'
    });
}

function drawLabelFrame(ctx, x, y, width, height) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#c9bda7';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.strokeStyle = '#8a3030';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 8, width - 16, height - 16);
}

function drawInstructionNumber(ctx, number, x, y) {
    ctx.fillStyle = '#8a3030';
    ctx.beginPath();
    ctx.arc(x + 17, y + 17, 17, 0, Math.PI * 2);
    ctx.fill();

    drawCenteredText(ctx, String(number), x + 17, y + 25, {
        size: 17,
        weight: 'bold',
        color: '#ffffff'
    });
}

function drawWrappedText(ctx, text, x, y, maxWidth, options = {}) {
    const size = options.size || 14;
    const lineHeight = options.lineHeight || size * 1.35;
    ctx.font = `${options.weight || 'normal'} ${size}px "Courier New", monospace`;
    ctx.fillStyle = options.color || '#1a1a1a';

    const words = text.split(' ');
    let line = '';
    let currentY = y;

    words.forEach(word => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
            ctx.fillText(line, x, currentY);
            line = word;
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    });

    if (line) {
        ctx.fillText(line, x, currentY);
    }

    return currentY;
}

function drawCenteredText(ctx, text, x, y, options = {}) {
    const size = options.size || 14;
    const weight = options.weight || 'normal';
    const letterSpacing = options.letterSpacing || 0;

    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    ctx.fillStyle = options.color || '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (!letterSpacing) {
        ctx.fillText(text, x, y);
        ctx.textAlign = 'start';
        return;
    }

    const characters = text.split('');
    const textWidth = characters.reduce((width, character, index) => {
        return width + ctx.measureText(character).width + (index < characters.length - 1 ? letterSpacing : 0);
    }, 0);
    let currentX = x - textWidth / 2;

    characters.forEach(character => {
        ctx.fillText(character, currentX + ctx.measureText(character).width / 2, y);
        currentX += ctx.measureText(character).width + letterSpacing;
    });

    ctx.textAlign = 'start';
}

function loadLabelImage(src) {
    return new Promise(resolve => {
        if (!src) {
            resolve(null);
            return;
        }

        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

async function createPdfFromCanvases(canvases) {
    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [0];
    let byteOffset = 0;

    function addString(value) {
        const bytes = encoder.encode(value);
        parts.push(bytes);
        byteOffset += bytes.length;
    }

    function addBytes(bytes) {
        parts.push(bytes);
        byteOffset += bytes.length;
    }

    function beginObject(id) {
        offsets[id] = byteOffset;
        addString(`${id} 0 obj\n`);
    }

    const pageCount = canvases.length;
    const objectCount = 2 + pageCount * 3;
    const pageObjectIds = canvases.map((_, index) => 3 + index * 3);

    addString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    beginObject(1);
    addString('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    beginObject(2);
    addString(`<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`);

    canvases.forEach((canvas, index) => {
        const pageId = 3 + index * 3;
        const imageId = pageId + 1;
        const contentId = pageId + 2;
        const imageName = `Im${index + 1}`;
        const imageBytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92));
        const content = `q\n${PDF_PAGE.widthPoints} 0 0 ${PDF_PAGE.heightPoints} 0 0 cm\n/${imageName} Do\nQ\n`;

        beginObject(pageId);
        addString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE.widthPoints} ${PDF_PAGE.heightPoints}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);

        beginObject(imageId);
        addString(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
        addBytes(imageBytes);
        addString('\nendstream\nendobj\n');

        beginObject(contentId);
        addString(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    });

    const xrefOffset = byteOffset;
    addString(`xref\n0 ${objectCount + 1}\n`);
    addString('0000000000 65535 f \n');
    for (let id = 1; id <= objectCount; id++) {
        addString(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    }
    addString(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(parts, { type: 'application/pdf' });
}

function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
