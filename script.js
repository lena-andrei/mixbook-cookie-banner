(() => {
  "use strict";

  const STORAGE_KEY = "mixbook_mock_consent";

  const banner = document.getElementById("cookieBanner");
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("settingsModal");

  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const acceptAllBtn = document.getElementById("acceptAllBtn");
  const modalAcceptAllBtn = document.getElementById("modalAcceptAllBtn");
  const rejectAllBtn = document.getElementById("rejectAllBtn");
  const savePreferencesBtn = document.getElementById("savePreferencesBtn");
  const resetConsentBtn = document.getElementById("resetConsentBtn");

  const toggleFunctional = document.getElementById("toggle-functional");
  const toggleAnalytics = document.getElementById("toggle-analytics");
  const toggleAdvertising = document.getElementById("toggle-advertising");

  let lastFocusedElement = null;

  // ---------- Mock consent storage (stand-in for Transcend's regime) ----------
  // In production, Transcend's airgap.js is the source of truth for consent
  // state and persistence (cookies + their backend). This localStorage mock
  // only exists so the banner behaves sensibly when airgap.js isn't present.
  function readMockConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeMockConsent(consent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  }

  function clearMockConsent() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function hasAirgap() {
    return typeof window.airgap !== "undefined" && window.airgap !== null;
  }

  // ---------- Banner visibility ----------
  function showBanner() {
    banner.hidden = false;
  }

  function hideBanner() {
    banner.hidden = true;
  }

  function consentAlreadyGiven() {
    if (hasAirgap() && typeof window.airgap.getConsent === "function") {
      // Real integration: ask airgap whether consent has already been recorded.
      const consent = window.airgap.getConsent();
      return Boolean(consent && consent.confirmed);
    }
    return readMockConsent() !== null;
  }

  // ---------- Modal open/close + focus management ----------
  function openModal() {
    lastFocusedElement = document.activeElement;
    overlay.hidden = false;
    modal.hidden = false;
    document.addEventListener("keydown", onModalKeydown);

    const firstFocusable = modal.querySelector(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (firstFocusable) firstFocusable.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    modal.hidden = true;
    document.removeEventListener("keydown", onModalKeydown);
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function onModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === "Tab") {
      trapFocus(event);
    }
  }

  function trapFocus(event) {
    const focusables = modal.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (focusables.length === 0) return;

    const list = Array.prototype.slice.call(focusables);
    const first = list[0];
    const last = list[list.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ---------- Purpose helpers ----------
  function getTogglePurposes() {
    return {
      Essential: true,
      Functional: toggleFunctional.checked,
      Analytics: toggleAnalytics.checked,
      Advertising: toggleAdvertising.checked,
    };
  }

  function setTogglesFromPurposes(purposes) {
    toggleFunctional.checked = Boolean(purposes.Functional);
    toggleAnalytics.checked = Boolean(purposes.Analytics);
    toggleAdvertising.checked = Boolean(purposes.Advertising);
  }

  // ---------- Consent actions ----------
  function acceptAll(event) {
    const purposes = { Essential: true, Functional: true, Analytics: true, Advertising: true };

    if (hasAirgap() && typeof window.airgap.optIn === "function") {
      // Real Transcend integration: opt the user into all configured purposes.
      window.airgap.optIn({ interaction: event });
    } else {
      writeMockConsent({ confirmed: true, purposes, updatedAt: Date.now() });
    }

    setTogglesFromPurposes(purposes);
    hideBanner();
    closeModal();
  }

  function rejectAll(event) {
    const purposes = { Essential: true, Functional: false, Analytics: false, Advertising: false };

    if (hasAirgap() && typeof window.airgap.optOut === "function") {
      // Real Transcend integration: opt the user out of all non-essential purposes.
      window.airgap.optOut({ interaction: event });
    } else {
      writeMockConsent({ confirmed: true, purposes, updatedAt: Date.now() });
    }

    setTogglesFromPurposes(purposes);
    hideBanner();
    closeModal();
  }

  function savePreferences(event) {
    const purposes = getTogglePurposes();

    if (hasAirgap() && typeof window.airgap.setConsent === "function") {
      // Real Transcend integration: persist the specific purpose selections.
      window.airgap.setConsent(event, { purposes });
    } else {
      writeMockConsent({ confirmed: true, purposes, updatedAt: Date.now() });
    }

    hideBanner();
    closeModal();
  }

  // ---------- Init ----------
  function init() {
    const existing = readMockConsent();
    if (existing && existing.purposes) {
      setTogglesFromPurposes(existing.purposes);
    }

    if (!consentAlreadyGiven()) {
      showBanner();
    }
  }

  function initAirgapIntegration() {
    // Real Transcend integration point: wait for airgap.js to be ready before
    // trusting its consent state, then decide whether to show the banner.
    if (hasAirgap() && typeof window.airgap.ready === "function") {
      window.airgap.ready(() => {
        if (!consentAlreadyGiven()) {
          showBanner();
        } else {
          hideBanner();
        }
      });
    }
  }

  openSettingsBtn.addEventListener("click", openModal);
  closeSettingsBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  acceptAllBtn.addEventListener("click", (e) => acceptAll(e));
  modalAcceptAllBtn.addEventListener("click", (e) => acceptAll(e));
  rejectAllBtn.addEventListener("click", (e) => rejectAll(e));
  savePreferencesBtn.addEventListener("click", (e) => savePreferences(e));

  resetConsentBtn.addEventListener("click", () => {
    clearMockConsent();
    setTogglesFromPurposes({ Functional: false, Analytics: false, Advertising: false });
    showBanner();
    closeModal();
  });

  init();
  initAirgapIntegration();
})();
