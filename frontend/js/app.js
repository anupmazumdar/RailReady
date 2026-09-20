// RailReady Core Application Engine
let activeJourney = null, openingTimeIso = null, countdownInterval = null;
let notifiedMilestones = new Set(), currentView = "dashboard";
let lastSearchResults = [], currentSearchCategory = "ALL";
let jpAutoDiscoveredTrains = [], currentJpCategory = "ALL";
let preparedPassengers = [], textareaFormats = { dash: "full", view: "full" };

// DOM Query Shortcuts & Event Binding
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const on = (id, evt, fn) => $(id)?.addEventListener(evt, fn);
const pad = v => String(v).padStart(2, "0");

// Initialize on DOM Load
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initStationDatalist();
    setupStationAutocomplete("search-input-from", "dropdown-search-from");
    setupStationAutocomplete("search-input-to", "dropdown-search-to");
    setDefaultDates();
    setupNavigation();
    setupEventListeners();
    fetchSystemStatus();
    loadLatestJourney();
    loadPassengers();
    loadChecklist();
    loadSearchHistory();
    loadSavedTickets();
    loadAlerts();
});

// Setup Stations Datalist
function initStationDatalist() {
    const dataList = $("station-list");
    if (!dataList || typeof MAJOR_STATIONS === "undefined") return;
    dataList.innerHTML = MAJOR_STATIONS.map(st => `<option value="${st.code} - ${st.name}">`).join("");
}

// Default Journey Dates to Tomorrow
function setDefaultDates() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formatted = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    ["search-input-date", "jp-journey-date"].forEach(id => {
        const el = $(id);
        if (el) { el.value = formatted; el.min = formatted; }
    });
}

// View Navigation Switcher
window.switchView = function(viewName) {
    currentView = viewName;
    $$(".nav-tab").forEach(tab => {
        const active = tab.getAttribute("data-view") === viewName;
        tab.classList.toggle("active", active);
        if (active) {
            try { tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch (e) {}
        }
    });
    $$(".view-panel").forEach(p => p.classList.toggle("active", p.id === `view-${viewName}`));
    window.scrollTo({ top: 0, behavior: "smooth" });
};

function setupNavigation() {
    const mainNav = $("main-nav"), sLeft = $("nav-scroll-left"), sRight = $("nav-scroll-right");
    $$(".nav-tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.getAttribute("data-view"))));

    if (mainNav) {
        mainNav.addEventListener("wheel", e => { if (e.deltaY) { e.preventDefault(); mainNav.scrollLeft += e.deltaY; } }, { passive: false });
        sLeft?.addEventListener("click", () => mainNav.scrollBy({ left: -220, behavior: "smooth" }));
        sRight?.addEventListener("click", () => mainNav.scrollBy({ left: 220, behavior: "smooth" }));

        const updateArrows = () => {
            if (!sLeft || !sRight) return;
            const overflow = mainNav.scrollWidth > mainNav.clientWidth + 2;
            sLeft.disabled = !overflow || mainNav.scrollLeft <= 5;
            sRight.disabled = !overflow || (mainNav.scrollLeft + mainNav.clientWidth) >= (mainNav.scrollWidth - 5);
            sLeft.style.opacity = sLeft.disabled ? "0.3" : "1";
            sRight.style.opacity = sRight.disabled ? "0.3" : "1";
        };
        mainNav.addEventListener("scroll", updateArrows);
        window.addEventListener("resize", updateArrows);
        setTimeout(updateArrows, 150);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    on("btn-execute-search", "click", handleTrainSearch);

    // Filter pill setup helper
    const setupPills = (containerId, cb) => {
        $$(containerId + " .category-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                $$(containerId + " .category-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                cb(pill.getAttribute("data-cat") || "ALL");
            });
        });
    };
    setupPills("#search-category-filters", cat => { currentSearchCategory = cat; renderSearchResults(); });
    setupPills("#jp-category-filters", cat => { currentJpCategory = cat; renderJpAutoTrains(); });

    // Route inputs debouncer helper
    const attachRouteDebounce = (fromId, toId, cb) => {
        let timer;
        const handler = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const f = $(fromId)?.value.trim(), t = $(toId)?.value.trim();
                if (f && t && f.length >= 2 && t.length >= 2) cb(f, t);
            }, 350);
        };
        [fromId, toId].forEach(id => {
            const el = $(id);
            if (el) { el.addEventListener("input", handler); el.addEventListener("change", handler); }
        });
    };

    attachRouteDebounce("jp-from-station", "jp-to-station", (f, t) => autoDiscoverJourneyTrains(f, t, true));
    on("btn-theme-toggle", "click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(cur === "dark" ? "light" : "dark");
    });
    on("btn-search-swap", "click", handleSearchStationSwap);
    on("btn-check-pnr", "click", () => { const v = $("pnr-input-field")?.value; checkPNRStatus(v); });
    $("pnr-input-field")?.addEventListener("keydown", (e) => { if (e.key === "Enter") checkPNRStatus($("pnr-input-field")?.value); });
    on("btn-load-coach-layout", "click", () => { const v = $("coach-train-input")?.value.trim(); if (v) loadCoachLayout(v); });
    $("search-sort-select")?.addEventListener("change", renderSearchResults);
    on("btn-clear-history-desktop", "click", clearSearchHistoryAction);
    on("btn-clear-history-settings", "click", clearSearchHistoryAction);

    on("btn-jp-auto-assign-top3", "click", () => assignTop3TrainsToJourneySlots(true));
    on("btn-load-details", "click", () => { const v = $("details-train-input")?.value.trim(); if (v) loadTrainDetails(v); });
    on("btn-load-running-status", "click", () => { const v = $("status-train-input")?.value.trim(); if (v) loadRunningStatus(v); });
    on("btn-load-timeline", "click", () => { const v = $("timeline-train-input")?.value.trim(); if (v) loadRouteTimeline(v); });

    on("form-journey-main", "submit", handleJourneyPlannerSubmit);
    on("form-view-add-passenger", "submit", handlePassengerSubmit);
    on("btn-dash-copy-passengers", "click", copyAllPassengerDetails);
    on("btn-view-copy-all-passengers", "click", copyAllPassengerDetails);

    // Textarea click-to-select
    ["dash-passenger-textarea", "view-passenger-textarea"].forEach(id => {
        $(id)?.addEventListener("click", function() { this.select(); });
    });

    on("btn-tatkal-reset-checklist", "click", resetChecklist);
    on("btn-clear-all-passengers", "click", async () => {
        if (confirm("Clear all prepared passenger records?")) {
            await fetch("/api/passengers", { method: "DELETE" });
            loadPassengers();
            showToast("🗑️ Passenger records cleared.");
        }
    });

    on("btn-test-chime-view", "click", () => { playAlertChime(); showToast("🔔 Test chime played!"); });
    on("btn-test-notification-view", "click", () => { triggerNotification("RailReady Alert", "Test notification."); showToast("🔔 Notification sent!"); });

    // Modal
    const modal = $("modal-irctc-guide");
    on("btn-manual-irctc", "click", () => modal?.classList.add("active"));
    on("btn-tatkal-manual-modal", "click", () => modal?.classList.add("active"));
    on("btn-close-modal", "click", () => modal?.classList.remove("active"));
    on("btn-modal-done", "click", () => modal?.classList.remove("active"));
    modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("active"); });
    on("btn-copy-url", "click", () => { copyToClipboard("https://www.irctc.co.in/"); showToast("🌐 IRCTC URL copied!"); });
}

// Fetch System Status & IST Clock
async function fetchSystemStatus() {
    try {
        const res = await fetch("/api/status");
        if (!res.ok) return;
        const data = await res.json();
        const timeEl = $("current-ist-time");
        if (timeEl) timeEl.textContent = data.current_time_ist || "Online (IST)";
        setInterval(() => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const ist = new Date(utc + (3600000 * 5.5));
            if (timeEl) timeEl.textContent = `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())} ${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`;
        }, 1000);
    } catch (e) {}
}

// Category Badge Helper
function getCategoryBadge(tType) {
    const t = (tType || "").toLowerCase();
    if (t.includes("rajdhani")) return `<span class="badge-category badge-category-rajdhani">👑 Rajdhani</span>`;
    if (t.includes("special")) return `<span class="badge-category badge-category-special">⭐ Special</span>`;
    if (t.includes("mail") || t.includes("express") || t.includes("superfast")) return `<span class="badge-category badge-category-mail">⚡ Mail / Express</span>`;
    if (t.includes("passenger") || t.includes("local") || t.includes("memu")) return `<span class="badge-category badge-category-passenger">🚉 Passenger / Local</span>`;
    return `<span class="badge-tag badge-tag-blue">${escapeHtml(tType)}</span>`;
}

function matchesCategory(tType, category) {
    if (!category || category === "ALL") return true;
    const t = (tType || "").toLowerCase();
    if (category === "Rajdhani") return t.includes("rajdhani");
    if (category === "Special") return t.includes("special");
    if (category === "Mail/Express") return t.includes("mail") || t.includes("express") || t.includes("superfast");
    if (category === "Passenger") return t.includes("passenger") || t.includes("local") || t.includes("memu");
    return true;
}

function updateCategoryCounts(prefix, trains) {
    const set = (id, n) => { const el = $(`${prefix}-cat-count-${id}`); if (el) el.textContent = n; };
    set("all", trains.length);
    set("raj", trains.filter(t => matchesCategory(t.train_type, "Rajdhani")).length);
    set("spec", trains.filter(t => matchesCategory(t.train_type, "Special")).length);
    set("mail", trains.filter(t => matchesCategory(t.train_type, "Mail/Express")).length);
    set("pass", trains.filter(t => matchesCategory(t.train_type, "Passenger")).length);
}

// ================= TRAIN INFORMATION & SEARCH =================
async function handleTrainSearch() {
    const q = $("search-input-query")?.value.trim() || "";
    const from = $("search-input-from")?.value.trim() || "";
    const to = $("search-input-to")?.value.trim() || "";
    const date = $("search-input-date")?.value || "";

    const params = new URLSearchParams();
    if (q) params.append("query", q);
    if (from) params.append("from_station", from);
    if (to) params.append("to_station", to);
    if (date) params.append("journey_date", date);

    showToast("🔍 Searching train database...");
    const container = $("search-results-container");

    try {
        const res = await fetch(`/api/trains/search?${params.toString()}`);
        if (!res.ok) throw new Error("Search failed");
        const trains = await res.json();
        lastSearchResults = trains;
        updateCategoryCounts("search", trains);
        renderSearchResults();
        showToast(`✅ Found ${trains.length} trains!`);

        // Record search history if route specified
        if (from || to || q) {
            recordSearchHistory({
                train_number: q && /^\d+$/.test(q) ? q : (trains[0]?.train_number || null),
                train_name: trains[0]?.train_name || null,
                from_station: from || trains[0]?.source_code || "ALL",
                to_station: to || trains[0]?.dest_code || "ALL",
                journey_date: date || null
            });
        }
    } catch (err) {
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;">Error searching trains. Please check inputs.</div>`;
    }
}

function renderSearchResults() {
    const container = $("search-results-container");
    const countEl = $("search-count");
    const sortVal = $("search-sort-select")?.value || "DEFAULT";
    if (!container) return;

    let filtered = lastSearchResults.filter(t => matchesCategory(t.train_type, currentSearchCategory));

    // Sort options
    if (sortVal === "DEP_ASC") {
        filtered.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    } else if (sortVal === "ARR_ASC") {
        filtered.sort((a, b) => a.arrival_time.localeCompare(b.arrival_time));
    } else if (sortVal === "DUR_ASC") {
        const getDurMins = d => {
            const h = parseInt(d.split("h")[0] || "0", 10);
            const m = parseInt((d.split("h")[1] || "").replace("m", "").trim() || "0", 10);
            return h * 60 + m;
        };
        filtered.sort((a, b) => getDurMins(a.duration) - getDurMins(b.duration));
    }

    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No matching trains found in category '${currentSearchCategory}'.</div>`;
        return;
    }

    container.innerHTML = filtered.map(t => {
        let statusMsg = "Runs on schedule";
        if (t.train_number === "12307") statusMsg = "Left DHN at 03:32 AM • Running 12m late";
        else if (t.train_number === "12987") statusMsg = "Left DHN at 03:15 AM • Right Time";
        else if (t.train_number === "63556") statusMsg = "Arrived DHN at 06:50 AM";
        else if (t.train_type === "Rajdhani") statusMsg = "On-time performance • High priority";

        return `
            <div class="train-result-card" id="train-card-${t.train_number}">
                <div class="train-card-top">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="train-tag" style="font-size: 1rem;">${t.train_number}</span>
                        <strong style="font-size: 1.05rem; color: #fff;">${escapeHtml(t.train_name)}</strong>
                        ${getCategoryBadge(t.train_type)}
                    </div>
                    <div class="train-badge-group">
                        <span class="badge-tag badge-tag-blue">${t.classes.join(", ")}</span>
                        <span class="badge-tag badge-tag-green">${t.running_days.join(" ")}</span>
                    </div>
                </div>
                <div class="train-route-visual">
                    <div class="route-stop-point"><div class="route-stop-time">${t.departure_time}</div><div class="route-stop-station">${t.source_name} (${t.source_code})</div></div>
                    <div class="route-duration-line"><span class="route-duration-text">${t.duration}</span></div>
                    <div class="route-stop-point"><div class="route-stop-time">${t.arrival_time}</div><div class="route-stop-station">${t.dest_name} (${t.dest_code})</div></div>
                </div>
                <div style="background: rgba(11, 15, 25, 0.4); padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 6px;">
                    <span style="color: #34d399; font-weight: 600;">⚡ Status: ${statusMsg}</span>
                    <span style="color: var(--text-dim); font-size: 0.75rem;">Source: Verified Reference Schedule</span>
                </div>
                <div class="train-card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY')">📌 Set as Primary</button>
                    <button class="btn btn-primary btn-sm" onclick="viewTrainDetailsTab('${t.train_number}')">🚆 Details</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">📍 Live Status</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')">🗺️ Route</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewCoachLayoutTab('${t.train_number}')">💺 Coach Layout</button>
                </div>
            </div>
        `;
    }).join("");
}

// ================= JOURNEY PLANNER AUTO-DISCOVERY =================
async function autoDiscoverJourneyTrains(fromStation, toStation, autoPopulateIfEmpty = false) {
    const listContainer = $("jp-auto-trains-list");
    if (!listContainer) return;
    listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">⚡ Automatically discovering Special, Rajdhani, Mail/Express, and Passenger trains...</div>`;

    const params = new URLSearchParams({ from_station: fromStation, to_station: toStation });
    try {
        const res = await fetch(`/api/trains/search?${params.toString()}`);
        if (!res.ok) throw new Error("Search failed");
        const trains = await res.json();
        jpAutoDiscoveredTrains = trains;
        updateCategoryCounts("jp", trains);
        renderJpAutoTrains();

        const pInput = $("jp-primary-train");
        if (autoPopulateIfEmpty && pInput && !pInput.value && trains.length) {
            assignTop3TrainsToJourneySlots(false);
        }
    } catch (err) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 14px;">Could not discover trains for route.</div>`;
    }
}

function renderJpAutoTrains() {
    const list = $("jp-auto-trains-list");
    if (!list) return;

    const pVal = $("jp-primary-train")?.value || "", a1Val = $("jp-alt1-train")?.value || "", a2Val = $("jp-alt2-train")?.value || "";
    const filtered = jpAutoDiscoveredTrains.filter(t => matchesCategory(t.train_type, currentJpCategory));

    if (!filtered.length) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">No trains found for '${currentJpCategory}'.</div>`;
        return;
    }

    list.innerHTML = filtered.map(t => {
        let assignedSlot = null;
        if (pVal.includes(t.train_number)) assignedSlot = "PRIMARY";
        else if (a1Val.includes(t.train_number)) assignedSlot = "ALT 1";
        else if (a2Val.includes(t.train_number)) assignedSlot = "ALT 2";

        return `
            <div class="auto-train-card ${assignedSlot ? 'is-assigned' : ''}" id="auto-train-${t.train_number}">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="color: #fff; font-size: 0.95rem;">${t.train_number} - ${escapeHtml(t.train_name)}</strong>
                        ${getCategoryBadge(t.train_type)}
                        ${assignedSlot ? `<span class="badge-tag badge-tag-green" style="font-weight: 700;">✓ ASSIGNED AS ${assignedSlot}</span>` : ''}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <span>Dep: <strong>${t.departure_time}</strong> (${t.source_code})</span>➔<span>Arr: <strong>${t.arrival_time}</strong> (${t.dest_code})</span>
                        <span>⏱️ ${t.duration}</span><span>Classes: <strong>${t.classes.join(", ")}</strong></span>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY')">📌 Primary</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT1')">🔁 Alt 1</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT2')">🔀 Alt 2</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')">🗺️ Route</button>
                </div>
            </div>
        `;
    }).join("");
}

function assignTop3TrainsToJourneySlots(showToastMsg = true) {
    if (!jpAutoDiscoveredTrains?.length) {
        if (showToastMsg) showToast("⚠️ Enter From & To stations first.");
        return;
    }
    const raj = jpAutoDiscoveredTrains.find(t => t.train_type === "Rajdhani");
    const spec = jpAutoDiscoveredTrains.find(t => t.train_type === "Special");
    const mail = jpAutoDiscoveredTrains.find(t => ["Mail/Express", "Superfast"].includes(t.train_type));
    const pass = jpAutoDiscoveredTrains.find(t => ["Passenger", "Local"].includes(t.train_type));

    const p = raj || jpAutoDiscoveredTrains[0];
    const a1 = spec || jpAutoDiscoveredTrains.find(t => t.train_number !== p.train_number);
    const a2 = mail || pass || jpAutoDiscoveredTrains.find(t => t.train_number !== p.train_number && (!a1 || t.train_number !== a1.train_number));

    const setInput = (id, train) => { if (train && $(id)) $(id).value = `${train.train_number} - ${train.train_name}`; };
    setInput("jp-primary-train", p);
    setInput("jp-alt1-train", a1);
    setInput("jp-alt2-train", a2);

    renderJpAutoTrains();
    if (showToastMsg) showToast("✨ Auto-assigned optimal Primary, Alt 1, and Alt 2 trains!");
}

window.quickAssignTrain = function(num, name, src, dst, slot) {
    const full = `${num} - ${name}`;
    const fIn = $("jp-from-station"), tIn = $("jp-to-station");
    if (src && fIn && !fIn.value) fIn.value = src;
    if (dst && tIn && !tIn.value) tIn.value = dst;

    if (slot === "PRIMARY") { if ($("jp-primary-train")) $("jp-primary-train").value = full; showToast(`📌 Set ${num} as Primary Train!`); }
    else if (slot === "ALT1") { if ($("jp-alt1-train")) $("jp-alt1-train").value = full; showToast(`🔄 Set ${num} as Alt 1!`); }
    else if (slot === "ALT2") { if ($("jp-alt2-train")) $("jp-alt2-train").value = full; showToast(`🔄 Set ${num} as Alt 2!`); }

    renderJpAutoTrains();
};

window.viewTrainDetailsTab = function(num) { if ($("details-train-input")) $("details-train-input").value = num; switchView("train-details"); loadTrainDetails(num); };
window.viewRunningStatusTab = function(num) { if ($("status-train-input")) $("status-train-input").value = num; switchView("running-status"); loadRunningStatus(num); };
window.viewRouteTimelineTab = function(num) { if ($("timeline-train-input")) $("timeline-train-input").value = num; switchView("route-timeline"); loadRouteTimeline(num); };

// Load Details, Status, Timeline
async function loadTrainDetails(trainNumber) {
    const c = $("train-details-content");
    if (c) c.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading train details...</div>`;
    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}`);
        if (!res.ok) throw new Error();
        const t = await res.json();
        c.innerHTML = `
            <div style="background: rgba(11, 15, 25, 0.5); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div><span class="train-tag" style="font-size: 1.2rem;">${t.train_number}</span><h3 style="display: inline-block; font-size: 1.2rem; color: #fff; margin-left: 8px;">${escapeHtml(t.train_name)}</h3></div>
                    <div class="train-badge-group"><span class="badge-tag badge-tag-blue">${t.train_type}</span><span class="badge-tag badge-tag-green">${t.pantry ? 'Pantry Car' : 'No Pantry'}</span></div>
                </div>
                <div class="form-row" style="margin-top: 14px; font-size: 0.9rem;">
                    <div><strong>Origin:</strong> ${t.source_name} (${t.source_code}) at ${t.departure_time}</div>
                    <div><strong>Destination:</strong> ${t.dest_name} (${t.dest_code}) at ${t.arrival_time}</div>
                    <div><strong>Distance:</strong> ${t.total_distance_km} km</div><div><strong>Duration:</strong> ${t.duration}</div>
                    <div><strong>Days:</strong> ${t.running_days.join(", ")}</div><div><strong>Classes:</strong> ${t.classes.join(", ")}</div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY'); switchView('journey-planner');">Use in Journey Planner</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">Track Live Status ➔</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewCoachLayoutTab('${t.train_number}')">💺 View Coach Layout</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')">🗺️ Station Timeline</button>
                </div>
            </div>
            <h4 style="color: #93c5fd; font-size: 1rem; margin-bottom: 12px;">Station Halts & Schedule (${t.stops.length} Stops)</h4>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead><tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); text-align: left;"><th style="padding: 8px;">#</th><th style="padding: 8px;">Station</th><th style="padding: 8px;">Arr</th><th style="padding: 8px;">Dep</th><th style="padding: 8px;">Halt</th><th style="padding: 8px;">Day</th><th style="padding: 8px;">PF</th><th style="padding: 8px;">Distance</th></tr></thead>
                    <tbody>${t.stops.map((s, idx) => `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);"><td style="padding: 8px; color: var(--text-dim);">${idx + 1}</td><td style="padding: 8px;"><strong>${s.station_code}</strong> - ${escapeHtml(s.station_name)}</td><td style="padding: 8px; font-family: var(--font-mono);">${s.scheduled_arrival}</td><td style="padding: 8px; font-family: var(--font-mono);">${s.scheduled_departure}</td><td style="padding: 8px;">${s.halt_minutes > 0 ? s.halt_minutes + ' min' : '--'}</td><td style="padding: 8px;">Day ${s.day_of_journey}</td><td style="padding: 8px; color: #a7f3d0;">${s.platform || 'PF 1'}</td><td style="padding: 8px; color: var(--text-dim);">${s.distance_km} km</td></tr>`).join("")}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        c.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not load train #${escapeHtml(trainNumber)}.</div>`;
    }
}

let statusFetchTime = null;
let freshnessInterval = null;

function startFreshnessTicker() {
    if (freshnessInterval) clearInterval(freshnessInterval);
    const updateFreshness = () => {
        if (!statusFetchTime) return;
        const diffSec = Math.max(0, Math.floor((Date.now() - statusFetchTime) / 1000));
        let text = "Updated just now";
        if (diffSec >= 60) text = `Updated ${Math.floor(diffSec / 60)} min ago`;
        else if (diffSec > 0) text = `Updated ${diffSec} seconds ago`;
        const el1 = $("running-status-freshness");
        if (el1) el1.textContent = text;
        const el2 = $("m-route-freshness");
        if (el2) el2.textContent = text;
    };
    updateFreshness();
    freshnessInterval = setInterval(updateFreshness, 1000);
}

async function loadRunningStatus(trainNumber) {
    const c = $("running-status-content");
    if (c) c.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Querying running status...</div>`;
    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}/status`);
        if (!res.ok) throw new Error();
        const s = await res.json();
        const delayed = s.delay_minutes > 0;
        statusFetchTime = Date.now();
        startFreshnessTicker();

        c.innerHTML = `
            <div class="live-status-hero ${delayed ? 'delayed' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div class="live-status-title"><span>🛰️</span><span>${s.train_number} - ${escapeHtml(s.train_name)}</span></div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="badge-tag ${delayed ? 'badge-tag-blue' : 'badge-tag-green'}">${s.current_status}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(11, 15, 25, 0.6); padding: 8px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin: 12px 0; flex-wrap: wrap; gap: 8px;">
                    <div class="freshness-box">
                        <span class="freshness-pulse"></span>
                        <span id="running-status-freshness">Updated just now</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="loadRunningStatus('${s.train_number}')">🔄 Refresh Status</button>
                        <button class="btn btn-secondary btn-sm" onclick="viewCoachLayoutTab('${s.train_number}')">💺 Coach Layout</button>
                    </div>
                </div>

                <div class="form-row" style="margin-top: 14px;">
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">CURRENT LOCATION</div><div style="font-size: 1.25rem; font-weight: 700; color: #60a5fa;">${s.current_station_name} (${s.current_station})</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">DELAY STATUS</div><div style="font-size: 1.25rem; font-weight: 700; color: ${delayed ? '#fcd34d' : '#34d399'};">${s.delay_status}</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">NEXT STATION</div><div style="font-size: 1.1rem; font-weight: 600; color: #f8fafc;">${s.next_station_name ? s.next_station_name + ' (' + s.next_station + ')' : 'Approaching Destination'}</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">STATUS TIME</div><div style="font-size: 0.95rem; font-family: var(--font-mono); color: #cbd5e1;">${s.last_updated}</div></div>
                </div>
                <div class="live-disclaimer-note">* Verified reference simulation. Verify official travel information via NTES / Helpline 139.</div>
            </div>
            <h4 style="color: #93c5fd; font-size: 1rem; margin-bottom: 12px;">Station Progress Timeline</h4>
            <div class="route-timeline-tree">${s.timeline.map(st => `<div class="timeline-station-node ${st.has_departed ? 'departed' : ''} ${st.station_code === s.current_station ? 'current-station' : ''}"><div style="display: flex; justify-content: space-between; align-items: center;"><div><strong style="color: #fff;">${st.station_code} - ${escapeHtml(st.station_name)}</strong><span style="font-size: 0.78rem; color: #a7f3d0; margin-left: 8px;">${st.platform || 'PF 1'}</span>${st.has_departed ? '<span style="font-size: 0.75rem; color: #34d399; margin-left: 8px;">✓ Departed</span>' : ''}${st.station_code === s.current_station ? '<span style="font-size: 0.75rem; color: #f59e0b; margin-left: 8px;">📍 Train Here</span>' : ''}</div><div style="text-align: right; font-family: var(--font-mono); font-size: 0.85rem;"><div>Sch: Arr ${st.scheduled_arrival} | Dep ${st.scheduled_departure}</div>${st.actual_arrival ? `<div style="color: #60a5fa;">Act: Arr ${st.actual_arrival} ${st.actual_departure ? '| Dep ' + st.actual_departure : ''}</div>` : ''}</div></div></div>`).join("")}</div>
        `;
    } catch (e) {
        c.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not retrieve live status for #${escapeHtml(trainNumber)}.</div>`;
    }
}

async function loadRouteTimeline(trainNumber) {
    const c = $("route-timeline-content");
    if (c) c.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading route stops...</div>`;
    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}/route`);
        if (!res.ok) throw new Error();
        const stops = await res.json();
        c.innerHTML = `
            <div style="margin-bottom: 16px;"><h3 style="font-size: 1.1rem; color: #fff;">Route Timeline for Train #${escapeHtml(trainNumber)}</h3></div>
            <div class="route-timeline-tree">${stops.map(s => `<div class="timeline-station-node"><div style="display: flex; justify-content: space-between; align-items: center;"><div><strong style="color: #fff;">${s.station_code} - ${escapeHtml(s.station_name)}</strong><span style="font-size: 0.78rem; color: #a7f3d0; margin-left: 8px;">${s.platform || 'PF 1'}</span><span style="font-size: 0.75rem; color: var(--text-dim); margin-left: 8px;">Day ${s.day_of_journey} • ${s.distance_km} km</span></div><div style="text-align: right; font-family: var(--font-mono); font-size: 0.88rem;"><div>Arr: <strong>${s.scheduled_arrival}</strong> | Dep: <strong>${s.scheduled_departure}</strong></div><div style="font-size: 0.78rem; color: var(--text-muted);">${s.halt_minutes > 0 ? s.halt_minutes + ' min halt' : 'Start/End'}</div></div></div></div>`).join("")}</div>
        `;
    } catch (e) {
        c.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not load route for #${escapeHtml(trainNumber)}.</div>`;
    }
}

// ================= JOURNEY PLANNER & COUNTDOWN =================
async function handleJourneyPlannerSubmit(e) {
    e.preventDefault();
    const primary = $("jp-primary-train")?.value.trim();
    const payload = {
        from_station: $("jp-from-station")?.value.trim(),
        to_station: $("jp-to-station")?.value.trim(),
        journey_date: $("jp-journey-date")?.value,
        preferred_train: primary,
        preferred_class: $("jp-class")?.value,
        tatkal_type: $("jp-tatkal-type")?.value,
        primary_train: primary,
        alt_train_1: $("jp-alt1-train")?.value.trim() || null,
        alt_train_2: $("jp-alt2-train")?.value.trim() || null
    };

    try {
        const res = await fetch("/api/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) { const err = await res.json(); showToast(`⚠️ Error: ${err.detail || "Could not save journey"}`); return; }
        const data = await res.json();
        applyJourneyState(data);
        showToast("✅ Journey saved! Tatkal opening computed.");
        switchView("tatkal-prep");
    } catch (err) { showToast("⚠️ Network error saving journey."); }
}

async function loadLatestJourney() {
    try {
        const res = await fetch("/api/journey/latest");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.journey) applyJourneyState(data);
    } catch (e) {}
}

function applyJourneyState(data) {
    activeJourney = data.journey;
    openingTimeIso = data.opening_time_iso;
    if (activeJourney) {
        const setVal = (id, val) => { const el = $(id); if (el && val !== undefined) el.value = val; };
        const setText = (id, txt) => { const el = $(id); if (el && txt !== undefined) el.textContent = txt; };

        setVal("jp-from-station", activeJourney.from_station);
        setVal("jp-to-station", activeJourney.to_station);
        setVal("jp-journey-date", activeJourney.journey_date);
        setVal("jp-class", activeJourney.preferred_class);
        setVal("jp-tatkal-type", activeJourney.tatkal_type);
        setVal("jp-primary-train", activeJourney.primary_train || activeJourney.preferred_train);
        setVal("jp-alt1-train", activeJourney.alt_train_1 || "");
        setVal("jp-alt2-train", activeJourney.alt_train_2 || "");

        if (activeJourney.from_station && activeJourney.to_station) {
            autoDiscoverJourneyTrains(activeJourney.from_station, activeJourney.to_station, false);
        }

        setText("dash-primary-train-name", activeJourney.primary_train || activeJourney.preferred_train || "Not Selected");
        setText("dash-alt1-train-name", activeJourney.alt_train_1 || "None specified");
        setText("dash-alt2-train-name", activeJourney.alt_train_2 || "None specified");

        const openStr = data.opening_time || activeJourney.expected_opening_time;
        setText("dash-opening-time", openStr);
        setText("tatkal-opening-time", openStr);
    }

    if (countdownInterval) clearInterval(countdownInterval);
    notifiedMilestones.clear();
    startCountdownLoop();
}

function startCountdownLoop() {
    updateCountdownTick();
    countdownInterval = setInterval(updateCountdownTick, 1000);
}

function updateCountdownTick() {
    if (!openingTimeIso) return;
    const diffSec = Math.floor((new Date(openingTimeIso).getTime() - Date.now()) / 1000);

    const setDigit = (prefix, val) => { const el = $(prefix); if (el) el.textContent = pad(val); };
    const setBadge = (text, bg, col, border) => {
        ["dash-status-badge", "tatkal-status-badge"].forEach(id => {
            const el = $(id);
            if (el) { el.textContent = text; el.style.background = bg; el.style.color = col; el.style.borderColor = border; }
        });
    };
    const setNotice = html => {
        ["dash-countdown-message", "tatkal-countdown-message"].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
    };

    if (diffSec <= 0) {
        ["dash-timer-", "tatkal-timer-"].forEach(p => ["days", "hours", "minutes", "seconds"].forEach(k => setDigit(p + k, 0)));
        setBadge("WINDOW OPEN", "rgba(16, 185, 129, 0.2)", "#6ee7b7", "rgba(16, 185, 129, 0.5)");
        const openMsg = "Tatkal booking window is now open. Open IRCTC manually.";
        setNotice(`<strong>${openMsg}</strong>`);
        if (!notifiedMilestones.has(0)) {
            notifiedMilestones.add(0);
            playAlertChime();
            triggerNotification("Tatkal Window Open", openMsg);
        }
        return;
    }

    const d = Math.floor(diffSec / 86400), h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60), s = diffSec % 60;

    ["dash-timer-", "tatkal-timer-"].forEach(p => {
        setDigit(p + "days", d); setDigit(p + "hours", h); setDigit(p + "minutes", m); setDigit(p + "seconds", s);
    });

    const timeStr = `${d ? d + "d " : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
    setNotice(`Tatkal opening in: ${timeStr}`);

    checkMilestone(diffSec, 900, "15 Minutes Left", "15 minutes until Tatkal opening. Confirm your passenger details.");
    checkMilestone(diffSec, 300, "5 Minutes Left", "5 minutes until Tatkal opening! Prepare to open IRCTC manually.");
    checkMilestone(diffSec, 60, "1 Minute Left", "1 minute remaining! Tatkal window opens in 60 seconds.");

    if (diffSec <= 900) setBadge("OPENING SOON", "rgba(245, 158, 11, 0.2)", "#fcd34d", "rgba(245, 158, 11, 0.5)");
    else setBadge("UPCOMING", "rgba(59, 130, 246, 0.2)", "#93c5fd", "rgba(59, 130, 246, 0.5)");
}

function checkMilestone(secondsLeft, milestoneSec, title, message) {
    if (secondsLeft <= milestoneSec && !notifiedMilestones.has(milestoneSec)) {
        notifiedMilestones.add(milestoneSec);
        playAlertChime();
        triggerNotification(title, message);
        showToast(`⏰ ${title}: ${message}`);
    }
}

// ================= PASSENGERS & TEXT AREA =================
async function loadPassengers() {
    try {
        const res = await fetch("/api/passengers");
        if (!res.ok) return;
        const passengers = await res.json();
        renderPassengers(passengers);
    } catch (e) {}
}

function renderPassengers(passengers) {
    preparedPassengers = passengers || [];
    const dashList = $("dash-passenger-list"), viewList = $("view-passenger-container");
    const countEl = $("dash-passenger-count"), addPanel = $("view-add-passenger-panel");
    if (countEl) countEl.textContent = preparedPassengers.length;

    if (dashList) {
        if (!preparedPassengers.length) {
            dashList.innerHTML = `<div style="color: var(--text-dim); font-size: 0.88rem; text-align: center; padding: 16px;">No passengers prepared. Add in Passenger Details tab.</div>`;
        } else {
            dashList.innerHTML = preparedPassengers.map((p, idx) => `
                <div class="dash-passenger-item" id="dash-pass-card-${p.id || idx}">
                    <div class="dash-passenger-header">
                        <strong style="color: #fff; font-size: 0.95rem;">${idx + 1}. ${escapeHtml(p.name)}</strong>
                        <div class="passenger-meta-row">
                            <span class="meta-badge meta-badge-gender">${p.age} yrs • ${p.gender}</span>
                            <span class="meta-badge meta-badge-berth">🛏️ ${escapeHtml(p.berth_preference || 'No Preference')}</span>
                            <span class="meta-badge meta-badge-meal">🥗 ${escapeHtml(p.meal_preference || 'None')}</span>
                            ${p.senior_citizen_opt ? `<span class="meta-badge meta-badge-senior">👴 Senior Concession</span>` : ''}
                        </div>
                    </div>
                    <div class="dash-passenger-copy-row">
                        <span style="font-size: 0.74rem; color: var(--text-muted);">Quick Copy:</span>
                        <button type="button" class="copy-mini-btn" onclick="copyIndividualField('${escapeJs(p.name)}', 'Name')">📋 Name</button>
                        <button type="button" class="copy-mini-btn" onclick="copyIndividualField('${p.age}', 'Age')">📋 Age</button>
                        <button type="button" class="copy-mini-btn" onclick="copyIndividualField('${escapeJs(p.berth_preference || '')}', 'Berth')">🛏️ Berth</button>
                        <button type="button" class="copy-mini-btn" onclick="copyIndividualField('${escapeJs(p.meal_preference || '')}', 'Meal')">🥗 Meal</button>
                    </div>
                </div>
            `).join("");
        }
    }

    if (viewList) {
        if (!preparedPassengers.length) {
            viewList.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">No passengers prepared yet. Add up to 4 passengers below.</div>`;
            if (addPanel) addPanel.style.display = "block";
        } else {
            viewList.innerHTML = preparedPassengers.map((p, idx) => `
                <div class="passenger-card" id="passenger-card-${p.id}">
                    <div class="passenger-details" style="flex: 1;">
                        <div class="passenger-name" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 1.05rem; font-weight: 700; color: #fff;">${idx + 1}. ${escapeHtml(p.name)}</span>
                            <span class="meta-badge meta-badge-gender">${p.age} yrs • ${p.gender}</span>
                            <span class="meta-badge meta-badge-berth">🛏️ ${escapeHtml(p.berth_preference || 'No Preference')}</span>
                            <span class="meta-badge meta-badge-meal">🥗 ${escapeHtml(p.meal_preference || 'None')}</span>
                            ${p.senior_citizen_opt ? `<span class="meta-badge meta-badge-senior">👴 Senior Concession</span>` : ''}
                        </div>
                        <div class="passenger-sub" style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 0.78rem; color: var(--text-muted);">Name: <strong>${escapeHtml(p.name)}</strong></span>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">Age: <strong>${p.age}</strong></span>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">Gender: <strong>${p.gender}</strong></span>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">Berth: <strong>${p.berth_preference}</strong></span>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">Meal: <strong>${p.meal_preference}</strong></span>
                        </div>
                    </div>
                    <div class="passenger-actions" style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.name)}', 'Name')">📋 Name</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="copyIndividualField('${p.age}', 'Age')">📋 Age</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.berth_preference || '')}', 'Berth')">🛏️ Berth</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.meal_preference || '')}', 'Meal')">🥗 Meal</button>
                        <button type="button" class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="deletePassenger(${p.id})">✕</button>
                    </div>
                </div>
            `).join("");
            if (addPanel) addPanel.style.display = preparedPassengers.length >= 4 ? "none" : "block";
        }
    }
    updatePassengerTextareas();
}

function updatePassengerTextareas() {
    const dTa = $("dash-passenger-textarea"), vTa = $("view-passenger-textarea");
    if (dTa) dTa.value = generatePassengerText(preparedPassengers, textareaFormats.dash);
    if (vTa) vTa.value = generatePassengerText(preparedPassengers, textareaFormats.view);
}

function generatePassengerText(passengers, format = "full") {
    if (!passengers?.length) return "No passenger details prepared. Add passengers in Passenger Details tab.";
    if (format === "row") {
        return ["# | Name | Age | Gender | Berth | Meal | Senior Citizen", ...passengers.map((p, idx) => `${idx + 1}, ${p.name}, ${p.age}, ${p.gender}, ${p.berth_preference}, ${p.meal_preference}, ${p.senior_citizen_opt ? 'Yes' : 'No'}`)].join("\n");
    }
    if (format === "irctc") {
        return passengers.map((p, idx) => `${idx + 1}. ${p.name} | ${p.age}y | ${p.gender} | Berth: ${p.berth_preference} | Meal: ${p.meal_preference}${p.senior_citizen_opt ? ' | [Senior Citizen Concession]' : ''}`).join("\n");
    }
    const lines = [`=== PREPARED PASSENGERS (${passengers.length}/4) ===`];
    if (activeJourney) {
        lines.push(`Route: ${activeJourney.from_station} -> ${activeJourney.to_station} | Date: ${activeJourney.journey_date}`);
        lines.push(`Train: ${activeJourney.primary_train || activeJourney.preferred_train || 'N/A'} (${activeJourney.preferred_class || '3A'}) | Quota: Tatkal`);
        lines.push("--------------------------------------------------");
    }
    passengers.forEach((p, idx) => {
        lines.push(`Passenger ${idx + 1}:\n  Full Name:       ${p.name}\n  Age & Gender:    ${p.age} years | ${p.gender}\n  Berth Choice:    ${p.berth_preference}\n  Meal Choice:     ${p.meal_preference}\n  Senior Citizen:  ${p.senior_citizen_opt ? 'Yes (Concession Opted)' : 'No'}${idx < passengers.length - 1 ? '\n' : ''}`);
    });
    lines.push("==================================================\n* Instructions: Use these exact details to manually fill passenger fields on IRCTC portal.");
    return lines.join("\n");
}

window.switchTextareaFormat = function(prefix, format) {
    textareaFormats[prefix] = format;
    const container = $(prefix === "dash" ? "dash-textarea-wrapper" : "view-textarea-wrapper");
    container?.querySelectorAll(".format-pill").forEach(btn => btn.classList.toggle("active", btn.id === `${prefix}-pill-${format}`));
    const ta = $(`${prefix}-passenger-textarea`);
    if (ta) ta.value = generatePassengerText(preparedPassengers, format);
};

window.copyTextareaContent = function(id) {
    const ta = $(id);
    if (!ta?.value || ta.value.startsWith("No passenger")) { showToast("⚠️ No passenger details to copy."); return; }
    copyToClipboard(ta.value);
    showToast("📋 Copied all passenger details to clipboard!");
};

window.selectTextarea = function(id) {
    const ta = $(id);
    if (ta) { ta.focus(); ta.select(); showToast("🔍 All text selected! Press Ctrl+C."); }
};

async function handlePassengerSubmit(e) {
    e.preventDefault();
    const payload = {
        name: $("view-passenger-name")?.value.trim(),
        age: parseInt($("view-passenger-age")?.value, 10),
        gender: $("view-passenger-gender")?.value,
        berth_preference: $("view-passenger-berth")?.value,
        meal_preference: $("view-passenger-meal")?.value,
        senior_citizen_opt: Boolean($("view-passenger-senior")?.checked)
    };
    try {
        const res = await fetch("/api/passengers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) { const err = await res.json(); showToast(`⚠️ ${err.detail || "Could not add passenger."}`); return; }
        $("form-view-add-passenger")?.reset();
        showToast("✅ Passenger added!");
        loadPassengers();
    } catch (err) { showToast("⚠️ Network error adding passenger."); }
}

window.deletePassenger = async function(id) {
    try {
        const res = await fetch(`/api/passengers/${id}`, { method: "DELETE" });
        if (res.ok) { showToast("🗑️ Passenger removed."); loadPassengers(); }
    } catch (err) { showToast("⚠️ Error removing passenger."); }
};

window.copyIndividualField = function(val, label) { copyToClipboard(val); showToast(`📋 Copied ${label}: "${val}"`); };

async function copyAllPassengerDetails() {
    try {
        const res = await fetch("/api/clipboard/passengers");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.count) { showToast("⚠️ Please add passengers first."); return; }
        copyToClipboard(data.formatted_summary);
        showToast(`📋 Copied all ${data.count} passenger details to clipboard!`);
    } catch (err) { showToast("⚠️ Error preparing clipboard text."); }
}

// ================= CHECKLIST =================
async function loadChecklist() {
    try {
        const res = await fetch("/api/checklist");
        if (!res.ok) return;
        renderChecklist(await res.json());
    } catch (e) {}
}

function renderChecklist(items) {
    const list = $("checklist-items-container");
    if (!list) return;
    let checkedCount = 0;
    list.innerHTML = items.map(item => {
        if (item.checked) checkedCount++;
        return `
            <label class="checklist-item ${item.checked ? 'checked' : ''}" id="checklist-item-${item.key}">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleChecklistItem('${item.key}', this.checked)">
                <span class="checklist-text">${escapeHtml(item.text)}</span>
            </label>
        `;
    }).join("");

    const total = items.length, pct = total ? Math.round((checkedCount / total) * 100) : 0;
    const updateProgress = (fillId, textId) => {
        const f = $(fillId), t = $(textId);
        if (f) f.style.width = `${pct}%`;
        if (t) t.textContent = `${checkedCount} of ${total} Completed (${pct}%)`;
    };
    updateProgress("tatkal-checklist-progress-fill", "tatkal-checklist-progress-text");
    updateProgress("dash-checklist-fill", "dash-checklist-text");
}

window.toggleChecklistItem = async function(itemKey, isChecked) {
    try {
        const res = await fetch(`/api/checklist/${itemKey}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_key: itemKey, checked: isChecked }) });
        if (res.ok) loadChecklist();
    } catch (e) {}
};

async function resetChecklist() {
    try {
        const res = await fetch("/api/checklist/reset", { method: "POST" });
        if (res.ok) { showToast("↺ Checklist reset to default."); loadChecklist(); }
    } catch (e) { showToast("⚠️ Could not reset checklist."); }
}

// Helpers
function playAlertChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
}

function triggerNotification(title, message) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body: message });
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body: message }); });
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
    }
}

function showToast(msg) {
    const container = $("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast"; toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0"; toast.style.transform = "translateX(100%)"; toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeJs(str) { return str ? str.replace(/'/g, "\\'") : ""; }

// ================= THEME SYSTEM (DARK / LIGHT / SYSTEM) =================
function initTheme() {
    const savedTheme = localStorage.getItem("railready_theme") || "dark";
    applyTheme(savedTheme, false);

    // Watch system theme change if set to auto
    try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
            if (localStorage.getItem("railready_theme") === "auto") {
                applyTheme("auto", false);
            }
        });
    } catch (e) {}
}

window.applyTheme = function(theme, save = true) {
    let effective = theme;
    if (theme === "auto") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        effective = prefersDark ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", effective);
    if (save) localStorage.setItem("railready_theme", theme);

    const isDark = effective === "dark";
    const iconEl = $("theme-icon");
    const mTopIcon = $("m-top-theme-icon");
    const mDrawerIcon = $("m-drawer-theme-icon");
    const mDrawerLabel = $("m-drawer-theme-label");

    if (iconEl) iconEl.textContent = isDark ? "🌙" : "☀️";
    if (mTopIcon) mTopIcon.textContent = isDark ? "🌙" : "☀️";
    if (mDrawerIcon) mDrawerIcon.textContent = isDark ? "🌙" : "☀️";
    if (mDrawerLabel) mDrawerLabel.textContent = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";

    // Update settings theme buttons if present
    ["dark", "light", "auto"].forEach(t => {
        const btn = $(`btn-set-theme-${t}`);
        if (btn) {
            btn.classList.toggle("btn-primary", (localStorage.getItem("railready_theme") || "dark") === t);
            btn.classList.toggle("btn-secondary", (localStorage.getItem("railready_theme") || "dark") !== t);
        }
    });
};

// ================= STATION AUTOCOMPLETE WITH KEYBOARD NAV =================
function setupStationAutocomplete(inputId, dropdownId, onSelect) {
    const input = $(inputId);
    const dropdown = $(dropdownId);
    if (!input || !dropdown) return;

    let activeIdx = -1;
    let debounceTimer = null;
    let currentStations = [];

    const renderItems = (stations) => {
        currentStations = stations;
        activeIdx = -1;
        if (!stations.length) {
            dropdown.innerHTML = `<div class="station-autocomplete-item" style="color: var(--text-dim); cursor: default;">No stations found</div>`;
            dropdown.classList.add("active");
            return;
        }

        dropdown.innerHTML = stations.map((st, idx) => `
            <div class="station-autocomplete-item" data-index="${idx}">
                <span class="st-code">${escapeHtml(st.code)}</span>
                <span class="st-name">${escapeHtml(st.name)}</span>
                <span class="st-city">${escapeHtml(st.city || "")}${st.state ? ', ' + escapeHtml(st.state) : ''}</span>
            </div>
        `).join("");
        dropdown.classList.add("active");

        dropdown.querySelectorAll(".station-autocomplete-item").forEach(item => {
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const idx = parseInt(item.getAttribute("data-index"), 10);
                if (!isNaN(idx) && currentStations[idx]) {
                    chooseStation(currentStations[idx]);
                }
            });
        });
    };

    const chooseStation = (st) => {
        input.value = `${st.code} - ${st.name}`;
        dropdown.classList.remove("active");
        activeIdx = -1;
        if (onSelect) onSelect(st);
    };

    const updateActiveVisual = () => {
        const items = dropdown.querySelectorAll(".station-autocomplete-item");
        items.forEach((it, i) => {
            it.classList.toggle("active", i === activeIdx);
            if (i === activeIdx) it.scrollIntoView({ block: "nearest" });
        });
    };

    const fetchStations = (q) => {
        const url = q ? `/api/stations/search?q=${encodeURIComponent(q)}&limit=10` : `/api/stations/search?limit=10`;
        fetch(url)
            .then(res => res.ok ? res.json() : [])
            .then(data => renderItems(data))
            .catch(() => renderItems([]));
    };

    input.addEventListener("focus", () => {
        const q = input.value.split("-")[0].trim();
        fetchStations(q);
    });

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = input.value.trim();
            fetchStations(q);
        }, 180);
    });

    input.addEventListener("keydown", (e) => {
        if (!dropdown.classList.contains("active")) return;
        const items = dropdown.querySelectorAll(".station-autocomplete-item");

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % items.length;
            updateActiveVisual();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            updateActiveVisual();
        } else if (e.key === "Enter") {
            if (activeIdx >= 0 && currentStations[activeIdx]) {
                e.preventDefault();
                chooseStation(currentStations[activeIdx]);
            }
        } else if (e.key === "Escape") {
            dropdown.classList.remove("active");
        }
    });

    // Close on clicking outside
    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
}

// Station Swap Helper
function handleSearchStationSwap() {
    const fromEl = $("search-input-from");
    const toEl = $("search-input-to");
    if (!fromEl || !toEl) return;
    const tmp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmp;
    showToast("⇅ Stations swapped");
}

window.quickSetRoute = function(src, dst) {
    const fromEl = $("search-input-from");
    const toEl = $("search-input-to");
    if (fromEl) fromEl.value = src;
    if (toEl) toEl.value = dst;
    switchView("train-search");
    handleTrainSearch();
};

// ================= PNR STATUS ENQUIRY =================
window.quickFillPNR = function(pnr) {
    const inp = $("pnr-input-field");
    if (inp) inp.value = pnr;
    checkPNRStatus(pnr);
};

window.checkPNRStatus = async function(pnr) {
    const rawVal = pnr || $("pnr-input-field")?.value || "";
    const cleanPnr = rawVal.trim().replace(/\D/g, "");
    const container = $("pnr-result-container");
    if (!container) return;

    if (cleanPnr.length !== 10) {
        showToast("⚠️ PNR must be exactly 10 numeric digits.");
        const inp = $("pnr-input-field");
        if (inp) {
            inp.style.borderColor = "var(--danger)";
            inp.focus();
            setTimeout(() => inp.style.borderColor = "", 2500);
        }
        return;
    }

    container.innerHTML = `
        <div class="pnr-card skeleton-loading" style="height: 220px; text-align: center; padding: 40px;">
            <div style="color: var(--text-dim); font-size: 1.05rem;">🔍 Querying PRS Reservation Database for PNR #${cleanPnr}...</div>
            <div style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted);">Parsing chart preparation status and passenger coach assignments...</div>
        </div>
    `;

    try {
        const res = await fetch(`/api/pnr/${cleanPnr}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Unable to retrieve PNR");
        }
        const data = await res.json();
        renderPNRResult(data, container);
    } catch (err) {
        container.innerHTML = `
            <div class="pnr-card" style="text-align: center; padding: 30px; border-color: rgba(239, 68, 68, 0.4);">
                <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                <h4 style="color: #ef4444; font-size: 1.1rem; margin-bottom: 6px;">PNR Enquiry Failed</h4>
                <p style="color: var(--text-dim); font-size: 0.88rem; margin-bottom: 16px;">${escapeHtml(err.message)}</p>
                <button class="btn btn-secondary btn-sm" onclick="checkPNRStatus('${cleanPnr}')">🔄 Retry Lookup</button>
            </div>
        `;
    }
};

function renderPNRResult(data, container) {
    const isPrepared = data.chart_prepared;

    container.innerHTML = `
        <div class="pnr-card">
            <div class="pnr-header">
                <div>
                    <span class="pnr-tag">PNR ${data.pnr}</span>
                    <h3 style="color: #fff; font-size: 1.25rem; margin-top: 6px;">
                        ${data.train_number} - ${escapeHtml(data.train_name)}
                    </h3>
                </div>
                <div style="text-align: right;">
                    <span class="pnr-status-badge ${isPrepared ? 'badge-tag-green' : 'badge-tag-blue'}">
                        ${isPrepared ? '✓ CHART PREPARED' : '⏳ CHART NOT PREPARED'}
                    </span>
                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 6px;">Class: <strong>${data.journey_class}</strong> • Quota: <strong>${data.quota}</strong></div>
                </div>
            </div>

            <div class="pnr-journey-route">
                <div class="pnr-route-col">
                    <div class="pnr-route-label">BOARDING STATION</div>
                    <div class="pnr-route-station">${escapeHtml(data.from_station)}</div>
                    <div class="pnr-route-date">Date: ${data.journey_date}</div>
                </div>
                <div style="font-size: 1.5rem; color: var(--text-dim);">➔</div>
                <div class="pnr-route-col">
                    <div class="pnr-route-label">DESTINATION STATION</div>
                    <div class="pnr-route-station">${escapeHtml(data.to_station)}</div>
                    <div class="pnr-route-date">Expected Arrival</div>
                </div>
            </div>

            <h4 style="font-size: 0.95rem; color: #93c5fd; margin-bottom: 10px;">Passenger Booking & Current Status</h4>
            <div class="pnr-passenger-table-wrap">
                <table class="pnr-passenger-table">
                    <thead>
                        <tr>
                            <th>Passenger</th>
                            <th>Booking Status</th>
                            <th>Current Status</th>
                            <th>Coach</th>
                            <th>Berth / Seat</th>
                            <th>Berth Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.passengers.map(p => `
                            <tr>
                                <td><strong>Passenger ${p.passenger_number}</strong></td>
                                <td><span class="pnr-status-tag ${p.booking_status.includes('CNF') ? 'cnf' : 'wl'}">${escapeHtml(p.booking_status)}</span></td>
                                <td><span class="pnr-status-tag ${p.current_status.includes('CNF') ? 'cnf' : 'wl'}">${escapeHtml(p.current_status)}</span></td>
                                <td><strong style="color: #60a5fa;">${p.coach}</strong></td>
                                <td><strong style="color: #34d399;">${p.berth}</strong></td>
                                <td><span style="font-size: 0.8rem; color: var(--text-muted);">${p.berth_type || '--'}</span></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 8px;">
                <div style="font-size: 0.76rem; color: var(--text-dim); font-style: italic;">
                    * ${escapeHtml(data.disclaimer || "Verified reference simulation.")}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="viewCoachLayoutTab('${data.train_number}')">💺 View Coach Layout</button>
                    <button class="btn btn-primary btn-sm" onclick="viewRunningStatusTab('${data.train_number}')">📍 Track Live Train</button>
                </div>
            </div>
        </div>
    `;
}

// ================= COACH COMPOSITION & SEAT LAYOUT =================
window.viewCoachLayoutTab = function(num) {
    const input = $("coach-train-input");
    if (input) input.value = num;
    switchView("coach-layout");
    loadCoachLayout(num);
};

window.loadCoachLayout = async function(trainNumber) {
    const cleanNum = (trainNumber || $("coach-train-input")?.value || "").trim();
    const container = $("coach-layout-container");
    if (!container || !cleanNum) return;

    container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 30px;">🔍 Retrieving Coach Composition & Rake Type for #${escapeHtml(cleanNum)}...</div>`;

    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(cleanNum)}/coaches`);
        if (!res.ok) throw new Error("Coach data unavailable");
        const data = await res.json();
        renderCoachLayout(data, container);
    } catch (err) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--danger); padding: 24px;">
                Unable to retrieve coach composition for #${escapeHtml(cleanNum)}.
            </div>
        `;
    }
};

function renderCoachLayout(data, container) {
    container.innerHTML = `
        <div style="background: rgba(11, 15, 25, 0.5); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                <div>
                    <span class="train-tag" style="font-size: 1.05rem;">${data.train_number}</span>
                    <strong style="color: #fff; font-size: 1.15rem; margin-left: 8px;">${escapeHtml(data.train_name)}</strong>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="badge-tag badge-tag-green">${escapeHtml(data.rake_type)}</span>
                    <span class="badge-tag badge-tag-blue">${data.total_coaches} Coaches</span>
                    ${data.pantry_car ? '<span class="badge-tag badge-tag-green">🍴 Pantry Car Attached</span>' : ''}
                </div>
            </div>
            <p style="font-size: 0.84rem; color: var(--text-dim); margin: 0;">
                Horizontal Rake Representation (Engine at front ➔ Guard/SLR at rear). Click any coach to inspect berth layout.
            </p>
        </div>

        <div class="coach-rake-container">
            <div class="coach-rake-strip" id="desktop-rake-strip">
                <div class="coach-loco-block">🚂 LOCO</div>
                ${data.coaches.map((c, idx) => `
                    <div class="coach-block" data-coach-idx="${idx}" onclick="selectCoachBlock(${idx})" title="${c.coach_name} (${c.coach_type})">
                        <div class="coach-code">${c.coach_name}</div>
                        <div class="coach-type-lbl">${c.coach_type}</div>
                        <div class="coach-seats-lbl">${c.seats_count ? c.seats_count + ' seats' : '--'}</div>
                    </div>
                `).join("")}
            </div>
        </div>

        <h4 style="font-size: 0.95rem; color: #93c5fd; margin: 20px 0 12px;">Coach List & Berth Classification</h4>
        <div class="coach-cards-grid" id="desktop-coach-grid">
            ${data.coaches.map(c => `
                <div class="coach-info-card">
                    <div class="coach-card-header">
                        <strong>${c.coach_name}</strong>
                        <span class="badge-tag badge-tag-blue">${c.coach_type}</span>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
                        <div>Capacity: <strong style="color: #fff;">${c.seats_count || 72} Berths</strong></div>
                        <div style="margin-top: 4px; color: var(--text-dim);">Layout: Lower, Middle, Upper, Side Lower, Side Upper</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

window.selectCoachBlock = function(idx) {
    document.querySelectorAll(".coach-block").forEach((b, i) => {
        b.classList.toggle("selected", i === idx);
    });
};

// ================= RECENT SEARCH HISTORY =================
async function loadSearchHistory() {
    const container = $("search-history-container");
    const mContainer = $("m-full-history-list");

    try {
        const res = await fetch("/api/history");
        if (!res.ok) return;
        const items = await res.json();

        const renderHtml = (itemsList) => {
            if (!itemsList.length) {
                return `
                    <div class="empty-state-card" style="text-align: center; padding: 40px;">
                        <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
                        <h4 style="color: #fff; font-size: 1.05rem; margin-bottom: 6px;">No Search History</h4>
                        <p style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px;">Your recent train and station searches will appear here automatically.</p>
                        <button class="btn btn-primary btn-sm" onclick="switchView('train-search')">Start Searching Trains</button>
                    </div>
                `;
            }

            return itemsList.map(item => `
                <div class="search-history-item" id="history-item-${item.id}">
                    <div class="history-item-left">
                        <div class="history-train-number">${item.train_number ? '#' + item.train_number : 'Route Search'}</div>
                        <div class="history-train-name">${escapeHtml(item.train_name || 'Station Route')}</div>
                        <div class="history-route-str">
                            <span>${escapeHtml(item.from_station)}</span> ➔ <span>${escapeHtml(item.to_station)}</span>
                            ${item.journey_date ? `<span style="color: var(--text-dim); margin-left: 8px;">• Date: ${item.journey_date}</span>` : ''}
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn btn-secondary btn-sm" onclick="reopenSearch('${escapeJs(item.from_station)}', '${escapeJs(item.to_station)}', '${item.journey_date || ''}')">Reopen Search ➔</button>
                        <button class="btn-delete-icon" onclick="deleteHistoryItem(${item.id})" title="Delete from history">✕</button>
                    </div>
                </div>
            `).join("");
        };

        if (container) container.innerHTML = renderHtml(items);
        if (mContainer) mContainer.innerHTML = renderHtml(items);
    } catch (e) {}
}

async function recordSearchHistory(item) {
    try {
        await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        });
        loadSearchHistory();
    } catch (e) {}
}

window.reopenSearch = function(fromStation, toStation, date) {
    const fromEl = $("search-input-from");
    const toEl = $("search-input-to");
    const dateEl = $("search-input-date");

    if (fromEl) fromEl.value = fromStation === "ALL" ? "" : fromStation;
    if (toEl) toEl.value = toStation === "ALL" ? "" : toStation;
    if (dateEl && date) dateEl.value = date;

    switchView("train-search");
    handleTrainSearch();
};

window.deleteHistoryItem = async function(id) {
    try {
        await fetch(`/api/history/${id}`, { method: "DELETE" });
        const el = $(`history-item-${id}`);
        if (el) el.remove();
        showToast("🗑️ History item removed");
        loadSearchHistory();
    } catch (e) {}
};

window.clearSearchHistoryAction = async function() {
    if (!confirm("Are you sure you want to clear your recent search history?")) return;
    try {
        await fetch("/api/history", { method: "DELETE" });
        loadSearchHistory();
        showToast("🗑️ Search history cleared");
    } catch (e) {}
};

// ================= TICKETS & SAVED BOOKINGS =================
function loadSavedTickets() {
    const container = $("tickets-list-container");
    const mContainer = $("m-tickets-list-cards");

    // Standard high-fidelity demo / saved tickets for reference verification
    const savedTickets = [
        {
            pnr: "2458917234",
            train_number: "12307",
            train_name: "Jodhpur Superfast Express",
            from: "Dhanbad Junction (DHN)",
            to: "Jaipur Junction (JP)",
            date: "Tomorrow",
            coach: "B2",
            berth: "24",
            berth_type: "Lower Berth",
            status: "CNF",
            quota: "Tatkal (TQ)"
        },
        {
            pnr: "4521098765",
            train_number: "12987",
            train_name: "Ajmer Superfast Express",
            from: "Dhanbad Junction (DHN)",
            to: "Jaipur Junction (JP)",
            date: "In 3 Days",
            coach: "S3",
            berth: "42",
            berth_type: "Side Lower",
            status: "CNF",
            quota: "General (GN)"
        }
    ];

    const renderTicketsHtml = (tickets) => {
        if (!tickets.length) {
            return `
                <div class="empty-state-card" style="text-align: center; padding: 40px;">
                    <div style="font-size: 2.5rem; margin-bottom: 12px;">🎟️</div>
                    <h4 style="color: #fff; font-size: 1.05rem; margin-bottom: 6px;">No Saved Tickets</h4>
                    <p style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px;">Keep track of upcoming journeys and confirmed PNRs offline here.</p>
                </div>
            `;
        }

        return tickets.map(t => `
            <div class="ticket-card">
                <div class="ticket-card-header">
                    <div>
                        <span class="pnr-tag">PNR ${t.pnr}</span>
                        <h3 style="font-size: 1.15rem; color: #fff; margin-top: 4px;">${t.train_number} - ${escapeHtml(t.train_name)}</h3>
                    </div>
                    <div style="text-align: right;">
                        <span class="pnr-status-badge badge-tag-green">✓ ${t.status}</span>
                        <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">${t.quota}</div>
                    </div>
                </div>
                <div class="ticket-route-strip">
                    <div><strong>${escapeHtml(t.from)}</strong><div style="font-size: 0.8rem; color: var(--text-dim);">Departure</div></div>
                    <div style="color: var(--text-dim); font-size: 1.2rem;">➔</div>
                    <div><strong>${escapeHtml(t.to)}</strong><div style="font-size: 0.8rem; color: var(--text-dim);">Arrival</div></div>
                </div>
                <div class="ticket-passenger-row">
                    <div><span style="color: var(--text-dim);">COACH:</span> <strong style="color: #60a5fa;">${t.coach}</strong></div>
                    <div><span style="color: var(--text-dim);">BERTH:</span> <strong style="color: #34d399;">${t.berth} (${t.berth_type})</strong></div>
                    <div><span style="color: var(--text-dim);">JOURNEY:</span> <strong>${t.date}</strong></div>
                </div>
                <div class="ticket-actions">
                    <button class="btn btn-primary btn-sm" onclick="switchView('pnr-status'); quickFillPNR('${t.pnr}')">Check PNR Status</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">Live Running Status</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewCoachLayoutTab('${t.train_number}')">Coach Position</button>
                </div>
            </div>
        `).join("");
    };

    if (container) container.innerHTML = renderTicketsHtml(savedTickets);
    if (mContainer) mContainer.innerHTML = renderTicketsHtml(savedTickets);
}

// ================= REMINDERS & ALERTS =================
async function loadAlerts() {
    const container = $("alerts-list-container");
    const mContainer = $("m-alerts-list-container");

    try {
        const res = await fetch("/api/alerts");
        if (!res.ok) return;
        const alerts = await res.json();

        const renderAlertsHtml = (alertsList) => {
            if (!alertsList.length) {
                return `
                    <div class="empty-state-card" style="text-align: center; padding: 30px;">
                        <div style="font-size: 2.2rem; margin-bottom: 10px;">🔔</div>
                        <h4 style="color: #fff; font-size: 1rem; margin-bottom: 4px;">No Active Alerts</h4>
                        <p style="color: var(--text-dim); font-size: 0.84rem; margin-bottom: 12px;">Add reminders for train departure, delays, or PNR refresh.</p>
                        <button class="btn btn-primary btn-sm" onclick="showAddAlertPrompt()">➕ Add New Alert</button>
                    </div>
                `;
            }

            return alertsList.map(a => `
                <div class="alert-item-card" id="alert-card-${a.id}">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="font-size: 1.5rem;">🔔</span>
                        <div>
                            <div style="font-weight: 600; color: #fff; font-size: 0.95rem;">${escapeHtml(a.title)}</div>
                            <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                                ${escapeHtml(a.alert_type)} ${a.train_number ? '• Train #' + a.train_number : ''} ${a.trigger_time ? '• ' + a.trigger_time : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="btn btn-sm ${a.is_enabled ? 'btn-secondary' : ''}" style="color: ${a.is_enabled ? '#34d399' : 'var(--text-dim)'};" onclick="toggleAlertState(${a.id}, ${!a.is_enabled})">
                            ${a.is_enabled ? '✓ Enabled' : 'Off'}
                        </button>
                        <button class="btn-delete-icon" onclick="deleteAlertAction(${a.id})" title="Delete alert">✕</button>
                    </div>
                </div>
            `).join("");
        };

        if (container) container.innerHTML = renderAlertsHtml(alerts);
        if (mContainer) mContainer.innerHTML = renderAlertsHtml(alerts);
    } catch (e) {}
}

window.toggleAlertState = async function(id, newState) {
    try {
        await fetch(`/api/alerts/${id}/toggle`, { method: "PUT" });
        loadAlerts();
        showToast(newState ? "🔔 Alert enabled" : "🔕 Alert muted");
    } catch (e) {}
};

window.deleteAlertAction = async function(id) {
    try {
        await fetch(`/api/alerts/${id}`, { method: "DELETE" });
        const el = $(`alert-card-${id}`);
        if (el) el.remove();
        showToast("🗑️ Alert deleted");
        loadAlerts();
    } catch (e) {}
};

window.showAddAlertPrompt = async function() {
    const title = prompt("Enter Alert Title (e.g. 12307 Departure Reminder):", "Train 12307 Departure");
    if (!title) return;
    const trainNo = prompt("Enter Train Number (optional):", "12307");

    try {
        await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                alert_type: "DEPARTURE_REMINDER",
                train_number: trainNo || null,
                title: title,
                notes: "Configured via alerts utility",
                is_enabled: true
            })
        });
        showToast("✅ Alert created!");
        loadAlerts();
    } catch (e) {
        showToast("⚠️ Could not create alert");
    }
};
