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

1. Create a branch: `git switch -c my-idea`
2. Make the change. Ask your agent to run `npm run typecheck && npm test && npm run build` before it finishes.
3. Push and open a pull request:
   ```bash
   git push -u origin my-idea
   gh pr create --fill
   ```
4. CI runs automatically on the PR. Once it's green, merge it. Merging to `main` redeploys the live site in about a minute.

Small fixes can go straight to `main` if you're confident. Just keep CI green.

## Good first things to try

- Change the look: colors and fonts are CSS variables at the top of `src/styles.css`.
- Tweak the optimizer: see the "tuning knobs" section in `AGENTS.md`.
- Pick an item from the "Ideas backlog" in `AGENTS.md`.
