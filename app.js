/*   ============================================================
       FitTrack Pro — Vanilla JS (Local Storage powered)
   ============================================================ */

/* ---------- Constants & helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const STORE_KEY =  "fittrackpro_v1";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const QUOTES = [
  "No Pain, No Gain.",
  "Consistency Beats Motivation.",
  "Small Steps Every Day.",
  "Your only limit is you.",
  "Sweat now,shine later.",
  "Push yourself, no one else will.",
  "Strong is the new beautiful.",
  "Discipline is choosing what you want most."
];
const todayKey = () => new Date().toISOString().slice(0, 10);
const muscleToday = () => DAYS[(new Date().getDay() + 6) % 7]; // JS Sun=0 -> map to our list

/* ---------- Default state ---------- */
const defaultState = () => ({
  user: "Athlete",
  theme: "light",
  workouts: DAYS.reduce((acc, d) => (acc[d] = [], acc), {}),
  bmi: { value: null, category: null, height: null, weight: null },
  water: { date: todayKey(), intake: 0, goal: 2500 },
  goal: { exercises: 5, calories: 300, minutes: 30 },
  streak: { current: 0, longest: 0, lastDone: null },
  history: {},          // { "2026-06-28": { total, completed, pct } }
  caloriesBurned: 0,
  totalExCompleted: 0,
  totalWorkouts: 0,
});

/* ---------- Load / save ---------- */
let state = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return raw ? { ...defaultState(), ...raw } : defaultState();
  } catch { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Toast notifications ---------- */
function toast(msg, type = "info") {
  const icons = { info: "fa-circle-info", success: "fa-circle-check", error: "fa-circle-exclamation" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  $("#toastWrap").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------- Confetti ---------- */
function confetti() {
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  canvas.style.display = "block";
  canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ["#6366f1","#8b5cf6","#06b6d4","#16a34a","#f59e0b","#ef4444"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height,
    s: 6 + Math.random() * 8, c: colors[(Math.random() * colors.length) | 0],
    vy: 2 + Math.random() * 4, vx: -2 + Math.random() * 4, rot: Math.random() * 360
  }));
  let frames = 0;
  (function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.rot += 6;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
    });
    frames++;
    if (frames < 200) requestAnimationFrame(anim);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = "none"; }
  })();
}

/* ============================================================
   Navigation & routing
   ============================================================ */
function showPage(id) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === id));
  $$(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === id));
  $("#navLinks").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function handleHash() {
  const id = location.hash.replace("#", "") || "dashboard";
  if ($("#" + id)) showPage(id);
  renderAll();
}
window.addEventListener("hashchange", handleHash);
$("#hamburger").addEventListener("click", () => $("#navLinks").classList.toggle("open"));

/* ---------- Theme ---------- */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#themeToggle").innerHTML = state.theme === "dark"
    ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}
$("#themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  save(); applyTheme();
});

/* ============================================================
   Planner
   ============================================================ */
let activeDay = muscleToday();

function renderDayTabs() {
  const wrap = $("#dayTabs"); wrap.innerHTML = "";
  DAYS.forEach(d => {
    const b = document.createElement("button");
    b.className = "day-tab" + (d === activeDay ? " active" : "");
    b.textContent = d.slice(0, 3);
    b.title = d;
    b.addEventListener("click", () => { activeDay = d; renderDayTabs(); renderExercises(); });
    wrap.appendChild(b);
  });
}

function renderExercises() {
  const grid = $("#exGrid");
  const term = $("#searchInput").value.trim().toLowerCase();
  const filter = $("#filterStatus").value;
  let list = state.workouts[activeDay] || [];
  let filtered = list.filter(ex => {
    const matches = ex.name.toLowerCase().includes(term) || ex.muscle.toLowerCase().includes(term);
    const statusOk = filter === "all" || (filter === "completed" ? ex.done : !ex.done);
    return matches && statusOk;
  });

  grid.innerHTML = "";
  if (!filtered.length) {
    grid.innerHTML = `<p class="empty"><i class="fa-solid fa-clipboard-list" style="font-size:2rem"></i><br>No exercises for ${activeDay}. Add one to get started!</p>`;
  }
  filtered.forEach(ex => grid.appendChild(exCard(ex)));
  updateProgress();
}

function exCard(ex) {
  const el = document.createElement("div");
  el.className = "card ex-card" + (ex.done ? " done" : "");
  el.innerHTML = `
    <div class="ex-top">
      <span class="ex-name ${ex.done ? "done" : ""}">${ex.name}</span>
      <span class="tag">${ex.muscle}</span>
    </div>
    <div class="ex-meta">
      <span><i class="fa-solid fa-layer-group"></i> ${ex.sets} sets</span>
      <span><i class="fa-solid fa-repeat"></i> ${ex.reps} reps</span>
      ${ex.duration ? `<span><i class="fa-solid fa-clock"></i> ${ex.duration} min</span>` : ""}
    </div>
    ${ex.notes ? `<p class="ex-notes">"${ex.notes}"</p>` : ""}
    <div class="ex-foot">
      <label class="check"><input type="checkbox" ${ex.done ? "checked" : ""}> Completed</label>
      <div class="ex-actions">
        <button class="mini edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="mini del" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  $(".check input", el).addEventListener("change", e => toggleDone(ex.id, e.target.checked));
  $(".edit", el).addEventListener("click", () => openModal(ex));
  $(".del", el).addEventListener("click", () => deleteExercise(ex.id, el));
  return el;
}

function toggleDone(id, done) {
  const ex = state.workouts[activeDay].find(e => e.id === id);
  if (!ex) return;
  ex.done = done;
  if (done) { state.totalExCompleted++; state.caloriesBurned += estimateCalories(ex); }
  save(); renderExercises(); checkWorkoutComplete();
}

function estimateCalories(ex) {
  const base = (ex.duration || 5) * 6 + ex.sets * ex.reps * 0.3;
  return Math.round(base);
}

function deleteExercise(id, el) {
  el.classList.add("removing");
  setTimeout(() => {
    state.workouts[activeDay] = state.workouts[activeDay].filter(e => e.id !== id);
    save(); renderExercises(); toast("Exercise deleted", "error");
  }, 280);
}

/* ---------- Workout completion ---------- */
function checkWorkoutComplete() {
  const list = state.workouts[activeDay];
  if (list.length && list.every(e => e.done)) {
    recordCompletion();
    confetti();
    toast("🎉 Workout complete! Great job!", "success");
    setTimeout(() => alert("🎉 Congratulations! You completed today's workout. Keep up the great work!"), 200);
  }
}

function recordCompletion() {
  const key = todayKey();
  if (state.history[key]?.pct === 100) { computeAchievements(); return; } // already counted
  const list = state.workouts[activeDay];
  state.history[key] = { total: list.length, completed: list.length, pct: 100, day: activeDay };
  state.totalWorkouts++;
  updateStreak(key);
  computeAchievements();
  save();
}

function updateStreak(key) {
  const last = state.streak.lastDone;
  if (last === key) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  state.streak.current = last === yesterday ? state.streak.current + 1 : 1;
  state.streak.longest = Math.max(state.streak.longest, state.streak.current);
  state.streak.lastDone = key;
}

/* ---------- Progress ---------- */
function updateProgress() {
  const list = state.workouts[activeDay] || [];
  const done = list.filter(e => e.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  $("#plannerProgress").style.width = pct + "%";
  $("#plannerProgressTxt").textContent = `${pct}% completed (${done}/${list.length})`;
  // also persist partial history (non-100)
  if (list.length && pct < 100) {
    state.history[todayKey()] = { total: list.length, completed: done, pct, day: activeDay };
  }
}

/* ============================================================
   Add / Edit modal + validation
   ============================================================ */
const modal = $("#modal");
function openModal(ex = null) {
  $("#exForm").reset();
  $$(".err").forEach(e => e.textContent = "");
  $("#modalTitle").textContent = ex ? "Edit Exercise" : "Add Exercise";
  $("#exId").value = ex ? ex.id : "";
  if (ex) {
    $("#exName").value = ex.name; $("#exMuscle").value = ex.muscle;
    $("#exSets").value = ex.sets; $("#exReps").value = ex.reps;
    $("#exDuration").value = ex.duration || ""; $("#exNotes").value = ex.notes || "";
  }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
$("#openAdd").addEventListener("click", () => openModal());
$("#modalClose").addEventListener("click", closeModal);
$("#modalCancel").addEventListener("click", closeModal);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

function setErr(field, msg) {
  $(`.err[data-for="${field}"]`).textContent = msg;
  $("#" + field).classList.toggle("invalid", !!msg);
}

$("#exForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#exName").value.trim();
  const muscle = $("#exMuscle").value;
  const sets = parseInt($("#exSets").value, 10);
  const reps = parseInt($("#exReps").value, 10);
  const duration = $("#exDuration").value ? parseInt($("#exDuration").value, 10) : null;
  const notes = $("#exNotes").value.trim();

  let ok = true;
  setErr("exName", ""); setErr("exMuscle", ""); setErr("exSets", ""); setErr("exReps", "");
  if (!name) { setErr("exName", "Name is required"); ok = false; }
  else if (name.length > 60) { setErr("exName", "Too long (max 60)"); ok = false; }
  if (!muscle) { setErr("exMuscle", "Select a muscle group"); ok = false; }
  if (!sets || sets < 1) { setErr("exSets", "Enter valid sets"); ok = false; }
  if (!reps || reps < 1) { setErr("exReps", "Enter valid reps"); ok = false; }
  if (!ok) return;

  const id = $("#exId").value;
  if (id) {
    const ex = state.workouts[activeDay].find(x => x.id === id);
    Object.assign(ex, { name, muscle, sets, reps, duration, notes });
    toast("Exercise updated", "success");
  } else {
    state.workouts[activeDay].push({ id: crypto.randomUUID(), name, muscle, sets, reps, duration, notes, done: false });
    toast("Exercise added", "success");
  }
  save(); closeModal(); renderExercises();
});

/* ---------- Toolbar actions ---------- */
$("#searchInput").addEventListener("input", renderExercises);
$("#filterStatus").addEventListener("change", renderExercises);
$("#clearDay").addEventListener("click", () => {
  if (!state.workouts[activeDay].length) return;
  if (confirm(`Clear all exercises for ${activeDay}?`)) {
    state.workouts[activeDay] = []; save(); renderExercises(); toast("Day cleared", "error");
  }
});

/* ============================================================
   BMI
   ============================================================ */
$("#bmiCalc").addEventListener("click", () => {
  const h = parseFloat($("#bmiHeight").value);
  const w = parseFloat($("#bmiWeight").value);
  if (!h || !w || h < 50 || w < 10) { toast("Enter valid height & weight", "error"); return; }
  const bmi = +(w / ((h / 100) ** 2)).toFixed(1);
  let cat, cls;
  if (bmi < 18.5) { cat = "Underweight"; cls = "cat-under"; }
  else if (bmi < 25) { cat = "Normal"; cls = "cat-normal"; }
  else if (bmi < 30) { cat = "Overweight"; cls = "cat-over"; }
  else { cat = "Obese"; cls = "cat-obese"; }
  state.bmi = { value: bmi, category: cat, height: h, weight: w };
  save();
  $("#bmiResult").hidden = false;
  $("#bmiValue").textContent = bmi;
  const catEl = $("#bmiCat"); catEl.textContent = cat; catEl.className = "bmi-cat " + cls;
  toast("BMI updated", "success");
  renderDashboard(); renderStats();
});

/* ============================================================
   Water tracker
   ============================================================ */
function ensureWaterDay() {
  if (state.water.date !== todayKey()) { state.water.date = todayKey(); state.water.intake = 0; save(); }
}
$$("[data-water]").forEach(b => b.addEventListener("click", () => {
  ensureWaterDay();
  state.water.intake += +b.dataset.water; save(); renderWater();
  toast(`+${b.dataset.water} ml water`, "success");
}));
$("#waterReset").addEventListener("click", () => { state.water.intake = 0; save(); renderWater(); });

function renderWater() {
  ensureWaterDay();
  const { intake, goal } = state.water;
  const pct = Math.min(100, Math.round((intake / goal) * 100));
  $("#waterRing").style.setProperty("--p", pct);
  $("#waterPct").textContent = pct + "%";
  $("#waterGoal").textContent = goal;
  $("#waterCur").textContent = intake;
  $("#waterRem").textContent = Math.max(0, goal - intake);
}

/* ============================================================
   Timer
   ============================================================ */
let timerSec = 30, timerLeft = 30, timerInt = null;
function fmt(s) { return `${String((s/60)|0).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function renderTimer() { $("#timerDisplay").textContent = fmt(timerLeft); }
$$(".timer-preset").forEach(b => b.addEventListener("click", () => {
  timerSec = +b.dataset.sec; timerLeft = timerSec; stopTimer(); renderTimer();
}));
function stopTimer() { clearInterval(timerInt); timerInt = null; }
$("#timerStart").addEventListener("click", () => {
  if (timerInt) return;
  timerInt = setInterval(() => {
    timerLeft--; renderTimer();
    if (timerLeft <= 0) { stopTimer(); beep(); toast("⏱ Timer finished!", "success"); timerLeft = timerSec; setTimeout(renderTimer, 800); }
  }, 1000);
});
$("#timerPause").addEventListener("click", stopTimer);
$("#timerReset").addEventListener("click", () => { stopTimer(); timerLeft = timerSec; renderTimer(); });
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.value = 880;
    o.start(); g.gain.setValueAtTime(.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1); o.stop(ctx.currentTime + 1);
  } catch {}
}

/* ============================================================
   Goal
   ============================================================ */
$("#goalSave").addEventListener("click", () => {
  state.goal = {
    exercises: +$("#goalEx").value || 0,
    calories: +$("#goalCal").value || 0,
    minutes: +$("#goalMin").value || 0
  };
  save(); renderGoal(); toast("Goal saved", "success");
});
function renderGoal() {
  $("#goalEx").value = state.goal.exercises;
  $("#goalCal").value = state.goal.calories;
  $("#goalMin").value = state.goal.minutes;
  const list = state.workouts[muscleToday()] || [];
  const doneEx = list.filter(e => e.done).length;
  const pct = state.goal.exercises ? Math.min(100, Math.round(doneEx / state.goal.exercises * 100)) : 0;
  $("#goalStatus").textContent = `${doneEx}/${state.goal.exercises} exercises today — ${pct}% of goal`;
}

/* ============================================================
   Achievements
   ============================================================ */
const BADGES = [
  { id: "first", icon: "🏅", name: "First Workout", desc: "Complete 1 workout", test: s => s.totalWorkouts >= 1 },
  { id: "s3", icon: "🔥", name: "3-Day Streak", desc: "Reach a 3-day streak", test: s => s.streak.longest >= 3 },
  { id: "s7", icon: "🔥", name: "7-Day Streak", desc: "Reach a 7-day streak", test: s => s.streak.longest >= 7 },
  { id: "s30", icon: "🔥", name: "30-Day Streak", desc: "Reach a 30-day streak", test: s => s.streak.longest >= 30 },
  { id: "ex100", icon: "💯", name: "100 Exercises", desc: "Complete 100 exercises", test: s => s.totalExCompleted >= 100 },
  { id: "master", icon: "🏆", name: "Fitness Master", desc: "30 streak + 100 exercises", test: s => s.streak.longest >= 30 && s.totalExCompleted >= 100 },
];
function computeAchievements() {
  BADGES.forEach(b => {
    const unlocked = b.test(state);
    if (unlocked && !state["badge_" + b.id]) {
      state["badge_" + b.id] = true;
      toast(`${b.icon} Achievement unlocked: ${b.name}!`, "success");
    }
  });
  save();
}
function renderAchievements() {
  const grid = $("#badgeGrid"); grid.innerHTML = "";
  BADGES.forEach(b => {
    const unlocked = !!state["badge_" + b.id];
    const el = document.createElement("div");
    el.className = "card badge" + (unlocked ? "" : " locked");
    el.innerHTML = `<div class="badge-ic">${b.icon}</div><div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div>`;
    grid.appendChild(el);
  });
}

/* ============================================================
   Calendar + History
   ============================================================ */
function renderCalendar() {
  const now = new Date();
  $("#calMonth").textContent = now.toLocaleString("default", { month: "long", year: "numeric" });
  const grid = $("#calendar"); grid.innerHTML = "";
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) grid.insertAdjacentHTML("beforeend", `<div class="cal-cell empty"></div>`);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const h = state.history[key];
    let cls = "cal-cell";
    if (h?.pct === 100) cls += " done";
    else if (h && h.pct < 100) cls += " miss";
    if (key === todayKey()) cls += " today";
    grid.insertAdjacentHTML("beforeend", `<div class="${cls}">${d}</div>`);
  }
}
function renderHistory(filterDate = "") {
  const wrap = $("#historyList"); wrap.innerHTML = "";
  const entries = Object.entries(state.history).sort((a, b) => b[0].localeCompare(a[0]))
    .filter(([k]) => !filterDate || k === filterDate);
  if (!entries.length) { wrap.innerHTML = `<p class="empty">No history yet.</p>`; return; }
  entries.forEach(([date, h]) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><b>${date}</b> <span class="muted">${h.day || ""}</span><br>
      <span class="muted">${h.completed}/${h.total} exercises</span></div>
      <div><span class="tag">${h.pct}%</span> ${h.pct === 100 ? "✅" : "⏳"}</div>`;
    wrap.appendChild(el);
  });
}
$("#historySearch").addEventListener("change", e => renderHistory(e.target.value));

/* ============================================================
   Settings
   ============================================================ */
$("#saveUser").addEventListener("click", () => {
  const v = $("#setUserName").value.trim();
  if (!v) { toast("Enter a username", "error"); return; }
  state.user = v; save(); renderDashboard(); toast("Username saved", "success");
});
$("#resetStreak").addEventListener("click", () => {
  state.streak = { current: 0, longest: state.streak.longest, lastDone: null }; save();
  renderAll(); toast("Streak reset", "info");
});
$("#clearHistory").addEventListener("click", () => {
  if (confirm("Clear all workout history?")) { state.history = {}; save(); renderAll(); toast("History cleared", "info"); }
});
$("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "fittrack-data.json"; a.click();
  toast("Data exported", "success");
});
$("#importData").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { state = { ...defaultState(), ...JSON.parse(reader.result) }; save(); applyTheme(); renderAll(); toast("Data imported", "success"); }
    catch { toast("Invalid file", "error"); }
  };
  reader.readAsText(file);
});
$("#resetApp").addEventListener("click", () => {
  if (confirm("Reset the entire app? This deletes all data.")) {
    localStorage.removeItem(STORE_KEY); state = defaultState(); save(); applyTheme(); renderAll(); toast("App reset", "info");
  }
});

/* ============================================================
   Dashboard + clock + quote
   ============================================================ */
function renderDashboard() {
  const hour = new Date().getHours();
  $("#greeting").textContent = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
  $("#userName").textContent = state.user;
  $("#setUserName").value = state.user;

  const allEx = Object.values(state.workouts).flat();
  const todayList = state.workouts[muscleToday()] || [];
  const doneToday = todayList.filter(e => e.done).length;

  $("#sTotalEx").textContent = allEx.length;
  $("#sCompleted").textContent = doneToday;
  $("#sStreak").textContent = state.streak.current;
  $("#sBmi").textContent = state.bmi.value ?? "--";
  $("#sCalories").textContent = state.caloriesBurned;

  const pct = todayList.length ? Math.round(doneToday / todayList.length * 100) : 0;
  $("#dashProgress").style.width = pct + "%";
  $("#dashProgressTxt").textContent = `${pct}% of today's workout completed`;

  renderWater(); renderGoal();
}
function tickClock() {
  $("#dateTime").textContent = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}
function renderQuote() {
  const idx = (new Date().getDate() + new Date().getMonth()) % QUOTES.length;
  $("#quote").textContent = `"${QUOTES[idx]}"`;
}

/* ============================================================
   Statistics + Progress page
   ============================================================ */
function renderStats() {
  const todayList = state.workouts[muscleToday()] || [];
  const doneToday = todayList.filter(e => e.done).length;
  const pct = todayList.length ? Math.round(doneToday / todayList.length * 100) : 0;
  const weekDays = countRecent(7), monthDays = countRecent(31);

  $("#stWorkouts").textContent = state.totalWorkouts;
  $("#stExercises").textContent = state.totalExCompleted;
  $("#stStreak").textContent = state.streak.current;
  $("#stLong").textContent = state.streak.longest;
  $("#stBmi").textContent = state.bmi.value ?? "--";
  $("#stPct").textContent = pct + "%";
  $("#stCal").textContent = state.caloriesBurned;
  $("#stWeek").textContent = weekDays;
  $("#stMonth").textContent = monthDays;
}
function countRecent(n) {
  const now = new Date();
  return Object.entries(state.history).filter(([k, h]) => {
    if (h.pct !== 100) return false;
    const diff = (now - new Date(k)) / 86400000;
    return diff >= 0 && diff < n;
  }).length;
}
function renderProgressPage() {
  $("#curStreak").textContent = state.streak.current;
  $("#longStreak").textContent = state.streak.longest;
  renderCalendar();
  renderHistory($("#historySearch").value);
}

/* ============================================================
   Master render
   ============================================================ */
function renderAll() {
  renderDayTabs(); renderExercises();
  renderDashboard(); renderStats();
  renderAchievements(); renderProgressPage();
  if (state.bmi.value) {
    $("#bmiHeight").value = state.bmi.height ?? "";
    $("#bmiWeight").value = state.bmi.weight ?? "";
  }
}

/* ============================================================
   Init
   ============================================================ */
function init() {
  applyTheme();
  $("#year").textContent = new Date().getFullYear();
  renderQuote();
  tickClock(); setInterval(tickClock, 1000);
  renderTimer();
  computeAchievements();
  handleHash();
}
init();
