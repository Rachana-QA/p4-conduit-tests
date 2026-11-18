import { test, expect, APIRequestContext, Page } from '@playwright/test';

// Shared test data, kept in one place.
// Password has 8+ characters (API.md, "This app's rules": minimum is 8 characters).
const PASSWORD = 'Password123';

// app.js keeps the sign-in token in localStorage under this key.
const TOKEN_KEY = 'jwtToken';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// A short unique text, so names, emails and titles never clash between tests.
function uniqueId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// Signs up a new user with the API (POST /api/users) and returns the username and token.
async function signUp(request: APIRequestContext) {
  const username = `e2euser${uniqueId()}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, token: json.user.token as string };
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
// It finds them with the API, so it works even if the test failed before it knew the slug.
async function deleteArticlesBy(request: APIRequestContext, user: { username: string; token: string }) {
  // ASSUMPTION: a test user has fewer than 100 articles.
  const list = await request.get(`/api/articles?author=${encodeURIComponent(user.username)}&limit=100`);
  expect(list.status()).toBe(200);
  for (const a of (await list.json()).articles as { slug: string }[]) {
    const response = await request.delete(`/api/articles/${encodeURIComponent(a.slug)}`, { headers: authHeader(user.token) });
    expect(response.status()).toBe(204);
  }
}

// Deletes every comment by this user on this article (DELETE /api/articles/:slug/comments/:id, comment author only, 204).
async function deleteCommentsBy(request: APIRequestContext, slug: string, user: { username: string; token: string }) {
  const list = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(list.status()).toBe(200);
  const mine = ((await list.json()).comments as { id: unknown; author: { username: string } }[])
    .filter((c) => c.author.username === user.username);
  for (const c of mine) {
    const response = await request.delete(`/api/articles/${encodeURIComponent(slug)}/comments/${c.id}`, { headers: authHeader(user.token) });
    expect(response.status()).toBe(204);
  }
}

// Gives the page the token before any page code runs, so the page starts signed in.
async function signInPage(page: Page, token: string) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  );
}

test('a signed-in user publishes a new article in the editor, and the API has it saved', async ({ page, request }) => {
  const user = await signUp(request);
  cleanupSteps.push((req) => deleteArticlesBy(req, user));
  const id = uniqueId();
  const article = {
    title: `E2E article ${id}`,
    description: `E2E description ${id}`,
    body: `E2E body text ${id}`,
  };
  await signInPage(page, user.token);

  // The journey in the page.
  await page.goto('/');
  await page.getByRole('link', { name: 'New Article' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(article.title);
  await page.getByRole('textbox', { name: "What's this article about?" }).fill(article.description);
  await page.getByRole('textbox', { name: 'Write your article' }).fill(article.body);
  await page.getByRole('textbox', { name: 'Tags' }).fill('e2e, testing');
  await page.getByRole('button', { name: 'Publish Article' }).click();

  // The page opens the new article.
  await expect(page).toHaveURL(/\/article\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
  await expect(page.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText(['e2e', 'testing']);

  // The slug is the last part of the page address (app.js opens /article/<slug>).
  const slug = decodeURIComponent(new URL(page.url()).pathname.split('/').pop() as string);

  // Check with the API: exactly one article by this user, with this slug.
  const list = await request.get(`/api/articles?author=${encodeURIComponent(user.username)}`);
  expect(list.status()).toBe(200);
  const listJson = await list.json();
  expect(listJson.articlesCount).toBe(1);
  expect(listJson.articles[0].slug).toBe(slug);

  // Check with the API: the saved article has every value the user typed.
  const readBack = await request.get(`/api/articles/${encodeURIComponent(slug)}`);
  expect(readBack.status()).toBe(200);
  const saved = (await readBack.json()).article;
  expect(saved.slug).toBe(slug);
  expect(saved.title).toBe(article.title);
  expect(saved.description).toBe(article.description);
  expect(saved.body).toBe(article.body);
  // API.md: tags keep the order you sent them in. app.js splits the Tags field on commas and trims each tag.
  expect(saved.tagList).toEqual(['e2e', 'testing']);
  expect(saved.favorited).toBe(false);
  expect(saved.favoritesCount).toBe(0);
  expect(saved.createdAt).toMatch(ISO_DATE);
  expect(saved.updatedAt).toMatch(ISO_DATE);
  // ASSUMPTION: without a token, following is false (API.md does not say what it is for no signed-in user).
  expect(saved.author).toEqual({ username: user.username, bio: null, image: null, following: false });
});

test('a signed-in user posts a comment on an article, and the API has it saved', async ({ page, request }) => {
  // Set-up with the API: one user writes the article, a second user comments.
  const author = await signUp(request);
  const commenter = await signUp(request);
  // Added before the article is made, so it is deleted even if the create check fails.
  cleanupSteps.push((req) => deleteArticlesBy(req, author));
  const id = uniqueId();
  const created = await request.post('/api/articles', {
    headers: authHeader(author.token),
    data: { article: { title: `Article to comment on ${id}`, description: `Description ${id}`, body: `Body ${id}`, tagList: [] } },
  });
  expect(created.status()).toBe(201);
  const slug = (await created.json()).article.slug as string;
  // Clean-up runs newest first: the comment, then the article.
  cleanupSteps.push((req) => deleteCommentsBy(req, slug, commenter));
  const commentBody = `E2E comment ${id}`;
  await signInPage(page, commenter.token);

  // The journey in the page.
  await page.goto(`/article/${encodeURIComponent(slug)}`);
  await page.getByRole('textbox', { name: 'Write a comment' }).fill(commentBody);
  await page.getByRole('button', { name: 'Post Comment' }).click();

  // The page shows the one new comment, by the commenter, and an empty comment box again.
  const comments = page.getByRole('region', { name: 'Comments' }).getByRole('listitem');
  await expect(comments).toHaveCount(1);
  await expect(comments).toContainText(commentBody);
  await expect(comments).toContainText(commenter.username);
  await expect(page.getByRole('textbox', { name: 'Write a comment' })).toHaveValue('');

  // Check with the API: exactly one comment is saved, with the text and the author.
  const readBack = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(readBack.status()).toBe(200);
  const saved = (await readBack.json()).comments;
  expect(saved).toHaveLength(1);
  expect(saved[0].body).toBe(commentBody);
  // ASSUMPTION: API.md does not give the type of the comment id; the test only checks it is there.
  expect(saved[0].id).toBeDefined();
  expect(saved[0].createdAt).toMatch(ISO_DATE);
  expect(saved[0].updatedAt).toMatch(ISO_DATE);
  // ASSUMPTION: without a token, following is false (API.md does not say what it is for no signed-in user).
  expect(saved[0].author).toEqual({ username: commenter.username, bio: null, image: null, following: false });
});
