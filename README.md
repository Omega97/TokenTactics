# Token Tactics

## Live Board State

<div align="center">
    <img src="saves/board.png" width="500">
</div>

## The Game

A token-based multiplayer board game. Feed it a text list of
commands and it computes the final board state. Read the for all the rules [COMMANDS.md](./COMMANDS.md). The board will automatically update after every commit. In [saves/commands.txt](./saves/commands.txt) you can find the game moves that were made. The interpreter deterministically converts them into the board position.

#### Commands

- `PLAYER`, `TOKEN`, `RANDOM_SEED`, `BOARD_SIZE`, 
- `next_turn`, `move`, `gift`, `shoot`, 
- `heal`, `upgrade`, `capture`, `vote`, 

---

## Run

```sh
python -m token_tactics          # run commands.txt once, print final state
python -m token_tactics --ascii  # ASCII palette (no emoji support)
python -m token_tactics --watch  # auto-refresh on commands.txt changes
python -m token_tactics --ui     # open the browser editor UI
```

## Use as a library (UI)

```python
from token_tactics import run_game_from_text, Game

game, state, report = run_game_from_text("# Players\nPLAYER Alice\n...")
```
