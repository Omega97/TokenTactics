"""
===== Token Tactics Runner =====
Command interpreter, file watcher, and CLI entry point.

The engine itself lives in `token_tactics.game`; this module only deals with
text input/output so a UI can bypass it entirely.
"""
import sys
import os
import time
import hashlib
import inspect

from .game import Game, Palette, AsciiPalette, FIRST_FILE_CONTENT


def read_emoji_file(path) -> dict:
    """Read the file of emoji."""
    emoji = dict()
    with open(path, "r", encoding="utf-8") as file:
        for line in file.readlines():
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            c, name = line.split()
            emoji[name] = c
    return emoji


class CommandInterpreter:
    """Executes text commands against a `Game` instance (no file I/O)."""

    def __init__(self, emoji: dict | None = None):
        self.emoji = emoji or {}

    def convert_args(self, raw_args, params):
        """Try to match the parameter's type based on signature annotations."""
        converted_args = []
        for raw, param in zip(raw_args, params):
            if raw in self.emoji:
                converted_args.append(self.emoji[raw])
                continue
            if param.annotation in (int, float):
                converted_args.append(param.annotation(raw))
            else:
                try:
                    converted_args.append(int(raw))
                except ValueError:
                    converted_args.append(raw)
        return converted_args

    def execute_text_command(self, game, line):
        """Execute a single line command on the game instance."""
        line = line.strip()
        if not line or line.startswith("#"):
            return line

        parts = line.split()
        command_key = parts[0]
        raw_args = parts[1:]

        if not game.is_command(command_key):
            raise GameError(f"Unknown command: {command_key}")

        command_class = game.get_command(command_key)

        # Inspect constructor to handle dynamic arguments
        sig = inspect.signature(command_class.__init__)
        params = [p for p in sig.parameters.values() if p.name not in ('self', 'game')]
        converted_args = self.convert_args(raw_args, params)

        command_instance = command_class(game, *converted_args)
        return command_instance.execute()

    def run_lines(self, game, lines):
        """Execute lines sequentially, stopping at the first error or game over."""
        game_state = game.repr()
        report = []
        for line in lines:
            if game.is_game_over():
                break
            try:
                result = self.execute_text_command(game, line)
                game_state = game.repr()
                report.append(result)
            except Exception as e:
                report.append(f"❌ Error: {e}")
                break
        return game_state, report


class GameRunner:
    def __init__(self,
                 input_file="commands.txt",
                 output_file="game_state.txt",
                 emoji_file="emoji.txt",
                 palette=None,
                 period=0.5):
        self.input_file = input_file
        self.output_file = output_file
        self.emoji_path = emoji_file
        self.emoji = None
        self.palette = palette or Palette()
        self.period = period
        self.prev_file_hash = None

        self.interpreter = CommandInterpreter(emoji=self._load_emoji())

        if not os.path.exists(self.input_file):
            self._create_initial_input()

    # --- Utility Methods ---

    def _load_emoji(self):
        try:
            return read_emoji_file(self.emoji_path)
        except OSError:
            return {}

    def _get_file_hash(self):
        """Compute MD5 hash of the input file contents."""
        try:
            with open(self.input_file, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        except FileNotFoundError:
            return None

    @staticmethod
    def _clear_screen():
        """Clear the terminal screen."""
        os.system('cls' if os.name == 'nt' else 'clear')

    def _create_initial_input(self):
        """Create an input file and write initial content."""
        try:
            with open(self.input_file, 'w', encoding='utf-8') as f:
                f.write(FIRST_FILE_CONTENT)
            return True
        except IOError as e:
            print(f"⚠️ Failed to create input file {self.input_file}: {e}")
            return False

    # --- Command Logic ---

    def run_commands(self, game):
        """Read the input file and execute all commands sequentially."""
        with open(self.input_file, "r", encoding="utf-8") as f:
            lines = list(f)
        return self.interpreter.run_lines(game, lines)

    # --- Orchestration ---

    def run_once(self):
        """Run the game once and print the final board state."""
        game = Game(palette=self.palette)
        game_state, report = self.run_commands(game)

        messages = [s for s in report if s.strip() and not s.startswith('#')]
        last_report = messages[-1] if messages else "(nothing to report)"

        output_msg = f"{last_report}\n{game_state}"

        # Persist the state
        try:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                f.write(str(game))
        except IOError as e:
            output_msg += f"\n⚠️ Failed to save state to {self.output_file}: {e}\n"

        print(output_msg)

    def update_display(self):
        """Run the game logic, save to file, and print to console."""
        game = Game(palette=self.palette)
        game_state, report = self.run_commands(game)

        messages = [s for s in report if s.strip() and not s.startswith('#')]
        last_report = messages[-1] if messages else "(nothing to report)"

        output_msg = f"🔄 Auto-watch mode active (Ctrl+C to quit).\n"
        output_msg += f"{last_report}\n{game_state}"

        # Persist the state
        try:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                f.write(str(game))
        except IOError as e:
            output_msg += f"\n⚠️ Failed to save state to {self.output_file}: {e}\n"

        self._clear_screen()
        print(output_msg)

    def watch(self):
        """Main loop that watches for file changes."""
        self.prev_file_hash = self._get_file_hash()
        self.update_display()

        try:
            while True:
                time.sleep(self.period)

                if not os.path.exists(self.input_file):
                    print(f"⚠️  Warning: '{self.input_file}' missing!")
                    continue

                current_hash = self._get_file_hash()
                if current_hash != self.prev_file_hash:
                    self.update_display()
                    self.prev_file_hash = current_hash
        except KeyboardInterrupt:
            self._clear_screen()
            print("👋 Exiting.")


def run_game_from_text(commands_text, palette=None):
    """
    Deterministic convenience API for UIs: feed a string of commands and get
    back the resulting `(game, final_state, report)` without touching the disk.
    """
    game = Game(palette=palette)
    emoji = read_emoji_file("emoji.txt") if os.path.exists("emoji.txt") else {}
    interpreter = CommandInterpreter(emoji=emoji)
    state, report = interpreter.run_lines(game, commands_text.splitlines())
    return game, state, report


def compile_text(commands_text, palette=None):
    """
    Compile a string of commands into a structured result for the UI.

    Returns a dict with:
      - state: the final board repr on success, or None if a command failed
      - error_line: 1-based line number of the failing command (None on success)
      - error_message: the interpreter error (None on success)
      - game_over: whether a winner was decided
      - winner: winning player name or None
    """
    game = Game(palette=palette)
    emoji = read_emoji_file("emoji.txt") if os.path.exists("emoji.txt") else {}
    interpreter = CommandInterpreter(emoji=emoji)

    error_line = None
    error_message = None

    for line_no, line in enumerate(commands_text.splitlines(), start=1):
        if game.is_game_over():
            break
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            interpreter.execute_text_command(game, line)
        except Exception as e:
            error_line = line_no
            error_message = str(e)
            break

    ok = error_line is None
    return {
        "state": game.repr() if ok else None,
        "turn": game.turn_counter,
        "board": game.repr_board_grid() if ok else None,
        "players": game.player_data() if ok else [],
        "priority": list(game.priority) if game.priority is not None else [],
        "jury": dict(game.jury),
        "symbols": {
            "heart": game.palette.HEART,
            "black_heart": game.palette.BLACK_HEART,
            "energy": game.palette.ENERGY,
        },
        "winner": game.winner,
        "game_over": game.is_game_over(),
        "error_line": error_line,
        "error_message": error_message,
    }


def main():
    # If you don't have emoji compatibility, then
    # 'python -m token_tactics --ascii'
    # runs the game in ascii mode.
    palette = AsciiPalette() if '--ascii' in sys.argv else None

    if '--ui' in sys.argv:
        from . import webui
        webui.serve(palette=palette)
        return

    runner = GameRunner(palette=palette)
    if '--watch' in sys.argv:
        runner.watch()
    else:
        runner.run_once()
