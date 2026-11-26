# Flip Side

A matching-pairs game show with a picture puzzle behind the board. It lives in this repo's `flip-side/` folder, so it's live at https://homejeopardy.github.io/plate-pursuit/flip-side/.

- **host.html**: the control page. It runs the game, opens a room, and stores uploaded pictures in this browser (IndexedDB).
- **display.html**: the projector. It shows the 5×4 board, the uncovered picture, team scores and a QR code to join.
- **play.html**: phones. Each team picks itself, then flips cards on its turn, presses Solve after a match, and buzzes in once the board is clear.
- **stage.html**: the on-stage host's script.

Connections use the same public MQTT relays as Plate Pursuit (topic `flip-side/v1/<ROOM>/…`). Uploaded pictures go to other screens over BroadcastChannel (same computer) or a retained `img/<id>` topic.

Starter puzzles (`images/`, listed in `starters.js`) are from Reader's Digest ("28 Rebus Puzzles That Are Almost Impossible to Solve") and ESL Vault's printable rebus sheets 4 and 9–16.
