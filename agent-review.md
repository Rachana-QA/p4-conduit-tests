# Tests from Playwright's agents, and my review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Date: 2026-11-19

## 1. How I set up the agents
- **Command:** `npx playwright init-agents --loop=claude` (TESTS terminal, in `P4`)
- **What it made:** `.claude/agents/playwright-test-planner.md`, `.claude/agents/playwright-test-generator.md`, `.claude/agents/playwright-test-healer.md`, `.mcp.json`, `specs/README.md`, `tests/seed.spec.ts`
- **Browser hidden:** `"--headless"` added to `P4/.mcp.json`: yes
- **Where I started Claude for the agents:** in `P4`, because Claude finds the agents and their browser only there

## 2. What I asked the agents
- **Area:** the profile page and following an author
- **My prompt** (`P4/prompts/agents.md`):
  - Task: First use the playwright-test-planner agent to plan tests for the profile page and following an author. Save the plan as specs/profile-follow.md. Then use the playwright-test-generator agent to write one test for each scenario in the plan, in the folder tests/profile-follow/.
  - Material: Start on the page /profile/practice-author. For steps that need a signed-in user, use a practice user from README.md.
  - Rules: Plan at most 2 short scenarios, with at most 5 steps each. Do not change any other test file. Do not run the test suite. Every test must use reliable user-facing locators, check the actual expected result with specific assertions, and avoid fixed waits like waitForTimeout().
- **The plan the planner saved:** none. The agents did not run: the planner's set-up failed 3 times with "Playwright Test did not expect test.describe() to be called here" (seed.spec.ts line 3).
- **The test files the generator wrote:** none (the generator was not started, because there was no plan).
- **Without the agents:** Claude would not write the tests from README.md alone, because it could not see the page and would have to guess every name (house rule 1).
- `tests/seed.spec.ts` is the agents' start file. It checks nothing about the app, so it is not reviewed here.

## 3. My review of every generated test
- The agents did not run, so there were no generated tests to review today. (Reported to the programme manager.)

## 4. What I asked Claude to change, and the result
- **My change** (the Changes line of `P4/prompts/stronger.md`): no change: there were no agent tests.
- **Result:** No fault: 21 passed, 0 failed (the "No fault" line of my second fault run)
