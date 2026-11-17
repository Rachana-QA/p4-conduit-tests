# API review: Claude's first API tests (week 4, project P4)

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- article 201

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201 – The response contains the new comment, including its body "Clear and useful." The app answered 201, the comment with body "Clear and useful." and author practice-reader.
- **B** (the same comment, with no token): I predicted 401 – The response contains the error "token is missing" because there is no Authorization header. The app answered 401, `{"errors":{"token":["is missing"]}}`.
- **C** (a comment on an article that does not exist): I predicted 404 – The response contains the error "article not found" because the article does not exist. The app answered 404, `{"errors":{"article":["not found"]}}`.

The answer that surprised me most was B (401). Even though the comment request was correct, it failed because the Authorization token was missing. This shows that the API checks the token before allowing a user to post a comment.

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Check both the response status code and the response body, including the actual expected values, not just whether the request succeeds.
```

## 4. The run
- **Result:** 9 passed, 1 failed.
- **A red test, and who is wrong:**
  - Test: "change: the author changes description and body; fields not sent stay the same"
  - Expected: `["testing", "api"]` · Received: `[]`
  - API.md says: "Updating: every field is optional. A field you do not send stays as it was."
  - My answer: The app is wrong, not the test. API.md says that when tagList is not included in an update request, the existing tags must stay unchanged. The test correctly expects ['testing', 'api'], but the app returns an empty list. We should keep the test and report this as a bug to the developer.
- **My note** (kept with `test.fail()`): The app removes existing tags when tagList is not included in the update request.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "create without a title gives 422 "title can't be blank""
- **My answer:** No, we cannot confirm that nothing was saved just from the 422 status and error message. We should also check that the article was not created, for example by checking the articles list or trying to read the article. A failed response alone does not prove that no data was saved.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "create: a signed-in user creates an article and gets 201 with all its values"
- **My decision:** Keep, with one improvement.
  The test checks the 201 status, article values, tags, author details, and date formats. It also creates its own user and unique article.
  However, it should perform a GET request after creation to confirm that the article was actually saved and can be retrieved.
  The slug type check is acceptable because API.md does not specify an exact slug format.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Check the exact status code, response body values, and response structure against API.md.
2. After creating, updating, or deleting data, use a GET request to verify the actual saved data.
3. For negative tests, verify that the request is rejected and no data is created or changed.
