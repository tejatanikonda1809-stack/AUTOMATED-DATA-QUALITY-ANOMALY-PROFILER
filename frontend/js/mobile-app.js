/* mobile-app.js
 * Mobile app detection and drawer navigation.
 * Only active inside the CleanCore Expo WebView.
 * NEVER modifies desktop layout or behaviour.
 *
 * Detection (any one is enough):
 *   1. window.__CLEANCORE_MOBILE_APP__ === true   (set by injectedJavaScriptBeforeContentLoaded)
 *   2. navigator.userAgent includes "CleanCoreMobile"  (applicationNameForUserAgent)
 *   3. URL search param ?app=mobile
 */

// ── Detection ──────────────────────────────────────────────────────────────
function detectMobileApp() {
  try {
    if (window.__CLEANCORE_MOBILE_APP__ === true) return true;
  } catch (_) {}
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("CleanCoreMobile")) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "mobile") return true;
  } catch (_) {}
  return false;
}

export const isMobileApp = detectMobileApp();

// Persist the flag in sessionStorage so it survives client-side SPA navigation
// (the URL changes when the app navigates between sections, losing ?app=mobile)
if (isMobileApp) {
  try { sessionStorage.setItem("cleancore_mobile_app", "1"); } catch (_) {}
} else {
  // Check if we already flagged it earlier in this session
  try {
    if (sessionStorage.getItem("cleancore_mobile_app") === "1") {
      // Re-export as true even without reassignment — we add the class below
      Object.defineProperty(window, "__CLEANCORE_MOBILE_APP__", { value: true, writable: false });
    }
  } catch (_) {}
}

const _isMobileApp = isMobileApp || (() => {
  try { return sessionStorage.getItem("cleancore_mobile_app") === "1"; } catch (_) { return false; }
})();

// ── Apply html.mobile-app class ───────────────────────────────────────────
if (_isMobileApp) {
  document.documentElement.classList.add("mobile-app");
}

// ── Drawer state ───────────────────────────────────────────────────────────
let drawerOpen = false;
let drawerEl = null;
let backdropEl = null;

function openDrawer() {
  if (!drawerEl) return;
  drawerOpen = true;
  drawerEl.classList.add("open");
  backdropEl && backdropEl.classList.add("open");
  const btn = document.getElementById("mobile-menu-btn");
  if (btn) {
    btn.setAttribute("aria-expanded", "true");
    btn.querySelector(".menu-icon").style.display = "none";
    btn.querySelector(".close-icon").style.display = "block";
  }
  document.addEventListener("keydown", handleEsc);
}

function closeDrawer() {
  if (!drawerEl) return;
  drawerOpen = false;
  drawerEl.classList.remove("open");
  backdropEl && backdropEl.classList.remove("open");
  const btn = document.getElementById("mobile-menu-btn");
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.querySelector(".menu-icon").style.display = "block";
    btn.querySelector(".close-icon").style.display = "none";
  }
  document.removeEventListener("keydown", handleEsc);
}

function handleEsc(e) {
  if (e.key === "Escape") closeDrawer();
}

// ── Inject hamburger button into topbar ────────────────────────────────────
function injectHamburger() {
  const actions = document.querySelector(".topbar-actions");
  if (!actions || document.getElementById("mobile-menu-btn")) return;

  const btn = document.createElement("button");
  btn.id = "mobile-menu-btn";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "mobile-drawer");
  btn.setAttribute("type", "button");

  // Three-line (hamburger) icon
  btn.innerHTML = `
    <span class="menu-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </span>
    <span class="close-icon" aria-hidden="true" style="display:none">
      <svg viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6"  y1="6" x2="18" y2="18"/>
      </svg>
    </span>
  `;

  btn.addEventListener("click", () => {
    drawerOpen ? closeDrawer() : openDrawer();
  });

  // Insert hamburger as the LAST item in topbar-actions (right-most)
  actions.appendChild(btn);
}

// ── Build the drawer DOM ───────────────────────────────────────────────────
function buildDrawer() {
  // Backdrop
  if (!document.getElementById("mobile-drawer-backdrop")) {
    backdropEl = document.createElement("div");
    backdropEl.id = "mobile-drawer-backdrop";
    backdropEl.addEventListener("click", closeDrawer);
    document.body.appendChild(backdropEl);
  } else {
    backdropEl = document.getElementById("mobile-drawer-backdrop");
  }

  // Drawer panel
  if (document.getElementById("mobile-drawer")) {
    drawerEl = document.getElementById("mobile-drawer");
    return;
  }

  drawerEl = document.createElement("div");
  drawerEl.id = "mobile-drawer";
  drawerEl.setAttribute("role", "navigation");
  drawerEl.setAttribute("aria-label", "Mobile navigation drawer");

  drawerEl.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-brand">
        <div class="drawer-brand-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <div class="drawer-title">CleanCore</div>
          <div class="drawer-subtitle">Data Quality &amp; Profiler</div>
        </div>
      </div>
      <button id="mobile-drawer-close" aria-label="Close navigation drawer" type="button">
        <svg viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="mobile-drawer-mode-badge" class="mode-badge" style="display:none"></div>
    <nav id="mobile-drawer-nav" class="drawer-nav" aria-label="Section navigation"></nav>
  `;

  document.body.appendChild(drawerEl);

  document.getElementById("mobile-drawer-close").addEventListener("click", closeDrawer);
}

// ── Sync drawer nav from the live sidebar ─────────────────────────────────
// Called every time renderSidebar() runs in app.js (we monkey-patch it below).
function syncDrawerNav() {
  if (!drawerEl) return;

  // Copy the sidebar nav HTML directly — already has correct active states
  const sidebarNav = document.getElementById("sidebar-nav");
  const drawerNav  = document.getElementById("mobile-drawer-nav");
  if (sidebarNav && drawerNav) {
    drawerNav.innerHTML = sidebarNav.innerHTML;

    // Wire nav-item clicks: navigate then close drawer
    drawerNav.querySelectorAll(".nav-item[data-page]").forEach(el => {
      el.addEventListener("click", () => {
        closeDrawer();
        // The original sidebar wireNav() will have already fired on the sidebar
        // element. We trigger navigation via the sidebar element click instead
        // of duplicating routing logic.
        const twin = sidebarNav.querySelector(
          `.nav-item[data-page="${el.dataset.page}"]` +
          (el.dataset.dataset ? `[data-dataset="${el.dataset.dataset}"]` : `:not([data-dataset])`)
        );
        if (twin) twin.click();
      });
    });
  }

  // Sync mode badge
  const modeBadgeSource = document.getElementById("mode-badge");
  const modeBadgeDest   = document.getElementById("mobile-drawer-mode-badge");
  if (modeBadgeSource && modeBadgeDest) {
    modeBadgeDest.innerHTML = modeBadgeSource.innerHTML;
    modeBadgeDest.style.display = modeBadgeSource.innerHTML.trim() ? "" : "none";
  }
}

// ── Monkey-patch app.js renderSidebar so drawer stays in sync ─────────────
// We wait for app.js to export renderSidebar, then wrap it.
// Since app.js uses ES modules and calls renderSidebar internally,
// we use a MutationObserver on the sidebar-nav element instead,
// which fires after every renderSidebar() call.
function watchSidebar() {
  const sidebarNav = document.getElementById("sidebar-nav");
  if (!sidebarNav) return;

  const observer = new MutationObserver(() => {
    syncDrawerNav();
  });
  observer.observe(sidebarNav, { childList: true, subtree: true, characterData: true });

  // Initial sync
  syncDrawerNav();
}

// ── Entry point ────────────────────────────────────────────────────────────
export function initMobileApp() {
  if (!_isMobileApp) return;

  injectHamburger();
  buildDrawer();
  watchSidebar();
}

