# My end-to-end tests and review (week 4, project P4)

App: Conduit practice app · Test file: `P4/tests/e2e.spec.ts` · Date: 2026-11-18

## 1. My first look
- **After I published an article by hand, I would check:** I would check that the article is published successfully, appears in the Global Feed, and displays the correct title, description, and article body. I would also verify that the logged-in author is correct.
- **Where the page keeps my sign-in:** jwtToken

## 2. Practice
- **Worked example (the like test):** it signs in through the form as a practice user, so other tests can change its data.
- **Does its check at the end prove the journey?** No. Line 19 only checks that the article heading is visible. It does not prove the like worked. The test should check that the article is favorited and favoritesCount increased to 1, preferably by reading the saved result through the API.

## 3. My prompt
```text
Task: Write 2 end-to-end tests in P4/tests/e2e.spec.ts. Test 1: a signed-in user publishes a new article in the editor. Test 2: a signed-in user posts a comment on an article. Make a new user with the API, give the page its token, do the journey in the page, and check the result with the API at the end. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/app/public/app.js app.js is the page's code: take the labels and button names from it. The page keeps the sign-in token in localStorage, key jwtToken.
Rules: Use app.js only for the labels and button names. Do not change the app. Do not run the tests. At the end of each test, use the API to verify that the actual article or comment was saved correctly, including its expected content and values.
```

## 4. The run
- **Claude's 2 tests:** 2 passed, 0 failed.

## 5. The teammate's question
- **Claude said:** "6. Tests do not depend on each other: Yes. Each test makes its own users and data." And at the end: "The users, the article and the comments stay in the app after a run. I did not add any clean-up."
- **My answer:** No. Each test creates its own user and data, so the tests are independent, but that data stays in the app after the run. The app is not clean. We need a cleanup step or a separate test environment to remove the test data.

## 6. What I saw on the home page
- Article to comment on 179498492878410986

## 7. My change
- **My line to Claude:** In @P4/tests/e2e.spec.ts, the tests leave behind the new users, published article and comments after each run. Add cleanup in test.afterEach to delete the test data using the API, so cleanup runs even when a test fails. Do not run the tests.
- **The clean-up Claude added:** test.afterEach deletes the articles and comments each test made, with the API. The users stay: API.md has no request to delete a user.

## 8. Proof
- **Each test twice, on an app that keeps its data:** `npx playwright test tests/e2e.spec.ts --repeat-each=2` → 4 passed, 0 failed.
- **The newest article on the home page after the run:** Your first end-to-end test
