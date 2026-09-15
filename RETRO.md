# Retrospective

Six Devin sessions built this project on 15 September 2026, after one earlier
attempt on 3 September. This is what went wrong in them, why, what Benjamin
said when he corrected the agent, and what a better prompt would have been.
It is drawn from the session transcripts and event logs.

## The sessions

| # | Session | Result |
| --- | --- | --- |
| 0 | Build battleships game (3 Sep) | Single HTML file, PR to the wrong repo, never merged |
| 1 | Scaffold Playable Battleship Game | PR #1, merged. Core, UI, tests, AGENTS.md, skill, CI, first deploy |
| 2 | Implement AI Difficulties | PR #2, merged. Easy, Medium, Hard, bench, fairness hash |
| 3 | Accessibility and Polish Pass | PR #3, merged. ARIA grid, keyboard, live region, touch |
| 4 | Run battleship-bughunt and redeploy | PR #4, merged. Three UI bugs fixed, BUGS.md |
| 5 | Document battleship and redeploy | This PR |

## Issues, session by session

### Session 0: "build a battleships game"

**What happened.** The prompt was four words. The agent built a single HTML
file with a hunt and target AI, opened a PR into `First-ever` because that was
the only repo it could see, and offered to test. Asked whether it had
researched what makes a good Battleship game, it said no. It had built from
the standard rules and one design choice.

**Why.** With no constraints, the agent optimised for a fast visible result.
Nothing in the prompt asked for research, a stack, a repo, tests or a design
direction, so none of those happened. The work did not survive; session 1
started again from scratch with a full specification.

**Correction.** "in building this did you first research and investigate what
would make a great battleships game?" and later "did you plug this into my
github?"

### Session 1: Scaffold

**Wrong repo.** The prompt said "into this repo" but the session was started
with `First-ever` as the repo, so the PR went there. Benjamin: "This work is in
the wrong repo. Push the branch to my battleship repo instead and open the PR
there, with main as the base branch. Then close the PR on First-ever." The
battleship repo turned out to be empty, so the agent had to ask permission to
push a README-only first commit before it could open a PR at all.

**A check that could not fail.** The `test-before-pr` skill had
`grep -ri react src/core && echo FAIL`, which prints FAIL and exits 0. Benjamin
spotted it: "grep -ri react src/core currently prints FAIL but still exits 0,
so it never actually fails the step. Make it exit non-zero on a match." The
agent wrote a guard rail without testing that the guard rail trips.

**Three Devin Review findings.** Randomise and reset used `Math.random` instead
of the injected source, so a seed did not reproduce a game. Drag placement
threw away the drag start and placed at the release cell. There was no CI.
Benjamin listed all three and the fix he wanted for each, including "Add a test
that the same seed produces the same board and the same shot sequence twice."
The agent had said randomness was injected and had said drag placement worked.
Both claims were true of part of the code and false of the rest.

**Blueprint applied to the wrong repo.** The environment blueprint ran
`npm install` in `First-ever`, which has no `package.json`, and failed. The
agent had to move the step and make it conditional. Benjamin: "Scope it to
battleship only."

**Could not merge.** The agent said it would merge PR #1 when asked to, then
found its tooling blocks merges to `main`. It should have known that before
offering.

**Lost recording.** Benjamin: "where is the recording?" It had been attached
to a message in the middle of the thread, not the final one.

### Session 2: AI difficulties

**Claimed there was no live link.** Asked to play all three difficulties on the
live link, the agent looked for a Pages, Vercel or Netlify config, found none,
and tested a local build instead. Benjamin: "Wrong, there is a live link. You
deployed this app in the Session 1 session and I approved it ... That is a
Devin-hosted static deploy, which is why there is no Pages or Vercel config in
the repo." The agent had looked in the repo for something that lives outside
the repo. It did not read the previous session's messages, where the URL was.

**Deployed without saying so.** Benjamin: "where is the request to deploy?"
The redeploy had already gone through because the earlier approval still
applied, but the agent had not said that. Each deploy also gets a new
subdomain, which the agent had not mentioned until asked to "Note whether the
URL changed."

**Flagged a bug and left it.** The agent's BENCHMARK write-up mentioned that
sunk-ship attribution could be wrong when two ships lie end to end, and moved
on. Benjamin: "That is a real bug and I want it in BUGS.md with 'Found by:
benchmark analysis'." He also asked for proof that Easy's numbers were
genuine random fire and not an artefact of the sparring partner. Both were
reasonable questions the agent could have answered before being asked.

**One-game evidence for a statistical question.** Asked to "Confirm Hard feels
harder", the agent played one game per difficulty. Hard took 61 shots to
Medium's 57. It correctly said this was noise and pointed at the medians, but a
single game was never going to answer the question.

### Session 3: Accessibility

**"Both games pass" hid two failures.** The first message said both test games
passed. The testing run had in fact found two problems, a second identical
rejected shot was not re-announced and focus was pushed off screen at game
over, which were fixed before the message went out. The result was right; the
wording buried the fact that the first run failed.

**Verification pushed back to the user.** Benjamin had to say: "Run Devin's AI
analysis on the PR. Blue button. It doesn't auto-trigger and it found three
bugs on PR #1." and "Watch both recordings ... You're checking the focus ring
is actually visible throughout and that placement works by touch, not just
that the video ends with a win." and "Test it yourself on the new URL." The
agent had a recording of a win and treated that as proof of everything in the
recording.

**No phone.** Touch was tested with Chrome's touch emulation. The agent said
so and asked for a 30-second check on a real phone. That is the honest answer,
but it means the touch success criterion was never met on a real device.

### Session 4: Bug hunt

**Went well.** The playbook listed 18 items and said "Say what actually
happened, not just pass or fail. Record a video of any failure before fixing
it, and one after." Three real bugs came out of it, each with a regression
test that fails without the fix. This is the session with the fewest
corrections, and it had the most specific prompt.

**Two boards changed size after the first shot** had been present since
session 1 and was missed by four rounds of browser testing. Every earlier
screenshot was taken later in a game, when both boards had marks and agreed on
their size again. The testing looked at the end state and not at the moments
between states.

**Review UI.** Benjamin asked "how do i review the pr", "where is the 'Files
changed' tab?" and "where's the description?". The agent's messages assumed
GitHub was familiar. Not an agent bug, but three round trips that a link
straight to the Files changed tab would have saved.

### Session 5: Documentation (this session)

**Stale wiki.** The prompt asked for the Architecture section to be drawn from
the DeepWiki summary. The existing wiki had been generated when the repo was a
single README and described a project with no source code. It had to be
regenerated before it could be used.

**No Session Insights.** The prompt asked for Session Insights to be generated
for every session. That is a feature of the Devin web app and there is no way
to trigger it from inside a session, so this file was written from the raw
transcripts and event logs instead.

## Recurring problems

**1. Claims of success that outran the evidence.** "Randomness is injected"
when two paths used `Math.random`. "Drag placement works" when it ignored the
drag. "Both games pass" when the first run failed. A recording of a win offered
as proof that the focus ring was visible in every frame. Session 4 shows the
fix: ask for what actually happened, not pass or fail.

**2. Not reading previous sessions.** The live URL was in session 1's
messages; session 2 said there was none. The deploy approval carried over;
session 2 did not say so. Each session started as if it were the first.

**3. Guard rails that were never tripped.** The grep check that always exited
0. The blueprint that ran `npm install` in a repo with no `package.json`.
Tests were written for the game; nothing tested the checks.

**4. Noticing a problem and not acting on it.** The collinear sunk-ship bug
was written up as a caveat rather than fixed. Easy's 1,995 games over 73 shots
was reported without explaining it. Both got fixed the moment Benjamin asked.

**5. Repo and environment scope.** Wrong repo in session 0 and again in
session 1. Blueprint applied to the wrong repo. Offer to merge that the
tooling did not allow.

**6. Testing the end state only.** The board resize bug lived for three merged
PRs because every check looked at a finished game.

## What the improved prompts would have been

Sessions 1 to 4 already had strong prompts. The changes below are small.

**Session 0**, instead of "build a battleships game":

> Repo: battleship, branch off main. Before writing code, spend ten minutes on
> what makes a good Battleship implementation (AI strategy, placement UX,
> fairness) and send me a short proposal. Then build it as Vite + React +
> TypeScript with pure game logic under src/core and Vitest tests.

Most of that became the session 1 prompt.

**Session 1**, add:

> The repo is jacobsbenjaminuk-cell/battleship and it is empty. Push a
> README-only first commit to main, then branch from it. Do not touch
> First-ever.
>
> Every check you write must be shown failing on purpose once before you rely
> on it. For the grep check, add a React import to src/core, run the skill,
> confirm it exits non-zero, then remove it.
>
> Scope the environment blueprint to this repo only.
>
> You cannot merge to main. Tell me when a PR is ready and I will merge it.
>
> Attach the final recording to your last message, not a middle one.

**Session 2**, add:

> The app is deployed as a Devin-hosted static site. The URL is in the
> previous session's messages. Redeploy to it at the end and tell me whether
> the URL changed. Do not look for Pages or Vercel config; there is none.
>
> If the benchmark or your own analysis turns up a correctness bug, do not
> write it up as a caveat. Write a failing test, fix it and log it in BUGS.md
> with how it was found.
>
> For any claim about the benchmark numbers (for example that Easy is
> genuine random fire), include the evidence in BENCHMARK.md without being
> asked.

**Session 3**, add:

> Trigger Devin Review on the PR yourself; it does not auto-run.
>
> When you report a test run, say what failed on the first pass and what you
> changed, not just the final result.
>
> Watching a recording end in a win is not proof of the accessibility
> criteria. For the keyboard run, confirm the focus ring is visible in every
> frame you sample. For the touch run, confirm the ship lands where the drag
> started.
>
> Inspect both boards before the first shot, during the enemy's first turn and
> after it. Do not rely on late-game screenshots.

The last line would have caught the board resize bug two sessions earlier.

**Session 4**: the playbook was the right shape. Keep it. Add one line:

> Before the hunt, read the previous sessions' messages for anything the user
> reported and confirm each one is still fixed.

**Session 5**, add:

> Regenerate the DeepWiki first; the current one predates the code.
>
> Session Insights cannot be generated from inside a session, so write the
> retrospective from the transcripts and say so.

## The one-line version

Say what actually happened, read the previous session before starting, and
test the checks as well as the code.
