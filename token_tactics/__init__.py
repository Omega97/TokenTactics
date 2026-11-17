"""Token Tactics — deterministic token-based multiplayer board game."""

from .game import (
    Game,
    Palette,
    AsciiPalette,
    DefaultParams,
    Token,
    chebyshev_distance,
    NUMBER_EMOJI,
    GameError,
    TokenError,
    PlayerError,
    APError,
    RangeError,
    InvalidMoveError,
    BoardSizeError,
)
from .runner import GameRunner, CommandInterpreter, run_game_from_text, compile_text

__all__ = [
    "Game",
    "Palette",
    "AsciiPalette",
    "DefaultParams",
    "Token",
    "chebyshev_distance",
    "NUMBER_EMOJI",
    "GameError",
    "TokenError",
    "PlayerError",
    "APError",
    "RangeError",
    "InvalidMoveError",
    "BoardSizeError",
    "GameRunner",
    "CommandInterpreter",
    "run_game_from_text",
    "compile_text",
]
