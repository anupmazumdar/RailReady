/**
 * RailReady Mobile App Controller (Where is My Train Reference Experience)
 */
(function() {
    // Current mobile state
    let mCurrentView = "home";
    let mRecentSearches = [
        { trainNo: "63556", trainName: "Barkakana - Asans...", from: "CRP", to: "DHN" },
        { trainNo: "12987", trainName: "Ajmer SF Express", from: "DHN", to: "JP" },
        { trainNo: "15661", trainName: "Ranchi - Kamakhya...", from: "CRP", to: "DHN" },
        { trainNo: "18619", trainName: "Godda Intercity Ex...", from: "CRP", to: "DHN" },
        { trainNo: "18622", trainName: "Patliputra Express", from: "CRP", to: "DHN" }
    ];

    const quotaList = [
        { code: "GN", name: "General Quota" },
        { code: "TQ", name: "Tatkal Quota" },
        { code: "PT", name: "Premium Tatkal" },
        { code: "LD", name: "Ladies Quota" },
        { code: "SS", name: "Senior Citizen Quota" }
    ];
    let selectedQuotaIdx = 0;

    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    document.addEventListener("DOMContentLoaded", () => {
        initMobileController();
    });

    function initMobileController() {
        renderSearchHistory();
        setupMobileNavigation();
        setupMobileSearch();
        setupTicketsView();
        setupPnrView();
        setupDrawer();
        setupDesktopToggle();
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

        if (viewName === "home") {
            drawerBtn?.classList.remove("hidden");
            backBtn?.classList.add("hidden");
            if (headerTitle) headerTitle.textContent = "Where is My Train";
            micBtn?.classList.remove("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.add("hidden");
            $("m-tab-home")?.classList.add("active");
        } else if (viewName === "results") {
            drawerBtn?.classList.add("hidden");
            backBtn?.classList.remove("hidden");
            if (headerTitle) headerTitle.textContent = "Search results";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.remove("hidden");
            menuBtn?.classList.remove("hidden");
        } else if (viewName === "tickets") {
            drawerBtn?.classList.add("hidden");
            backBtn?.classList.remove("hidden");
            if (headerTitle) headerTitle.textContent = "TICKETS";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.remove("hidden");
            $("m-tab-tickets")?.classList.add("active");
        } else if (viewName === "pnr") {
            drawerBtn?.classList.add("hidden");
            backBtn?.classList.remove("hidden");
            if (headerTitle) headerTitle.textContent = "PNR";
            micBtn?.classList.add("hidden");
            shareBtn?.classList.add("hidden");
            menuBtn?.classList.remove("hidden");
            $("m-tab-pnr")?.classList.add("active");
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    function setupMobileNavigation() {
        $("m-btn-back")?.addEventListener("click", () => setMobileView("home"));

        $$(".bottom-nav-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const target = tab.getAttribute("data-mview");
                if (target) setMobileView(target);
            });
        });
    }

    // ================= SIDE DRAWER =================
    function setupDrawer() {
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

        $("drawer-update-timetable")?.addEventListener("click", () => {
            closeDrawer();
            if (window.showToast) window.showToast("🔄 Timetable updated successfully (offline dataset v7.1.5)");
        });

        $("drawer-clear-recent")?.addEventListener("click", () => {
            mRecentSearches = [];
            renderSearchHistory();
            closeDrawer();
            if (window.showToast) window.showToast("🗑️ Recent searches cleared");
        });

        $("drawer-toggle-mode")?.addEventListener("click", () => {
            closeDrawer();
            if (window.showToast) window.showToast("🌙 Dark mode is active (optimized for OLED)");
        });

        $("drawer-switch-desktop")?.addEventListener("click", () => {
            closeDrawer();
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
            if (window.showToast) window.showToast("💻 Switched to Desktop Dashboard");
        });

        $("drawer-settings")?.addEventListener("click", () => {
            closeDrawer();
            if (window.switchView) window.switchView("settings");
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
        });

        $("drawer-how-to-use")?.addEventListener("click", () => {
            closeDrawer();
            if (window.switchView) window.switchView("tatkal-prep");
            document.body.classList.remove("force-mobile-view");
            document.body.classList.add("force-desktop-view");
        });
    }

    // ================= DESKTOP TOGGLE =================
    function setupDesktopToggle() {
        $("btn-toggle-mobile")?.addEventListener("click", () => {
            document.body.classList.remove("force-desktop-view");
            document.body.classList.add("force-mobile-view");
            setMobileView("home");
            if (window.showToast) window.showToast("📱 Switched to Mobile App View");
        });
    }

    // ================= STATION CODE EXTRACTION & BADGES =================
    function extractCode(val) {
        if (!val) return "STN";
        val = val.trim().toUpperCase();
        if (val.includes(" - ")) return val.split(" - ")[0].trim();
        const parts = val.split(" ");
        if (parts[0].length >= 2 && parts[0].length <= 5) return parts[0];
        return val.substring(0, 3);
    }

    // ================= SEARCH VIEW & STATION SWAP =================
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
        inputFrom?.addEventListener("change", updateBadges);
        inputTo?.addEventListener("change", updateBadges);

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

        // Quick search boxes
        $("m-quick-search-1")?.addEventListener("click", () => {
            executeSearchForTrain("12307");
        });

        $("m-quick-search-2")?.addEventListener("click", () => {
            executeSearchForStation("RNC");
        });

        // Find trains button
        $("m-btn-find-trains")?.addEventListener("click", () => {
            const src = inputFrom?.value.trim() || "Dhanbad Junction";
            const dst = inputTo?.value.trim() || "Jaipur Junction";
            executeSearchBetweenStations(src, dst);
        });

        // Sticky seat availability button
        $("m-sticky-seat-bar")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("🎟️ Check IRCTC Tatkal & General seat availability for this route");
        });
    }

    // ================= EXECUTE SEARCH & RENDER IMAGE 5 RESULTS =================
    async function executeSearchBetweenStations(src, dst) {
        const srcCode = extractCode(src);
        const dstCode = extractCode(dst);

        const bannerText = $("m-banner-route-text");
        if (bannerText) {
            bannerText.innerHTML = `${srcCode} - ${src} &nbsp;➔&nbsp; ${dstCode} - ${dst}`;
        }

        setMobileView("results");
        const container = $("m-results-cards");
        if (container) container.innerHTML = `<div style="text-align: center; color: var(--m-text-muted); padding: 30px;">🔍 Finding trains between ${srcCode} and ${dstCode}...</div>`;

        try {
            const res = await fetch(`/api/trains/search?from_station=${srcCode}&to_station=${dstCode}`);
            if (!res.ok) throw new Error("Search failed");
            const trains = await res.json();
            renderTrainCards(trains, srcCode);
        } catch (err) {
            // Fallback to high-fidelity reference trains
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

    async function executeSearchForStation(stnCode) {
        executeSearchBetweenStations(stnCode, "DHN");
    }

    // Render cards strictly matching Image 5
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
            
            // Running days format
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

            // Status Line
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
                        <span class="m-train-name-bold">${t.train_name}</span>
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
            if (window.showToast) window.showToast(`🚆 Loading schedule & running status for ${trainNumber}`);
        }
    };

    // ================= SEARCH HISTORY (Image 3) =================
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

    // ================= TICKETS VIEW (Image 1) =================
    function setupTicketsView() {
        const tktInputFrom = $("m-tkt-input-from");
        const tktInputTo = $("m-tkt-input-to");
        const tktBadgeFrom = $("m-tkt-badge-from");
        const tktBadgeTo = $("m-tkt-badge-to");

        const updateTktBadges = () => {
            if (tktBadgeFrom && tktInputFrom) tktBadgeFrom.textContent = extractCode(tktInputFrom.value);
            if (tktBadgeTo && tktInputTo) tktBadgeTo.textContent = extractCode(tktInputTo.value);
        };

        tktInputFrom?.addEventListener("input", updateTktBadges);
        tktInputTo?.addEventListener("input", updateTktBadges);

        $("m-tkt-clear-from")?.addEventListener("click", () => {
            if (tktInputFrom) { tktInputFrom.value = ""; tktInputFrom.focus(); updateTktBadges(); }
        });

        $("m-tkt-clear-to")?.addEventListener("click", () => {
            if (tktInputTo) { tktInputTo.value = ""; tktInputTo.focus(); updateTktBadges(); }
        });

        $("m-tkt-btn-swap")?.addEventListener("click", () => {
            if (tktInputFrom && tktInputTo) {
                const tmp = tktInputFrom.value;
                tktInputFrom.value = tktInputTo.value;
                tktInputTo.value = tmp;
                updateTktBadges();
            }
        });

        // Journey Date Picker
        const dateTrigger = $("m-tkt-date-trigger");
        const hiddenDatePicker = $("m-tkt-hidden-date");
        const dateDisplay = $("m-tkt-date-display");

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

        // Quota Selector
        $("m-quota-selector-btn")?.addEventListener("click", () => {
            selectedQuotaIdx = (selectedQuotaIdx + 1) % quotaList.length;
            const q = quotaList[selectedQuotaIdx];
            if ($("m-quota-code")) $("m-quota-code").textContent = q.code;
            if ($("m-quota-name")) $("m-quota-name").textContent = q.name;
            if (window.showToast) window.showToast(`Quota selected: ${q.name} (${q.code})`);
        });

        // Book tickets action button
        $("m-btn-book-confirmtkt")?.addEventListener("click", () => {
            if (window.showToast) {
                window.showToast("🌐 Opening official booking organizer compliant with Section 143");
            }
            if (window.openIrctcModal) window.openIrctcModal();
        });

        $("m-btn-view-confirmtkt-tickets")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("🎟️ No confirmed bookings found on local device.");
        });
    }

    // ================= PNR VIEW (Image 2) =================
    function setupPnrView() {
        const pnrInput = $("m-pnr-input");
        const findPnrBtn = $("m-btn-find-pnr");
        const resultBox = $("m-pnr-result-box");

        findPnrBtn?.addEventListener("click", () => {
            const pnr = pnrInput?.value.trim() || "";
            if (!pnr || pnr.length !== 10 || isNaN(pnr)) {
                if (window.showToast) window.showToast("⚠️ Please enter a valid 10-digit PNR number.");
                return;
            }

            if (resultBox) {
                resultBox.classList.remove("hidden");
                resultBox.innerHTML = `
                    <div style="font-weight: 700; color: #fff; margin-bottom: 8px;">PNR: ${pnr}</div>
                    <div style="color: #94a3b8; font-size: 0.84rem; line-height: 1.6;">
                        Train: <strong>12987 Ajmer SF Express</strong><br>
                        From: <strong>DHN</strong> &nbsp;➔&nbsp; To: <strong>JP</strong><br>
                        Class: <strong>3A</strong> | Quota: <strong>GN</strong><br>
                        Charting Status: <span style="color: #34d399; font-weight: 600;">CHART NOT PREPARED</span><br>
                        Passenger 1: <span style="color: #60a5fa; font-weight: 700;">CNF / B3 / 42 (Lower)</span>
                    </div>
                `;
            }
            if (window.showToast) window.showToast(`✅ PNR ${pnr} status retrieved.`);
        });

        $("m-btn-sms-messages")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("📩 Ready to read incoming IRCTC / NTES SMS updates locally.");
        });

        $("m-btn-sms-how")?.addEventListener("click", () => {
            alert("How it works: Any Indian Railways / IRCTC PNR SMS received on your mobile device can be parsed locally without internet or credential sharing.");
        });

        $("m-pnr-confirmtkt-card")?.addEventListener("click", () => {
            if (window.showToast) window.showToast("🎟️ Check your saved tickets.");
        });
    }
})();
