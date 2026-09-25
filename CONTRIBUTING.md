# Contributing

Welcome! This is a small family project, so the process is light.

## First-time setup

1. Accept the collaborator invite (GitHub emails it to you, or visit https://github.com/alexbroderickforster/kanto-team-builder/invitations).
2. Clone the repo and run it:
   ```bash
   git clone https://github.com/alexbroderickforster/kanto-team-builder.git
   cd kanto-team-builder
   npm install
   npm run dev
   ```
   You'll need Node.js 22 or newer (https://nodejs.org).
3. Open the folder with your coding agent. It should read `AGENTS.md` first, which explains the code and the Gen 1 rules.

## Making a change

`main` is protected so the live site can't break by accident. Everyone, including Alex, works the same way:

1. Start fresh: `git switch main && git pull`
2. Make a branch: `git switch -c my-idea`
3. Make the change. Ask your agent to run `npm run typecheck && npm test && npm run build`.
4. Push and open a pull request that merges itself when the checks pass:
   ```bash
   git push -u origin HEAD
   gh pr create --fill
   gh pr merge --auto --squash
   ```
5. That's it. When CI is green, the PR merges, the branch is cleaned up, and the live site updates about a minute later.

No approvals are needed: you can merge your own PRs. If CI goes red, click into the failed check (or ask your agent to run `gh pr checks`) and push a fix to the same branch.

Easiest of all, just tell your coding agent: "make this change and open a PR with auto-merge". `AGENTS.md` tells it the steps.

## House rules

- Small PRs are easier than big ones, and they rarely collide.
- Pull `main` before you start something new.
- If you and Alex both want to change the same area, say so in the family chat first.

## Good first things to try

- Change the look: colors and fonts are CSS variables at the top of `src/styles.css`.
- Tweak the optimizer: see the "tuning knobs" section in `AGENTS.md`.
- Pick an item from the "Ideas backlog" in `AGENTS.md`.
