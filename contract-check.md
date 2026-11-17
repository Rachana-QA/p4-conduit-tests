# My schema, auth and contract checks (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Date: 2026-11-17

## 1. My first look
How I would check that an article answer has the right shape: I would check that the response has an article object with all the required keys listed in API.md, such as slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, and author. I would also verify that each field has the correct data type.

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):**
  1. Missing bio: Fail – bio is missing from the answer.
  2. New field password: Fail – an extra field is present.
  3. Token is a number: Pass – the key token still exists; the key list does not check its data type.

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. In every API test, check that the response has all the required fields, no unexpected fields, and the correct data types as defined in API.md.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape" (from another run, `toMatchObject` only; my own test already had exact key lists, lines 92–95)
- **Claude said:** "an anonymous reader gets 200 and the full Article shape."
- **My answer:** No, this test will still pass because toMatchObject() checks only the fields listed in the expectation. It allows extra fields like password. To catch unexpected fields, we need an exact key-list check using Object.keys().sort() and toEqual().

## 6. My change
- **What I asked Claude:** My own test needed no change (it already had exact key lists). My line for the test from the other run: "In @P4/tests/articles.spec.ts, the GET article shape test is missing an exact key-list check. Add a check to verify that the article response contains exactly the fields listed in API.md, including the author fields. Do not run the tests."
- **The run after it:** no change made · 5 passed, 0 failed

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** The GET /api/articles/:slug answers with the Article shape test will fail because F2 removes a field from the article response. The exact key-list check will detect that a required field is missing.
- **Run with the practice fault F2 on:** `$env:CONDUIT_FAULT = "F2"`, then `npx playwright test tests/contract.spec.ts` · **Result:** 4 passed, 1 failed (✘ GET /api/articles/:slug answers with the Article shape)
- **What Playwright showed:** `-     "body": Any<String>,` under `- Expected  - 1` / `+ Received  + 0` (line 71, the toMatchObject check)
- **My answer about a red test:** The fault removed the body field. I can see it in the error output because "body": Any<String> appears under Expected, but it is missing under Received.
- **Run with the fault off again:** `$env:CONDUIT_FAULT = ""`, then the same run · **Result:** 5 passed, 0 failed
