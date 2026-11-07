# Onboard Sergio (or another contributor)

## 1. Owner grants GitHub access

Repository: https://github.com/tylercyert/indy-learning-app

Tyler opens **Settings → Collaborators → Add people**, enters Sergio's verified GitHub username, and invites him with the minimum contributor access GitHub offers for this personal repository. Sergio accepts while signed into his own account. No invitation was sent by the bootstrap task. Do not share Tyler's token, login or SSH private key.

The public repo can be read and cloned without an invitation. Sergio needs collaborator access to push to this repo, or can use his own fork and open a PR.

## 2. Clone on Sergio's computer

Install Git and Node 24 LTS through trusted sources. Then:

```sh
git clone https://github.com/tylercyert/indy-learning-app.git
cd indy-learning-app
nvm install
nvm use
npm ci
npm run verify
npm run web
```

`nvm` is optional; another Node manager is fine. Configure Git with Sergio's own name/email if not already configured. GitHub CLI (`gh auth login`) is optional. Browser GitHub works for issues and PRs.

For a phone, run `npm start` and use an Expo Go version compatible with SDK 58; app and phone must be able to reach the same dev server. If Expo Go does not support the SDK/native modules, use a development build. iOS Simulator needs macOS/Xcode; Android Emulator needs Android tooling. Neither a paid Expo service nor a shared server is required for the first web smoke test.

## 3. Read, claim, branch

Read `docs/product.md`, `docs/architecture.md`, `docs/factory.md` and `AGENTS.md`. Open the [issues](https://github.com/tylercyert/indy-learning-app/issues), agree ownership with Tyler, and claim one ready issue. Shared types/schema need an owner before UI and data work run in parallel.

```sh
git switch main
git pull --ff-only
git switch -c agent/sergio/<issue>-<short-name>
# edit only the agreed scope
npm run verify
npm run export:all
git add <specific-files>
git commit -m "feat: describe the change"
git push -u origin HEAD
```

Open a draft PR, link `Closes #<issue>`, add evidence and ask an independent reviewer. Never commit secrets or force push another person's branch.

## 4. Agents and shared-host option

Each agent reads `AGENTS.md` and gets an issue, owned paths, its own branch/worktree and a unique Metro port. Tell it not to merge or deploy. Agent tools/models are optional; no agent is launched automatically by this repo.

If both people later work on Noir, give Sergio his own approved machine/account access first, then a separate clone/worktree. Tailscale access does not itself grant GitHub access. The shared development host is Noir. The project is at `~/projects/indy-learning-app` under the existing development account. SSH connectivity was verified during bootstrap. Shared login access does not isolate credentials; prefer separate accounts. Do not make shared-host setup a prerequisite for independent laptop development.

## First successful handoff

Sergio can open the repo, `npm ci` succeeds on Node 24, checks pass, the starter screen runs, he has claimed an issue, and his branch/owned paths are recorded on it. This is the onboarding finish line, not just accepting an invitation.
