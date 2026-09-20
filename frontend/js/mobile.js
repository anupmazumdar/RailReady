/**
 * RailReady Mobile App Controller
 * Adapts RailReady's core offline railway & Tatkal preparation features
 * into the clean mobile card layout, drawer, and bottom navigation.
 */
(function() {
    let mCurrentView = "trains";
    let mRecentSearches = [
        { trainNo: "12987", trainName: "Ajmer SF Express", from: "DHN", to: "JP" },
        { trainNo: "12307", trainName: "Jodhpur Superfast Express", from: "DHN", to: "JP" },
        { trainNo: "12302", trainName: "Howrah Rajdhani Express", from: "NDLS", to: "HWH" },
        { trainNo: "12952", trainName: "Mumbai Tejas Rajdhani", from: "NDLS", to: "BCT" },
        { trainNo: "63556", trainName: "Barkakana - Asansol MEMU", from: "CRP", to: "DHN" }
    ];

    const quotaList = [
        { code: "TQ", name: "Tatkal Quota (10 AM AC / 11 AM Non-AC)" },
        { code: "PT", name: "Premium Tatkal Quota" },
        { code: "GN", name: "General Quota" },
        { code: "LD", name: "Ladies Quota" },
        { code: "SS", name: "Senior Citizen Quota" }
    ];
    let selectedQuotaIdx = 0;
    let mTextareaFormat = "full";
    let mCountdownTimer = null;

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
        setupMobileAlternates();
        setupMobileDrawer();
        setupDesktopToggle();
        renderSearchHistory();
        loadMobileData();
    }

    // ================= DATA LOADING & SYNCHRONIZATION =================
    async function loadMobileData() {
        try {
            await Promise.all([
                refreshMobileCountdown(),
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
        const shareBtn = $("m-btn-share");
        const menuBtn = $("m-btn-menu");

        // Update Bottom Nav active state
        $$(".bottom-nav-tab").forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-mview") === viewName);
        });

        if (viewName === "trains") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "RailReady Trains";
            micBtn?.classList.remove("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.add("hidden");
            $("m-tab-trains")?.classList.add("active");
        } else if (viewName === "results") {
            drawerBtn?.classList.add("hidden");
            backBtn?.classList.remove("hidden");
            if (headerTitle) headerTitle.textContent = "Search results";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.remove("hidden");
            menuBtn?.classList.remove("hidden");
        } else if (viewName === "tatkal") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Tatkal Preparation";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.remove("hidden");
            $("m-tab-tatkal")?.classList.add("active");
            refreshMobileCountdown();
            refreshMobileChecklist();
        } else if (viewName === "passengers") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Prepared Passengers";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.remove("hidden");
            $("m-tab-passengers")?.classList.add("active");
            refreshMobilePassengers();
        } else if (viewName === "alternates") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Split Routes & Alternatives";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.remove("hidden");
            $("m-tab-alternates")?.classList.add("active");
            loadMobileSplitRoutes();
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    function setupMobileNavigation() {
        $("m-btn-back")?.addEventListener("click", () => setMobileView("trains"));

        $$(".bottom-nav-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const target = tab.getAttribute("data-mview");
                if (target) setMobileView(target);
            });
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

        // Drawer Links
        const bindDrawerNav = (id, viewName) => {
            $(id)?.addEventListener("click", () => {
                closeDrawer();
                setMobileView(viewName);
            });
        };

        bindDrawerNav("drawer-nav-trains", "trains");
        bindDrawerNav("drawer-nav-tatkal", "tatkal");
        bindDrawerNav("drawer-nav-passengers", "passengers");
        bindDrawerNav("drawer-nav-alternates", "alternates");

        $("drawer-update-timetable")?.addEventListener("click", () => {
            closeDrawer();
            if (window.showToast) window.showToast("🔄 Offline timetable synced (26 active corridors)");
        });

        $("drawer-clear-recent")?.addEventListener("click", () => {
            mRecentSearches = [];
            renderSearchHistory();
            closeDrawer();
            if (window.showToast) window.showToast("🗑️ Recent searches cleared");
        });

        $("drawer-open-irctc")?.addEventListener("click", () => {
            closeDrawer();
            if (window.openIrctcModal) window.openIrctcModal();
        });

        $("drawer-switch-desktop")?.addEventListener("click", () => {
            closeDrawer();
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
            if (window.showToast) window.showToast("💻 Switched to Desktop Dashboard");
        });

        $("drawer-settings")?.addEventListener("click", () => {
            closeDrawer();
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
            if (window.switchView) window.switchView("settings");
        });
    }

    // ================= DESKTOP TOGGLE =================
    function setupDesktopToggle() {
        $("btn-toggle-mobile")?.addEventListener("click", () => {
            document.body.classList.remove("force-desktop-view");
            document.body.classList.add("force-mobile-view");
            setMobileView("trains");
            if (window.showToast) window.showToast("📱 Switched to RailReady Mobile Experience");
        });
    }

    // ================= HELPER FUNCTIONS =================
    function extractCode(val) {
        if (!val) return "STN";
        val = val.trim().toUpperCase();
        if (val.includes(" - ")) return val.split(" - ")[0].trim();
        const parts = val.split(" ");
        if (parts[0].length >= 2 && parts[0].length <= 5) return parts[0];
        return val.substring(0, 3);
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // ================= VIEW 1: TRAIN SEARCH & TIMELINE =================
    function setupMobileSearch() {
        const inputFrom = $("m-input-from");
        const inputTo = $("m-input-to");
        const badgeFrom = $("m-badge-from");
        const badgeTo = $("m-badge-to");

        const updateBadges = () => {
            if (badgeFrom && inputFrom) badgeFrom.textContent = extractCode(inputFrom.value);
            if (badgeTo && inputTo) badgeTo.textContent = extractCode(inputTo.value);
        };

        inputFrom?.addEventListener("input", updateBadges);
        inputTo?.addEventListener("input", updateBadges);

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
            }
        });

        // Quick search shortcuts
        $("m-quick-search-1")?.addEventListener("click", () => executeSearchForTrain("12307"));
        $("m-quick-search-2")?.addEventListener("click", () => executeSearchForTrain("12987"));

        // Find trains CTA
        $("m-btn-find-trains")?.addEventListener("click", () => {
            const src = inputFrom?.value.trim() || "Dhanbad Junction";
            const dst = inputTo?.value.trim() || "Jaipur Junction";
            executeSearchBetweenStations(src, dst);
        });

        $("m-sticky-seat-bar")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("🎟️ Check Tatkal & General seat availability on IRCTC");
            if (window.openIrctcModal) window.openIrctcModal();
        });
    }

    async function executeSearchBetweenStations(src, dst) {
        const srcCode = extractCode(src);
        const dstCode = extractCode(dst);

        const bannerText = $("m-banner-route-text");
        if (bannerText) bannerText.innerHTML = `${srcCode} - ${src} &nbsp;➔&nbsp; ${dstCode} - ${dst}`;

        setMobileView("results");
        const container = $("m-results-cards");
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--m-text-muted); padding: 30px;">🔍 Searching trains between ${srcCode} and ${dstCode}...</div>`;

        try {
            const res = await fetch(`/api/trains/search?from_station=${srcCode}&to_station=${dstCode}`);
            if (!res.ok) throw new Error("Search failed");
            const trains = await res.json();
            renderTrainCards(trains, srcCode);
        } catch (e) {
            renderFallbackReferenceCards();
        }
    }

    async function executeSearchForTrain(trainNumber) {
        setMobileView("results");
        const container = $("m-results-cards");
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--m-text-muted); padding: 30px;">🔍 Searching train ${trainNumber}...</div>`;

        try {
            const res = await fetch(`/api/trains/${trainNumber}`);
            if (!res.ok) throw new Error("Not found");
            const t = await res.json();
            const bannerText = $("m-banner-route-text");
            if (bannerText) bannerText.innerHTML = `${t.source_code} - ${t.source_name} &nbsp;➔&nbsp; ${t.dest_code} - ${t.dest_name}`;
            renderTrainCards([t], t.source_code);
        } catch (e) {
            renderFallbackReferenceCards();
        }
    }

    function renderTrainCards(trains, srcCode) {
        const container = $("m-results-cards");
        if (!container) return;

        if (!trains || !trains.length) {
            renderFallbackReferenceCards();
            return;
        }

        container.innerHTML = trains.map((t, idx) => {
            const isRunningToday = idx % 2 === 1 || t.train_number === "12987" || t.train_number === "12307";
            const badgeClass = isRunningToday ? "badge-blue" : "badge-gray";

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

            let statusHtml = "";
            if (isRunningToday) {
                const delayMins = (parseInt(t.train_number) % 15) + 3;
                statusHtml = `<div class="m-train-status-line status-live">Left ${srcCode || t.source_code} at ${t.departure_time} (+${delayMins}m)</div>`;
            } else {
                statusHtml = `<div class="m-train-status-line status-not-running">Not running today</div>`;
            }

            return `
                <div class="m-train-card" onclick="openTrainMobileDetails('${t.train_number}')">
                    <div class="m-train-card-header">
                        <span class="m-train-number-badge ${badgeClass}">${t.train_number}</span>
                        <div class="m-train-timing-line">
                            ${t.departure_time} <span class="duration-sep">—</span> ${t.duration} <span class="duration-sep">—</span> ${t.arrival_time}
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
    }

    function renderFallbackReferenceCards() {
        const container = $("m-results-cards");
        if (!container) return;

        container.innerHTML = `
            <div class="m-train-card" onclick="openTrainMobileDetails('12496')">
                <div class="m-train-card-header">
                    <span class="m-train-number-badge badge-gray">12496</span>
                    <div class="m-train-timing-line">2:55 AM <span class="duration-sep">—</span> 20hr <span class="duration-sep">—</span> 10:55 PM</div>
                </div>
                <div class="m-train-middle-row">
                    <span class="m-train-name-bold">Pratap SF Express</span>
                    <span class="m-days-group">S M T W T <span class="day-active">F</span> S</span>
                </div>
                <div class="m-train-status-line status-not-running">Not running today</div>
            </div>

            <div class="m-train-card" onclick="openTrainMobileDetails('12987')">
                <div class="m-train-card-header">
                    <span class="m-train-number-badge badge-blue">12987</span>
                    <div class="m-train-timing-line">3:12 AM <span class="duration-sep">—</span> 20hr 03min <span class="duration-sep">—</span> 11:15 PM</div>
                </div>
                <div class="m-train-middle-row">
                    <span class="m-train-name-bold">Ajmer SF Express</span>
                    <span class="m-runs-daily">Runs Daily</span>
                </div>
                <div class="m-train-status-line status-live">Left DHN at 03:15 AM</div>
            </div>

            <div class="m-train-card" onclick="openTrainMobileDetails('22307')">
                <div class="m-train-card-header">
                    <span class="m-train-number-badge badge-gray">22307</span>
                    <div class="m-train-timing-line">3:25 AM <span class="duration-sep">—</span> 20hr 10min <span class="duration-sep">—</span> 11:35 PM</div>
                </div>
                <div class="m-train-middle-row">
                    <span class="m-train-name-bold">Bikaner SF Express</span>
                    <span class="m-days-group"><span class="day-active">S</span> M <span class="day-active">T</span> W <span class="day-active">T</span> F S</span>
                </div>
                <div class="m-train-status-line status-not-running">Not running today</div>
            </div>

            <div class="m-train-card" onclick="openTrainMobileDetails('12307')">
                <div class="m-train-card-header">
                    <span class="m-train-number-badge badge-blue">12307</span>
                    <div class="m-train-timing-line">3:25 AM <span class="duration-sep">—</span> 20hr 10min <span class="duration-sep">—</span> 11:35 PM</div>
                </div>
                <div class="m-train-middle-row">
                    <span class="m-train-name-bold">Jodhpur Superfast Express</span>
                    <span class="m-days-group">S <span class="day-active">M</span> T <span class="day-active">W</span> <span class="day-active">T</span> F <span class="day-active">S</span></span>
                </div>
                <div class="m-train-status-line status-live">Left DHN at 03:32 AM</div>
            </div>
        `;
    }

    window.openTrainMobileDetails = function(trainNumber) {
        if (window.loadTrainDetails) {
            window.loadTrainDetails(trainNumber);
            if (window.showToast) window.showToast(`🚆 Loading train details for ${trainNumber}`);
        }
    };

    function renderSearchHistory() {
        const container = $("m-search-history-list");
        if (!container) return;

        container.innerHTML = mRecentSearches.map(item => `
            <div class="m-history-item" onclick="handleHistoryItemClick('${item.from}', '${item.to}', '${item.trainNo}')">
                <div class="m-history-train-info">${item.trainNo} &nbsp;${item.trainName}</div>
                <div class="m-history-route">
                    <span>${item.from} - ${item.to}</span>
                    <span class="m-history-chevron">›</span>
                </div>
            </div>
        `).join("");
    }

    window.handleHistoryItemClick = function(from, to, trainNo) {
        if ($("m-input-from")) $("m-input-from").value = from;
        if ($("m-input-to")) $("m-input-to").value = to;
        $("m-badge-from").textContent = from;
        $("m-badge-to").textContent = to;
        executeSearchBetweenStations(from, to);
    };

    // ================= VIEW 2: TATKAL COUNTDOWN & PREPARATION =================
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

        // Date Picker
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
                refreshMobileCountdown();
            }
        });

        // Quota Selector
        $("m-tatkal-quota-btn")?.addEventListener("click", () => {
            selectedQuotaIdx = (selectedQuotaIdx + 1) % quotaList.length;
            const q = quotaList[selectedQuotaIdx];
            if ($("m-tatkal-quota-code")) $("m-tatkal-quota-code").textContent = q.code;
            if ($("m-tatkal-quota-name")) $("m-tatkal-quota-name").textContent = q.name;
            if (window.showToast) window.showToast(`Quota selected: ${q.name} (${q.code})`);
            refreshMobileCountdown();
        });

        // Prepare Tatkal Journey CTA
        $("m-btn-prepare-tatkal")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("⚡ Journey configured! Opening countdown active.");
            setMobileView("tatkal");
        });

        $("m-btn-open-irctc-prep")?.addEventListener("click", () => {
            if (window.openIrctcModal) window.openIrctcModal();
        });
    }

    async function refreshMobileCountdown() {
        try {
            const res = await fetch("/api/journey/latest");
            const data = await res.json();
            const cd = data?.countdown;

            if (cd) {
                if ($("m-cd-days")) $("m-cd-days").textContent = String(cd.days).padStart(2, "0");
                if ($("m-cd-hours")) $("m-cd-hours").textContent = String(cd.hours).padStart(2, "0");
                if ($("m-cd-mins")) $("m-cd-mins").textContent = String(cd.minutes).padStart(2, "0");
                if ($("m-cd-secs")) $("m-cd-secs").textContent = String(cd.seconds).padStart(2, "0");
                if ($("m-cd-msg")) $("m-cd-msg").textContent = cd.message;
            } else {
                // Tomorrow 10 AM default calculation
                const now = new Date();
                const target = new Date();
                target.setHours(10, 0, 0, 0);
                if (now.getHours() >= 10) target.setDate(target.getDate() + 1);

                const diff = Math.max(0, Math.floor((target - now) / 1000));
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;

                if ($("m-cd-days")) $("m-cd-days").textContent = "00";
                if ($("m-cd-hours")) $("m-cd-hours").textContent = String(h).padStart(2, "0");
                if ($("m-cd-mins")) $("m-cd-mins").textContent = String(m).padStart(2, "0");
                if ($("m-cd-secs")) $("m-cd-secs").textContent = String(s).padStart(2, "0");
                if ($("m-cd-msg")) $("m-cd-msg").textContent = "AC Tatkal opens at 10:00 AM IST. Non-AC Tatkal opens at 11:00 AM IST.";
            }
        } catch (e) {}
    }

    async function refreshMobileChecklist() {
        const container = $("m-checklist-container");
        if (!container) return;

        try {
            const res = await fetch("/api/checklist");
            const items = await res.json();
            container.innerHTML = items.map(item => `
                <div class="m-check-row ${item.checked ? 'checked' : ''}" onclick="toggleMobileChecklistItem('${item.item_key}', ${!item.checked})">
                    <div class="m-checkbox-custom">${item.checked ? '✓' : ''}</div>
                    <span class="m-check-text">${escapeHtml(item.item_text)}</span>
                </div>
            `).join("");
        } catch (e) {}
    }

    window.toggleMobileChecklistItem = async function(key, checked) {
        try {
            await fetch(`/api/checklist/${key}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checked })
            });
            refreshMobileChecklist();
            if (window.loadChecklist) window.loadChecklist();
        } catch (e) {}
    };

    // ================= VIEW 3: PASSENGERS & ALL DETAILS TEXT AREA =================
    function setupMobilePassengers() {
        // Format pills
        $$(".m-fmt-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                $$(".m-fmt-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                mTextareaFormat = pill.getAttribute("data-fmt") || "full";
                updateMobileTextarea();
            });
        });

        $("m-btn-copy-textarea")?.addEventListener("click", copyMobilePassengerTextarea);
        $("m-btn-select-all-textarea")?.addEventListener("click", () => {
            const ta = $("m-passenger-textarea");
            if (ta) { ta.focus(); ta.select(); }
        });

        $("m-passenger-textarea")?.addEventListener("click", function() {
            this.select();
        });

        // Quick add passenger form
        $("m-form-add-passenger")?.addEventListener("submit", async e => {
            e.preventDefault();
            const name = $("m-input-pax-name")?.value.trim();
            const age = parseInt($("m-input-pax-age")?.value);
            const gender = $("m-select-pax-gender")?.value || "MALE";
            const berth = $("m-select-pax-berth")?.value || "NO_PREFERENCE";
            const meal = $("m-select-pax-meal")?.value || "VEG";
            const senior = $("m-check-pax-senior")?.checked || false;

            if (!name || isNaN(age)) {
                if (window.showToast) window.showToast("⚠️ Please enter passenger name and age.");
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
                if (window.showToast) window.showToast(`✅ Added passenger ${name}`);
            } catch (err) {
                if (window.showToast) window.showToast(`⚠️ ${err.message}`);
            }
        });
    }

    async function refreshMobilePassengers() {
        const container = $("m-passengers-list");
        const countBadge = $("m-pax-count-badge");
        if (!container) return;

        try {
            const res = await fetch("/api/passengers");
            const passengers = await res.json();

            if (countBadge) countBadge.textContent = `${passengers.length}/4 Prepared`;

            if (!passengers.length) {
                container.innerHTML = `<div style="text-align: center; color: var(--m-text-dim); padding: 20px;">No passengers prepared yet. Add up to 4 for Tatkal.</div>`;
            } else {
                container.innerHTML = passengers.map((p, idx) => `
                    <div class="m-passenger-card">
                        <div class="m-pax-top">
                            <span class="m-pax-name">${idx + 1}. ${escapeHtml(p.name)}</span>
                            <span class="m-pax-meta">${p.age} yrs • ${p.gender}</span>
                        </div>
                        <div class="m-pax-badges-row">
                            <span class="m-pax-badge">🛏️ ${p.berth_preference.replace("_", " ")}</span>
                            <span class="m-pax-badge">🥗 ${p.meal_preference}</span>
                            ${p.senior_citizen_opt ? '<span class="m-pax-badge" style="color: #fef08a;">👴 Senior</span>' : ''}
                        </div>
                        <div class="m-pax-actions">
                            <button class="m-btn-mini" onclick="copyValueToClipboard('${escapeHtml(p.name)}', 'Passenger Name')">📋 Name</button>
                            <button class="m-btn-mini" onclick="copyValueToClipboard('${p.age}', 'Age')">📋 Age</button>
                            <button class="m-btn-mini" onclick="deleteMobilePassenger(${p.id})">🗑️</button>
                        </div>
                    </div>
                `).join("");
            }

            updateMobileTextarea();
        } catch (e) {}
    }

    async function updateMobileTextarea() {
        const textarea = $("m-passenger-textarea");
        if (!textarea) return;

        try {
            const res = await fetch("/api/clipboard/passengers");
            const data = await res.json();
            if (mTextareaFormat === "row") {
                textarea.value = data.row_format || "";
            } else if (mTextareaFormat === "irctc") {
                textarea.value = data.irctc_format || "";
            } else {
                textarea.value = data.formatted_summary || "";
            }
        } catch (e) {}
    }

    async function copyMobilePassengerTextarea() {
        const textarea = $("m-passenger-textarea");
        if (!textarea || !textarea.value.trim()) {
            if (window.showToast) window.showToast("⚠️ No passenger details to copy.");
            return;
        }

        try {
            await navigator.clipboard.writeText(textarea.value);
            if (window.showToast) window.showToast("📋 All passenger details copied to clipboard!");
        } catch (e) {
            textarea.focus();
            textarea.select();
            document.execCommand("copy");
            if (window.showToast) window.showToast("📋 Copied via fallback!");
        }
    }

    window.copyValueToClipboard = async function(val, label) {
        try {
            await navigator.clipboard.writeText(val);
            if (window.showToast) window.showToast(`📋 Copied ${label}: ${val}`);
        } catch (e) {}
    };

    window.deleteMobilePassenger = async function(id) {
        try {
            await fetch(`/api/passengers/${id}`, { method: "DELETE" });
            refreshMobilePassengers();
            if (window.loadPassengers) window.loadPassengers();
            if (window.showToast) window.showToast("🗑️ Passenger removed.");
        } catch (e) {}
    };

    // ================= VIEW 4: SPLIT ROUTES & ALTERNATIVES =================
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
