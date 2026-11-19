New tests: Add P4/tests/comments.spec.ts with 2 API tests: one to verify that a comment is successfully created and saved, and another to verify that the GET comments request returns the saved comment with the correct body and author. Use API.md for the expected status codes and response fields. Do not run the tests.
Material: @P4/API.md @P4/tests/e2e.spec.ts Make users and data by API, and clean up, like these tests.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Change nothing else. Do not run the tests.
