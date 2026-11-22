# My CI workflow and review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

Repository: the P4 folder · Workflow: `.github/workflows/playwright.yml` · Date: 2026-11-20

## 1. What my project needs
- **Node.js on my laptop (`node -v`):** v24.22.1
- **My whole suite on my laptop:** `npx playwright test` → 21 passed, 0 failed
- **What the GitHub computer needs (my words):**
  - Node.js: Node.js v24.22.1 proved your test suite today, with 21 passed, 0 failed.
  - Packages: npm ci. It installs the exact package versions from package-lock.json, so GitHub uses the same dependencies that your project has locked.
  - Browser: Chromium only (from the example)

## 2. My prompt to Claude
```text
Task: Write a GitHub Actions workflow that runs this Playwright suite on every push and keeps the HTML report. My GitHub repository is the P4 folder, so save it as P4/.github/workflows/playwright.yml. After the file, write one line for each step: what it does.
Material: @P4/package.json @P4/playwright.config.ts @P4/README.md
Rules: Use actions/checkout@v6, actions/setup-node@v6 and actions/upload-artifact@v6. Do not run anything. Do not commit or push. The workflow must use Node.js 24.22.1, install packages using npm ci, and install only Chromium because my Playwright config uses Chromium.
```

## 3. What Claude's workflow got wrong for my project
My own rule gave Claude the Node.js version, so my workflow already used `node-version: 24.22.1`. The line below is from another run, with no Node.js rule.
- **Claude's workflow (another run):** `node-version: 22`
- **Claude said:** ASSUMPTION: `node-version: 22` gets the newest Node 22, which is 22.13 or later. You could use 24 instead. Nothing in the material asks for a specific version.
- **My project needs:** Node.js v24.22.1 (21 passed, 0 failed on my laptop)
- **My answer to the developer:** I would say not yet. The workflow uses Node.js 22, but our test suite was proven on Node.js 24.22.1 with 21 tests passing. We should use Node.js 24.22.1 in the workflow to match our tested environment before merging.
- **My line to Claude:** In @P4/.github/workflows/playwright.yml, add a comment above line 17: "# Node.js 24.22.1: my test suite passed all 21 tests on this version." Change nothing else. Do not run anything.

## 4. My reading of the workflow
- **When, where, the code and Node.js (lines 1–18):**
  - Lines 3–4 mean the workflow runs automatically whenever someone pushes code to any branch.
  - runs-on: ubuntu-latest – Runs the tests on a fresh Linux computer provided by GitHub.
  - timeout-minutes: 30 – Stops the workflow if it takes more than 30 minutes.
- **Packages, browser, tests and the report (lines 19–36):**
  - Line 19 – cache: npm: Saves packages between runs to make future runs faster.
  - Lines 21–22 – npm ci: Installs the exact packages from package-lock.json.
  - Lines 24–25 – Install Chromium: Installs the Chromium browser needed for Playwright tests.
  - Lines 27–28 – Run tests: Runs the Playwright test suite.
  - Lines 30–32 – Keep the HTML report: Uploads the test report to GitHub, even if the tests fail (unless the workflow is cancelled).
  - Lines 33–36 – Report settings: Names the report playwright-report and keeps it for 30 days.

## 5. The first run on GitHub
- **Run:** Add the CI workflow · **Result:** green · **Tests:** 21 passed
- **The report (artifact):** yes, playwright-report is under Artifacts

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** The Run the Playwright tests step will turn red because the test expects status code 201, but GET /api/tags should return 200 (OK), not 201 (Created). The status-code assertion on line 6 will fail.
- **What GitHub showed:** 1) [chromium] › tests/example.spec.ts:3:5 › the API lists the popular tags · Expected: 201 · Received: 200 · 1 failed, 20 passed

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** 21 passed green

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- "read: anyone can get an article by its slug and gets 200 with the saved values": **changed**, because it checks the saved values, but should also verify the exact response fields and data types.
- "delete: the author deletes an article, gets 204 with no body, and the article is gone": **kept**, because it checks 204, empty response body, and 404 after deletion.
- "create without a token gives 401 "token is missing" and saves nothing": **changed**, because checking only the newest 100 articles may not prove that nothing was saved. Verify the exact test article was not created.
- "read an article that does not exist gives 404 "article not found"": **kept**, because it checks the expected 404 status and error message.
- "change by a user who is not the author gives 403 and the article stays the same": **kept**, because it checks 403 and confirms the article body remains unchanged.
- "delete by a user who is not the author gives 403 and the article still exists": **kept**, because it checks 403 and confirms the article still exists.
- "delete with a wrong token gives 401 "token is invalid" and the article still exists": **changed**, because GET checks only status 200. Also verify the article's saved values remain unchanged.

My overall rule: Keep tests that verify the expected result. Improve tests that do not fully verify the response or saved data. Ensure tests use their own test data.

### Tuesday: `tests/contract.spec.ts`
- "GET /api/user answers with the User shape": **kept**, because it checks status, field types, exact keys, and the signed-in user's email and username.
- "GET /api/user without a token answers 401 "is missing"": **kept**, because it checks 401, exact error keys, and the expected error message.
- "GET /api/user with a wrong token answers 401 "is invalid"": **kept**, because it checks 401, exact error keys, and the expected invalid-token message.
- "PUT /api/articles/:slug on someone else's article answers 403 and changes nothing": **changed**, because it checks 403, but after the request it verifies only the title. It should also verify that the other article's remaining saved values are unchanged.

Overall: The first three tests are strong. Test 4 needs a stronger check to confirm that the refused request did not change the article.
