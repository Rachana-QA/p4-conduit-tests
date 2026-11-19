import { test, expect, APIRequestContext } from '@playwright/test';

// Shared test data, kept in one place.
// Password has 8+ characters (API.md, "This app's rules": minimum is 8 characters).
const PASSWORD = 'Password123';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

type User = { username: string; token: string };

// A short unique text, so names, emails and titles never clash between tests.
function uniqueId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Signs up a new user with the API (POST /api/users, 201) and returns the username and token.
async function signUp(request: APIRequestContext): Promise<User> {
  const username = `cmtuser${uniqueId()}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, token: json.user.token as string };
}

// Creates an article with the API (POST /api/articles, 201) and returns its slug.
async function createArticle(request: APIRequestContext, author: User): Promise<string> {
  const id = uniqueId();
  const response = await request.post('/api/articles', {
    headers: authHeader(author.token),
    data: { article: { title: `Comments article ${id}`, description: `Description ${id}`, body: `Body ${id}`, tagList: [] } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article.slug as string;
}

// ---------- Clean-up ----------
// Each test adds its clean-up steps here as soon as it makes data.
// test.afterEach runs them, even when the test fails.
// The users stay: API.md has no request to delete a user (NOT IN THE MATERIAL).
type CleanupStep = (request: APIRequestContext) => Promise<void>;
let cleanupSteps: CleanupStep[] = [];

test.afterEach(async ({ request }) => {
  // Newest step first: comments go before the article they are on.
  const steps = cleanupSteps.reverse();
  cleanupSteps = [];
  let firstError: unknown;
  for (const step of steps) {
    // Run every step, even if one fails; report the first failure at the end.
    try {
      await step(request);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
});

// Deletes every article by this user (DELETE /api/articles/:slug, author only, 204).
async function deleteArticlesBy(request: APIRequestContext, user: User) {
  // ASSUMPTION: a test user has fewer than 100 articles.
  const list = await request.get(`/api/articles?author=${encodeURIComponent(user.username)}&limit=100`);
  expect(list.status()).toBe(200);
  for (const a of (await list.json()).articles as { slug: string }[]) {
    const response = await request.delete(`/api/articles/${encodeURIComponent(a.slug)}`, { headers: authHeader(user.token) });
    expect(response.status()).toBe(204);
  }
}

// Deletes every comment by this user on this article (DELETE /api/articles/:slug/comments/:id, comment author only, 204).
async function deleteCommentsBy(request: APIRequestContext, slug: string, user: User) {
  const list = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(list.status()).toBe(200);
  const mine = ((await list.json()).comments as { id: unknown; author: { username: string } }[])
    .filter((c) => c.author.username === user.username);
  for (const c of mine) {
    const response = await request.delete(`/api/articles/${encodeURIComponent(slug)}/comments/${c.id}`, { headers: authHeader(user.token) });
    expect(response.status()).toBe(204);
  }
}

// Set-up shared by both tests: one user writes an article, a second user will comment on it.
async function articleWithCommenter(request: APIRequestContext) {
  const author = await signUp(request);
  const commenter = await signUp(request);
  // Added before the article is made, so it is deleted even if the create check fails.
  cleanupSteps.push((req) => deleteArticlesBy(req, author));
  const slug = await createArticle(request, author);
  // Clean-up runs newest first: the comment, then the article.
  cleanupSteps.push((req) => deleteCommentsBy(req, slug, commenter));
  return { author, commenter, slug };
}

test('POST comment creates the comment and saves it', async ({ request }) => {
  const { commenter, slug } = await articleWithCommenter(request);
  const commentBody = `API comment ${uniqueId()}`;

  // API.md, Comments: POST /api/articles/:slug/comments, token needed, body required, answer 201 {"comment":{...}}.
  const response = await request.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
    headers: authHeader(commenter.token),
    data: { comment: { body: commentBody } },
  });
  expect(response.status()).toBe(201);

  // API.md: Comment is {"id","createdAt","updatedAt","body","author"}, and author is a Profile.
  const json = await response.json();
  expect(Object.keys(json)).toEqual(['comment']);
  const created = json.comment;
  expect(Object.keys(created).sort()).toEqual(['author', 'body', 'createdAt', 'id', 'updatedAt']);
  // ASSUMPTION: API.md does not give the type of the comment id; the test only checks it is there.
  expect(created.id).toBeDefined();
  expect(created.body).toBe(commentBody);
  expect(created.createdAt).toMatch(ISO_DATE);
  expect(created.updatedAt).toMatch(ISO_DATE);
  // API.md: a new user has bio and image null.
  // ASSUMPTION: following is false, because a user does not follow themselves (API.md does not say).
  expect(created.author).toEqual({ username: commenter.username, bio: null, image: null, following: false });

  // Check with a GET that the comment is really saved: exactly one comment, with the same id and text.
  const readBack = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(readBack.status()).toBe(200);
  const saved = (await readBack.json()).comments;
  expect(saved).toHaveLength(1);
  expect(saved[0].id).toBe(created.id);
  expect(saved[0].body).toBe(commentBody);
});

test('GET comments returns the saved comment with the correct body and author', async ({ request }) => {
  const { commenter, slug } = await articleWithCommenter(request);
  const commentBody = `Saved comment ${uniqueId()}`;

  // Set-up with the API: the commenter posts one comment.
  const posted = await request.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
    headers: authHeader(commenter.token),
    data: { comment: { body: commentBody } },
  });
  expect(posted.status()).toBe(201);
  const postedId = (await posted.json()).comment.id;

  // API.md, Comments: GET /api/articles/:slug/comments, token optional, answer 200 {"comments":[...]}.
  // Sent without a token.
  const response = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(Object.keys(json)).toEqual(['comments']);
  expect(json.comments).toHaveLength(1);

  const saved = json.comments[0];
  expect(Object.keys(saved).sort()).toEqual(['author', 'body', 'createdAt', 'id', 'updatedAt']);
  expect(saved.id).toBe(postedId);
  expect(saved.body).toBe(commentBody);
  expect(saved.createdAt).toMatch(ISO_DATE);
  expect(saved.updatedAt).toMatch(ISO_DATE);
  // API.md: author is a Profile {"username","bio","image","following"}; a new user has bio and image null.
  // ASSUMPTION: without a token, following is false (API.md does not say what it is for no signed-in user).
  expect(saved.author).toEqual({ username: commenter.username, bio: null, image: null, following: false });
});
