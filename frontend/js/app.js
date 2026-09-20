// Application State
let activeJourney = null;
let openingTimeIso = null;
let countdownInterval = null;
let notifiedMilestones = new Set();
let currentView = "dashboard";
let lastSearchResults = [];
let currentSearchCategory = "ALL";
let jpAutoDiscoveredTrains = [];
let currentJpCategory = "ALL";

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
    const dataList = document.getElementById("station-list");
    if (!dataList || typeof MAJOR_STATIONS === "undefined") return;
    
    dataList.innerHTML = MAJOR_STATIONS.map(st => 
        `<option value="${st.code} - ${st.name}">`
    ).join("");
}

// Default Journey Dates to Tomorrow
function setDefaultDates() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const formatted = `${yyyy}-${mm}-${dd}`;

    const searchDate = document.getElementById("search-input-date");
    const jpDate = document.getElementById("jp-journey-date");
    if (searchDate) {
        searchDate.value = formatted;
        searchDate.min = formatted;
    }
    if (jpDate) {
        jpDate.value = formatted;
        jpDate.min = formatted;
    }
}

// View Navigation Switcher
window.switchView = function(viewName) {
    currentView = viewName;

    // Update Tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
        if (tab.getAttribute("data-view") === viewName) {
            tab.classList.add("active");
            // Auto scroll the selected tab into view smoothly
            try {
                tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            } catch (e) {
                // fallback if scrollIntoView options unsupported
            }
        } else {
            tab.classList.remove("active");
        }
    });

    // Update Panels
    document.querySelectorAll(".view-panel").forEach(panel => {
        if (panel.id === `view-${viewName}`) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
};

function setupNavigation() {
    const mainNav = document.getElementById("main-nav");
    const scrollLeftBtn = document.getElementById("nav-scroll-left");
    const scrollRightBtn = document.getElementById("nav-scroll-right");

    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetView = tab.getAttribute("data-view");
            if (targetView) switchView(targetView);
        });
    });

    // Mouse wheel horizontal scrolling over navbar
    if (mainNav) {
        mainNav.addEventListener("wheel", (evt) => {
            if (evt.deltaY !== 0) {
                evt.preventDefault();
                mainNav.scrollLeft += evt.deltaY;
            }
        }, { passive: false });
    }

    // Scroll Arrow Controls
    if (scrollLeftBtn && mainNav) {
        scrollLeftBtn.addEventListener("click", () => {
            mainNav.scrollBy({ left: -220, behavior: "smooth" });
        });
    }

    if (scrollRightBtn && mainNav) {
        scrollRightBtn.addEventListener("click", () => {
            mainNav.scrollBy({ left: 220, behavior: "smooth" });
        });
    }

    // Update arrow states based on scroll position
    function updateNavScrollButtons() {
        if (!mainNav || !scrollLeftBtn || !scrollRightBtn) return;
        const isOverflowing = mainNav.scrollWidth > mainNav.clientWidth + 2;
        if (!isOverflowing) {
            scrollLeftBtn.style.opacity = "0.3";
            scrollLeftBtn.disabled = true;
            scrollRightBtn.style.opacity = "0.3";
            scrollRightBtn.disabled = true;
            return;
        }
        scrollLeftBtn.disabled = mainNav.scrollLeft <= 5;
        scrollRightBtn.disabled = (mainNav.scrollLeft + mainNav.clientWidth) >= (mainNav.scrollWidth - 5);
        scrollLeftBtn.style.opacity = scrollLeftBtn.disabled ? "0.3" : "1";
        scrollRightBtn.style.opacity = scrollRightBtn.disabled ? "0.3" : "1";
    }

    if (mainNav) {
        mainNav.addEventListener("scroll", updateNavScrollButtons);
        window.addEventListener("resize", updateNavScrollButtons);
        setTimeout(updateNavScrollButtons, 150);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Search View
    const btnSearch = document.getElementById("btn-execute-search");
    if (btnSearch) btnSearch.addEventListener("click", handleTrainSearch);

    // Category Filter Pills - Train Search
    document.querySelectorAll("#search-category-filters .category-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll("#search-category-filters .category-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentSearchCategory = pill.getAttribute("data-cat") || "ALL";
            renderSearchResults();
        });
    });

    // Category Filter Pills - Journey Planner
    document.querySelectorAll("#jp-category-filters .category-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll("#jp-category-filters .category-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentJpCategory = pill.getAttribute("data-cat") || "ALL";
            renderJpAutoTrains();
        });
    });

    // Instant Route Auto-Discovery in Journey Planner
    const jpFrom = document.getElementById("jp-from-station");
    const jpTo = document.getElementById("jp-to-station");
    let jpDebounceTimer = null;
    function onJpStationChange() {
        clearTimeout(jpDebounceTimer);
        jpDebounceTimer = setTimeout(() => {
            const from = (jpFrom?.value || "").trim();
            const to = (jpTo?.value || "").trim();
            if (from && to && from.length >= 2 && to.length >= 2) {
                autoDiscoverJourneyTrains(from, to, true);
            }
        }, 350);
    }
    if (jpFrom) {
        jpFrom.addEventListener("input", onJpStationChange);
        jpFrom.addEventListener("change", onJpStationChange);
    }
    if (jpTo) {
        jpTo.addEventListener("input", onJpStationChange);
        jpTo.addEventListener("change", onJpStationChange);
    }

    // Auto-Assign Top 3 Trains Button in Journey Planner
    const btnAutoAssign = document.getElementById("btn-jp-auto-assign-top3");
    if (btnAutoAssign) {
        btnAutoAssign.addEventListener("click", () => {
            assignTop3TrainsToJourneySlots(true);
        });
    }

    // Instant Route Auto-Search in Train Search View
    const searchFrom = document.getElementById("search-input-from");
    const searchTo = document.getElementById("search-input-to");
    let searchDebounceTimer = null;
    function onSearchStationChange() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            if (searchFrom?.value.trim() && searchTo?.value.trim()) {
                handleTrainSearch();
            }
        }, 350);
    }
    if (searchFrom) {
        searchFrom.addEventListener("input", onSearchStationChange);
        searchFrom.addEventListener("change", onSearchStationChange);
    }
    if (searchTo) {
        searchTo.addEventListener("input", onSearchStationChange);
        searchTo.addEventListener("change", onSearchStationChange);
    }

    // Details View
    const btnLoadDetails = document.getElementById("btn-load-details");
    if (btnLoadDetails) {
        btnLoadDetails.addEventListener("click", () => {
            const trainNo = document.getElementById("details-train-input").value.trim();
            if (trainNo) loadTrainDetails(trainNo);
        });
    }

    // Running Status View
    const btnLoadStatus = document.getElementById("btn-load-running-status");
    if (btnLoadStatus) {
        btnLoadStatus.addEventListener("click", () => {
            const trainNo = document.getElementById("status-train-input").value.trim();
            if (trainNo) loadRunningStatus(trainNo);
        });
    }

    // Timeline View
    const btnLoadTimeline = document.getElementById("btn-load-timeline");
    if (btnLoadTimeline) {
        btnLoadTimeline.addEventListener("click", () => {
            const trainNo = document.getElementById("timeline-train-input").value.trim();
            if (trainNo) loadRouteTimeline(trainNo);
        });
    }

    // Journey Planner Form
    const jpForm = document.getElementById("form-journey-main");
    if (jpForm) jpForm.addEventListener("submit", handleJourneyPlannerSubmit);

    // Passenger Forms
    const viewPassengerForm = document.getElementById("form-view-add-passenger");
    if (viewPassengerForm) viewPassengerForm.addEventListener("submit", handlePassengerSubmit);

    // Copy Passenger Buttons
    const btnDashCopy = document.getElementById("btn-dash-copy-passengers");
    if (btnDashCopy) btnDashCopy.addEventListener("click", copyAllPassengerDetails);

    const btnViewCopy = document.getElementById("btn-view-copy-all-passengers");
    if (btnViewCopy) btnViewCopy.addEventListener("click", copyAllPassengerDetails);

    // Checklist Reset
    const btnTatkalReset = document.getElementById("btn-tatkal-reset-checklist");
    if (btnTatkalReset) btnTatkalReset.addEventListener("click", resetChecklist);

    // Clear Passenger Data in Settings
    const btnClearPassengers = document.getElementById("btn-clear-all-passengers");
    if (btnClearPassengers) {
        btnClearPassengers.addEventListener("click", async () => {
            if (confirm("Clear all prepared passenger records?")) {
                await fetch("/api/passengers", { method: "DELETE" });
                loadPassengers();
                showToast("🗑️ Passenger records cleared.");
            }
        });
    }

    // Notifications View Buttons
    const btnChime = document.getElementById("btn-test-chime-view");
    if (btnChime) {
        btnChime.addEventListener("click", () => {
            playAlertChime();
            showToast("🔔 Test chime played successfully!");
        });
    }

    const btnNotif = document.getElementById("btn-test-notification-view");
    if (btnNotif) {
        btnNotif.addEventListener("click", () => {
            triggerNotification("RailReady Alert", "Test notification triggered from RailReady.");
            showToast("🔔 Notification triggered!");
        });
    }

    // Manual IRCTC Modal Listeners
    const manualIrctcBtn = document.getElementById("btn-manual-irctc");
    const tatkalModalBtn = document.getElementById("btn-tatkal-manual-modal");
    const modal = document.getElementById("modal-irctc-guide");
    const closeModalBtn = document.getElementById("btn-close-modal");
    const modalDoneBtn = document.getElementById("btn-modal-done");
    const copyUrlBtn = document.getElementById("btn-copy-url");

    if (manualIrctcBtn) manualIrctcBtn.addEventListener("click", () => modal.classList.add("active"));
    if (tatkalModalBtn) tatkalModalBtn.addEventListener("click", () => modal.classList.add("active"));
    if (closeModalBtn) closeModalBtn.addEventListener("click", () => modal.classList.remove("active"));
    if (modalDoneBtn) modalDoneBtn.addEventListener("click", () => modal.classList.remove("active"));
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("active");
        });
    }
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener("click", () => {
            copyToClipboard("https://www.irctc.co.in/");
            showToast("🌐 IRCTC URL copied to clipboard!");
        });
    }
}

// Fetch System Status & IST Clock
async function fetchSystemStatus() {
    try {
        const res = await fetch("/api/status");
        if (!res.ok) return;
        const data = await res.json();
        const timeDisplay = document.getElementById("current-ist-time");
        if (timeDisplay && data.current_time_ist) {
            timeDisplay.textContent = data.current_time_ist;
        }
    } catch (err) {
        console.error("Status fetch error:", err);
    }
}

// ================= TRAIN CATEGORY HELPERS =================
function getCategoryBadge(trainType) {
    const t = (trainType || "").toLowerCase();
    if (t === "rajdhani") {
        return `<span class="badge-category badge-category-rajdhani">👑 Rajdhani</span>`;
    } else if (t === "special") {
        return `<span class="badge-category badge-category-special">⭐ Special</span>`;
    } else if (t.includes("mail") || t.includes("express") || t.includes("superfast")) {
        return `<span class="badge-category badge-category-mail">⚡ Mail / Express</span>`;
    } else if (t.includes("passenger") || t.includes("local") || t.includes("memu")) {
        return `<span class="badge-category badge-category-passenger">🚉 Passenger</span>`;
    } else if (t.includes("shatabdi") || t.includes("vande")) {
        return `<span class="badge-category badge-category-mail">🚄 ${escapeHtml(trainType)}</span>`;
    }
    return `<span class="badge-tag badge-tag-blue">${escapeHtml(trainType)}</span>`;
}

function matchesCategory(trainType, category) {
    if (!category || category === "ALL") return true;
    const t = (trainType || "").toLowerCase();
    if (category === "Rajdhani") return t === "rajdhani";
    if (category === "Special") return t === "special";
    if (category === "Mail/Express") return t.includes("mail") || t.includes("express") || t.includes("superfast");
    if (category === "Passenger") return t.includes("passenger") || t.includes("local") || t.includes("memu");
    return true;
}

// ================= TRAIN INFORMATION & SEARCH =================
async function handleTrainSearch() {
    const query = document.getElementById("search-input-query").value.trim();
    const fromStation = document.getElementById("search-input-from").value.trim();
    const toStation = document.getElementById("search-input-to").value.trim();
    const date = document.getElementById("search-input-date").value;

    const params = new URLSearchParams();
    if (query) params.append("query", query);
    if (fromStation) params.append("from_station", fromStation);
    if (toStation) params.append("to_station", toStation);
    if (date) params.append("journey_date", date);

    showToast("🔍 Searching train database...");
    const container = document.getElementById("search-results-container");

    try {
        const res = await fetch(`/api/trains/search?${params.toString()}`);
        if (!res.ok) throw new Error("Search failed");
        const trains = await res.json();
        lastSearchResults = trains;

        // Update counts on filter pills
        const elAll = document.getElementById("search-cat-count-all");
        const elRaj = document.getElementById("search-cat-count-raj");
        const elSpec = document.getElementById("search-cat-count-spec");
        const elMail = document.getElementById("search-cat-count-mail");
        const elPass = document.getElementById("search-cat-count-pass");

        if (elAll) elAll.textContent = trains.length;
        if (elRaj) elRaj.textContent = trains.filter(t => matchesCategory(t.train_type, "Rajdhani")).length;
        if (elSpec) elSpec.textContent = trains.filter(t => matchesCategory(t.train_type, "Special")).length;
        if (elMail) elMail.textContent = trains.filter(t => matchesCategory(t.train_type, "Mail/Express")).length;
        if (elPass) elPass.textContent = trains.filter(t => matchesCategory(t.train_type, "Passenger")).length;

        renderSearchResults();
        showToast(`✅ Found ${trains.length} trains!`);
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;">Error searching trains. Please check your inputs.</div>`;
    }
}

function renderSearchResults() {
    const container = document.getElementById("search-results-container");
    const countEl = document.getElementById("search-count");
    if (!container) return;

    const filtered = lastSearchResults.filter(t => matchesCategory(t.train_type, currentSearchCategory));
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
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
                <div class="route-stop-point">
                    <div class="route-stop-time">${t.departure_time}</div>
                    <div class="route-stop-station">${t.source_name} (${t.source_code})</div>
                </div>
                <div class="route-duration-line">
                    <span class="route-duration-text">${t.duration}</span>
                </div>
                <div class="route-stop-point">
                    <div class="route-stop-time">${t.arrival_time}</div>
                    <div class="route-stop-station">${t.dest_name} (${t.dest_code})</div>
                </div>
            </div>

            <div class="train-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY')">
                    📌 Set as Primary
                </button>
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT1')">
                    🔄 Set as Alt 1
                </button>
                <button class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT2')">
                    🔄 Set as Alt 2
                </button>
                <button class="btn btn-primary btn-sm" onclick="viewTrainDetailsTab('${t.train_number}')">
                    🚆 Details
                </button>
                <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">
                    📍 Live Status
                </button>
                <button class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')">
                    🗺️ Route
                </button>
            </div>
        </div>
    `).join("");
}

// ================= JOURNEY PLANNER AUTO-DISCOVERY =================
async function autoDiscoverJourneyTrains(fromStation, toStation, autoPopulateIfEmpty = false) {
    const listContainer = document.getElementById("jp-auto-trains-list");
    if (!listContainer) return;
    listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">⚡ Automatically discovering Special, Rajdhani, Mail/Express, and Passenger trains on this route...</div>`;

    const params = new URLSearchParams();
    params.append("from_station", fromStation);
    params.append("to_station", toStation);

    try {
        const res = await fetch(`/api/trains/search?${params.toString()}`);
        if (!res.ok) throw new Error("Search failed");
        const trains = await res.json();
        jpAutoDiscoveredTrains = trains;

        // Update counts
        const elAll = document.getElementById("jp-cat-count-all");
        const elRaj = document.getElementById("jp-cat-count-raj");
        const elSpec = document.getElementById("jp-cat-count-spec");
        const elMail = document.getElementById("jp-cat-count-mail");
        const elPass = document.getElementById("jp-cat-count-pass");

        if (elAll) elAll.textContent = trains.length;
        if (elRaj) elRaj.textContent = trains.filter(t => matchesCategory(t.train_type, "Rajdhani")).length;
        if (elSpec) elSpec.textContent = trains.filter(t => matchesCategory(t.train_type, "Special")).length;
        if (elMail) elMail.textContent = trains.filter(t => matchesCategory(t.train_type, "Mail/Express")).length;
        if (elPass) elPass.textContent = trains.filter(t => matchesCategory(t.train_type, "Passenger")).length;

        renderJpAutoTrains();

        // If primary train input is currently empty, auto-assign top 3 trains!
        const primaryInput = document.getElementById("jp-primary-train");
        if (autoPopulateIfEmpty && primaryInput && !primaryInput.value && trains.length > 0) {
            assignTop3TrainsToJourneySlots(false);
        }
    } catch (err) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 14px;">Could not discover trains for route. Please verify station names.</div>`;
    }
}

function renderJpAutoTrains() {
    const listContainer = document.getElementById("jp-auto-trains-list");
    if (!listContainer) return;

    const primaryVal = (document.getElementById("jp-primary-train")?.value || "").trim();
    const alt1Val = (document.getElementById("jp-alt1-train")?.value || "").trim();
    const alt2Val = (document.getElementById("jp-alt2-train")?.value || "").trim();

    const filtered = jpAutoDiscoveredTrains.filter(t => matchesCategory(t.train_type, currentJpCategory));

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">No trains found for category '${currentJpCategory}'.</div>`;
        return;
    }

    listContainer.innerHTML = filtered.map(t => {
        let assignedSlot = null;
        if (primaryVal.includes(t.train_number)) assignedSlot = "PRIMARY";
        else if (alt1Val.includes(t.train_number)) assignedSlot = "ALT 1";
        else if (alt2Val.includes(t.train_number)) assignedSlot = "ALT 2";

        return `
            <div class="auto-train-card ${assignedSlot ? 'is-assigned' : ''}" id="auto-train-${t.train_number}">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="color: #fff; font-size: 0.95rem;">${t.train_number} - ${escapeHtml(t.train_name)}</strong>
                        ${getCategoryBadge(t.train_type)}
                        ${assignedSlot ? `<span class="badge-tag badge-tag-green" style="font-weight: 700;">✓ ASSIGNED AS ${assignedSlot}</span>` : ''}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <span>Dep: <strong>${t.departure_time}</strong> (${t.source_code})</span>
                        <span>➔</span>
                        <span>Arr: <strong>${t.arrival_time}</strong> (${t.dest_code})</span>
                        <span>⏱️ ${t.duration}</span>
                        <span>Classes: <strong>${t.classes.join(", ")}</strong></span>
                    </div>
                </div>

                <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY')" title="Set as Primary Train">
                        📌 Primary
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT1')" title="Set as Alternative 1">
                        🔁 Alt 1
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'ALT2')" title="Set as Alternative 2">
                        🔀 Alt 2
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="viewRouteTimelineTab('${t.train_number}')" title="View Route Timeline">
                        🗺️ Route
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function assignTop3TrainsToJourneySlots(showToastMsg = true) {
    if (!jpAutoDiscoveredTrains || jpAutoDiscoveredTrains.length === 0) {
        if (showToastMsg) showToast("⚠️ Please enter route details (From & To station) first.");
        return;
    }

    const rajdhani = jpAutoDiscoveredTrains.find(t => t.train_type === "Rajdhani");
    const special = jpAutoDiscoveredTrains.find(t => t.train_type === "Special");
    const mailExp = jpAutoDiscoveredTrains.find(t => t.train_type === "Mail/Express" || t.train_type === "Superfast");
    const pass = jpAutoDiscoveredTrains.find(t => t.train_type === "Passenger" || t.train_type === "Local");

    const primary = rajdhani || jpAutoDiscoveredTrains[0];
    const alt1 = special || jpAutoDiscoveredTrains.find(t => t.train_number !== primary.train_number);
    const alt2 = mailExp || pass || jpAutoDiscoveredTrains.find(t => t.train_number !== primary.train_number && (!alt1 || t.train_number !== alt1.train_number));

    const primaryInput = document.getElementById("jp-primary-train");
    const alt1Input = document.getElementById("jp-alt1-train");
    const alt2Input = document.getElementById("jp-alt2-train");

    if (primary && primaryInput) primaryInput.value = `${primary.train_number} - ${primary.train_name}`;
    if (alt1 && alt1Input) alt1Input.value = `${alt1.train_number} - ${alt1.train_name}`;
    if (alt2 && alt2Input) alt2Input.value = `${alt2.train_number} - ${alt2.train_name}`;

    renderJpAutoTrains();
    if (showToastMsg) {
        showToast("✨ Auto-assigned optimal Primary, Alt 1, and Alt 2 trains!");
    }
}

// Quick Assign Train to Journey Planner Slots
window.quickAssignTrain = function(number, name, src, dst, slot) {
    const fullTrainStr = `${number} - ${name}`;
    const primaryInput = document.getElementById("jp-primary-train");
    const alt1Input = document.getElementById("jp-alt1-train");
    const alt2Input = document.getElementById("jp-alt2-train");
    const fromInput = document.getElementById("jp-from-station");
    const toInput = document.getElementById("jp-to-station");

    if (src && fromInput && !fromInput.value) fromInput.value = src;
    if (dst && toInput && !toInput.value) toInput.value = dst;

    if (slot === "PRIMARY") {
        if (primaryInput) primaryInput.value = fullTrainStr;
        showToast(`📌 Set ${number} as Primary Train in Journey Planner!`);
    } else if (slot === "ALT1") {
        if (alt1Input) alt1Input.value = fullTrainStr;
        showToast(`🔄 Set ${number} as Alternative Train 1!`);
    } else if (slot === "ALT2") {
        if (alt2Input) alt2Input.value = fullTrainStr;
        showToast(`🔄 Set ${number} as Alternative Train 2!`);
    }

    renderJpAutoTrains();
};

// Open Train Details Tab & Load
window.viewTrainDetailsTab = function(trainNumber) {
    const input = document.getElementById("details-train-input");
    if (input) input.value = trainNumber;
    switchView("train-details");
    loadTrainDetails(trainNumber);
};

// Open Running Status Tab & Load
window.viewRunningStatusTab = function(trainNumber) {
    const input = document.getElementById("status-train-input");
    if (input) input.value = trainNumber;
    switchView("running-status");
    loadRunningStatus(trainNumber);
};

// Open Route Timeline Tab & Load
window.viewRouteTimelineTab = function(trainNumber) {
    const input = document.getElementById("timeline-train-input");
    if (input) input.value = trainNumber;
    switchView("route-timeline");
    loadRouteTimeline(trainNumber);
};

// Load Train Details
async function loadTrainDetails(trainNumber) {
    const container = document.getElementById("train-details-content");
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading train details...</div>`;

    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}`);
        if (!res.ok) throw new Error("Train not found");
        const t = await res.json();

        container.innerHTML = `
            <div style="background: rgba(11, 15, 25, 0.5); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <span class="train-tag" style="font-size: 1.2rem;">${t.train_number}</span>
                        <h3 style="display: inline-block; font-size: 1.2rem; color: #fff; margin-left: 8px;">${escapeHtml(t.train_name)}</h3>
                    </div>
                    <div class="train-badge-group">
                        <span class="badge-tag badge-tag-blue">${t.train_type}</span>
                        <span class="badge-tag badge-tag-green">${t.pantry ? 'Pantry Car Available' : 'No Pantry'}</span>
                    </div>
                </div>

                <div class="form-row" style="margin-top: 14px; font-size: 0.9rem;">
                    <div><strong>Origin:</strong> ${t.source_name} (${t.source_code}) at ${t.departure_time}</div>
                    <div><strong>Destination:</strong> ${t.dest_name} (${t.dest_code}) at ${t.arrival_time}</div>
                    <div><strong>Total Distance:</strong> ${t.total_distance_km} km</div>
                    <div><strong>Total Duration:</strong> ${t.duration}</div>
                    <div><strong>Running Days:</strong> ${t.running_days.join(", ")}</div>
                    <div><strong>Available Classes:</strong> ${t.classes.join(", ")}</div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 18px;">
                    <button class="btn btn-primary btn-sm" onclick="quickAssignTrain('${t.train_number}', '${escapeJs(t.train_name)}', '${t.source_code}', '${t.dest_code}', 'PRIMARY'); switchView('journey-planner');">
                        Use in Journey Planner
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="viewRunningStatusTab('${t.train_number}')">
                        Track Live Running Status ➔
                    </button>
                </div>
            </div>

            <h4 style="color: #93c5fd; font-size: 1rem; margin-bottom: 12px;">Station Halts & Schedule Sequence (${t.stops.length} Stops)</h4>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); text-align: left;">
                            <th style="padding: 10px 8px;">#</th>
                            <th style="padding: 10px 8px;">Station</th>
                            <th style="padding: 10px 8px;">Arr</th>
                            <th style="padding: 10px 8px;">Dep</th>
                            <th style="padding: 10px 8px;">Halt</th>
                            <th style="padding: 10px 8px;">Day</th>
                            <th style="padding: 10px 8px;">Platform</th>
                            <th style="padding: 10px 8px;">Distance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${t.stops.map((s, idx) => `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                                <td style="padding: 10px 8px; color: var(--text-dim);">${idx + 1}</td>
                                <td style="padding: 10px 8px;"><strong>${s.station_code}</strong> - ${escapeHtml(s.station_name)}</td>
                                <td style="padding: 10px 8px; font-family: var(--font-mono);">${s.scheduled_arrival}</td>
                                <td style="padding: 10px 8px; font-family: var(--font-mono);">${s.scheduled_departure}</td>
                                <td style="padding: 10px 8px;">${s.halt_minutes > 0 ? s.halt_minutes + ' min' : '--'}</td>
                                <td style="padding: 10px 8px;">Day ${s.day_of_journey}</td>
                                <td style="padding: 10px 8px; color: #a7f3d0;">${s.platform || 'PF 1'}</td>
                                <td style="padding: 10px 8px; color: var(--text-dim);">${s.distance_km} km</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not load details for train #${escapeHtml(trainNumber)}.</div>`;
    }
}

// Load Live Running Status
async function loadRunningStatus(trainNumber) {
    const container = document.getElementById("running-status-content");
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Querying running status...</div>`;

    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}/status`);
        if (!res.ok) throw new Error("Status unavailable");
        const status = await res.json();

        const isDelayed = status.delay_minutes > 0;

        container.innerHTML = `
            <div class="live-status-hero ${isDelayed ? 'delayed' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="live-status-title">
                        <span>🛰️</span>
                        <span>${status.train_number} - ${escapeHtml(status.train_name)}</span>
                    </div>
                    <span class="badge-tag ${isDelayed ? 'badge-tag-blue' : 'badge-tag-green'}" style="font-size: 0.9rem;">
                        ${status.current_status}
                    </span>
                </div>

                <div class="form-row" style="margin-top: 14px;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Current Location</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #60a5fa;">${status.current_station_name} (${status.current_station})</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Delay Status</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: ${isDelayed ? '#fcd34d' : '#34d399'};">${status.delay_status}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Upcoming Station</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: #f8fafc;">${status.next_station_name ? status.next_station_name + ' (' + status.next_station + ')' : 'Approaching Destination'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Status Time</div>
                        <div style="font-size: 0.95rem; font-family: var(--font-mono); color: #cbd5e1;">${status.last_updated}</div>
                    </div>
                </div>

                <div class="live-disclaimer-note">
                    * Last updated: ${status.last_updated}. Data may be delayed or unavailable. Verify critical travel information through official railway sources (NTES / 139).
                </div>
            </div>

            <h4 style="color: #93c5fd; font-size: 1rem; margin-bottom: 12px;">Station Progress Timeline</h4>
            <div class="route-timeline-tree">
                ${status.timeline.map(s => `
                    <div class="timeline-station-node ${s.has_departed ? 'departed' : ''} ${s.station_code === status.current_station ? 'current-station' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 1rem; color: #fff;">${s.station_code} - ${escapeHtml(s.station_name)}</strong>
                                <span style="font-size: 0.78rem; color: #a7f3d0; margin-left: 8px;">${s.platform || 'PF 1'}</span>
                                ${s.has_departed ? '<span style="font-size: 0.75rem; color: #34d399; margin-left: 8px;">✓ Departed</span>' : ''}
                                ${s.station_code === status.current_station ? '<span style="font-size: 0.75rem; color: #f59e0b; margin-left: 8px;">📍 Train Here</span>' : ''}
                            </div>
                            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.85rem;">
                                <div>Sch: Arr ${s.scheduled_arrival} | Dep ${s.scheduled_departure}</div>
                                ${s.actual_arrival ? `<div style="color: #60a5fa;">Act: Arr ${s.actual_arrival} ${s.actual_departure ? '| Dep ' + s.actual_departure : ''}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not retrieve live running status for train #${escapeHtml(trainNumber)}.</div>`;
    }
}

// Load Route Timeline
async function loadRouteTimeline(trainNumber) {
    const container = document.getElementById("route-timeline-content");
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading route stops...</div>`;

    try {
        const res = await fetch(`/api/trains/${encodeURIComponent(trainNumber)}/route`);
        if (!res.ok) throw new Error("Route not found");
        const stops = await res.json();

        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 1.1rem; color: #fff;">Station Route & Halt Sequence for Train #${escapeHtml(trainNumber)}</h3>
            </div>
            <div class="route-timeline-tree">
                ${stops.map(s => `
                    <div class="timeline-station-node">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 1rem; color: #fff;">${s.station_code} - ${escapeHtml(s.station_name)}</strong>
                                <span style="font-size: 0.78rem; color: #a7f3d0; margin-left: 8px;">${s.platform || 'PF 1'}</span>
                                <span style="font-size: 0.75rem; color: var(--text-dim); margin-left: 8px;">Day ${s.day_of_journey} • ${s.distance_km} km</span>
                            </div>
                            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.88rem;">
                                <div>Arr: <strong>${s.scheduled_arrival}</strong> | Dep: <strong>${s.scheduled_departure}</strong></div>
                                <div style="font-size: 0.78rem; color: var(--text-muted);">${s.halt_minutes > 0 ? s.halt_minutes + ' min halt' : 'Start/End Station'}</div>
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 24px;">Could not load route for train #${escapeHtml(trainNumber)}.</div>`;
    }
}

// ================= JOURNEY PLANNER SUBMISSION =================
async function handleJourneyPlannerSubmit(e) {
    e.preventDefault();
    const fromStation = document.getElementById("jp-from-station").value.trim();
    const toStation = document.getElementById("jp-to-station").value.trim();
    const journeyDate = document.getElementById("jp-journey-date").value;
    const preferredClass = document.getElementById("jp-class").value;
    const tatkalType = document.getElementById("jp-tatkal-type").value;
    const primaryTrain = document.getElementById("jp-primary-train").value.trim();
    const alt1Train = document.getElementById("jp-alt1-train").value.trim() || null;
    const alt2Train = document.getElementById("jp-alt2-train").value.trim() || null;

    const payload = {
        from_station: fromStation,
        to_station: toStation,
        journey_date: journeyDate,
        preferred_train: primaryTrain,
        preferred_class: preferredClass,
        tatkal_type: tatkalType,
        primary_train: primaryTrain,
        alt_train_1: alt1Train,
        alt_train_2: alt2Train
    };

    try {
        const res = await fetch("/api/journey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const error = await res.json();
            showToast(`⚠️ Error: ${error.detail || "Could not save journey"}`);
            return;
        }

        const data = await res.json();
        applyJourneyState(data);
        showToast("✅ Journey plan saved! Tatkal opening calculated.");
        switchView("tatkal-prep");
    } catch (err) {
        showToast("⚠️ Network error while saving journey.");
    }
}

// Load Latest Journey
async function loadLatestJourney() {
    try {
        const res = await fetch("/api/journey/latest");
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.journey) {
            applyJourneyState(data);
        }
    } catch (err) {
        console.error("Latest journey error:", err);
    }
}

// Apply Journey State to UI & Start Countdown
function applyJourneyState(data) {
    activeJourney = data.journey;
    openingTimeIso = data.opening_time_iso;
    
    if (activeJourney) {
        // Update Journey Planner inputs
        const jpFrom = document.getElementById("jp-from-station");
        const jpTo = document.getElementById("jp-to-station");
        const jpDate = document.getElementById("jp-journey-date");
        const jpClass = document.getElementById("jp-class");
        const jpTatkal = document.getElementById("jp-tatkal-type");
        const jpPrimary = document.getElementById("jp-primary-train");
        const jpAlt1 = document.getElementById("jp-alt1-train");
        const jpAlt2 = document.getElementById("jp-alt2-train");

        if (jpFrom) jpFrom.value = activeJourney.from_station;
        if (jpTo) jpTo.value = activeJourney.to_station;
        if (jpDate) jpDate.value = activeJourney.journey_date;
        if (jpClass) jpClass.value = activeJourney.preferred_class;
        if (jpTatkal) jpTatkal.value = activeJourney.tatkal_type;
        if (jpPrimary) jpPrimary.value = activeJourney.primary_train || activeJourney.preferred_train;
        if (jpAlt1) jpAlt1.value = activeJourney.alt_train_1 || "";
        if (jpAlt2) jpAlt2.value = activeJourney.alt_train_2 || "";

        // Auto-discover route trains for Journey Planner if route is set
        if (activeJourney.from_station && activeJourney.to_station) {
            autoDiscoverJourneyTrains(activeJourney.from_station, activeJourney.to_station, false);
        }

        // Update Dashboard Slots Preview
        const dashPrimary = document.getElementById("dash-primary-train-name");
        const dashAlt1 = document.getElementById("dash-alt1-train-name");
        const dashAlt2 = document.getElementById("dash-alt2-train-name");
        if (dashPrimary) dashPrimary.textContent = activeJourney.primary_train || activeJourney.preferred_train;
        if (dashAlt1) dashAlt1.textContent = activeJourney.alt_train_1 || "None specified";
        if (dashAlt2) dashAlt2.textContent = activeJourney.alt_train_2 || "None specified";

        // Update Opening Times
        const dashOpenTime = document.getElementById("dash-opening-time");
        const tatkalOpenTime = document.getElementById("tatkal-opening-time");
        const timeText = data.opening_time || activeJourney.expected_opening_time;
        if (dashOpenTime) dashOpenTime.textContent = timeText;
        if (tatkalOpenTime) tatkalOpenTime.textContent = timeText;
    }

    if (countdownInterval) clearInterval(countdownInterval);
    notifiedMilestones.clear();
    startCountdownLoop();
}

// Countdown Engine
function startCountdownLoop() {
    updateCountdownTick();
    countdownInterval = setInterval(updateCountdownTick, 1000);
}

function updateCountdownTick() {
    if (!openingTimeIso) return;

    const targetTime = new Date(openingTimeIso).getTime();
    const now = new Date().getTime();
    const diffMs = targetTime - now;
    const totalSeconds = Math.floor(diffMs / 1000);

    const updateDigit = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val).padStart(2, "0");
    };

    const updateBadge = (id, text, bg, color, border) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
            el.style.background = bg;
            el.style.color = color;
            el.style.borderColor = border;
        }
    };

    if (totalSeconds <= 0) {
        ["dash-timer-days", "tatkal-timer-days"].forEach(id => updateDigit(id, "00"));
        ["dash-timer-hours", "tatkal-timer-hours"].forEach(id => updateDigit(id, "00"));
        ["dash-timer-minutes", "tatkal-timer-minutes"].forEach(id => updateDigit(id, "00"));
        ["dash-timer-seconds", "tatkal-timer-seconds"].forEach(id => updateDigit(id, "00"));

        ["dash-status-badge", "tatkal-status-badge"].forEach(id => 
            updateBadge(id, "WINDOW OPEN", "rgba(16, 185, 129, 0.2)", "#6ee7b7", "rgba(16, 185, 129, 0.5)")
        );

        const openMsg = "Tatkal booking window should now be open. Please open/use IRCTC manually.";
        const dashMsg = document.getElementById("dash-countdown-message");
        const tatkalMsg = document.getElementById("tatkal-countdown-message");
        if (dashMsg) dashMsg.innerHTML = `<strong>${openMsg}</strong>`;
        if (tatkalMsg) tatkalMsg.innerHTML = `<strong>${openMsg}</strong>`;

        if (!notifiedMilestones.has(0)) {
            notifiedMilestones.add(0);
            playAlertChime();
            triggerNotification("Tatkal Window Open", openMsg);
        }
        return;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    ["dash-timer-days", "tatkal-timer-days"].forEach(id => updateDigit(id, days));
    ["dash-timer-hours", "tatkal-timer-hours"].forEach(id => updateDigit(id, hours));
    ["dash-timer-minutes", "tatkal-timer-minutes"].forEach(id => updateDigit(id, minutes));
    ["dash-timer-seconds", "tatkal-timer-seconds"].forEach(id => updateDigit(id, seconds));

    const timeStr = `${days > 0 ? days + "d " : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const openNotice = `Tatkal opening in: ${timeStr}`;
    const dashMsg = document.getElementById("dash-countdown-message");
    const tatkalMsg = document.getElementById("tatkal-countdown-message");
    if (dashMsg) dashMsg.textContent = openNotice;
    if (tatkalMsg) tatkalMsg.textContent = openNotice;

    // Milestones
    checkMilestone(totalSeconds, 900, "15 Minutes Left", "15 minutes until Tatkal opening. Confirm your passenger details.");
    checkMilestone(totalSeconds, 300, "5 Minutes Left", "5 minutes until Tatkal opening! Prepare to open IRCTC manually.");
    checkMilestone(totalSeconds, 60, "1 Minute Left", "1 minute remaining! Tatkal window opens in 60 seconds.");

    if (totalSeconds <= 900) {
        ["dash-status-badge", "tatkal-status-badge"].forEach(id => 
            updateBadge(id, "OPENING SOON", "rgba(245, 158, 11, 0.2)", "#fcd34d", "rgba(245, 158, 11, 0.5)")
        );
    } else {
        ["dash-status-badge", "tatkal-status-badge"].forEach(id => 
            updateBadge(id, "UPCOMING", "rgba(59, 130, 246, 0.2)", "#93c5fd", "rgba(59, 130, 246, 0.5)")
        );
    }
}

function checkMilestone(secondsLeft, milestone, title, message) {
    if (secondsLeft <= milestone && secondsLeft > (milestone - 2) && !notifiedMilestones.has(milestone)) {
        notifiedMilestones.add(milestone);
        playAlertChime();
        triggerNotification(title, message);
        showToast(`⏰ ${title}: ${message}`);
    }
}

// ================= PASSENGERS =================
async function loadPassengers() {
    try {
        const res = await fetch("/api/passengers");
        if (!res.ok) return;
        const passengers = await res.json();
        renderPassengers(passengers);
    } catch (err) {
        console.error("Load passengers error:", err);
    }
}

function renderPassengers(passengers) {
    const dashContainer = document.getElementById("dash-passenger-list");
    const viewContainer = document.getElementById("view-passenger-container");
    const dashCount = document.getElementById("dash-passenger-count");
    const addPanel = document.getElementById("view-add-passenger-panel");

    if (dashCount) dashCount.textContent = passengers.length;

    // Dashboard preview
    if (dashContainer) {
        if (!passengers || passengers.length === 0) {
            dashContainer.innerHTML = `<div style="color: var(--text-dim); font-size: 0.88rem; text-align: center; padding: 12px;">No passengers prepared.</div>`;
        } else {
            dashContainer.innerHTML = passengers.map((p, idx) => `
                <div style="background: rgba(11, 15, 25, 0.5); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem;">
                    <div>${idx + 1}. <strong>${escapeHtml(p.name)}</strong> (${p.age}y, ${p.gender})</div>
                    <button class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.name)}', 'Name')">Copy Name</button>
                </div>
            `).join("");
        }
    }

    // Full Passenger View
    if (viewContainer) {
        if (!passengers || passengers.length === 0) {
            viewContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">No passengers prepared yet. Add up to 4 passengers below.</div>`;
            if (addPanel) addPanel.style.display = "block";
            return;
        }

        viewContainer.innerHTML = passengers.map((p, idx) => `
            <div class="passenger-card" id="passenger-card-${p.id}">
                <div class="passenger-details">
                    <div class="passenger-name">
                        ${idx + 1}. ${escapeHtml(p.name)} 
                        <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">(${p.age} yrs, ${p.gender})</span>
                    </div>
                    <div class="passenger-sub">
                        Berth: <strong>${p.berth_preference}</strong> | Meal: <strong>${p.meal_preference}</strong>
                    </div>
                </div>
                <div class="passenger-actions">
                    <button class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.name)}', 'Name')">Copy Name</button>
                    <button class="btn btn-secondary btn-sm" onclick="copyIndividualField('${p.age}', 'Age')">Copy Age</button>
                    <button class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="deletePassenger(${p.id})">✕</button>
                </div>
            </div>
        `).join("");

        if (addPanel) addPanel.style.display = passengers.length >= 4 ? "none" : "block";
    }
}

async function handlePassengerSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("view-passenger-name").value.trim();
    const age = parseInt(document.getElementById("view-passenger-age").value, 10);
    const gender = document.getElementById("view-passenger-gender").value;
    const berth = document.getElementById("view-passenger-berth").value;
    const meal = document.getElementById("view-passenger-meal").value;

    const payload = {
        name: name,
        age: age,
        gender: gender,
        berth_preference: berth,
        meal_preference: meal
    };

    try {
        const res = await fetch("/api/passengers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            showToast(`⚠️ ${err.detail || "Could not add passenger."}`);
            return;
        }

        document.getElementById("form-view-add-passenger").reset();
        showToast("✅ Passenger added!");
        loadPassengers();
    } catch (err) {
        showToast("⚠️ Network error while adding passenger.");
    }
}

window.deletePassenger = async function(id) {
    try {
        const res = await fetch(`/api/passengers/${id}`, { method: "DELETE" });
        if (res.ok) {
            showToast("🗑️ Passenger removed.");
            loadPassengers();
        }
    } catch (err) {
        showToast("⚠️ Error removing passenger.");
    }
};

window.copyIndividualField = function(val, label) {
    copyToClipboard(val);
    showToast(`📋 Copied ${label}: "${val}"`);
};

async function copyAllPassengerDetails() {
    try {
        const res = await fetch("/api/clipboard/passengers");
        if (!res.ok) return;
        const data = await res.json();
        if (data.count === 0) {
            showToast("⚠️ Please add passengers first.");
            return;
        }
        copyToClipboard(data.formatted_summary);
        showToast(`📋 Copied all ${data.count} passenger details to clipboard!`);
    } catch (err) {
        showToast("⚠️ Error preparing clipboard text.");
    }
}

// ================= CHECKLIST =================
async function loadChecklist() {
    try {
        const res = await fetch("/api/checklist");
        if (!res.ok) return;
        const items = await res.json();
        renderChecklist(items);
    } catch (err) {
        console.error("Checklist load error:", err);
    }
}

function renderChecklist(items) {
    const container = document.getElementById("tatkal-checklist-container");
    if (!container) return;

    let checkedCount = 0;
    container.innerHTML = items.map(item => {
        if (item.checked) checkedCount++;
        return `
            <label class="checklist-item ${item.checked ? 'checked' : ''}" id="check-item-${item.item_key}">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleChecklistItem('${item.item_key}', this.checked)">
                <span class="checklist-text">${escapeHtml(item.item_text)}</span>
            </label>
        `;
    }).join("");

    const total = items.length;
    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    const progressFill = document.getElementById("tatkal-checklist-progress-fill");
    const progressText = document.getElementById("tatkal-checklist-progress-text");
    const dashFill = document.getElementById("dash-checklist-fill");
    const dashText = document.getElementById("dash-checklist-text");

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${checkedCount} of ${total} Completed (${percent}%)`;
    if (dashFill) dashFill.style.width = `${percent}%`;
    if (dashText) dashText.textContent = `${checkedCount} of ${total} Completed (${percent}%)`;
}

window.toggleChecklistItem = async function(itemKey, isChecked) {
    try {
        const res = await fetch(`/api/checklist/${itemKey}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_key: itemKey, checked: isChecked })
        });
        if (res.ok) loadChecklist();
    } catch (err) {
        console.error("Checklist update error:", err);
    }
};

async function resetChecklist() {
    try {
        const res = await fetch("/api/checklist/reset", { method: "POST" });
        if (res.ok) {
            showToast("↺ Checklist reset to default.");
            loadChecklist();
        }
    } catch (err) {
        showToast("⚠️ Could not reset checklist.");
    }
}

// Helpers
function playAlertChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (err) {}
}

function triggerNotification(title, message) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body: message });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body: message });
            }
        });
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    }
}

function showToast(msg) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeJs(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}
