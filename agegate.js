// ============================================================
// 21+ age gate — lightweight local confirmation only.
// No date of birth, no personal data, no accounts, no tracking.
// ============================================================
(function () {
    const KEY = 'sidewalk_saints_age_ok';

    function init() {
        const gate = document.getElementById('ageGate');
        if (!gate) return;

        // Already confirmed on this device — never show the gate.
        let confirmed = false;
        try { confirmed = localStorage.getItem(KEY) === 'yes'; } catch (e) {}
        if (confirmed) {
            gate.classList.add('hidden');
            return;
        }

        // Block scrolling/interaction with the machine while the gate is up.
        document.body.style.overflow = 'hidden';

        document.getElementById('ageConfirmBtn').addEventListener('click', () => {
            try { localStorage.setItem(KEY, 'yes'); } catch (e) {}
            gate.classList.add('hidden');
            document.body.style.overflow = '';
        });

        document.getElementById('ageExitBtn').addEventListener('click', () => {
            document.getElementById('ageGateBody').innerHTML =
                '<p class="age-gate-locked">Sorry, this site is intended for adults 21+.</p>';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
