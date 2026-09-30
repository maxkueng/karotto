# Home Assistant integration

The Home Assistant integration lives in its own repository so HACS can
install it directly:

https://github.com/maxkueng/karotto-ha-integration

It provides to-do list entities for to-dos and today's dailies, count and
timestamp sensors, a rollover-pending binary sensor, and `karotto.score`,
`karotto.run_rollover` and `karotto.add_task` actions, kept live over the
server's event stream. The repository's README has the entity table,
installation and setup.
