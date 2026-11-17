"""
===== Token Tactics Web UI =====
Starts a local HTTP server, opens a browser window, and serves the editor UI.

The interpreter itself stays in `runner.compile_text`; this module only handles
HTTP transport and static file serving.
"""
import json
import os
import webbrowser
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .game import FIRST_FILE_CONTENT, NUMBER_EMOJI, Palette
from .runner import compile_text

WEBUI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "webui")
WELCOME_FILE = os.path.join(WEBUI_DIR, "welcome_text.txt")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}


def _make_handler(commands_file, palette):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass  # silence request logs

        # --- helpers ---
        def _send(self, status, body, content_type):
            if isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_json(self, status, payload):
            self._send(status, json.dumps(payload), "application/json; charset=utf-8")

        def _read_json_body(self):
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                return json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return {}

        def _serve_static(self, path):
            # Resolve path safely within WEBUI_DIR.
            if path in ("/", ""):
                rel = "index.html"
            else:
                rel = path.lstrip("/")
            full = os.path.normpath(os.path.join(WEBUI_DIR, rel))
            if not full.startswith(os.path.normpath(WEBUI_DIR)):
                self._send(403, "Forbidden", "text/plain; charset=utf-8")
                return
            if not os.path.isfile(full):
                self._send(404, "Not found", "text/plain; charset=utf-8")
                return
            ext = os.path.splitext(full)[1].lower()
            with open(full, "rb") as f:
                self._send(200, f.read(), CONTENT_TYPES.get(ext, "application/octet-stream"))

        # --- routes ---
        def do_GET(self):
            if self.path == "/api/welcome":
                if os.path.exists(WELCOME_FILE):
                    with open(WELCOME_FILE, "r", encoding="utf-8") as f:
                        text = f.read()
                elif os.path.exists(commands_file):
                    with open(commands_file, "r", encoding="utf-8") as f:
                        text = f.read()
                else:
                    text = FIRST_FILE_CONTENT
                self._send_json(200, {"text": text})
                return
            self._serve_static(self.path)

        def do_POST(self):
            if self.path == "/api/compile":
                body = self._read_json_body()
                active_palette = palette
                if body.get("coordinates") == "numbers":
                    base = Palette() if active_palette is None else deepcopy(active_palette)
                    base.NUMBERS = NUMBER_EMOJI
                    active_palette = base
                result = compile_text(body.get("text", ""), palette=active_palette)
                self._send_json(200, result)
                return
            self._send(404, "Not found", "text/plain; charset=utf-8")

    return Handler


def serve(commands_file="commands.txt", palette=None, open_browser=True, port=0):
    """
    Start the web UI server and (optionally) open a browser window.

    Blocks until the server is stopped (Ctrl+C).
    """
    handler = _make_handler(commands_file, palette)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"TokenTactics UI running at {url}")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
