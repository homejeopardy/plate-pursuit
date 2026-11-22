# Plate Pursuit

A license-plate puzzle game for a classroom: a host screen, a projector screen, and phones as buzzers.

## Playing (website)

1. Open `host.html` on the laptop. It shows a 4-letter room code.
2. Click **Open projector window** and drag it to the projector. Click it once to turn on sound and go full screen.
3. Players scan the QR code on the projector (or open `play.html` and type the room code) and enter a team name.

The host page runs the game. The projector and phones connect to it through PeerJS, so phones can be on any network, including cellular data, as long as they have internet. Keep the host page open for the whole game: closing it ends the room.

## Rounds

- **Buzz-in plates:** Space shows the plate, and its points drain from 100 to 10 over 20 seconds. The first phone to buzz answers out loud. C = correct, X = wrong (that team is locked out for the plate), R = reveal.
- **Speed round:** one team, 60 seconds. C = correct (+50), P = pass.
- **Final standings.**

Plates, points and timers can be edited on the host page. Plate format: `PLATE | answer`, and a `## question` line sets the question shown above the plates that follow it.

## Offline fallback

`node server.js` (or double-click `Start Plate Pursuit.command`) runs everything from this Mac with no internet. Phones must then be on the same Wi-Fi as the Mac.

## Releases

Every local file is loaded with `?v=N`. Bump that number in all the `.html` files on every release, or browsers can mix old and new files.
