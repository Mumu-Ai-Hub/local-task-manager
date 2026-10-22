const STORAGE_KEY = "local-task-planner-v1";
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const $ = (selector) => document.querySelector(selector);
const state = loadState();

let cursorDate = startOfDay(new Date());
let selectedDate = toISODate(cursorDate);
let deferredInstallPrompt = null;

const nodes = {
  currentTitle: $("#currentTitle"),
  viewMode: $("#viewMode"),
  prevRange: $("#prevRange"),
  nextRange: $("#nextRange"),
  todayButton: $("#todayButton"),
  installApp: $("#installApp"),
  quickAddForm: $("#quickAddForm"),
  taskTitle: $("#taskTitle"),
  taskDate: $("#taskDate"),
  taskTime: $("#taskTime"),
  taskColor: $("#taskColor"),
  taskPriority: $("#taskPriority"),
  taskReminder: $("#taskReminder"),
  todoWeekLabel: $("#todoWeekLabel"),
  todoList: $("#todoList"),
  clearDone: $("#clearDone"),
  calendarHeader: $("#calendarHeader"),
  calendarGrid: $("#calendarGrid"),
  monthGoals: $("#monthGoals"),
  yearGoals: $("#yearGoals"),
  reminderStatus: $("#reminderStatus"),
  requestNotification: $("#requestNotification"),
  exportData: $("#exportData"),
  importData: $("#importData"),
  toastArea: $("#toastArea"),
  taskDialog: $("#taskDialog"),
  taskEditForm: $("#taskEditForm"),
  dialogTitle: $("#dialogTitle"),
  editTaskId: $("#editTaskId"),
  editTitle: $("#editTitle"),
  editDate: $("#editDate"),
  editTime: $("#editTime"),
  editNotes: $("#editNotes"),
  editColor: $("#editColor"),
  editPriority: $("#editPriority"),
  editReminder: $("#editReminder"),
  deleteTask: $("#deleteTask"),
};

init();

function init() {
  nodes.viewMode.value = state.viewMode;
  nodes.taskDate.value = selectedDate;
  nodes.monthGoals.value = state.goals.month;
  nodes.yearGoals.value = state.goals.year;

  bindEvents();
  render();
  updateReminderStatus();
  checkReminders();
  setInterval(checkReminders, 30 * 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  nodes.viewMode.addEventListener("change", () => {
    state.viewMode = nodes.viewMode.value;
    saveState();
    render();
  });

  nodes.prevRange.addEventListener("click", () => moveRange(-1));
  nodes.nextRange.addEventListener("click", () => moveRange(1));
  nodes.todayButton.addEventListener("click", () => {
    cursorDate = startOfDay(new Date());
    selectedDate = toISODate(cursorDate);
    nodes.taskDate.value = selectedDate;
    render();
  });

  nodes.quickAddForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTaskFromQuickForm();
  });

  nodes.clearDone.addEventListener("click", () => {
    state.tasks = state.tasks.filter((task) => !task.done);
    saveState();
    render();
  });

  nodes.monthGoals.addEventListener("input", () => {
    state.goals.month = nodes.monthGoals.value;
    saveState();
  });

  nodes.yearGoals.addEventListener("input", () => {
    state.goals.year = nodes.yearGoals.value;
    saveState();
  });

  document.querySelectorAll("[data-goal-tab]").forEach((tab) => {
    tab.addEventListener("click", () => switchGoalTab(tab.dataset.goalTab));
  });

  nodes.requestNotification.addEventListener("click", requestNotificationPermission);
  nodes.exportData.addEventListener("click", exportData);
  nodes.importData.addEventListener("change", importData);

  nodes.taskEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDialogTask();
  });

  nodes.deleteTask.addEventListener("click", () => {
    const id = nodes.editTaskId.value;
    state.tasks = state.tasks.filter((task) => task.id !== id);
    nodes.taskDialog.close();
    saveState();
    render();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    nodes.installApp.hidden = false;
  });

  nodes.installApp.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => {});
      deferredInstallPrompt = null;
      return;
    }
    showToast("安装提示", "使用 install.ps1 可以创建桌面和开始菜单快捷方式。");
  });
}

function loadState() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const seeded = {
    viewMode: "month",
    goals: {
      month: "品牌IP形象设计",
      year: "",
    },
    tasks: [
      sampleTask("25备用金交单", dateInCurrentMonth(25), "blue", "normal"),
      sampleTask("版权资料整理", dateInCurrentMonth(26), "gray", "normal"),
      sampleTask("任务管理表开发", null, "gray", "normal"),
      sampleTask("gpt海报应用开发", null, "gray", "normal"),
      sampleTask("表格转图开发落地", null, "gray", "normal"),
    ],
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.tasks)) return { ...seeded, ...stored };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  if (month !== 5) {
    seeded.goals.month = "";
  }
  return seeded;
}

function sampleTask(title, date, color, priority) {
  return {
    id: crypto.randomUUID(),
    title,
    date,
    time: "",
    color,
    priority,
    notes: "",
    done: false,
    remind: false,
    notifiedAt: "",
    createdAt: new Date().toISOString(),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const range = getVisibleRange();
  nodes.currentTitle.textContent = formatMonthTitle(cursorDate);
  nodes.calendarGrid.classList.toggle("view-week", state.viewMode === "week");
  nodes.todoWeekLabel.textContent = state.viewMode === "week" ? formatWeekLabel(range[0]) : "本月";

  renderCalendarHeader();
  renderCalendar(range);
  renderTodoList(range);
  updateReminderStatus();
}

function renderCalendarHeader() {
  nodes.calendarHeader.innerHTML = "";
  for (const day of WEEKDAYS) {
    const cell = document.createElement("div");
    cell.className = "weekday";
    cell.textContent = day;
    nodes.calendarHeader.append(cell);
  }
}

function renderCalendar(days) {
  nodes.calendarGrid.innerHTML = "";
  for (const date of days) {
    const iso = toISODate(date);
    const cell = document.createElement("article");
    cell.className = "day-cell";
    cell.classList.toggle("today", iso === toISODate(new Date()));
    cell.classList.toggle("selected", iso === selectedDate);
    cell.classList.toggle("other-month", date.getMonth() !== cursorDate.getMonth());
    cell.dataset.date = iso;

    const number = document.createElement("button");
    number.type = "button";
    number.className = "day-number";
    number.textContent = String(date.getDate());
    number.title = "选择日期";
    number.addEventListener("click", () => selectDate(iso));

    const body = document.createElement("div");
    body.className = "day-body";
    tasksForDate(iso).forEach((task) => body.append(createTaskChip(task, "calendar")));

    cell.addEventListener("dblclick", () => {
      selectDate(iso);
      nodes.taskTitle.focus();
    });
    cell.append(number, body);
    nodes.calendarGrid.append(cell);
  }
}

function renderTodoList(range) {
  nodes.todoList.innerHTML = "";
  const rangeStart = toISODate(range[0]);
  const rangeEnd = toISODate(range[range.length - 1]);
  const tasks = state.tasks
    .filter((task) => !task.date || (task.date >= rangeStart && task.date <= rangeEnd))
    .sort(compareTasks);

  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.className = "reminder-status";
    empty.textContent = "暂无待办";
    nodes.todoList.append(empty);
    return;
  }

  tasks.forEach((task) => nodes.todoList.append(createTaskChip(task, "list")));
}

function createTaskChip(task, context) {
  const chip = document.createElement("div");
  chip.className = `task-chip task-${task.color || "gray"} ${task.priority || "normal"}`;
  chip.classList.toggle("done", task.done);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.title = "完成";
  checkbox.addEventListener("change", () => {
    task.done = checkbox.checked;
    saveState();
    render();
  });

  const title = document.createElement("button");
  title.type = "button";
  title.textContent = task.title;
  title.title = task.notes || task.title;
  title.addEventListener("click", () => openTaskDialog(task.id));

  const meta = document.createElement("span");
  meta.className = "task-time";
  meta.textContent = context === "list" ? formatTaskMeta(task) : task.time;

  chip.append(checkbox, title, meta);
  return chip;
}

function addTaskFromQuickForm() {
  const title = nodes.taskTitle.value.trim();
  if (!title) return;

  state.tasks.push({
    id: crypto.randomUUID(),
    title,
    date: nodes.taskDate.value || "",
    time: nodes.taskTime.value || "",
    color: nodes.taskColor.value,
    priority: nodes.taskPriority.value,
    notes: "",
    done: false,
    remind: nodes.taskReminder.checked && Boolean(nodes.taskDate.value && nodes.taskTime.value),
    notifiedAt: "",
    createdAt: new Date().toISOString(),
  });

  nodes.taskTitle.value = "";
  nodes.taskTime.value = "";
  saveState();
  render();
}

function openTaskDialog(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  nodes.editTaskId.value = task.id;
  nodes.editTitle.value = task.title;
  nodes.editDate.value = task.date || "";
  nodes.editTime.value = task.time || "";
  nodes.editNotes.value = task.notes || "";
  nodes.editColor.value = task.color || "gray";
  nodes.editPriority.value = task.priority || "normal";
  nodes.editReminder.checked = task.remind;
  nodes.dialogTitle.textContent = "编辑任务";
  nodes.taskDialog.showModal();
}

function saveDialogTask() {
  const task = state.tasks.find((item) => item.id === nodes.editTaskId.value);
  if (!task) return;

  const previousReminderKey = getReminderKey(task);
  task.title = nodes.editTitle.value.trim();
  task.date = nodes.editDate.value;
  task.time = nodes.editTime.value;
  task.notes = nodes.editNotes.value.trim();
  task.color = nodes.editColor.value;
  task.priority = nodes.editPriority.value;
  task.remind = nodes.editReminder.checked && Boolean(task.date && task.time);
  if (previousReminderKey !== getReminderKey(task)) task.notifiedAt = "";

  nodes.taskDialog.close();
  saveState();
  render();
}

function selectDate(iso) {
  selectedDate = iso;
  nodes.taskDate.value = iso;
  cursorDate = parseISODate(iso);
  render();
}

function moveRange(direction) {
  const next = new Date(cursorDate);
  if (state.viewMode === "week") next.setDate(next.getDate() + direction * 7);
  else next.setMonth(next.getMonth() + direction);
  cursorDate = startOfDay(next);
  render();
}

function getVisibleRange() {
  if (state.viewMode === "week") {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0);
  const end = addDays(startOfWeek(last), 6);
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) days.push(date);
  return days;
}

function tasksForDate(iso) {
  return state.tasks.filter((task) => task.date === iso).sort(compareTasks);
}

function compareTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.date !== b.date) return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
  if (a.time !== b.time) return (a.time || "99:99").localeCompare(b.time || "99:99");
  const priorityRank = { high: 0, normal: 1, low: 2 };
  return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
}

function checkReminders() {
  const now = Date.now();
  const dueTasks = state.tasks.filter((task) => {
    if (!task.remind || task.done || !task.date || !task.time) return false;
    const reminderTime = new Date(`${task.date}T${task.time}:00`).getTime();
    return reminderTime <= now && task.notifiedAt !== getReminderKey(task);
  });

  if (!dueTasks.length) return;

  for (const task of dueTasks) {
    notifyTask(task);
    task.notifiedAt = getReminderKey(task);
  }
  saveState();
  render();
}

function notifyTask(task) {
  beep();
  showToast("任务提醒", `${task.time} ${task.title}`, [
    { label: "稍后10分钟", action: () => snoozeTask(task, 10) },
    { label: "完成", action: () => completeTask(task) },
  ]);

  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification("任务提醒", {
      body: `${task.time} ${task.title}`,
      tag: task.id,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      openTaskDialog(task.id);
      notification.close();
    };
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("提醒不可用", "当前浏览器不支持系统通知。");
    return;
  }
  const permission = await Notification.requestPermission();
  updateReminderStatus();
  showToast("提醒状态", permission === "granted" ? "系统通知已开启。" : "没有获得系统通知权限。");
}

function snoozeTask(task, minutes) {
  const next = new Date(Date.now() + minutes * 60 * 1000);
  task.date = toISODate(next);
  task.time = `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
  task.notifiedAt = "";
  saveState();
  render();
}

function completeTask(task) {
  task.done = true;
  saveState();
  render();
}

function updateReminderStatus() {
  if (!("Notification" in window)) {
    nodes.reminderStatus.textContent = "提醒：浏览器不支持系统通知，仍会显示应用内提醒。";
    return;
  }
  const status = Notification.permission === "granted" ? "已开启" : "未开启";
  const active = state.tasks.filter((task) => task.remind && !task.done).length;
  nodes.reminderStatus.textContent = `系统通知：${status}。待提醒任务：${active} 个。应用需要保持打开。`;
}

function showToast(title, message, actions = []) {
  const toast = document.createElement("div");
  toast.className = "toast";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const body = document.createElement("div");
  body.textContent = message;
  toast.append(strong, body);

  if (actions.length) {
    const row = document.createElement("div");
    row.className = "toast-actions";
    actions.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.addEventListener("click", () => {
        item.action();
        toast.remove();
      });
      row.append(button);
    });
    toast.append(row);
  }

  nodes.toastArea.append(toast);
  setTimeout(() => toast.remove(), actions.length ? 30000 : 5000);
}

function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.38);
  } catch {
    // Audio can be blocked before user interaction.
  }
}

function switchGoalTab(tabName) {
  document.querySelectorAll("[data-goal-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.goalTab === tabName);
  });
  nodes.monthGoals.classList.toggle("hidden", tabName !== "month");
  nodes.yearGoals.classList.toggle("hidden", tabName !== "year");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `任务管理备份-${toISODate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported.tasks)) throw new Error("invalid");
      state.tasks = imported.tasks;
      state.goals = imported.goals || { month: "", year: "" };
      state.viewMode = imported.viewMode || state.viewMode;
      saveState();
      nodes.monthGoals.value = state.goals.month || "";
      nodes.yearGoals.value = state.goals.year || "";
      render();
      showToast("导入完成", "任务和目标已更新。");
    } catch {
      showToast("导入失败", "请选择有效的任务管理备份 JSON。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function getReminderKey(task) {
  return `${task.date}T${task.time}`;
}

function formatTaskMeta(task) {
  const parts = [];
  if (task.date) parts.push(task.date.slice(5));
  if (task.time) parts.push(task.time);
  return parts.join(" ");
}

function formatMonthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatWeekLabel(date) {
  const week = getISOWeek(date);
  return `${week}周`;
}

function getISOWeek(date) {
  const target = startOfDay(date);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

function startOfWeek(date) {
  const result = startOfDay(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function toISODate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateInCurrentMonth(day) {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), day));
}
