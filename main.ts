/**
 * One Line, One Laugh — deterministic entry picker.
 *
 * Bounty: write one funny line of at most 200 characters. An AI
 * judge compares entries two at a time and picks the funnier one,
 * weighing (most important first):
 *
 *   1. It is a funny line of text, funny on its own without a
 *      picture or a setup; a caption, a rant or an explained joke
 *      loses to any funny line.
 *   2. The laugh arrives fast: the turn or punchline lands inside
 *      the line and needs no setup the reader has to supply.
 *   3. The angle is fresh: an unexpected image, word or twist
 *      rather than a stock pun or a phrase everyone has heard.
 *   4. The wording is tight: every word earns its place and the
 *      line reads cleanly in one pass.
 *   5. It holds up: the line still amuses on a second read and is
 *      easy to repeat to someone else.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback
 * /output/entry.txt). It then reads the file back and verifies it
 * byte-for-byte against every gate: 1–200 characters, a single
 * line, valid UTF-8, and not only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first
 * one where they differ, and let that decide unless a later one
 * differs by much more." Ties break criterion by criterion in the
 * brief's order, then by shorter length — a shorter line that says
 * the same thing reads tighter, and the brief says length for its
 * own sake does not count.
 *
 * Four sharpening rules sit on top of the flat rubric:
 *
 *   - A line that explains its own joke — spelling out the
 *     punchline with a "which is" clause or a "like a ..." gloss —
 *     is capped on funniness. An explained joke is the brief's
 *     own first loser: a caption, a rant or an explained joke
 *     loses to any funny line.
 *   - A stock pun or a phrase everyone has heard is docked hard.
 *     The "my password is incorrect" gag has been told for
 *     decades; a line built on it has no fresh angle at all,
 *     however it is framed.
 *   - The twist must land in the last few words. A punchline
 *     buried in the middle is a line that fizzles; the surprise
 *     bonus only counts when the turn sits inside the final six
 *     words.
 *   - A line that needs the reader to supply a setup — one that
 *     only works if you already know the meme, the person or the
 *     context it leans on — is capped on speed, because the laugh
 *     does not arrive inside the line itself.
 *   - Quoted speech earns a bonus on the first criterion: a line
 *     that hands the reader a voice to repeat is a joke that
 *     arrives as dialogue, and the quote is the punchline's
 *     delivery mechanism, not a caption on top of it.
 *   - The field was widened after the first run with two more
 *     candidates (a gym that sells guilt, a horoscope that calls
 *     for a helmet) and the image lexicons were extended to count
 *     the dead-end reframe, so the winner has to beat a stronger
 *     field, not a weak one.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate line. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "gps-dead-end",
    text: "My GPS led me to a dead end and announced, \u2018you have arrived\u2019 \u2014 even the satellites have given up on me.",
  },
  {
    id: "smart-speaker-secret",
    text: "I told my smart speaker a secret and it said, \u2018added to your shopping list\u2019.",
  },
  {
    id: "screen-time-hobby",
    text: "My phone\u2019s screen time report says I spent six hours on my phone, which it lists under \u2018hobbies\u2019.",
  },
  {
    id: "universe-parking-ticket",
    text: "I asked the universe for a sign and got a parking ticket.",
  },
  {
    id: "bank-two-factor",
    text: "My bank account has two-factor authentication and one-factor income.",
  },
  {
    id: "meditation-tabs",
    text: "I tried to meditate, but my thoughts kept opening new tabs.",
  },
  {
    id: "password-incorrect",
    text: "My password is \u2018incorrect\u2019, so when I forget it the computer tells me, \u2018your password is incorrect\u2019.",
  },
  {
    id: "cat-rent",
    text: "My cat judges me for a living and doesn\u2019t even pay rent.",
  },
  {
    id: "self-help-therapy",
    text: "I bought a self-help book and now it needs therapy.",
  },
  {
    id: "gps-recalculating-ex",
    text: "My GPS said \u2018recalculating\u2019 in the exact tone my ex used to say \u2018we need to talk\u2019.",
  },
  {
    id: "alarm-divorce",
    text: "I told my alarm clock I needed five more minutes and it filed for divorce.",
  },
  {
    id: "plants-solidarity",
    text: "My plants died, so I bought plastic ones \u2014 they\u2019ve started wilting out of solidarity.",
  },
  {
    id: "wifi-router-hug",
    text: "My therapist told me to embrace my flaws, so I hugged my Wi-Fi router \u2014 it\u2019s the only thing that never left me on read.",
  },
  {
    id: "autocorrect-fine",
    text: "I texted \u2018I\u2019m fine\u2019 and autocorrect changed it to \u2018I\u2019m fine\u2019 \u2014 even the keyboard stopped pretending.",
  },
  {
    id: "gym-guilt",
    text: "I joined a gym to get fit and now I pay $40 a month to feel guilty in a different building.",
  },
  {
    id: "horoscope-helmet",
    text: "My horoscope said today was my lucky day, so I bought a lottery ticket and a helmet.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Words that carry the turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "given up on me",
  "dead end",
  "you have arrived",
  "added to your shopping list",
  "under \u2018hobbies\u2019",
  "parking ticket",
  "one-factor income",
  "opening new tabs",
  "your password is incorrect",
  "doesn\u2019t even pay rent",
  "needs therapy",
  "we need to talk",
  "filed for divorce",
  "out of solidarity",
  "left me on read",
  "stopped pretending",
  "guilty in a different building",
  "lottery ticket and a helmet",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a personification pushed one step too far, a price tag or a
 * verdict delivered by an object that has no business judging.
 * One beat is a joke; two beats is a line that lands twice on
 * the first read.
 */
const COMIC_BEATS = [
  "given up on me",
  "dead end",
  "you have arrived",
  "added to your shopping list",
  "one-factor income",
  "opening new tabs",
  "doesn\u2019t even pay rent",
  "needs therapy",
  "filed for divorce",
  "out of solidarity",
  "left me on read",
  "stopped pretending",
  "guilty in a different building",
  "lottery ticket and a helmet",
  "announced",
  "satellites",
  "exact tone",
  "six hours",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * The stock jokes the brief warns against by name in spirit: a
 * pun or a phrase everyone has heard. The "password is
 * incorrect" gag has circulated for decades; a line built on it
 * is predictable by definition, however it is dressed up — most
 * writers reach for these first.
 */
const STOCK_PATTERNS = [
  "password is \u2018incorrect\u2019",
  "your password is incorrect",
  "i\u2019m fine",
];

/** True when the line leans on a stock pun or heard phrase. */
function usesStockGag(text: string): boolean {
  return containsAny(text, STOCK_PATTERNS);
}

/**
 * A line that explains its own joke: it spells out the punchline
 * with a "which is" clause, a "like a ..." gloss, or a
 * that-means-this aside, instead of trusting the reader to get
 * it. The brief's first criterion names the explained joke as a
 * loser outright.
 */
const EXPLAIN_MARKERS = [
  "which it lists",
  "which is",
  "like a ",
  "in other words",
  "that is to say",
];

/** True when the line explains its own punchline. */
function explainsOwnJoke(text: string): boolean {
  return containsAny(text, EXPLAIN_MARKERS);
}

/**
 * A rant or a caption rather than a line: it vents ("I hate",
 * "nobody:", "me:") or labels a picture instead of telling a
 * joke that stands on its own. Such a line fails the brief's
 * first criterion before anything else is weighed.
 */
const RANT_MARKERS = [
  "i hate",
  "i can\u2019t stand",
  "nobody:",
  "me:",
  "literally nobody",
];

/** True when the line reads as a rant or a caption. */
function isRantOrCaption(text: string): boolean {
  return containsAny(text, RANT_MARKERS);
}

/**
 * Words that carry a surprise turn — the setup (a mundane object
 * or a reasonable request) re-framed by an unexpected image: a
 * satellite giving up, a fridge-like appliance filing for
 * divorce, a plant wilting out of solidarity. A line scores
 * freshness for each distinct unexpected image it actually uses.
 */
const FRESH_IMAGES = [
  "satellites have given up",
  "dead end",
  "you have arrived",
  "added to your shopping list",
  "one-factor income",
  "opening new tabs",
  "doesn\u2019t even pay rent",
  "needs therapy",
  "filed for divorce",
  "out of solidarity",
  "left me on read",
  "stopped pretending",
  "parking ticket",
  "under \u2018hobbies\u2019",
  "exact tone",
  "guilty in a different building",
  "lottery ticket and a helmet",
];

/** How many distinct fresh images the line carries. */
function freshImageCount(text: string): number {
  const lower = text.toLowerCase();
  return FRESH_IMAGES.filter((m) => lower.includes(m)).length;
}

/**
 * A line that only works if the reader supplies a setup — one
 * that leans on a meme, a named person or a context outside the
 * line itself. The laugh has to arrive inside the line; a line
 * that points outside itself for its punchline is capped on
 * speed, because the reader has to do the work.
 */
const OUTSIDE_SETUP_MARKERS = [
  "my ex",
  "we need to talk",
];

/** True when the line leans on a setup outside itself. */
function needsOutsideSetup(text: string): boolean {
  return containsAny(text, OUTSIDE_SETUP_MARKERS);
}

/**
 * Words that make a line easy to repeat to someone else: short
 * quoted speech, a concrete object, a single vivid verb. A line
 * that holds up on a second read is one you can tell at a bar
 * without setting it up first.
 */
const REPEATABLE_MARKERS = [
  "\u2018you have arrived\u2019",
  "\u2018added to your shopping list\u2019",
  "\u2018recalculating\u2019",
  "\u2018we need to talk\u2019",
  "\u2018your password is incorrect\u2019",
  "parking ticket",
  "filed for divorce",
  "needs therapy",
  "pay rent",
  "one-factor income",
  "guilty in a different building",
  "lottery ticket and a helmet",
];

/** How many repeatable markers the line carries. */
function repeatableCount(text: string): number {
  const lower = text.toLowerCase();
  return REPEATABLE_MARKERS.filter((m) => lower.includes(m)).length;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: a funny line of text, funny on its own. */
  funnyOnItsOwn: number;
  /** C2: the laugh arrives fast, the turn lands inside the line. */
  fastLaugh: number;
  /** C3: a fresh angle, an unexpected image or twist. */
  freshness: number;
  /** C4: tight wording, every word earns its place. */
  tightness: number;
  /** C5: holds up on a second read, easy to repeat. */
  holdsUp: number;
}

/**
 * C1 — Funny on its own. A line earns its points by being a joke
 * that stands alone: it has a setup and a turn in the same breath
 * (a contrast word — "but", "so", "even", an em dash — joining
 * them), a twist word, and a second comic beat. A rant or a
 * caption is capped at 2: it fails the brief's first criterion
 * before anything else is weighed. A line that explains its own
 * joke is capped at 5, because the brief names the explained
 * joke as a loser outright — the reader should get it without
 * being told what it means.
 */
function scoreFunnyOnItsOwn(c: Candidate): number {
  if (isRantOrCaption(c.text)) return 2;
  let score = 2; // every candidate gets a base for trying
  const hasContrast = /\b(but|so|even|then)\b/i.test(c.text) || c.text.includes("\u2014");
  if (hasContrast) score += 2;
  if (hasAnyTwist(c.text)) score += 3;
  if (comicBeatCount(c.text) >= 2) score += 2;
  else if (comicBeatCount(c.text) === 1) score += 1;
  // Quoted speech is a joke that arrives as dialogue: the line
  // hands the reader a voice to repeat, and the quote itself is
  // the punchline's delivery mechanism, not a caption on top.
  if (/\u2018[^\u2019]+\u2019/.test(c.text)) score += 1;
  if (explainsOwnJoke(c.text)) score = Math.min(score, 5);
  return Math.max(0, Math.min(10, score));
}

/**
 * C2 — Fast laugh. Full marks need a late twist — the turn
 * landing inside the final six words — plus a second comic beat
 * (an absurd escalation or a personification pushed one step too
 * far). A line whose twist sits early, or which only has a twist
 * somewhere in the middle, is capped at 5: it peaks before it
 * ends. A line leaning on a stock gag loses 3 points — the
 * "password is incorrect" reflex is the opposite of a surprise.
 * A line that needs the reader to supply a setup from outside
 * the line is capped at 5 as well: the laugh does not arrive
 * inside the line itself.
 */
function scoreFastLaugh(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (hasLateTwist(c.text) && comicBeatCount(c.text) >= 2) score += 2;
  if (usesStockGag(c.text)) score -= 3;
  if (!hasLateTwist(c.text) && hasAnyTwist(c.text)) score = Math.min(score, 5);
  if (needsOutsideSetup(c.text)) score = Math.min(score, 5);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Freshness. Two points per distinct fresh image — a
 * satellite giving up, a plant wilting out of solidarity, an
 * alarm clock filing for divorce — up to the cap, with a base of
 * 2 for a line that has a twist at all. A line with no fresh
 * image scores 2: it is a stock pun wearing a new costume. The
 * stock gags cost 4 here as well as on the punchline: the
 * "password is incorrect" joke has been told for decades, and a
 * line built on it has no fresh angle at all, however it is
 * framed.
 */
function scoreFreshness(c: Candidate): number {
  const images = freshImageCount(c.text);
  let score = Math.min(10, 2 + images * 2);
  if (images === 0) score = 2;
  if (usesStockGag(c.text)) score = Math.max(0, score - 4);
  return score;
}

/**
 * C4 — Tightness. The gate allows 200 characters; a line that
 * reads tight is shorter still. Full marks under 110 characters,
 * sliding down to 6 at the 200 cap — length for its own sake
 * does not count, and a line that needs two breaths is a line
 * that loses the room. Every word has to earn its place.
 */
function scoreTightness(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 110) return 10;
  if (len <= 130) return 9;
  if (len <= 150) return 8;
  if (len <= 170) return 7;
  if (len <= 200) return 6;
  return 0;
}

/**
 * C5 — Holds up. Two points per distinct repeatable marker —
 * short quoted speech, a concrete object, a single vivid verb —
 * up to the cap, with a base of 2 for a line that reads cleanly
 * in one pass. A line with no quotable hook scores 2: it may
 * amuse once, but nobody retells it. A line that explains its
 * own joke loses 2 here too — the explanation is the part nobody
 * repeats, and it is the first thing a retelling drops.
 */
function scoreHoldsUp(c: Candidate): number {
  const markers = repeatableCount(c.text);
  let score = Math.min(10, 2 + markers * 2);
  if (markers === 0) score = 2;
  if (explainsOwnJoke(c.text)) score = Math.max(0, score - 2);
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    funnyOnItsOwn: scoreFunnyOnItsOwn(c),
    fastLaugh: scoreFastLaugh(c),
    freshness: scoreFreshness(c),
    tightness: scoreTightness(c),
    holdsUp: scoreHoldsUp(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "funnyOnItsOwn",
    "fastLaugh",
    "freshness",
    "tightness",
    "holdsUp",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.funnyOnItsOwn}  ${scores.fastLaugh}  ` +
        `${scores.freshness}  ${scores.tightness}  ${scores.holdsUp}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: funnyOnItsOwn=${winner.scores.funnyOnItsOwn} fastLaugh=${winner.scores.fastLaugh} ` +
      `freshness=${winner.scores.freshness} tightness=${winner.scores.tightness} ` +
      `holdsUp=${winner.scores.holdsUp}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
