// ============================================================
// SIDEWALK SAINTS VENDING MACHINE - Main Script
// ============================================================

// State management
let currentSelection = {
    labels: [],  // Array of 12 selected label objects
    selectedSlotIndex: null  // Which slot is being edited
};

let machineState = {
    shakeCount: 0,
    maxShakes: 3,
    dispensedCount: 0  // Anonymous counter for odometer
};

// Initialize machine on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeMachine();
    setupEventListeners();
    loadOdometerCount();
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
    // Main buttons
    document.getElementById('insertQuarterBtn').addEventListener('click', openDonationModal);
    document.getElementById('shakeBtn').addEventListener('click', shakeTheeMachine);

    // Instructions
    document.getElementById('instructionsBtn').addEventListener('click', openInstructionsModal);
    document.getElementById('instructionsCloseBtn').addEventListener('click', closeAllModals);
    
    // Selection modal
    document.getElementById('strainDropdown').addEventListener('change', onStrainSelected);
    document.getElementById('modalCloseBtn').addEventListener('click', closeAllModals);
    
    // Donation modal
    document.getElementById('customDonationBtn').addEventListener('click', openCustomDonationModal);
    document.getElementById('donationCloseBtn').addEventListener('click', closeAllModals);
    
    document.querySelectorAll('.donation-button:not(#customDonationBtn)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amount = e.currentTarget.getAttribute('data-amount');
            processDonation(amount);
        });
    });
    
    // Custom donation modal
    document.getElementById('confirmCustomBtn').addEventListener('click', () => {
        const amount = document.getElementById('customAmountInput').value;
        if (amount && parseFloat(amount) > 0) {
            processDonation(amount);
        }
    });
    document.getElementById('cancelCustomBtn').addEventListener('click', closeAllModals);
    
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

function openCustomDonationModal() {
    // Close donation modal, open custom modal
    document.getElementById('donationModal').classList.remove('active');
    document.getElementById('customDonationModal').classList.add('active');
    
    // Focus input
    setTimeout(() => {
        document.getElementById('customAmountInput').focus();
    }, 100);
}

function processDonation(amount) {
    // Close modals
    closeAllModals();
    
    // TODO: Connect to real payment system here
    // For now, just trigger dispense
    console.log(`Donation received: $${amount}`);
    
    // Show dispense animation and generate PDF
    dispensePDF();
}

// ============================================================
// SHAKE THE MACHINE
// ============================================================

function shakeTheeMachine() {
    if (machineState.shakeCount >= machineState.maxShakes) {
        // Reset if at max
        machineState.shakeCount = 0;
    }
    
    machineState.shakeCount++;
    
    // Calculate probability of dispense
    let shouldDispense = false;
    
    if (machineState.shakeCount === 1) {
        // 20% on first shake
        shouldDispense = Math.random() < 0.2;
    } else if (machineState.shakeCount === 2) {
        // 40% on second shake
        shouldDispense = Math.random() < 0.4;
    } else if (machineState.shakeCount === 3) {
        // 100% on third shake
        shouldDispense = true;
    }
    
    // Animate shake
    const machine = document.querySelector('.machine-stage');
    machine.style.animation = 'none';
    setTimeout(() => {
        machine.style.animation = 'rattle 0.4s ease-in-out 1';
    }, 10);
    
    if (shouldDispense) {
        // Reset shake count and dispense
        machineState.shakeCount = 0;
        setTimeout(() => {
            dispensePDF();
        }, 500);
    }
}

// ============================================================
// PDF DISPENSE
// ============================================================

function dispensePDF() {
    // Show dispense animation
    document.getElementById('dispenseModal').classList.add('active');
    
    setTimeout(() => {
        // Generate PDF with current selection
        generatePDF(currentSelection.labels);
        
        // Increment counter
        machineState.dispensedCount++;
        saveOdometerCount();
        updateOdometerDisplay();
        
        // Close dispense modal
        document.getElementById('dispenseModal').classList.remove('active');
    }, 1500);
}

// ============================================================
// ODOMETER TRACKING
// ============================================================

function updateOdometerDisplay() {
    const display = document.getElementById('odometerValue');
    display.textContent = machineState.dispensedCount.toString().padStart(6, '0');
}

function saveOdometerCount() {
    // Save to localStorage (client-side only, no tracking)
    localStorage.setItem('sidewalk_saints_dispensed', machineState.dispensedCount.toString());
}

function loadOdometerCount() {
    // Load from localStorage
    const saved = localStorage.getItem('sidewalk_saints_dispensed');
    if (saved) {
        machineState.dispensedCount = parseInt(saved, 10);
    }
    updateOdometerDisplay();
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
    
    // Enter confirms in custom amount modal if focused
    if (e.key === 'Enter') {
        const customModal = document.getElementById('customDonationModal');
        if (customModal.classList.contains('active')) {
            const amount = document.getElementById('customAmountInput').value;
            if (amount && parseFloat(amount) > 0) {
                processDonation(amount);
            }
        }
    }
});
