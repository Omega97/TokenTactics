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
    boardBg: "#141414",
    accent: "#ff2d95",
    accent2: "#00e5ff",
    boardZoom: 1
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
    document.documentElement.style.setProperty("--accent", settings.accent);
    document.documentElement.style.setProperty("--accent-2", settings.accent2);
    document.documentElement.style.setProperty("--board-zoom", settings.boardZoom);
  }

  var settingsPanel = document.getElementById("settings-panel");
  var gearBtn = document.getElementById("settings-gear");
  var coordSelect = document.getElementById("setting-coordinates");
  var commandColorInput = document.getElementById("setting-command-color");
  var commentColorInput = document.getElementById("setting-comment-color");
  var boardBgInput = document.getElementById("setting-board-bg");
  var accentInput = document.getElementById("setting-accent");
  var accent2Input = document.getElementById("setting-accent-2");
  var boardZoomInput = document.getElementById("setting-board-zoom");
  var boardZoomValue = document.getElementById("setting-board-zoom-value");
  var emojiBtn = document.getElementById("emoji-btn");
  var emojiPanel = document.getElementById("emoji-panel");
  var emojiGrid = document.getElementById("emoji-grid");
  var toast = document.getElementById("toast");

  function formatZoom(v) {
    return (Math.round(v * 10) / 10).toFixed(1) + "×";
  }

  coordSelect.value = settings.coordinates;
  commandColorInput.value = settings.commandColor;
  commentColorInput.value = settings.commentColor;
  boardBgInput.value = settings.boardBg;
  accentInput.value = settings.accent;
  accent2Input.value = settings.accent2;
  boardZoomInput.value = settings.boardZoom;
  boardZoomValue.textContent = formatZoom(settings.boardZoom);
  applyColors();

  gearBtn.addEventListener("click", function () {
    settingsPanel.classList.toggle("hidden");
    emojiPanel.classList.add("hidden");
  });

  emojiBtn.addEventListener("click", function () {
    emojiPanel.classList.toggle("hidden");
    settingsPanel.classList.add("hidden");
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

  accentInput.addEventListener("input", function () {
    settings.accent = accentInput.value;
    saveSettings();
    applyColors();
  });

  accent2Input.addEventListener("input", function () {
    settings.accent2 = accent2Input.value;
    saveSettings();
    applyColors();
  });

  boardZoomInput.addEventListener("input", function () {
    settings.boardZoom = parseFloat(boardZoomInput.value);
    boardZoomValue.textContent = formatZoom(settings.boardZoom);
    saveSettings();
    applyColors();
  });

  // --- Save board + commands ---
  function autoSave() {
    var node = document.getElementById("board-panel");
    if (!node || typeof html2canvas === "undefined") return;
    html2canvas(node, {
      backgroundColor: "#15001f",
      scale: 2,
      useCORS: true,
      logging: false
    }).then(function (canvas) {
      canvas.toBlob(function (blob) {
        var reader = new FileReader();
        reader.onloadend = function () {
          var base64 = String(reader.result).split(",")[1] || "";
          fetch("/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: editor.getValue(), png: base64 })
          }).catch(function (err) { console.warn("Auto-save failed:", err); });
        };
        reader.readAsDataURL(blob);
      }, "image/png");
    }).catch(function (err) { console.warn("Screenshot failed:", err); });
  }

  // --- Emoji menu ---
  var toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 1500);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyEmoji(emoji) {
    var done = function () { showToast("Copied to clipboard!"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(emoji).then(done, function () {
        fallbackCopy(emoji);
        done();
      });
    } else {
      fallbackCopy(emoji);
      done();
    }
  }

  function graphemes(str) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      var seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(seg.segment(str), function (s) { return s.segment; });
    }
    return Array.from(str);
  }

  var EMOJI_RE = /[\p{Extended_Pictographic}]/u;

  function scrapeEmoji(text) {
    var result = [];
    var seen = new Set();
    text.split("\n").forEach(function (line) {
      graphemes(line).forEach(function (g) {
        if (EMOJI_RE.test(g) && !seen.has(g)) {
          seen.add(g);
          result.push(g);
        }
      });
    });
    return result;
  }

  fetch("/emoji.txt")
    .then(function (r) { return r.text(); })
    .then(function (text) {
      scrapeEmoji(text).forEach(function (emoji) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = emoji;
        btn.title = "Copy " + emoji;
        btn.addEventListener("click", function () {
          copyEmoji(emoji);
          emojiPanel.classList.add("hidden");
        });
        emojiGrid.appendChild(btn);
      });
    })
    .catch(function () {
      emojiGrid.textContent = "Failed to load emoji";
    });

  function swapLine(cm, dir) {
    var cur = cm.getCursor();
    var line = cur.line;
    var other = line + dir;
    if (other < 0 || other >= cm.lineCount()) return;
    var top = Math.min(line, other);
    var bottom = Math.max(line, other);
    var topText = cm.getLine(top);
    var bottomText = cm.getLine(bottom);
    cm.operation(function () {
      cm.replaceRange(
        bottomText + "\n" + topText + "\n",
        { line: top, ch: 0 },
        { line: bottom + 1, ch: 0 }
      );
    });
    cm.setCursor({ line: other, ch: Math.min(cur.ch, cm.getLine(other).length) });
  }

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
      },
      "Shift-Alt-Up": function (cm) { swapLine(cm, -1); },
      "Shift-Alt-Down": function (cm) { swapLine(cm, 1); }
    }
  });

  var statusEl = document.getElementById("status");
  var statusLabel = document.getElementById("status-label");
  var errorBanner = document.getElementById("error-banner");
  var boardEl = document.getElementById("board");
  var boardTurnEl = document.getElementById("board-turn");
  var playersEl = document.getElementById("players");
  var priorityEl = document.getElementById("priority");
  var lastErrorLine = null;
  var lastCompiledNorm = null;
  var tokenSet = new Set();

  function capitalize(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function renderBoard(res) {
    boardEl.textContent = res.board;
    boardTurnEl.textContent = res.turn != null ? "TURN " + res.turn : "";
  }

  function textOffsetAtPoint(x, y) {
    if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode && pos.offsetNode.nodeType === 3) {
        return { node: pos.offsetNode, offset: pos.offset };
      }
    }
    if (document.caretRangeFromPoint) {
      var range = document.caretRangeFromPoint(x, y);
      if (range && range.startContainer && range.startContainer.nodeType === 3) {
        return { node: range.startContainer, offset: range.startOffset };
      }
    }
    return null;
  }

  function graphemeAtOffset(text, offset) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      var it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text);
      for (var seg of it) {
        if (offset >= seg.index && offset < seg.index + seg.segment.length) {
          return seg.segment;
        }
      }
      return null;
    }
    var cps = Array.from(text);
    var idx = 0;
    for (var i = 0; i < cps.length; i++) {
      var len = cps[i].length;
      if (offset >= idx && offset < idx + len) return cps[i];
      idx += len;
    }
    return null;
  }

  boardEl.addEventListener("click", function (e) {
    var hit = textOffsetAtPoint(e.clientX, e.clientY);
    if (!hit || hit.node !== boardEl.firstChild) return;
    var grapheme = graphemeAtOffset(boardEl.textContent, hit.offset);
    if (grapheme && tokenSet.has(grapheme)) {
      copyEmoji(grapheme);
    }
  });

  function renderPlayers(res) {
    playersEl.textContent = "";
    tokenSet.clear();
    var s = res.symbols || {};
    var heart = s.heart || "❤️";
    var black = s.black_heart || "🖤";
    var energy = s.energy || "⚡️";
    (res.players || []).forEach(function (p) {
      var div = document.createElement("div");
      div.className = "player";

      var name = document.createElement("div");
      name.className = "player-name";
      name.textContent = capitalize(p.name);
      div.appendChild(name);

      (p.tokens || []).forEach(function (t) {
        tokenSet.add(t.emoji);
        var row = document.createElement("div");
        row.className = "token-row";

        var em = document.createElement("span");
        em.className = "token-emoji";
        em.textContent = t.emoji;
        row.appendChild(em);

        var life = document.createElement("span");
        life.className = "life";
        life.textContent = heart.repeat(t.life) + black.repeat(t.life_cap - t.life);
        row.appendChild(life);

        var en = document.createElement("span");
        en.className = "energy";
        en.textContent = energy.repeat(t.ap);
        row.appendChild(en);

        var rng = document.createElement("span");
        rng.className = "range-tag";
        rng.textContent = "range " + t.range;
        row.appendChild(rng);

        div.appendChild(row);
      });

      playersEl.appendChild(div);
    });
  }

  function renderPriority(res) {
    priorityEl.textContent = "";

    var prioLabel = document.createElement("div");
    prioLabel.className = "section-label";
    prioLabel.textContent = "Priority";
    priorityEl.appendChild(prioLabel);

    (res.priority || []).forEach(function (name, i) {
      var row = document.createElement("div");
      row.className = "rank-row";
      var num = document.createElement("span");
      num.className = "rank-num";
      num.textContent = String(i + 1);
      var nm = document.createElement("span");
      nm.className = "rank-name";
      nm.textContent = capitalize(name);
      row.appendChild(num);
      row.appendChild(nm);
      priorityEl.appendChild(row);
    });

    var jury = res.jury || {};
    if (Object.keys(jury).length) {
      var votesLabel = document.createElement("div");
      votesLabel.className = "section-label";
      votesLabel.textContent = "Votes";
      priorityEl.appendChild(votesLabel);

      Object.keys(jury).forEach(function (name) {
        var row = document.createElement("div");
        row.className = "vote-row";
        var nm = document.createElement("span");
        nm.className = "name";
        nm.textContent = capitalize(name);
        row.appendChild(nm);
        var arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "→";
        row.appendChild(arrow);
        if (jury[name]) {
          var tok = document.createElement("span");
          tok.className = "token";
          tok.textContent = jury[name];
          row.appendChild(tok);
        } else {
          var none = document.createElement("span");
          none.className = "novote";
          none.textContent = "no vote";
          row.appendChild(none);
        }
        priorityEl.appendChild(row);
      });
    }
  }

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

  function clearErrorHighlights() {
    editor.eachLine(function (line) {
      editor.removeLineClass(line, "background", "error-line");
    });
  }

  function clearError() {
    clearErrorHighlights();
    lastErrorLine = null;
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
  }

  function showError(lineNo, message) {
    errorBanner.textContent = "Line " + lineNo + ": " + message;
    errorBanner.classList.remove("hidden");
    var line = lineNo - 1;
    clearErrorHighlights();
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
          renderBoard(res);
          renderPlayers(res);
          renderPriority(res);
          lastCompiledNorm = normalize(text);
          setStatus(true);
          autoSave();
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
