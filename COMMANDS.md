# TokenTactics Commands

A game is a list of text commands. Each line is one command; lines starting
with `#` are comments and blank lines are ignored. The interpreter runs the
commands top-to-bottom and produces the resulting board state.

## Setup

| Command       | Usage                         | Description                                                               |
| ------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `PLAYER`      | `PLAYER [name]`               | Add a new player.                                                         |
| `TOKEN`       | `TOKEN [token] [player]`      | Add a token (1–2 characters, usually an emoji) to a player.               |
| `RANDOM_SEED` | `RANDOM_SEED [number]`        | Set the random seed for reproducible board positions.                     |
| `BOARD_SIZE`  | `BOARD_SIZE [size/"default"]` | Set the board size. **Resets the game state** and repositions all tokens. |

## Turn

| Command | Usage | Description |
| --- | --- | --- |
| `next_turn` | `next_turn` | End the turn: every living token gets `AP_PER_TURN` AP; tokens voted by the jury get +1 extra. |

## Actions

| Command   | Usage                                | Cost                           | Description                                                                                               |
| --------- | ------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `move`    | `move [token] [dx] [dy]`             | `MOVE_COST`<br>(⚡️)            | Move a token one adjacent square (horizontal, vertical, or diagonal). Target must be in bounds and empty. |
| `gift`    | `gift [token_1] [token_2] [points?]` | `GIFT_COST`<br>                | Gift AP from `token_1` to `token_2`. Tokens must be in range.                                             |
| `shoot`   | `shoot [token_1] [token_2]`          | `SHOOT_COST`<br>(⚡️)           | Deal 1 damage to `token_2` (in range). If you kill it, you steal all its AP.                              |
| `heal`    | `heal [token] [target?]`             | `HEAL_COST`<br>(⚡️⚡️)          | Heal a token +1 life (up to its cap). Heals itself, or a target in range. Revives a jury member.          |
| `upgrade` | `upgrade [token]`                    | `UPGRADE_COST`<br>(⚡️⚡️⚡️⚡️⚡️) | Give a token +1 range, +1 life cap, and +1 heart.                                                         |
| `capture` | `capture [token_1] [token_2]`        | `CAPTURE_COST`<br>(⚡️⚡️⚡️⚡️⚡️) | Capture a knocked-out enemy token (adjacent). It changes ownership and is restored to 1 heart.            |
| `vote`    | `vote [player] [token?]`             | —                              | Jury vote for a live token to receive +1 AP each turn. Eliminated players only.                           |


## Change Cost-parameters

These commands change the AP costs (or turn bonus) for the rest of the game.

| Command                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `AP_PER_TURN [amount]`   | AP given to each living token at the start of every turn. |
| `MOVE_COST [cost]`       | AP cost for `move`.                                       |
| `SHOOT_COST [cost]`      | AP cost for `shoot`.                                      |
| `GIFT_COST [cost]`       | AP cost for `gift`.                                       |
| `HEAL_COST [cost]`       | AP cost for `heal`.                                       |
| `UPGRADE_COST [cost]`    | AP cost for `upgrade`.                                    |
| `CAPTURE_COST [cost]`    | AP cost for `capture`.                                    |

## Default values


### AP per turn 🔋

| Parameter     | Default ⚡️ |
| ------------- | ---------- |
| `AP_PER_TURN` | +1         |

### Costs ⚡️

| Parameter         | Default ⚡️ |
| ----------------- | ---------- |
| `MOVE_COST`       | 1          |
| `SHOOT_COST`      | 1          |
| `GIFT_COST`       | 0          |
| `HEAL_COST`       | 2          |
| `UPGRADE_COST`    | 5          |
| `CAPTURE_COST`    | 5          |

### Token stats 

| Stat              | Default  |
| ----------------- | -------- |
| Life cap (hearts) | 3 ❤️❤️❤️ |
| Action range      | 2 🏹🏹   |
| Starting AP       | 0        |

## Rules

- **AP (action points)** power every action; you gain AP on `next_turn`.
- **Life**: a token at 0 life is knocked out — it stays on the board but can't act, and can be captured.
- **Jury**: a player with no living tokens is eliminated and joins the jury, where they vote to give an extra AP each turn.
- **Priority**: performing an action moves a player to the bottom of the priority order.
- **Win condition**: the last player with living tokens wins.
