# Screenshots

Images referenced from the README and docs. Keep them current with the
seeded demo data, so the same tasks appear across web, Android and Home
Assistant shots.

Naming: `<client>-<what>[-<theme>][-<mode>].png`, lowercase, dashes.

- `web-tasks-carrot-light.png`, `web-tasks-tokyo-night-dark.png`
- `web-task-editor.png`, `web-settings-themes.png`
- `android-tasks-carrot-dark.png`, `android-task-form.png`
- `home-assistant-todo-card.png`

Web shots with the browser chrome cropped, Android shots straight from
`adb -s <serial> exec-out screencap -p`. Then scale them to twice the width
they are displayed at in the README, which keeps them sharp on high-density
screens without shipping full-resolution captures:

```sh
mogrify -resize 840x web-*.png
mogrify -resize 540x android-*.png
mogrify -strip -define png:compression-level=9 *.png
```

PNG for UI, no JPEG artefacts on text. Keep files under 200 KB.
