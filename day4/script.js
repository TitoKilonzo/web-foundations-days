// Live Character Counter - Day 4

const MAX_CHARS = 200;
const WARNING_AT = 180;
const DRAFT_KEY = "draft";
const THEME_KEY = "theme";

// Grab every element we need once, up front.
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// localStorage can be blocked (private mode, strict settings),
// so every call goes through these small safe helpers.
function saveItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Could not save to localStorage:", error);
  }
}

function loadItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Could not remove from localStorage:", error);
  }
}

// Words are groups of characters separated by whitespace.
function countWords(text) {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

// Refresh both counters and the warning / over colours.
function updateCounts() {
  const length = noteText.value.length;

  charCount.textContent = `${length} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${countWords(noteText.value)} words`;

  charCount.classList.toggle("warning", length > WARNING_AT);
  charCount.classList.toggle("over", length > MAX_CHARS);
}

// Empty the box, reset the counters and forget the saved draft.
function clearNote() {
  noteText.value = "";
  removeItem(DRAFT_KEY);
  updateCounts();
  noteText.focus();
}

// The button offers the mode you can switch TO.
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

// --- Events ---
noteText.addEventListener("input", () => {
  updateCounts();
  saveItem(DRAFT_KEY, noteText.value);
});

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

clearBtn.addEventListener("click", clearNote);

themeToggle.addEventListener("click", () => {
  const goingDark = !document.body.classList.contains("dark");
  applyTheme(goingDark);
  saveItem(THEME_KEY, goingDark ? "dark" : "light");
});

// --- On page load: bring back the draft and the theme ---
const savedDraft = loadItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}
applyTheme(loadItem(THEME_KEY) === "dark");
updateCounts();
