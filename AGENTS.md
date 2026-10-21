# AGENTS.md — Project Working Rules

These rules apply to every LLM, coding agent, automation, and sub-agent working in this project.

## 1. Local work only

- All implementation work must be performed in the local project folder.
- The project owner is solely responsible for publishing work to GitHub or any other remote service.
- Do not deploy, publish, upload, release, or send project content anywhere unless the owner explicitly requests that specific action.
- Do not create pull requests or interact with external issue trackers without explicit permission.

## 2. The project owner controls Git

The project owner controls all Git operations.

Agents must not run any Git command, including read-only commands, unless the owner explicitly authorizes it.

This includes, but is not limited to:

- `git status`
- `git diff`
- `git log`
- `git branch`
- `git switch` or `git checkout`
- `git add`
- `git commit`
- `git merge` or `git rebase`
- `git pull`, `git fetch`, or `git push`
- `git stash`
- `git reset`, `git restore`, or `git clean`
- Creating, renaming, or deleting branches or tags

Do not assume that permission to edit files includes permission to use Git.

When Git information or an operation is needed, explain what is needed and ask the owner to perform or authorize it.

## 3. Branch protection and feature work

- Never make client-facing, production-facing, or feature changes directly on `main` or the project's default branch.
- Such work must be developed and tested on a separate branch before it is merged.
- Because the owner controls Git, ask the owner to confirm that an appropriate branch is active before editing client-facing or feature code.
- Do not merge anything into `main`.
- Do not bypass branch protections, required checks, reviews, or release procedures.
- Small documentation, investigation, or internal maintenance changes may be handled according to the owner's instructions, but Git remains owner-controlled.

## 4. No deletion without permission

Do not delete anything without explicit permission for the exact target and operation.

This prohibition includes:

- Files and directories
- Git branches, tags, commits, stashes, and worktrees
- Tests, fixtures, snapshots, and documentation
- Database records, tables, schemas, and migrations
- Cloud resources, deployments, releases, and remote data
- Dependencies, packages, accounts, credentials, and configuration
- Comments or code that may appear unused

Never run destructive commands or destructive command options without permission, including:

- `rm`, `rmdir`, or equivalent commands
- Any command using deletion flags such as `-d`, `-D`, `--delete`, or `--force`
- `git clean`, destructive resets, or history rewrites
- Database `DROP`, `DELETE`, or destructive migrations
- Recursive replacement, bulk overwrite, or cleanup operations

Permission to modify something is not permission to delete it.

If deletion seems necessary:

1. Identify the exact target.
2. Explain why deletion is needed.
3. Describe the consequences and whether recovery is possible.
4. Wait for explicit approval before proceeding.

Prefer reversible approaches, such as moving an item to a clearly named quarantine or backup location, but still ask before doing so.

## 5. Preserve existing work

- Treat all existing files and uncommitted changes as owner-controlled work.
- Do not overwrite, revert, discard, reformat, or clean up unrelated work.
- Limit edits to the files and areas required for the current task.
- Inspect a file before editing it.
- If existing changes conflict with the requested work, stop and explain the conflict.
- Do not replace a whole file when a focused edit will suffice.
- Preserve established architecture, naming, formatting, and conventions unless asked to change them.

## 6. Testing and verification

- Test meaningful changes locally before reporting them as complete.
- Use the project's existing test, lint, formatting, type-checking, and build processes.
- Do not alter or weaken tests merely to make a change pass.
- Do not remove failing tests without explicit permission.
- Clearly report:
  - What was tested
  - What passed or failed
  - What was not tested
  - Any remaining risks or assumptions
- Never claim that a change was tested, deployed, committed, pushed, or verified unless that action actually occurred.

## 7. Dependencies and generated files

- Do not install, remove, or upgrade dependencies without explicit permission.
- Do not regenerate lockfiles unless the approved task requires it.
- Do not introduce a new framework, service, database, build system, or major dependency without discussing it first.
- Prefer the project's existing tools and libraries.
- Do not manually edit generated files unless the project's workflow specifically requires it.

## 8. External access and sensitive information

- Do not send source code, project files, client information, or credentials to external services without explicit permission.
- Do not expose secrets in output, logs, tests, screenshots, commits, or documentation.
- Never invent credentials or replace missing secrets with real-looking values.
- Use obvious placeholders in examples.
- Do not access production systems, client accounts, analytics, billing, email, messaging platforms, or cloud consoles unless explicitly requested.
- Treat client data and project details as confidential.

## 9. Command guidance and learning

The owner is learning software engineering and wants to understand the commands used during development.

When a terminal or Git command is needed:

1. Explain in plain language what the command does and why it is needed.
2. State where it should be run, such as the project folder or a particular subdirectory.
3. Show the exact command separately so it can be copied safely.
4. Explain any placeholders that the owner must replace.
5. Describe the expected result and any meaningful risks.
6. Ask the owner to run the command and share the output before continuing when the result affects the next step.

For Git commands specifically:

- You may recommend and explain Git commands, but you must not execute them.
- The owner must be the person who presses Enter to run every Git command.
- Present one logical Git operation at a time whenever practical.
- Do not combine Git commands with `&&`, `;`, scripts, aliases, or other command-chaining mechanisms.
- Clearly distinguish between commands that only inspect the repository and commands that change files, history, branches, or remotes.
- Warn the owner before proposing a command that could overwrite work, modify history, create a commit, switch branches, contact a remote, or otherwise change repository state.
- After the command runs, help the owner interpret its output rather than assuming it succeeded.

Never press Enter, submit a prepared command, or use terminal automation to execute a Git command on the owner's behalf.

For other engineering commands, default to the same guided approach when it would help the owner learn. The owner may explicitly authorize an agent to run a non-Git command when appropriate.

Avoid unexplained jargon. Briefly define unfamiliar flags and concepts as they arise, without overwhelming the owner with unrelated detail.

## 10. Scope and communication

- Work only on the requested task.
- Do not silently expand the scope into refactors, redesigns, migrations, or unrelated cleanup.
- Reasonable, reversible implementation details may be decided autonomously when they stay within the approved scope.
- Ask before proceeding when a choice would:
  - Change externally visible behaviour
  - Affect data compatibility
  - Introduce a new dependency
  - Require deletion or irreversible action
  - Interact with Git or a remote system
  - Materially expand the task
- State important assumptions and uncertainties clearly.
- If instructions conflict, follow the safer and more restrictive interpretation and ask the owner.

## 11. Sub-agents and automation

- These rules apply equally to sub-agents, delegated tasks, scripts, and automated tools.
- An agent must pass these restrictions to any sub-agent it uses.
- Delegation does not grant additional permissions.
- The primary agent remains responsible for reviewing delegated work and ensuring it follows these rules.

## 12. Session handover and working ledger

Maintain a Markdown file named `HANDOVER.md` in the project root as the shared working ledger between sessions and agents.

At the beginning of each working session:

- Read `HANDOVER.md` before making changes.
- Use it to understand the project's current state, active work, previous decisions, known issues, and next steps.
- Check the ledger against the current project files. If it appears outdated or inconsistent, call that out instead of silently relying on it.

During and at the end of each working session:

- Keep the current logic and state summary accurate.
- Record material decisions and the reasons behind them.
- Record what changed, what was tested, and the outcome of those tests.
- Record unresolved questions, known issues, risks, assumptions, and blockers.
- Record recommended next steps in a clear order.
- Record any commands the owner still needs to run, especially Git commands.
- Add useful workflow improvements or lessons that could make future work safer, clearer, or more efficient.

The ledger should:

- Be concise enough for a new session to understand quickly.
- Clearly separate the current state from historical session notes.
- Distinguish confirmed facts from assumptions or proposals.
- Use dates for session entries.
- Avoid secrets, credentials, personal data, and unnecessary client information.
- Never claim that work, testing, Git operations, deployment, or approval occurred when it did not.
- Be updated as part of completing any material task.

Do not delete or rewrite prior session entries without explicit permission. Correct outdated information by updating the current-state summary and, when useful, adding a dated clarification to the session history.

## 13. Definition of complete

A task is complete only when:

- The requested change has been implemented locally.
- Relevant local checks have been run where possible.
- Results and limitations have been reported accurately.
- `HANDOVER.md` has been updated for any material work completed during the session.
- No unauthorized Git, deletion, deployment, publishing, or external-service action occurred.
- The owner has been left in control of reviewing, committing, pushing, merging, and releasing the work.

## Permission rule

Permission must be explicit and specific. Approval for one command, file, target, or task does not imply approval for related destructive, Git, remote, or publishing actions.

When uncertain, stop and ask.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
