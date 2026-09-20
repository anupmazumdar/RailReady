// Application State
let activeJourney = null;
let openingTimeIso = null;
let countdownInterval = null;
let notifiedMilestones = new Set();

// Initialize on DOM Load
document.addEventListener("DOMContentLoaded", () => {
    initStationDatalist();
    setDefaultJourneyDate();
    fetchSystemStatus();
    loadLatestJourney();
    loadPassengers();
    loadChecklist();
    setupEventListeners();
});

// Setup Stations Datalist
function initStationDatalist() {
    const dataList = document.getElementById("station-list");
    if (!dataList || typeof MAJOR_STATIONS === "undefined") return;
    
    dataList.innerHTML = MAJOR_STATIONS.map(st => 
        `<option value="${st.code} - ${st.name}">`
    ).join("");
}

// Default Journey Date to Tomorrow
function setDefaultJourneyDate() {
    const dateInput = document.getElementById("input-journey-date");
    if (!dateInput) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    dateInput.min = `${yyyy}-${mm}-${dd}`;
}

// Setup Event Listeners
function setupEventListeners() {
    // Journey Form Submit
    const journeyForm = document.getElementById("form-journey");
    journeyForm.addEventListener("submit", handleJourneySubmit);

    // Passenger Form Submit
    const passengerForm = document.getElementById("form-add-passenger");
    passengerForm.addEventListener("submit", handlePassengerSubmit);

    // Copy All Passengers Button
    const copyAllBtn = document.getElementById("btn-copy-all-passengers");
    copyAllBtn.addEventListener("click", copyAllPassengerDetails);

    // Reset Checklist Button
    const resetChecklistBtn = document.getElementById("btn-reset-checklist");
    resetChecklistBtn.addEventListener("click", resetChecklist);

    // Test Alert / Audio Chime Button
    const testAlertBtn = document.getElementById("btn-test-notification");
    testAlertBtn.addEventListener("click", () => {
        playAlertChime();
        triggerNotification("Tatkal Test Alert", "Alert notification and audio chime are operational.");
        showToast("🔔 Alert chime & notification triggered!");
    });

    // Manual IRCTC Modal Listeners
    const manualIrctcBtn = document.getElementById("btn-manual-irctc");
    const modal = document.getElementById("modal-irctc-guide");
    const closeModalBtn = document.getElementById("btn-close-modal");
    const modalDoneBtn = document.getElementById("btn-modal-done");
    const copyUrlBtn = document.getElementById("btn-copy-url");

    manualIrctcBtn.addEventListener("click", () => modal.classList.add("active"));
    closeModalBtn.addEventListener("click", () => modal.classList.remove("active"));
    modalDoneBtn.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
    });

    copyUrlBtn.addEventListener("click", () => {
        copyToClipboard("https://www.irctc.co.in/");
        showToast("🌐 IRCTC URL copied to clipboard!");
    });
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

// Handle Journey Form Submission
async function handleJourneySubmit(e) {
    e.preventDefault();
    const fromStation = document.getElementById("input-from-station").value.trim();
    const toStation = document.getElementById("input-to-station").value.trim();
    const journeyDate = document.getElementById("input-journey-date").value;
    const preferredTrain = document.getElementById("input-train").value.trim();
    const preferredClass = document.getElementById("select-class").value;
    const tatkalType = document.getElementById("select-tatkal-type").value;

    const payload = {
        from_station: fromStation,
        to_station: toStation,
        journey_date: journeyDate,
        preferred_train: preferredTrain,
        preferred_class: preferredClass,
        tatkal_type: tatkalType
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
        showToast("✅ Journey saved & opening time computed!");
    } catch (err) {
        showToast("⚠️ Network error while saving journey.");
    }
}

// Apply Journey State to UI & Start Countdown
function applyJourneyState(data) {
    activeJourney = data.journey;
    openingTimeIso = data.opening_time_iso;
    
    // Fill inputs if different
    if (activeJourney) {
        document.getElementById("input-from-station").value = activeJourney.from_station;
        document.getElementById("input-to-station").value = activeJourney.to_station;
        document.getElementById("input-journey-date").value = activeJourney.journey_date;
        document.getElementById("input-train").value = activeJourney.preferred_train;
        document.getElementById("select-class").value = activeJourney.preferred_class;
        document.getElementById("select-tatkal-type").value = activeJourney.tatkal_type;
        
        const openTimeEl = document.getElementById("display-opening-time");
        if (openTimeEl) {
            openTimeEl.textContent = data.opening_time || activeJourney.expected_opening_time;
        }
    }

    // Restart Countdown Loop
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

    const daysEl = document.getElementById("timer-days");
    const hoursEl = document.getElementById("timer-hours");
    const minsEl = document.getElementById("timer-minutes");
    const secsEl = document.getElementById("timer-seconds");
    const badgeEl = document.getElementById("countdown-status-badge");
    const msgEl = document.getElementById("countdown-message");

    if (totalSeconds <= 0) {
        daysEl.textContent = "00";
        hoursEl.textContent = "00";
        minsEl.textContent = "00";
        secsEl.textContent = "00";

        badgeEl.textContent = "WINDOW OPEN";
        badgeEl.style.background = "rgba(16, 185, 129, 0.2)";
        badgeEl.style.color = "#6ee7b7";
        badgeEl.style.borderColor = "rgba(16, 185, 129, 0.5)";

        msgEl.innerHTML = "<strong>Tatkal booking window should now be open. Please open/use IRCTC manually.</strong>";
        msgEl.style.color = "#a7f3d0";

        if (!notifiedMilestones.has(0)) {
            notifiedMilestones.add(0);
            playAlertChime();
            triggerNotification("Tatkal Window Open", "The Tatkal booking window should now be open! Open IRCTC manually.");
        }
        return;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    daysEl.textContent = String(days).padStart(2, "0");
    hoursEl.textContent = String(hours).padStart(2, "0");
    minsEl.textContent = String(minutes).padStart(2, "0");
    secsEl.textContent = String(seconds).padStart(2, "0");

    // Milestones notifications (15m, 5m, 1m)
    checkMilestone(totalSeconds, 900, "15 Minutes Left", "15 minutes until Tatkal opening. Confirm your passenger details.");
    checkMilestone(totalSeconds, 300, "5 Minutes Left", "5 minutes until Tatkal opening! Get ready to open IRCTC manually.");
    checkMilestone(totalSeconds, 60, "1 Minute Left", "1 minute remaining! Tatkal window opens in 60 seconds.");

    if (totalSeconds <= 900) {
        badgeEl.textContent = "OPENING SOON";
        badgeEl.style.background = "rgba(245, 158, 11, 0.2)";
        badgeEl.style.color = "#fcd34d";
        badgeEl.style.borderColor = "rgba(245, 158, 11, 0.5)";
    } else {
        badgeEl.textContent = "UPCOMING";
        badgeEl.style.background = "rgba(59, 130, 246, 0.2)";
        badgeEl.style.color = "#93c5fd";
        badgeEl.style.borderColor = "rgba(59, 130, 246, 0.5)";
    }

    msgEl.textContent = `Tatkal opening in: ${days > 0 ? days + "d " : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function checkMilestone(secondsLeft, milestone, title, message) {
    if (secondsLeft <= milestone && secondsLeft > (milestone - 2) && !notifiedMilestones.has(milestone)) {
        notifiedMilestones.add(milestone);
        playAlertChime();
        triggerNotification(title, message);
        showToast(`⏰ ${title}: ${message}`);
    }
}

// Load Passengers
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

// Render Passengers
function renderPassengers(passengers) {
    const container = document.getElementById("passenger-container");
    const addPanel = document.getElementById("add-passenger-panel");
    if (!container) return;

    if (!passengers || passengers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-dim); font-size: 0.88rem;">
                No passengers prepared yet. Add up to 4 passengers below.
            </div>
        `;
        if (addPanel) addPanel.style.display = "block";
        return;
    }

    container.innerHTML = passengers.map((p, idx) => `
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
                <button class="btn btn-secondary btn-sm" onclick="copyIndividualField('${escapeJs(p.name)}', 'Name')">
                    Copy Name
                </button>
                <button class="btn btn-secondary btn-sm" onclick="copyIndividualField('${p.age}', 'Age')">
                    Copy Age
                </button>
                <button class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="deletePassenger(${p.id})">
                    ✕
                </button>
            </div>
        </div>
    `).join("");

    // Hide add panel if reached max 4
    if (addPanel) {
        addPanel.style.display = passengers.length >= 4 ? "none" : "block";
    }
}

// Handle Add Passenger Form
async function handlePassengerSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("input-passenger-name").value.trim();
    const age = parseInt(document.getElementById("input-passenger-age").value, 10);
    const gender = document.getElementById("select-passenger-gender").value;
    const berth = document.getElementById("select-passenger-berth").value;
    const meal = document.getElementById("select-passenger-meal").value;

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

        document.getElementById("form-add-passenger").reset();
        showToast("✅ Passenger added!");
        loadPassengers();
    } catch (err) {
        showToast("⚠️ Network error while adding passenger.");
    }
}

// Delete Passenger
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

// Copy Individual Field
window.copyIndividualField = function(val, label) {
    copyToClipboard(val);
    showToast(`📋 Copied ${label}: "${val}"`);
};

// Copy All Passenger Details
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

// Load Checklist
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

// Render Checklist
function renderChecklist(items) {
    const container = document.getElementById("checklist-container");
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

    // Progress Bar
    const total = items.length;
    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    const progressFill = document.getElementById("checklist-progress-fill");
    const progressText = document.getElementById("checklist-progress-text");
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${checkedCount} of ${total} Completed (${percent}%)`;
}

// Toggle Checklist Item
window.toggleChecklistItem = async function(itemKey, isChecked) {
    try {
        const res = await fetch(`/api/checklist/${itemKey}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_key: itemKey, checked: isChecked })
        });
        if (res.ok) {
            loadChecklist();
        }
    } catch (err) {
        console.error("Checklist update error:", err);
    }
};

// Reset Checklist
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

// Helper: Synthesize Alert Chime with Web Audio API
function playAlertChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (err) {
        // AudioContext not allowed without prior user interaction
    }
}

// Helper: Browser Notifications
function triggerNotification(title, message) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: "/static/favicon.ico"
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body: message });
            }
        });
    }
}

// Helper: Clipboard Copy
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

// Helper: Toast Notifications
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

// Sanitization helpers
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeJs(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}
