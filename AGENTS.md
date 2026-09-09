# Project instructions

## Local version history

The user explicitly requires all future project changes to be saved locally in Git.

- After each completed user-requested update, run the appropriate checks and create a descriptive local commit covering that update before reporting completion.
- Commit source, project instructions, configuration templates, tests, and required media assets. Keep secrets, local environment files, dependencies, build output, and temporary test artifacts out of Git.
- Inspect existing changes before editing. Preserve unrelated user work; do not discard or silently include unrelated changes in a task commit.
- Verify the resulting commit and working-tree status. Report any uncommitted task changes honestly.
- Do not push to a remote or rewrite existing history unless the user explicitly requests it.

## Website architecture

This is a static explanatory frontend. Grafana owns all actual experiment data and its visualization. Do not add sensor-data APIs, database connections, aggregation, polling, WebSockets, data caching, or a replacement dashboard. Website interactions explain authored illustrations and content.

## Notebook dimensions and content overflow

- Keep the notebook's current dimensions unchanged across all sections and responsive layouts. Use commit `b67bcf0` as the accepted size baseline; content additions must not enlarge or shrink it, including through automatic layout growth.
- If supplied content does not fit, tell the user what overflows and discuss arrangement options in the conversation before implementing a workaround.
- Do not independently resize the notebook, shrink text or images, truncate content, or add pages to accommodate overflow. Wait for the user's agreed arrangement before making those changes.
