/* Wordle2 - 5-letter word game */

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const toastEl = document.getElementById("toast");
const newGameBtn = document.getElementById("newGameBtn");
const dailyModeCheckbox = document.getElementById("dailyMode");
const dictCountEl = document.getElementById("dictCount");

/**
 * Game state
 */
let allowedWords = [];
let allowedWordsSet = new Set();
let targetWord = "";
let currentRowIndex = 0;
let currentGuess = "";
let isRevealing = false;

/** Utility */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function showToast(message, duration = 1200) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toastEl.classList.remove("show"), duration);
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function getDailySeed() {
  const epoch = new Date("2022-01-01T00:00:00Z");
  const now = new Date();
  const diffDays = Math.floor((now - epoch) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function seededRandom(seed) {
  // xorshift32
  let x = (seed || 1) >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

function chooseTargetWord(words, useDaily) {
  if (!words.length) return "apple"; // fallback
  if (useDaily) {
    const rng = seededRandom(getDailySeed());
    const idx = Math.floor(rng() * words.length);
    return words[idx];
  }
  return words[randomInt(words.length)];
}

/** Board + UI */
function createBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r += 1) {
    for (let c = 0; c < WORD_LENGTH; c += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "gridcell");
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      boardEl.appendChild(tile);
    }
  }
}

function getTile(row, col) {
  return boardEl.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function renderGuessRow(rowIndex, guess) {
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    const tile = getTile(rowIndex, i);
    const ch = guess[i] || "";
    tile.textContent = ch ? ch.toUpperCase() : "";
    tile.classList.toggle("filled", Boolean(ch));
  }
}

function renderKeyboard() {
  const rows = [
    "qwertyuiop".split(""),
    "asdfghjkl".split(""),
    ["Enter", ..."zxcvbnm".split(""), "Backspace"],
  ];
  keyboardEl.innerHTML = "";
  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    row.forEach((key) => {
      const keyEl = document.createElement("div");
      keyEl.className = "key";
      if (key === "Enter" || key === "Backspace") keyEl.classList.add("wide");
      keyEl.dataset.key = key;
      keyEl.textContent = key === "Backspace" ? "⌫" : key.toUpperCase();
      keyEl.addEventListener("click", () => onKey(key));
      rowEl.appendChild(keyEl);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function updateKeyboardStates(guess, resultStates) {
  // resultStates: array of 'correct' | 'present' | 'absent'
  const priority = { absent: 0, present: 1, correct: 2 };
  for (let i = 0; i < guess.length; i += 1) {
    const ch = guess[i];
    const state = resultStates[i];
    const keyEl = keyboardEl.querySelector(`.key[data-key="${ch}"]`);
    if (!keyEl) continue;
    const existing = keyEl.getAttribute("data-state");
    if (!existing || priority[state] > priority[existing]) {
      keyEl.setAttribute("data-state", state);
      const label = state === 'correct' ? 'Correct spot' : state === 'present' ? 'Wrong spot' : 'Not in word';
      keyEl.setAttribute('title', label);
      keyEl.setAttribute('aria-label', `${ch.toUpperCase()}: ${label}`);
    }
  }
}

/** Game logic */
function scoreGuess(guess, solution) {
  const result = Array(WORD_LENGTH).fill("absent");
  const counts = Object.create(null);
  for (const ch of solution) counts[ch] = (counts[ch] || 0) + 1;

  // First pass: correct
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === solution[i]) {
      result[i] = "correct";
      counts[guess[i]] -= 1;
    }
  }
  // Second pass: present
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (result[i] !== "correct") {
      const ch = guess[i];
      if (counts[ch] > 0) {
        result[i] = "present";
        counts[ch] -= 1;
      }
    }
  }
  return result;
}

async function revealRow(rowIndex, guess, resultStates) {
  isRevealing = true;
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    const tile = getTile(rowIndex, i);
    tile.classList.add("reveal");
    await sleep(60 + i * 220);
    tile.classList.remove("state-absent", "state-present", "state-correct");
    tile.classList.add(`state-${resultStates[i]}`);
    tile.style.transform = "rotateX(0)";
  }
  isRevealing = false;
}

async function submitGuess() {
  if (isRevealing) return;
  if (!allowedWordsSet || allowedWordsSet.size === 0) {
    showToast("Dictionary loading...", 1200);
    return;
  }
  if (currentGuess.length !== WORD_LENGTH) {
    showToast("Not enough letters");
    return;
  }
  if (!allowedWordsSet.has(currentGuess)) {
    showToast("Not in word list");
    return;
  }

  const result = scoreGuess(currentGuess, targetWord);
  await revealRow(currentRowIndex, currentGuess, result);
  updateKeyboardStates(currentGuess, result);

  if (currentGuess === targetWord) {
    showToast("You got it! 🎉", 1500);
    window.removeEventListener("keydown", onKeydown);
    return;
  }

  currentRowIndex += 1;
  currentGuess = "";
  if (currentRowIndex >= MAX_GUESSES) {
    showToast(`The word was ${targetWord.toUpperCase()}`);
    window.removeEventListener("keydown", onKeydown);
  }
}

function onKey(key) {
  if (isRevealing) return;
  if (key === "Enter") {
    submitGuess();
    return;
  }
  if (key === "Backspace") {
    if (currentGuess.length > 0) {
      currentGuess = currentGuess.slice(0, -1);
      renderGuessRow(currentRowIndex, currentGuess);
    }
    return;
  }
  if (/^[a-zA-Z]$/.test(key)) {
    if (currentGuess.length < WORD_LENGTH) {
      currentGuess += key.toLowerCase();
      renderGuessRow(currentRowIndex, currentGuess);
    }
  }
}

function onKeydown(e) {
  const key = e.key;
  if (key === "Backspace" || key === "Enter" || /^[a-zA-Z]$/.test(key)) {
    e.preventDefault();
    onKey(key);
  }
}

async function loadDictionary() {
  const builtInFallback = [
    "apple", "other", "about", "farts", "cigar", "rebus", "gamer", "zesty"
  ];
  const candidates = [];
  if (window.WORDLE_ALLOWED_WORDS && Array.isArray(window.WORDLE_ALLOWED_WORDS)) {
    // Prefer inline dictionary when available (file:// mode)
    const words = window.WORDLE_ALLOWED_WORDS;
    allowedWords = words.map((w) => (w || "").toString().toLowerCase()).filter((w) => w.length === WORD_LENGTH);
    allowedWordsSet = new Set(allowedWords);
    if (dictCountEl) dictCountEl.textContent = `Words: ${allowedWords.length}`;
    console.log(`[dict] loaded from inline JS: ${allowedWords.length} words`);
    return;
  } else {
    candidates.push(`./data/allowed_words.json?ts=${Date.now()}`);
    candidates.push(`/data/allowed_words.json?ts=${Date.now()}`);
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const url of candidates) {
      try {
        // eslint-disable-next-line no-console
        console.log(`[dict] fetching ${url} (attempt ${attempt})`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const words = await res.json();
        // normalize
        allowedWords = words.map((w) => (w || "").toString().toLowerCase()).filter((w) => w.length === WORD_LENGTH);
        allowedWordsSet = new Set(allowedWords);
        if (dictCountEl) dictCountEl.textContent = `Words: ${allowedWords.length}`;
        // eslint-disable-next-line no-console
        console.log(`[dict] loaded ${allowedWords.length} words`);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    await sleep(500);
  }
  // eslint-disable-next-line no-console
  console.error("[dict] failed to fetch, using fallback:", lastErr);
  allowedWords = builtInFallback;
  allowedWordsSet = new Set(allowedWords);
  if (dictCountEl) dictCountEl.textContent = `Words: ${allowedWords.length} (fallback)`;
}

function resetGame() {
  currentRowIndex = 0;
  currentGuess = "";
  createBoard();
  renderGuessRow(0, "");
  renderKeyboard();
  window.addEventListener("keydown", onKeydown);
}

async function newGame() {
  resetGame();
  targetWord = chooseTargetWord(allowedWords, dailyModeCheckbox.checked);
}

async function init() {
  try {
    await loadDictionary();
  } catch (err) {
    console.error(err);
    showToast("Dictionary missing. Run scripts/setup_dictionary.ps1", 3000);
    return;
  }
  resetGame();
  targetWord = chooseTargetWord(allowedWords, false);
}

newGameBtn.addEventListener("click", () => newGame());
dailyModeCheckbox.addEventListener("change", () => newGame());

init();


