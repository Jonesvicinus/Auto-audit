# CLAUDE.md

This file gives Claude project-specific context for Auto Audit.

## Session Start

Read these first, in order:

1. `/Users/jonesvicinus/Code/AI-Brain/wiki/projects/auto-audit/auto-audit.md`
   - For page-specific work, also read the matching note in `/Users/jonesvicinus/Code/AI-Brain/wiki/projects/auto-audit/`.
   - For broad cleanup or audit-fix work, also read `/Users/jonesvicinus/Code/AI-Brain/wiki/projects/auto-audit/implementation-plans.md`.
2. `/Users/jonesvicinus/Code/Auto-audit/Auto Audit/budget-app/DEVELOPER.md`
3. `/Users/jonesvicinus/Code/Auto-audit/Auto Audit/budget-app/README.md` only if quick setup context is needed

The AI-Brain project page is the durable memory for what happened last and what should happen next. Prefer it over old prompts or stale notes.

## Project Shape

- Canonical repo: `/Users/jonesvicinus/Code/Auto-audit`
- App root: `/Users/jonesvicinus/Code/Auto-audit/Auto Audit/budget-app`
- Obsolete copy: `/Users/jonesvicinus/Code/auto-audit0.1` — ignore

Auto Audit is a personal money-management app running locally today, with Supabase-backed multi-user support already designed into the architecture. It may be released to other users later, but the current focus is making the local app more useful and polished first.

## Current Product Priorities

Use the AI-Brain page as the source of truth, but the current known priorities are:

1. Add income tracking so income can be compared against spending.
2. Improve daily spending tracking and the budget workflow.
3. Improve savings goals with ahead/on-track/behind pacing.
4. Capture new small ideas when the user mentions them, then write durable summaries back to the AI-Brain page.

## Coding Rules

- Work from `Auto Audit/budget-app` for app commands.
- Use existing Next.js, TypeScript, Tailwind, Supabase, and local storage patterns.
- Read `DEVELOPER.md` before touching architecture, storage, auth, imports, budgets, or savings.
- Keep demo mode and Supabase mode both working.
- Preserve user data safety: avoid destructive migrations or storage resets unless explicitly requested.
- Prefer focused changes and run the relevant checks when possible.

Useful commands from the app root:

```bash
npm run dev
npm run lint
npm run test:run
npx tsc --noEmit
```

## Write Back To AI-Brain

After meaningful Auto Audit work, update:

- `/Users/jonesvicinus/Code/AI-Brain/wiki/projects/auto-audit/auto-audit.md`
- `/Users/jonesvicinus/Code/AI-Brain/log.md`

Update the project overview and any affected page-specific note when current status, next tasks, implementation decisions, or open questions change. Always update `last_updated` frontmatter on any Brain page modified.

Append a brief log entry in this format:

```markdown
## [YYYY-MM-DD] project update | Auto Audit
Updated: wiki/projects/auto-audit/auto-audit.md and any affected page notes.
Summary: <what changed, what remains next>.
```

Do not edit `/Users/jonesvicinus/Code/AI-Brain/Inbox/dump.md` unless the user explicitly asks. The dump is the user's private working scratchpad; durable Auto Audit context belongs in the project page.

## Responsibility Split

- Claude: implement Auto Audit code changes and write back important project context.
- Codex: clean, lint, reorganize, deduplicate, and maintain the AI-Brain vault.

If the user asks for vault cleanup or broad second-brain organization, route that work to Codex.
