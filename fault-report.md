# My practice fault report (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Practice faults: `P4/faults/practice.json` (F1 to F6) · Date: 2026-11-19
**How to read it:** a "detect" fault is **caught** when at least one test that passed with no fault fails with it, and **missed** when every test still passes. A "robust" fault (the app is only slower) should **stay green**; if tests fail, it **went red**.

## 1. My guess this morning
- **The developer asked:** "Your suite is green. How many real problems would it catch?"
- **My answer:** A green test suite does not prove that it catches real problems. I would find out by introducing known bugs one at a time and running the tests to see whether they fail. If a bug is introduced and all tests still pass, the suite has missed it.

## 2. Before: my suite against the practice faults
- **Command:** `node materials/faults-run.mjs` (TESTS terminal, in `P4`, with no app running)
- **My test files:** `api.spec.ts` (10 tests), `contract.spec.ts` (5), `e2e.spec.ts` (2), `example.spec.ts` (1), `seed.spec.ts` (1, checks nothing)
- **No fault:** 19 passed, 0 failed
- **F1:** caught (10 tests failed) · Opening an article gives a server error (500)
- **F2:** caught (4 tests failed) · The article answer has no body text
- **F3:** caught (5 tests failed) · The article answer has a different title
- **F4:** caught (1 test failed: the e2e comment test) · The comments list is always empty
- **F5:** stayed green (0 tests failed) · The article answer comes 3 seconds late
- **F6:** caught (1 test failed: the e2e comment test) · Posting a comment is refused (422) and nothing is saved

## 3. The weak spot I chose, and why
The suite is weakest at F4

## 4. How I made the suite stronger
- **My request for Claude** (the New tests line of `P4/prompts/stronger.md`): Add P4/tests/comments.spec.ts with 2 API tests: one to verify that a comment is successfully created and saved, and another to verify that the GET comments request returns the saved comment with the correct body and author. Use API.md for the expected status codes and response fields. Do not run the tests.
- **New or changed test file:** `P4/tests/comments.spec.ts` (new: "POST comment creates the comment and saves it", "GET comments returns the saved comment with the correct body and author")

## 5. After: the run again
- **Command:** `node materials/faults-run.mjs F4`
- **No fault:** 21 passed, 0 failed
- **The fault I chose:** F4: caught (3 tests failed: the 2 new comment tests and the e2e comment test)

## 6. What changed
The new comment tests improved the suite. Before, only 1 test caught F4. Now 3 tests catch it. The suite is stronger, and the comments feature has better test coverage.
