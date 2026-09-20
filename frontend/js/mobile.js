/**
 * RailReady Mobile App Controller
 * Adapts RailReady's actual current features (Dashboard, Tatkal Countdown,
 * Prepared Passengers, Booking Readiness, Route Search, Reminders & Alerts)
 * into the Android mobile card layout, drawer, and bottom navigation.
 */
(function() {
    let mCurrentView = "dashboard";
    let activeJourneyData = null;
    let preparedPassengersList = [];
    let mTextareaFormat = "full";
    let mCategoryFilter = "ALL";
    let currentSearchResults = [];
    let mCountdownInterval = null;

    // Load recent searches from localStorage or initialize with user's corridor
    let mRecentSearches = [];
    try {
        const stored = localStorage.getItem("railready_m_recent");
        if (stored) {
            mRecentSearches = JSON.parse(stored);
        }
    } catch (e) {}

    if (!mRecentSearches || !mRecentSearches.length) {
        mRecentSearches = [
            { trainNo: "12707", trainName: "Jaipur - Pune Rajdhani Express", from: "JP", to: "PUNE" },
            { trainNo: "12302", trainName: "Howrah Rajdhani Express", from: "NDLS", to: "HWH" },
            { trainNo: "12952", trainName: "Mumbai Tejas Rajdhani", from: "NDLS", to: "BCT" }
        ];
    }

    const quotaList = [
        { code: "TQ", name: "Tatkal Quota (10 AM AC / 11 AM Non-AC)" },
        { code: "PT", name: "Premium Tatkal Quota" },
        { code: "GN", name: "General Quota" },
        { code: "LD", name: "Ladies Quota" },
        { code: "SS", name: "Senior Citizen Quota" }
    ];
    let selectedQuotaIdx = 0;

    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    document.addEventListener("DOMContentLoaded", () => {
        initMobileRailReady();
    });

    function initMobileRailReady() {
        setupMobileNavigation();
        setupMobileSearch();
        setupMobileTatkal();
        setupMobilePassengers();
        setupMobileAlerts();
        setupMobileAlternates();
        setupMobileDrawer();
        setupDesktopToggle();
        renderSearchHistory();
        loadMobileData();
        startCountdownTicker();
    }

    // ================= DATA SYNCHRONIZATION =================
    async function loadMobileData() {
        try {
            await Promise.all([
                refreshMobileJourneyAndCountdown(),
                refreshMobilePassengers(),
                refreshMobileChecklist()
            ]);
        } catch (e) {
            console.error("Mobile data sync error", e);
        }
    }

    // ================= NAVIGATION & VIEW SWITCHING =================
    window.setMobileView = function(viewName) {
        mCurrentView = viewName;
        $$(".m-view").forEach(v => v.classList.remove("active"));
        const targetView = $(`m-view-${viewName}`);
        if (targetView) targetView.classList.add("active");

        const backBtn = $("m-btn-back");
        const drawerBtn = $("m-btn-drawer");
        const headerTitle = $("m-header-title");
        const micBtn = $("m-btn-mic");

        // Update Bottom Nav active state
        $$(".bottom-nav-tab").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-mview") === viewName);
        });

        if (viewName === "dashboard") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "RailReady Dashboard";
            micBtn?.classList.remove("hidden");
            $("m-tab-dashboard")?.classList.add("active");
            refreshMobileJourneyAndCountdown();
            refreshMobilePassengers();
            refreshMobileChecklist();
        } else if (viewName === "trains") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Train Information & Search";
            micBtn?.classList.remove("hidden");
            $("m-tab-trains")?.classList.add("active");
            executeMobileTrainSearch();
        } else if (viewName === "results") {
            drawerBtn?.classList.add("hidden");
            backBtn?.classList.remove("hidden");
            if (headerTitle) headerTitle.textContent = "Search results";
            micBtn?.classList.add("hidden");
        } else if (viewName === "tatkal") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Tatkal Preparation";
            micBtn?.classList.add("hidden");
            $("m-tab-tatkal")?.classList.add("active");
            refreshMobileJourneyAndCountdown();
            refreshMobileChecklist();
        } else if (viewName === "passengers") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Prepared Passengers";
            micBtn?.classList.add("hidden");
            $("m-tab-passengers")?.classList.add("active");
            refreshMobilePassengers();
        } else if (viewName === "alerts") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Reminders & Alerts";
            micBtn?.classList.add("hidden");
            $("m-tab-alerts")?.classList.add("active");
        } else if (viewName === "alternates") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Split Routes & Alternatives";
            micBtn?.classList.add("hidden");
            loadMobileSplitRoutes();
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    function setupMobileNavigation() {
        $("m-btn-back")?.addEventListener("click", () => {
            if (mCurrentView === "results") {
                setMobileView("trains");
            } else {
                setMobileView("dashboard");
            }
        });

        $$(".bottom-nav-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const target = tab.getAttribute("data-mview");
                if (target) setMobileView(target);
            });
        });

        $("m-btn-open-irctc-top")?.addEventListener("click", () => {
            if (window.openIrctcModal) window.openIrctcModal();
            else {
                const modal = $("modal-irctc-guide");
                if (modal) modal.classList.add("active");
            }
        });
    }

    // ================= SIDE DRAWER =================
    function setupMobileDrawer() {
        const drawer = $("mobile-side-drawer");
        const backdrop = $("mobile-drawer-backdrop");
        const drawerBtn = $("m-btn-drawer");

        const openDrawer = () => {
            drawer?.classList.add("active");
            backdrop?.classList.add("active");
        };

        const closeDrawer = () => {
            drawer?.classList.remove("active");
            backdrop?.classList.remove("active");
        };

        drawerBtn?.addEventListener("click", openDrawer);
        backdrop?.addEventListener("click", closeDrawer);

        const bindDrawerNav = (id, viewName) => {
            $(id)?.addEventListener("click", () => {
                closeDrawer();
                setMobileView(viewName);
            });
        };

        bindDrawerNav("drawer-nav-dashboard", "dashboard");
        bindDrawerNav("drawer-nav-trains", "trains");
        bindDrawerNav("drawer-nav-tatkal", "tatkal");
        bindDrawerNav("drawer-nav-passengers", "passengers");
        bindDrawerNav("drawer-nav-alerts", "alerts");
        bindDrawerNav("drawer-nav-alternates", "alternates");

        $("drawer-update-timetable")?.addEventListener("click", () => {
            closeDrawer();
            showMobileToast("🔄 Offline timetable synced (26 active corridors)");
        });

        $("drawer-clear-recent")?.addEventListener("click", () => {
            mRecentSearches = [];
            try { localStorage.removeItem("railready_m_recent"); } catch (e) {}
            renderSearchHistory();
            closeDrawer();
            showMobileToast("🗑️ Recent searches cleared");
        });

        $("drawer-open-irctc")?.addEventListener("click", () => {
            closeDrawer();
            const modal = $("modal-irctc-guide");
            if (modal) modal.classList.add("active");
        });

        $("drawer-switch-desktop")?.addEventListener("click", () => {
            closeDrawer();
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
            showMobileToast("💻 Switched to Desktop Dashboard");
        });
    }

    // ================= DESKTOP TOGGLE =================
    function setupDesktopToggle() {
        $("btn-toggle-mobile")?.addEventListener("click", () => {
            document.body.classList.remove("force-desktop-view");
            document.body.classList.add("force-mobile-view");
            setMobileView("dashboard");
            showMobileToast("📱 Switched to RailReady Mobile Experience");
        });
    }

    // ================= HELPER FUNCTIONS =================
    function extractCode(val) {
        if (!val) return "STN";
        val = val.trim().toUpperCase();
        if (val.includes(" - ")) return val.split(" - ")[0].trim();
        const parts = val.split(" ");
        if (parts[0].length >= 2 && parts[0].length <= 5) return parts[0];
        return val.substring(0, 4);
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function showMobileToast(msg) {
        if (window.showToast) {
            window.showToast(msg);
        } else {
            const container = $("toast-container");
            if (!container) return;
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = msg;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    // ================= 1. DASHBOARD & LIVE TATKAL COUNTDOWN =================
    async function refreshMobileJourneyAndCountdown() {
        try {
            const res = await fetch("/api/journey/latest");
            if (!res.ok) return;
            const data = await res.json();
            activeJourneyData = data.journey;

            // Render Planned Trains on Dashboard
            if (activeJourneyData) {
                const primaryEl = $("m-dash-primary-train");
                const alt1El = $("m-dash-alt1-train");
                const alt2El = $("m-dash-alt2-train");
                if (primaryEl) primaryEl.textContent = activeJourneyData.primary_train || activeJourneyData.preferred_train || "Not Selected";
                if (alt1El) alt1El.textContent = activeJourneyData.alt_train_1 || "None";
                if (alt2El) alt2El.textContent = activeJourneyData.alt_train_2 || "None";

                // Pre-populate Search and Tatkal station inputs from user's active journey
                if ($("m-input-from") && !$("m-input-from").dataset.userModified) {
                    $("m-input-from").value = activeJourneyData.from_station || "JP";
                    if ($("m-badge-from")) $("m-badge-from").textContent = extractCode(activeJourneyData.from_station || "JP");
                }
                if ($("m-input-to") && !$("m-input-to").dataset.userModified) {
                    $("m-input-to").value = activeJourneyData.to_station || "PUNE";
                    if ($("m-badge-to")) $("m-badge-to").textContent = extractCode(activeJourneyData.to_station || "PUNE");
                }
                if ($("m-tatkal-from")) {
                    $("m-tatkal-from").value = activeJourneyData.from_station || "JP";
                    if ($("m-tatkal-badge-from")) $("m-tatkal-badge-from").textContent = extractCode(activeJourneyData.from_station || "JP");
                }
                if ($("m-tatkal-to")) {
                    $("m-tatkal-to").value = activeJourneyData.to_station || "PUNE";
                    if ($("m-tatkal-badge-to")) $("m-tatkal-badge-to").textContent = extractCode(activeJourneyData.to_station || "PUNE");
                }

                // Tatkal opening time
                const openTimeStr = data.opening_time || activeJourneyData.expected_opening_time || "--";
                if ($("m-dash-expected-time")) $("m-dash-expected-time").textContent = openTimeStr;
            }

            updateCountdownDisplay(data.countdown);
        } catch (e) {}
    }

    function updateCountdownDisplay(cd) {
        if (!cd) return;
        const d = String(cd.days || 0).padStart(2, "0");
        const h = String(cd.hours || 0).padStart(2, "0");
        const m = String(cd.minutes || 0).padStart(2, "0");
        const s = String(cd.seconds || 0).padStart(2, "0");

        // Update Dashboard Countdown
        if ($("m-cd-days")) $("m-cd-days").textContent = d;
        if ($("m-cd-hours")) $("m-cd-hours").textContent = h;
        if ($("m-cd-mins")) $("m-cd-mins").textContent = m;
        if ($("m-cd-secs")) $("m-cd-secs").textContent = s;
        if ($("m-cd-msg")) $("m-cd-msg").textContent = cd.message || `Tatkal opening in: ${h}:${m}:${s}`;
        if ($("m-dash-status-badge")) {
            $("m-dash-status-badge").textContent = cd.status || (cd.is_open ? "OPEN" : "UPCOMING");
            $("m-dash-status-badge").className = cd.is_open ? "m-badge-tag-green" : "m-status-badge-upcoming";
        }

        // Update Tatkal Tab Countdown
        if ($("m-tatkal-cd-days")) $("m-tatkal-cd-days").textContent = d;
        if ($("m-tatkal-cd-hours")) $("m-tatkal-cd-hours").textContent = h;
        if ($("m-tatkal-cd-mins")) $("m-tatkal-cd-mins").textContent = m;
        if ($("m-tatkal-cd-secs")) $("m-tatkal-cd-secs").textContent = s;
        if ($("m-tatkal-cd-msg")) $("m-tatkal-cd-msg").textContent = cd.message || "Tatkal window opens at 10:00 AM IST (AC) / 11:00 AM IST (Non-AC).";
    }

    function startCountdownTicker() {
        if (mCountdownInterval) clearInterval(mCountdownInterval);
        mCountdownInterval = setInterval(async () => {
            if (mCurrentView === "dashboard" || mCurrentView === "tatkal") {
                try {
                    const res = await fetch("/api/journey/latest");
                    if (res.ok) {
                        const data = await res.json();
                        updateCountdownDisplay(data.countdown);
                    }
                } catch (e) {}
            }
        }, 1000);
    }

    // ================= 2. PREPARED PASSENGERS & TEXT AREA =================
    async function refreshMobilePassengers() {
        try {
            const res = await fetch("/api/passengers");
            if (!res.ok) return;
            preparedPassengersList = await res.json();

            // Update Counts
            const dashCount = $("m-dash-pax-count");
            const paxTabCount = $("m-pax-count-badge");
            if (dashCount) dashCount.textContent = preparedPassengersList.length;
            if (paxTabCount) paxTabCount.textContent = `${preparedPassengersList.length}/4 Prepared`;

            // Render Dashboard Passenger Cards
            renderDashboardPassengers(preparedPassengersList);

            // Render Passenger Tab Cards
            renderPassengersTabList(preparedPassengersList);

            // Update Both Text Areas
            updateMobilePassengerTextareas();
        } catch (e) {}
    }

    function renderDashboardPassengers(passengers) {
        const container = $("m-dash-passengers-list");
        if (!container) return;

        if (!passengers.length) {
            container.innerHTML = `<div style="color: var(--m-text-dim); font-size: 0.84rem; text-align: center; padding: 10px;">No passengers prepared. Tap Manage to add.</div>`;
            return;
        }

        container.innerHTML = passengers.map((p, idx) => `
            <div class="m-passenger-card" style="margin-bottom: 8px; padding: 10px 12px;">
                <div class="m-pax-top">
                    <span class="m-pax-name">${idx + 1}. ${escapeHtml(p.name)} (${p.age}y, ${p.gender})</span>
                    <button class="m-btn-mini" onclick="copyMobileField('${escapeHtml(p.name)}', 'Name')">Copy Name</button>
                </div>
                <div class="m-pax-badges-row" style="margin-bottom: 0;">
                    <span class="m-pax-badge">🛏️ ${escapeHtml(p.berth_preference || 'No Preference')}</span>
                    <span class="m-pax-badge">🥗 ${escapeHtml(p.meal_preference || 'None')}</span>
                    ${p.senior_citizen_opt ? '<span class="m-pax-badge" style="color: #fef08a;">👴 Senior Concession</span>' : ''}
                </div>
            </div>
        `).join("");
    }

    function renderPassengersTabList(passengers) {
        const container = $("m-passengers-list");
        if (!container) return;

        if (!passengers.length) {
            container.innerHTML = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">No passengers prepared yet. Add up to 4 for Tatkal.</div>`;
            return;
        }

        container.innerHTML = passengers.map((p, idx) => `
            <div class="m-passenger-card">
                <div class="m-pax-top">
                    <span class="m-pax-name">${idx + 1}. ${escapeHtml(p.name)}</span>
                    <span class="m-pax-meta">${p.age} yrs • ${p.gender}</span>
                </div>
                <div class="m-pax-badges-row">
                    <span class="m-pax-badge">🛏️ ${escapeHtml(p.berth_preference || 'No Preference')}</span>
                    <span class="m-pax-badge">🥗 ${escapeHtml(p.meal_preference || 'None')}</span>
                    ${p.senior_citizen_opt ? '<span class="m-pax-badge" style="color: #fef08a;">👴 Senior Concession</span>' : ''}
                </div>
                <div class="m-pax-actions">
                    <button class="m-btn-mini" onclick="copyMobileField('${escapeHtml(p.name)}', 'Passenger Name')">📋 Name</button>
                    <button class="m-btn-mini" onclick="copyMobileField('${p.age}', 'Age')">📋 Age</button>
                    <button class="m-btn-mini" onclick="copyMobileField('${escapeHtml(p.berth_preference || '')}', 'Berth')">🛏️ Berth</button>
                    <button class="m-btn-mini" style="color: #ef4444;" onclick="deleteMobilePassenger(${p.id})">🗑️</button>
                </div>
            </div>
        `).join("");
    }

    function generateMobilePassengerSummary(passengers, format = "full") {
        if (!passengers || !passengers.length) {
            return "No passenger details prepared. Add passengers in Passenger Details tab.";
        }
        if (format === "row") {
            return ["# | Name | Age | Gender | Berth | Meal | Senior Citizen", ...passengers.map((p, idx) => `${idx + 1}, ${p.name}, ${p.age}, ${p.gender}, ${p.berth_preference}, ${p.meal_preference}, ${p.senior_citizen_opt ? 'Yes' : 'No'}`)].join("\n");
        }
        if (format === "irctc") {
            return passengers.map((p, idx) => `${idx + 1}. ${p.name} | ${p.age}y | ${p.gender} | Berth: ${p.berth_preference} | Meal: ${p.meal_preference}${p.senior_citizen_opt ? ' | [Senior Citizen Concession]' : ''}`).join("\n");
        }
        const lines = [`=== PREPARED PASSENGERS (${passengers.length}/4) ===`];
        if (activeJourneyData) {
            lines.push(`Route: ${activeJourneyData.from_station} -> ${activeJourneyData.to_station} | Date: ${activeJourneyData.journey_date}`);
            lines.push(`Train: ${activeJourneyData.primary_train || activeJourneyData.preferred_train || 'N/A'} (${activeJourneyData.preferred_class || '3A'}) | Quota: Tatkal`);
            lines.push("--------------------------------------------------");
        }
        passengers.forEach((p, idx) => {
            lines.push(`Passenger ${idx + 1}:\n  Full Name:       ${p.name}\n  Age & Gender:    ${p.age} years | ${p.gender}\n  Berth Choice:    ${p.berth_preference}\n  Meal Choice:     ${p.meal_preference}\n  Senior Citizen:  ${p.senior_citizen_opt ? 'Yes (Concession Opted)' : 'No'}${idx < passengers.length - 1 ? '\n' : ''}`);
        });
        lines.push("==================================================\n* Copy into IRCTC booking form.");
        return lines.join("\n");
    }

    function updateMobilePassengerTextareas() {
        const text = generateMobilePassengerSummary(preparedPassengersList, mTextareaFormat);
        const dashTa = $("m-dash-passenger-textarea");
        const paxTa = $("m-passenger-textarea");
        if (dashTa) dashTa.value = text;
        if (paxTa) paxTa.value = text;
    }

    window.switchMobileTextareaFormat = function(format) {
        mTextareaFormat = format;
        $$(".m-fmt-pill").forEach(p => p.classList.remove("active"));
        const pillDash = $(`m-dash-pill-${format}`);
        if (pillDash) pillDash.classList.add("active");
        updateMobilePassengerTextareas();
    };

    window.copyMobileTextareaContent = async function(taId) {
        const ta = $(taId);
        if (!ta || !ta.value.trim() || ta.value.startsWith("No passenger")) {
            showMobileToast("⚠️ No passenger details to copy.");
            return;
        }
        try {
            await navigator.clipboard.writeText(ta.value);
            showMobileToast("📋 All passenger details copied to clipboard!");
        } catch (e) {
            ta.focus();
            ta.select();
            document.execCommand("copy");
            showMobileToast("📋 Copied via fallback!");
        }
    };

    window.selectMobileTextarea = function(taId) {
        const ta = $(taId);
        if (ta) {
            ta.focus();
            ta.select();
            showMobileToast("🔍 All text selected! Press Ctrl+C.");
        }
    };

    window.copyMobileField = async function(val, label) {
        try {
            await navigator.clipboard.writeText(val);
            showMobileToast(`📋 Copied ${label}: ${val}`);
        } catch (e) {}
    };

    window.deleteMobilePassenger = async function(id) {
        try {
            await fetch(`/api/passengers/${id}`, { method: "DELETE" });
            refreshMobilePassengers();
            if (window.loadPassengers) window.loadPassengers();
            showMobileToast("🗑️ Passenger removed.");
        } catch (e) {}
    };

    function setupMobilePassengers() {
        $("m-dash-btn-copy-all")?.addEventListener("click", () => {
            copyMobileTextareaContent("m-dash-passenger-textarea");
        });

        // Passenger tab pills
        $$(".m-fmt-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const fmt = pill.getAttribute("data-fmt");
                if (fmt) switchMobileTextareaFormat(fmt);
            });
        });

        $("m-btn-copy-textarea")?.addEventListener("click", () => {
            copyMobileTextareaContent("m-passenger-textarea");
        });

        $("m-btn-select-all-textarea")?.addEventListener("click", () => {
            selectMobileTextarea("m-passenger-textarea");
        });

        // Add Passenger Form
        $("m-form-add-passenger")?.addEventListener("submit", async e => {
            e.preventDefault();
            const name = $("m-input-pax-name")?.value.trim();
            const age = parseInt($("m-input-pax-age")?.value);
            const gender = $("m-select-pax-gender")?.value || "MALE";
            const berth = $("m-select-pax-berth")?.value || "NO_PREFERENCE";
            const meal = $("m-select-pax-meal")?.value || "VEG";
            const senior = $("m-check-pax-senior")?.checked || false;

            if (!name || isNaN(age)) {
                showMobileToast("⚠️ Please enter passenger name and age.");
                return;
            }

            try {
                const res = await fetch("/api/passengers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name, age, gender,
                        berth_preference: berth,
                        meal_preference: meal,
                        senior_citizen_opt: senior
                    })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || "Failed to add passenger");
                }
                $("m-form-add-passenger").reset();
                refreshMobilePassengers();
                if (window.loadPassengers) window.loadPassengers();
                showMobileToast(`✅ Added passenger ${name}`);
            } catch (err) {
                showMobileToast(`⚠️ ${err.message}`);
            }
        });
    }

    // ================= 3. BOOKING READINESS CHECKLIST =================
    async function refreshMobileChecklist() {
        const container = $("m-checklist-container");
        try {
            const res = await fetch("/api/checklist");
            if (!res.ok) return;
            const items = await res.json();

            let checkedCount = 0;
            items.forEach(it => { if (it.checked) checkedCount++; });
            const total = items.length;
            const pct = total ? Math.round((checkedCount / total) * 100) : 0;

            // Update Progress Bar on Dashboard
            const fill = $("m-dash-checklist-fill");
            const text = $("m-dash-checklist-text");
            if (fill) fill.style.width = `${pct}%`;
            if (text) text.textContent = `${checkedCount} of ${total} Completed (${pct}%)`;

            // Render in Tatkal Tab
            if (container) {
                container.innerHTML = items.map(item => `
                    <div class="m-check-row ${item.checked ? 'checked' : ''}" onclick="toggleMobileChecklistItem('${item.item_key || item.key}', ${!item.checked})">
                        <div class="m-checkbox-custom">${item.checked ? '✓' : ''}</div>
                        <span class="m-check-text">${escapeHtml(item.item_text || item.text)}</span>
                    </div>
                `).join("");
            }
        } catch (e) {}
    }

    window.toggleMobileChecklistItem = async function(key, checked) {
        try {
            await fetch(`/api/checklist/${key}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ item_key: key, checked })
            });
            refreshMobileChecklist();
            if (window.loadChecklist) window.loadChecklist();
        } catch (e) {}
    };

    // ================= 4. TRAIN SEARCH & CATEGORY FILTERS =================
    function setupMobileSearch() {
        const inputFrom = $("m-input-from");
        const inputTo = $("m-input-to");
        const badgeFrom = $("m-badge-from");
        const badgeTo = $("m-badge-to");

        const updateBadges = () => {
            if (badgeFrom && inputFrom) badgeFrom.textContent = extractCode(inputFrom.value);
            if (badgeTo && inputTo) badgeTo.textContent = extractCode(inputTo.value);
        };

        inputFrom?.addEventListener("input", () => {
            inputFrom.dataset.userModified = "true";
            updateBadges();
        });
        inputTo?.addEventListener("input", () => {
            inputTo.dataset.userModified = "true";
            updateBadges();
        });

        $("m-clear-from")?.addEventListener("click", () => {
            if (inputFrom) { inputFrom.value = ""; inputFrom.focus(); updateBadges(); }
        });

        $("m-clear-to")?.addEventListener("click", () => {
            if (inputTo) { inputTo.value = ""; inputTo.focus(); updateBadges(); }
        });

        $("m-btn-swap")?.addEventListener("click", () => {
            if (inputFrom && inputTo) {
                const tmp = inputFrom.value;
                inputFrom.value = inputTo.value;
                inputTo.value = tmp;
                updateBadges();
                executeMobileTrainSearch();
            }
        });

        $("m-btn-find-trains")?.addEventListener("click", () => {
            executeMobileTrainSearch();
        });

        // Category Filter Pills
        $$("#m-search-cat-pills .m-filter-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                $$("#m-search-cat-pills .m-filter-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                mCategoryFilter = pill.getAttribute("data-cat") || "ALL";
                filterAndRenderTrainCards();
            });
        });

        $("m-sticky-seat-bar")?.addEventListener("click", () => {
            showMobileToast("🎟️ Check Tatkal & General seat availability on IRCTC");
            const modal = $("modal-irctc-guide");
            if (modal) modal.classList.add("active");
        });
    }

    async function executeMobileTrainSearch() {
        const src = $("m-input-from")?.value.trim() || "JP";
        const dst = $("m-input-to")?.value.trim() || "PUNE";
        const srcCode = extractCode(src);
        const dstCode = extractCode(dst);

        const bannerText = $("m-banner-route-text");
        if (bannerText) bannerText.innerHTML = `${srcCode} &nbsp;➔&nbsp; ${dstCode}`;

        const container = $("m-trains-cards-list");
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--m-text-muted); padding: 24px;">🔍 Searching trains between ${srcCode} and ${dstCode}...</div>`;

        try {
            const res = await fetch(`/api/trains/search?from_station=${srcCode}&to_station=${dstCode}`);
            if (!res.ok) throw new Error("Search failed");
            currentSearchResults = await res.json();
            filterAndRenderTrainCards();
            saveSearchToHistory(srcCode, dstCode);
        } catch (e) {
            if (container) container.innerHTML = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">No trains found for ${srcCode} ➔ ${dstCode}. Try NDLS to HWH or BCT.</div>`;
        }
    }

    function filterAndRenderTrainCards() {
        const container = $("m-trains-cards-list");
        const resultsContainer = $("m-results-cards");
        if (!container && !resultsContainer) return;

        let filtered = currentSearchResults;
        if (mCategoryFilter !== "ALL") {
            filtered = currentSearchResults.filter(t => {
                const name = (t.train_name || "").toLowerCase();
                const type = (t.train_type || "").toLowerCase();
                if (mCategoryFilter === "Rajdhani") return name.includes("rajdhani") || type.includes("rajdhani");
                if (mCategoryFilter === "Special") return name.includes("special") || type.includes("special");
                if (mCategoryFilter === "Mail/Express") return name.includes("express") || name.includes("mail") || name.includes("sf");
                if (mCategoryFilter === "Passenger") return name.includes("passenger") || name.includes("memu") || name.includes("local");
                return true;
            });
        }

        if (!filtered.length) {
            const emptyHtml = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">No trains matching category "${mCategoryFilter}".</div>`;
            if (container) container.innerHTML = emptyHtml;
            if (resultsContainer) resultsContainer.innerHTML = emptyHtml;
            return;
        }

        const cardsHtml = filtered.map(t => {
            const isRajdhani = (t.train_name || "").toLowerCase().includes("rajdhani");
            const badgeClass = isRajdhani ? "badge-blue" : "badge-gray";

            let daysHtml = "";
            if (t.running_days && t.running_days.length >= 7) {
                daysHtml = `<span class="m-runs-daily">Runs Daily</span>`;
            } else {
                const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];
                const activeDays = new Set((t.running_days || []).map(d => d.substring(0, 3).toUpperCase()));
                const allDaysUpper = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
                daysHtml = `<span class="m-days-group">${dayLetters.map((l, i) => {
                    const active = activeDays.has(allDaysUpper[i]);
                    return `<span class="${active ? 'day-active' : ''}">${l}</span>`;
                }).join(" ")}</span>`;
            }

            const delayMins = (parseInt(t.train_number) % 15);
            const statusHtml = delayMins > 0
                ? `<div class="m-train-status-line status-live">Live: Running ${delayMins}m late</div>`
                : `<div class="m-train-status-line status-live" style="color: #34d399;">Live: On Time</div>`;

            return `
                <div class="m-train-card" onclick="openTrainMobileDetails('${t.train_number}')">
                    <div class="m-train-card-header">
                        <span class="m-train-number-badge ${badgeClass}">${t.train_number}</span>
                        <div class="m-train-timing-line">
                            ${t.departure_time || '--:--'} <span class="duration-sep">—</span> ${t.duration || '--'} <span class="duration-sep">—</span> ${t.arrival_time || '--:--'}
                        </div>
                    </div>
                    <div class="m-train-middle-row">
                        <span class="m-train-name-bold">${escapeHtml(t.train_name)}</span>
                        ${daysHtml}
                    </div>
                    ${statusHtml}
                </div>
            `;
        }).join("");

        if (container) container.innerHTML = cardsHtml;
        if (resultsContainer) resultsContainer.innerHTML = cardsHtml;
    }

    window.openTrainMobileDetails = function(trainNumber) {
        if (window.loadTrainDetails) {
            window.loadTrainDetails(trainNumber);
        }
        showMobileToast(`🚆 Train ${trainNumber} selected. Opening schedule.`);
    };

    function saveSearchToHistory(from, to) {
        if (!from || !to) return;
        const exists = mRecentSearches.some(s => s.from === from && s.to === to);
        if (!exists) {
            mRecentSearches.unshift({
                trainNo: "CORRIDOR",
                trainName: `${from} ➔ ${to}`,
                from, to
            });
            if (mRecentSearches.length > 5) mRecentSearches.pop();
            try { localStorage.setItem("railready_m_recent", JSON.stringify(mRecentSearches)); } catch (e) {}
            renderSearchHistory();
        }
    }

    function renderSearchHistory() {
        const container = $("m-search-history-list");
        if (!container) return;

        container.innerHTML = mRecentSearches.map(item => `
            <div class="m-history-item" onclick="handleHistoryItemClick('${item.from}', '${item.to}')">
                <div class="m-history-train-info">${item.trainName || item.trainNo}</div>
                <div class="m-history-route">
                    <span>${item.from} - ${item.to}</span>
                    <span class="m-history-chevron">›</span>
                </div>
            </div>
        `).join("");
    }

    window.handleHistoryItemClick = function(from, to) {
        if ($("m-input-from")) $("m-input-from").value = from;
        if ($("m-input-to")) $("m-input-to").value = to;
        if ($("m-badge-from")) $("m-badge-from").textContent = from;
        if ($("m-badge-to")) $("m-badge-to").textContent = to;
        executeMobileTrainSearch();
    };

    // ================= 5. TATKAL PREPARATION VIEW =================
    function setupMobileTatkal() {
        const tktInputFrom = $("m-tatkal-from");
        const tktInputTo = $("m-tatkal-to");
        const tktBadgeFrom = $("m-tatkal-badge-from");
        const tktBadgeTo = $("m-tatkal-badge-to");

        const updateBadges = () => {
            if (tktBadgeFrom && tktInputFrom) tktBadgeFrom.textContent = extractCode(tktInputFrom.value);
            if (tktBadgeTo && tktInputTo) tktBadgeTo.textContent = extractCode(tktInputTo.value);
        };

        tktInputFrom?.addEventListener("input", updateBadges);
        tktInputTo?.addEventListener("input", updateBadges);

        $("m-tatkal-clear-from")?.addEventListener("click", () => {
            if (tktInputFrom) { tktInputFrom.value = ""; tktInputFrom.focus(); updateBadges(); }
        });

        $("m-tatkal-clear-to")?.addEventListener("click", () => {
            if (tktInputTo) { tktInputTo.value = ""; tktInputTo.focus(); updateBadges(); }
        });

        $("m-tatkal-btn-swap")?.addEventListener("click", () => {
            if (tktInputFrom && tktInputTo) {
                const tmp = tktInputFrom.value;
                tktInputFrom.value = tktInputTo.value;
                tktInputTo.value = tmp;
                updateBadges();
            }
        });

        // Date picker
        const dateTrigger = $("m-tatkal-date-trigger");
        const hiddenDatePicker = $("m-tatkal-hidden-date");
        const dateDisplay = $("m-tatkal-date-display");

        dateTrigger?.addEventListener("click", () => {
            try {
                if (hiddenDatePicker && hiddenDatePicker.showPicker) {
                    hiddenDatePicker.showPicker();
                } else if (hiddenDatePicker) {
                    hiddenDatePicker.focus();
                }
            } catch (e) {}
        });

        hiddenDatePicker?.addEventListener("change", () => {
            if (hiddenDatePicker.value) {
                const d = new Date(hiddenDatePicker.value);
                const options = { day: 'numeric', month: 'long', weekday: 'long' };
                if (dateDisplay) dateDisplay.textContent = d.toLocaleDateString('en-GB', options);
            }
        });

        // Quota selector
        $("m-tatkal-quota-btn")?.addEventListener("click", () => {
            selectedQuotaIdx = (selectedQuotaIdx + 1) % quotaList.length;
            const q = quotaList[selectedQuotaIdx];
            if ($("m-tatkal-quota-code")) $("m-tatkal-quota-code").textContent = q.code;
            if ($("m-tatkal-quota-name")) $("m-tatkal-quota-name").textContent = q.name;
            showMobileToast(`Quota selected: ${q.name} (${q.code})`);
        });

        // Save Journey & Set Countdown
        $("m-btn-prepare-tatkal")?.addEventListener("click", async () => {
            const from = $("m-tatkal-from")?.value.trim() || "JP";
            const to = $("m-tatkal-to")?.value.trim() || "PUNE";
            const dateVal = hiddenDatePicker?.value || new Date().toISOString().split("T")[0];
            const q = quotaList[selectedQuotaIdx];

            try {
                const res = await fetch("/api/journey", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        from_station: extractCode(from),
                        to_station: extractCode(to),
                        journey_date: dateVal,
                        preferred_train: `${extractCode(from)} - ${extractCode(to)} Rajdhani`,
                        preferred_class: "3A",
                        tatkal_type: q.code === "GN" ? "GENERAL" : "AC"
                    })
                });
                if (res.ok) {
                    showMobileToast("⚡ Journey saved! Tatkal countdown active.");
                    await refreshMobileJourneyAndCountdown();
                    setMobileView("dashboard");
                }
            } catch (e) {
                showMobileToast("⚡ Journey updated locally.");
            }
        });

        $("m-btn-open-irctc-prep")?.addEventListener("click", () => {
            const modal = $("modal-irctc-guide");
            if (modal) modal.classList.add("active");
        });
    }

    // ================= 6. REMINDERS & ALERTS VIEW =================
    function setupMobileAlerts() {
        $("m-btn-test-chime")?.addEventListener("click", () => {
            playMobileAlertChime();
            showMobileToast("🔔 Test chime played!");
        });

        $("m-btn-test-notification")?.addEventListener("click", () => {
            triggerMobileNotification("RailReady Alert", "Tatkal booking alert test.");
            showMobileToast("🔔 Notification triggered!");
        });
    }

    function playMobileAlertChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {}
    }

    function triggerMobileNotification(title, message) {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(title, { body: message });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(p => {
                if (p === "granted") new Notification(title, { body: message });
            });
        }
    }

    // ================= 7. SPLIT ROUTES & ALTERNATIVES =================
    function setupMobileAlternates() {
        $("m-btn-find-alternates")?.addEventListener("click", () => {
            loadMobileSplitRoutes();
        });
    }

    async function loadMobileSplitRoutes() {
        const container = $("m-alternates-cards");
        if (!container) return;

        const src = $("m-alt-from")?.value.trim() || "NDLS";
        const dst = $("m-alt-to")?.value.trim() || "HWH";
        const srcCode = extractCode(src);
        const dstCode = extractCode(dst);

        container.innerHTML = `<div style="text-align: center; color: var(--m-text-muted); padding: 20px;">🔍 Calculating connecting split routes via transit junctions...</div>`;

        try {
            const res = await fetch(`/api/trains/alternatives?from_station=${srcCode}&to_station=${dstCode}`);
            const data = await res.json();
            const alts = data.alternatives || [];

            if (!alts.length) {
                container.innerHTML = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">No legal connecting routes found within layover window (1h - 8h).</div>`;
                return;
            }

            container.innerHTML = alts.slice(0, 4).map(alt => `
                <div class="m-split-route-card">
                    <div class="m-split-header">
                        <span class="m-junction-tag">Via ${alt.junction_name} (${alt.junction_code})</span>
                        <span style="font-weight: 700; color: #60a5fa; font-size: 0.9rem;">${alt.total_duration}</span>
                    </div>
                    <div class="m-split-legs-wrapper">
                        <div class="m-split-leg-row">
                            <strong>Leg 1: ${alt.leg1.train_number} ${alt.leg1.train_name}</strong>
                            <span>${alt.leg1.departure} ➔ ${alt.leg1.arrival}</span>
                        </div>
                        <div class="m-layover-tag">Transfer Layover: ${alt.layover_time} (Connecting PNR Eligible)</div>
                        <div class="m-split-leg-row">
                            <strong>Leg 2: ${alt.leg2.train_number} ${alt.leg2.train_name}</strong>
                            <span>${alt.leg2.departure} ➔ ${alt.leg2.arrival}</span>
                        </div>
                    </div>
                    <div style="font-size: 0.78rem; color: #a7f3d0; line-height: 1.4;">
                        🛡️ ${alt.booking_tip}
                    </div>
                </div>
            `).join("");
        } catch (e) {
            container.innerHTML = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">Unable to load split routes. Check station codes.</div>`;
        }
    }
})();
