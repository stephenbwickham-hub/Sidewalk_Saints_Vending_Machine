// ============================================================
// SIDEWALK SAINTS VENDING MACHINE - Main Script
// ============================================================

// State management
let currentSelection = {
    labels: [],  // Array of 12 selected label objects
    selectedSlotIndex: null  // Which slot is being edited
};

// Payment links — replace these with your real Stripe payment links.
const PAYMENT_LINKS = {
    dollar: 'https://buy.stripe.com/REPLACE_WITH_DOLLAR_LINK',
    custom: 'https://buy.stripe.com/REPLACE_WITH_CUSTOM_LINK'
};

function openPaymentLink(url) {
    // Opens the hosted payment page in a new tab; payment is never required.
    window.open(url, '_blank', 'noopener');
}

// Initialize machine on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeMachine();
    setupEventListeners();
    // Odometer display is owned by odometer.js (global server count).
});

// ============================================================
// INITIALIZATION
// ============================================================

function initializeMachine() {
    // Load initial 12 random labels
    currentSelection.labels = getRandomInitialLabels();
    renderLabelSlots();
}

function renderLabelSlots() {
    const grid = document.getElementById('labelGrid');
    grid.innerHTML = '';
    
    currentSelection.labels.forEach((label, index) => {
        const slot = document.createElement('div');
        slot.className = 'label-slot';
        slot.onclick = () => openSelectionModal(index);
        
        const img = document.createElement('img');
        img.className = 'label-image';
        img.src = label.image;
        img.alt = `${label.strain} - ${label.series}`;
        
        slot.appendChild(img);
        grid.appendChild(slot);
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Insert Quarter opens the payment modal
    document.getElementById('insertQuarterBtn').addEventListener('click', openDonationModal);

    // Instructions
    document.getElementById('instructionsBtn').addEventListener('click', openInstructionsModal);
    document.getElementById('instructionsCloseBtn').addEventListener('click', closeAllModals);

    // Selection modal
    document.getElementById('strainDropdown').addEventListener('change', onStrainSelected);
    document.getElementById('modalCloseBtn').addEventListener('click', closeAllModals);

    // Payment modal
    document.getElementById('paymentCloseBtn').addEventListener('click', closeAllModals);
    document.getElementById('donate1Btn').addEventListener('click', () => openPaymentLink(PAYMENT_LINKS.dollar));
    document.getElementById('customAmountBtn').addEventListener('click', () => openPaymentLink(PAYMENT_LINKS.custom));
    document.getElementById('modalShakeBtn').addEventListener('click', () => {
        // Free path: close the modal and run the existing dispense.
        closeAllModals();
        dispensePDF();
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllModals);
    });
}

// ============================================================
// LABEL SELECTION MODAL
// ============================================================

function openSelectionModal(slotIndex) {
    currentSelection.selectedSlotIndex = slotIndex;
    
    // Populate strain dropdown
    const dropdown = document.getElementById('strainDropdown');
    dropdown.innerHTML = '<option value="">-- Choose Strain --</option>';
    
    getAllStrains().forEach(strain => {
        const option = document.createElement('option');
        option.value = strain;
        option.textContent = strain;
        dropdown.appendChild(option);
    });
    
    // Hide label options until strain is selected
    document.getElementById('labelOptions').style.display = 'none';
    
    // Show modal
    document.getElementById('selectionModal').classList.add('active');
}

function onStrainSelected(e) {
    const strain = e.target.value;
    
    if (!strain) {
        document.getElementById('labelOptions').style.display = 'none';
        return;
    }
    
    // Find strain slug
    const strainSlug = LABEL_CATALOG.find(label => label.strain === strain)?.strainSlug;
    if (!strainSlug) return;
    
    // Get available labels for this strain
    const options = getLabelsByStrain(strainSlug);
    
    // Populate options grid
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = '';
    
    options.forEach(label => {
        const thumb = document.createElement('button');
        thumb.className = 'option-thumbnail';
        thumb.type = 'button';
        thumb.onclick = () => selectLabel(label);
        
        const img = document.createElement('img');
        img.src = label.image;
        img.alt = `${label.strain} - ${label.series}`;
        
        thumb.appendChild(img);
        grid.appendChild(thumb);
    });
    
    // Show options
    document.getElementById('labelOptions').style.display = 'block';
}

function selectLabel(label) {
    // Update the selected slot
    currentSelection.labels[currentSelection.selectedSlotIndex] = label;
    
    // Re-render slots
    renderLabelSlots();
    
    // Close modal
    closeAllModals();
}

// ============================================================
// DONATION FLOW
// ============================================================

function openInstructionsModal() {
    document.getElementById('instructionsModal').classList.add('active');
}

function openDonationModal() {
    document.getElementById('donationModal').classList.add('active');
}

// ============================================================
// PDF DISPENSE
// ============================================================

function dispensePDF() {
    // Show dispense animation
    document.getElementById('dispenseModal').classList.add('active');

    setTimeout(async () => {
        // Generate PDF with current selection
        const dispensed = await generatePDF(currentSelection.labels);

        // Only bump the global odometer on an actual successful download.
        // The Worker adds 1 per dispense server-side; odometer.js owns the display.
        if (dispensed && window.Odometer) {
            await window.Odometer.recordDispense();
        }

        // Close dispense modal
        document.getElementById('dispenseModal').classList.remove('active');
    }, 1500);
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Reset strain dropdown
    document.getElementById('strainDropdown').value = '';
}

// ============================================================
// UTILITY
// ============================================================

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC closes all modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
});
