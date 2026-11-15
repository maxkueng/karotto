# Home Assistant integration

The Home Assistant integration lives in its own repository so HACS can
install it directly:

https://github.com/maxkueng/karotto-ha-integration

It provides to-do list entities for to-dos and today's dailies, count and
timestamp sensors, a rollover-pending binary sensor, and `karotto.score`,
`karotto.run_rollover` and `karotto.add_task` actions, kept live over the
server's event stream. The repository's README has the entity table,
installation and setup.

## The dashboard card

`custom:karotto-card` is the web app's display mode (`/display`) packaged as a
Home Assistant card. `npm run build -w @karotto/web` writes it to
`dist/karotto-card.js` next to the app, and the server serves it as
`/karotto-card.js`. The integration fetches it from there and registers it
with Home Assistant's frontend, so the card always matches the server.

Inside Home Assistant the app talks to the integration instead of the server.
`src/api/transport.ts` defines the transport the API client and the live
store use: HTTP and `EventSource` in the browser, and in the card
(`src/card/haTransport.ts`) the `karotto/request` and `karotto/events`
commands over Home Assistant's websocket. The integration forwards those with
its own token and only allows the requests the board makes; see
`custom_components/karotto/websocket.py` there before adding a call the board
needs.

The card renders into a shadow root. Its stylesheet is the app's
(`src/styles/app.css`) without the fonts, which Home Assistant already loads.
Rules that browsers ignore inside a shadow root (`@font-face`, `@property`)
are copied to the document, the theme is applied to the card element instead
of `<html>`, and modals mount inside the shadow root through `PortalMount`.
