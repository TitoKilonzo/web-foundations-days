// Starting data
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const CATEGORIES = ["personal", "work", "study"];

// Lower-cases, trims and squashes repeated spaces so that
// "  Buy   MILK " and "buy milk" compare as equal.
function normalise(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// 1. Find every note whose text contains the word (any case).
function searchNotes(word) {
  const target = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(target));
}

// 2. The note with the most characters, or null if there are none.
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// 3. Count how many notes are in each category.
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category] += 1;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

// 4. A friendly one-line summary, e.g. "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  const parts = CATEGORIES.map((category) => `${counts[category] || 0} ${category}`);
  return `${total} ${word}: ${parts.join(", ")}.`;
}

// 5. Does a note with this text already exist (ignoring case and extra spaces)?
function isDuplicate(text) {
  const cleaned = normalise(text);
  return notes.some((note) => normalise(note.text) === cleaned);
}

// 6. Add a note if it passes every check. Returns true or false.
function addNote(text, category) {
  const cleaned = typeof text === "string" ? text.trim() : "";

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Not added: the note must be 1-200 characters long.");
    return false;
  }
  if (!CATEGORIES.includes(category)) {
    console.log("Not added: the category must be personal, work or study.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("Not added: that note already exists.");
    return false;
  }

  const nextId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
  notes.push({ id: nextId, text: cleaned, category: category });
  return true;
}

// ---------------------------------------------------------------
// Tests (expected output is written next to each call)
// ---------------------------------------------------------------

// --- searchNotes ---
console.log("--- searchNotes ---");
console.log(searchNotes("the")); // 2 notes: id 2 "Finish the Day 3 assignment" and id 3 "Email the project report to Grace"
console.log(searchNotes("MILK")); // 1 note: id 1 "Buy milk and bread" (upper case still matches)
console.log(searchNotes("banana")); // [] (no results)

// --- longestNote ---
console.log("--- longestNote ---");
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }

// --- countByCategory ---
console.log("--- countByCategory ---");
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }

// --- getSummary ---
console.log("--- getSummary ---");
console.log(getSummary()); // "5 notes: 2 personal, 1 work, 2 study."

// --- isDuplicate ---
console.log("--- isDuplicate ---");
console.log(isDuplicate("Buy milk and bread")); // true
console.log(isDuplicate("  buy   MILK and bread ")); // true (case and extra spaces ignored)
console.log(isDuplicate("Walk the dog")); // false

// --- Edge cases with fewer notes (the real list is put back afterwards) ---
console.log("--- edge cases: empty and single-note lists ---");
const savedNotes = notes;

notes = [];
console.log(longestNote()); // null
console.log(countByCategory()); // {}
console.log(getSummary()); // "0 notes: 0 personal, 0 work, 0 study."

notes = [savedNotes[0]];
console.log(getSummary()); // "1 note: 1 personal, 0 work, 0 study."

notes = savedNotes;

// --- addNote ---
console.log("--- addNote ---");
console.log(addNote("Water the plants", "personal")); // true
console.log(addNote("  water   the PLANTS ", "personal")); // "Not added: that note already exists." then false
console.log(addNote("", "work")); // "Not added: the note must be 1-200 characters long." then false
console.log(addNote("a".repeat(201), "work")); // "Not added: the note must be 1-200 characters long." then false
console.log(addNote("Plan the budget", "hobby")); // "Not added: the category must be personal, work or study." then false

// --- Final check after the successful add ---
console.log("--- after adding one note ---");
console.log(countByCategory()); // { personal: 3, study: 2, work: 1 }
console.log(getSummary()); // "6 notes: 3 personal, 1 work, 2 study."
console.log(notes[notes.length - 1]); // { id: 6, text: "Water the plants", category: "personal" }
