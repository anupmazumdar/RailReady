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
    initStationDatalist();
    setDefaultDates();
    setupNavigation();
    setupEventListeners();
    fetchSystemStatus();
    loadLatestJourney();
    loadPassengers();
    loadChecklist();
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
    attachRouteDebounce("search-input-from", "search-input-to", () => handleTrainSearch());

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
    } catch (err) {
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;">Error searching trains. Please check inputs.</div>`;
    }
}

function renderSearchResults() {
    const container = $("search-results-container");
    const countEl = $("search-count");
    if (!container) return;

    const filtered = lastSearchResults.filter(t => matchesCategory(t.train_type, currentSearchCategory));
    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No matching trains found in category '${currentSearchCategory}'.</div>`;
        return;
    }

    container.innerHTML = filtered.map(t => `
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
            <div class="train-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY')">📌 Set as Primary</button>
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT1')">🔄 Set as Alt 1</button>
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT2')">🔄 Set as Alt 2</button>
                <button class="btn btn-primary btn-sm" onclick="viewTrainDetailsTab('${t.train_number}')">🚆 Details</button>
                <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">📍 Live Status</button>
                <button class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')">🗺️ Route</button>
            </div>
        </div>
    `).join("");
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
                <div style="display: flex; gap: 10px; margin-top: 18px;">
                    <button class="btn btn-primary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY'); switchView('journey-planner');">Use in Journey Planner</button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">Track Live Status ➔</button>
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

async function loadRunningStatus(trainNumber) {
    const c = $("running-status-content");
    if (c) c.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Querying running status...</div>`;
    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}/status`);
        if (!res.ok) throw new Error();
        const s = await res.json();
        const delayed = s.delay_minutes > 0;
        c.innerHTML = `
            <div class="live-status-hero ${delayed ? 'delayed' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="live-status-title"><span>🛰️</span><span>${s.train_number} - ${escapeHtml(s.train_name)}</span></div>
                    <span class="badge-tag ${delayed ? 'badge-tag-blue' : 'badge-tag-green'}">${s.current_status}</span>
                </div>
                <div class="form-row" style="margin-top: 14px;">
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">CURRENT LOCATION</div><div style="font-size: 1.25rem; font-weight: 700; color: #60a5fa;">${s.current_station_name} (${s.current_station})</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">DELAY STATUS</div><div style="font-size: 1.25rem; font-weight: 700; color: ${delayed ? '#fcd34d' : '#34d399'};">${s.delay_status}</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">NEXT STATION</div><div style="font-size: 1.1rem; font-weight: 600; color: #f8fafc;">${s.next_station_name ? s.next_station_name + ' (' + s.next_station + ')' : 'Approaching Destination'}</div></div>
                    <div><div style="font-size: 0.8rem; color: var(--text-dim);">STATUS TIME</div><div style="font-size: 0.95rem; font-family: var(--font-mono); color: #cbd5e1;">${s.last_updated}</div></div>
                </div>
                <div class="live-disclaimer-note">* Last updated: ${s.last_updated}. Verify critical travel info via NTES / 139.</div>
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
