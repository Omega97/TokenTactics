(function () {
  // --- Syntax highlighting mode (commands + comments) ---
  CodeMirror.defineMode("tt", function () {
    return {
      startState: function () { return {}; },
      token: function (stream, state) {
        if (stream.sol()) state.command = false;
        if (stream.eatSpace()) return null;
        if (stream.peek() === "#") {
          stream.skipToEnd();
          return "comment";
        }
        if (!state.command && stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) {
          state.command = true;
          return "command";
        }
        stream.next();
        return null;
      }
    };
  });

  // --- Settings (persisted to localStorage) ---
  var SETTINGS_KEY = "tt.settings";
  var defaults = {
    coordinates: "dots",
    commandColor: "#89b4fa",
    commentColor: "#808080",
    boardBg: "#141414"
  };
  var settings = defaults;
  try {
    var stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    settings = Object.assign({}, defaults, stored);
  } catch (e) {
    settings = defaults;
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function applyColors() {
    document.documentElement.style.setProperty("--command-color", settings.commandColor);
    document.documentElement.style.setProperty("--comment-color", settings.commentColor);
    document.documentElement.style.setProperty("--board-bg", settings.boardBg);
  }

  var settingsPanel = document.getElementById("settings-panel");
  var gearBtn = document.getElementById("settings-gear");
  var coordSelect = document.getElementById("setting-coordinates");
  var commandColorInput = document.getElementById("setting-command-color");
  var commentColorInput = document.getElementById("setting-comment-color");
  var boardBgInput = document.getElementById("setting-board-bg");

  coordSelect.value = settings.coordinates;
  commandColorInput.value = settings.commandColor;
  commentColorInput.value = settings.commentColor;
  boardBgInput.value = settings.boardBg;
  applyColors();

  gearBtn.addEventListener("click", function () {
    settingsPanel.classList.toggle("hidden");
  });

  coordSelect.addEventListener("change", function () {
    settings.coordinates = coordSelect.value;
    saveSettings();
    compile();
  });

  commandColorInput.addEventListener("input", function () {
    settings.commandColor = commandColorInput.value;
    saveSettings();
    applyColors();
  });

  commentColorInput.addEventListener("input", function () {
    settings.commentColor = commentColorInput.value;
    saveSettings();
    applyColors();
  });

  boardBgInput.addEventListener("input", function () {
    settings.boardBg = boardBgInput.value;
    saveSettings();
    applyColors();
  });

  var editor = CodeMirror(document.getElementById("editor"), {
    value: "",
    mode: "tt",
    lineNumbers: true,
    lineWrapping: false,
    tabSize: 4,
    extraKeys: {
      Enter: function (cm) {
        cm.execCommand("newlineAndIndent");
        compile();
      },
      "Ctrl-Enter": function (cm) {
        compile();
      }
    }
  });

  var statusEl = document.getElementById("status");
  var statusLabel = document.getElementById("status-label");
  var errorBanner = document.getElementById("error-banner");
  var boardEl = document.getElementById("board");
  var lastErrorLine = null;
  var lastCompiledNorm = null;

  function normalize(text) {
    return text.split("\n")
      .map(function (line) { return line.replace(/[ \t]+$/, ""); })
      .filter(function (line) { return line.trim() !== ""; })
      .join("\n");
  }

  function setStatus(compiled) {
    statusEl.classList.toggle("compiled", compiled);
    statusEl.classList.toggle("not-compiled", !compiled);
    statusLabel.textContent = compiled ? "compiled" : "not compiled";
  }

  function clearError() {
    if (lastErrorLine != null) {
      editor.removeLineClass(lastErrorLine, "background", "error-line");
      lastErrorLine = null;
    }
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
  }

  function showError(lineNo, message) {
    errorBanner.textContent = "Line " + lineNo + ": " + message;
    errorBanner.classList.remove("hidden");
    var line = lineNo - 1;
    editor.addLineClass(line, "background", "error-line");
    editor.scrollIntoView({ line: line, ch: 0 }, 60);
    lastErrorLine = line;
  }

  function compile() {
    var text = editor.getValue();
    fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, coordinates: settings.coordinates })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error_line) {
          showError(res.error_line, res.error_message);
          setStatus(false);
        } else {
          clearError();
          boardEl.textContent = res.state;
          lastCompiledNorm = normalize(text);
          setStatus(true);
        }
      })
      .catch(function (err) {
        errorBanner.textContent = "Failed to reach the compiler: " + err;
        errorBanner.classList.remove("hidden");
        setStatus(false);
      });
  }

  // Mark dirty whenever the user makes a meaningful edit (ignore blank lines
  // and trailing whitespace).
  editor.on("change", function () {
    if (lastCompiledNorm === null) {
      setStatus(false);
    } else {
      setStatus(normalize(editor.getValue()) === lastCompiledNorm);
    }
  });

  // Seed the editor from the welcome text, then compile once.
  fetch("/api/welcome")
    .then(function (r) { return r.json(); })
    .then(function (res) {
      editor.setValue(res.text || "");
      clearError();
      compile();
    })
    .catch(function (err) {
      boardEl.textContent = "Failed to load commands: " + err;
    });
})();
