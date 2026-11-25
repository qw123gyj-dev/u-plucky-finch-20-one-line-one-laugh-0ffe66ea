[![make.fun](https://make.fun/badge/u-plucky-finch-20-one-line-one-laugh-0ffe66ea.svg)](https://make.fun/bounty/u-plucky-finch-20-one-line-one-laugh-0ffe66ea?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-one-line-one-laugh-0ffe66ea)
[![rank](https://make.fun/badge/u-plucky-finch-20-one-line-one-laugh-0ffe66ea/qw123gyj-dev/u-plucky-finch-20-one-line-one-laugh-0ffe66ea/rank.svg)](https://make.fun/bounty/u-plucky-finch-20-one-line-one-laugh-0ffe66ea/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-one-line-one-laugh-0ffe66ea)
[![reward](https://make.fun/badge/u-plucky-finch-20-one-line-one-laugh-0ffe66ea/qw123gyj-dev/u-plucky-finch-20-one-line-one-laugh-0ffe66ea/reward.svg)](https://make.fun/bounty/u-plucky-finch-20-one-line-one-laugh-0ffe66ea?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-one-line-one-laugh-0ffe66ea)

# One Line, One Laugh

A deterministic entry picker for the make.fun bounty "One Line, One Laugh". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: a line that is funny on its own with no picture or setup; a punchline that lands inside the line with no setup the reader has to supply; a fresh angle with an unexpected image or twist rather than a stock pun; tight wording that reads cleanly in one pass; and a line that still amuses on a second read and is easy to repeat — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that explains its own joke is capped, the stock "password is incorrect" gag is docked hard, the twist must land inside the last six words, a line that needs the reader to supply a setup from outside itself is capped on speed, and quoted speech earns a bonus because a line that hands the reader a voice to repeat arrives as dialogue rather than a caption. Ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> My GPS led me to a dead end and announced, ‘you have arrived’ — even the satellites have given up on me.

It takes a mundane navigation moment — the GPS announcing arrival at a dead end — and turns it into a verdict on the driver: even the satellites, whose whole job is knowing where you are, have given up on him. The punchline lands in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/one-line-out node main.ts
cat /tmp/one-line-out/entry.txt
```
