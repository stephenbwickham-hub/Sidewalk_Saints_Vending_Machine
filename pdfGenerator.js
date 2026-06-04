// ============================================================
// PDF Generator - Creates printable label sheets
// TODO: Connect to real PDF generation library (jsPDF + html2canvas)
// TODO: Add final Sidewalk Saints branding and logo assets
// ============================================================

// Placeholder function to generate PDF
function generatePDF(selectedLabels) {
    // TODO: Implement real PDF generation here
    // For now, this is a placeholder that logs the data
    
    console.log('PDF Generation - Placeholder Mode');
    console.log('Selected labels:', selectedLabels);
    
    // Mock PDF download
    const mockPDFContent = `
Sidewalk Saints - Label Sheet

Selected Labels:
${selectedLabels.map((label, index) => {
        return `${index + 1}. ${label.strain} - ${label.series} (${label.labelId})`;
    }).join('\n')}

Printing Instructions:
1. Print this sheet on standard 8.5" x 11" paper
2. Use high-quality matte finish label stock for best results
3. Cut along the dotted lines
4. Apply to 4 oz herb jars

--- This is a placeholder. Real PDF will include images, layout, and branding. ---
    `;
    
    // Create and download text file as placeholder
    const blob = new Blob([mockPDFContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sidewalk-saints-labels.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// TODO: Real PDF generation function (when library is added)
// function generatePDFReal(selectedLabels) {
//     const doc = new jsPDF({
//         orientation: 'portrait',
//         unit: 'mm',
//         format: 'a4'
//     });
//
//     // Add Sidewalk Saints branding
//     // doc.addImage(logoPath, 'PNG', ...)
//     // doc.setFontSize(20);
//     // doc.text('SIDEWALK SAINTS', 105, 20, { align: 'center' });
//
//     // Add label images in 3x4 grid
//     // selectedLabels.forEach((label, index) => {
//     //     const row = Math.floor(index / 4);
//     //     const col = index % 4;
//     //     doc.addImage(label.image, 'PNG', ...);
//     //     doc.text(`${label.strain} - ${label.labelId}`, ...);
//     // });
//
//     // Add printing instructions page
//     // doc.addPage();
//     // doc.text('PRINTING INSTRUCTIONS', ...);
//     // ...
//
//     // doc.save('sidewalk-saints-labels.pdf');
// }
