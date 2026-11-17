import { test, expect, APIRequestContext } from '@playwright/test';

// Field lists from API.md.
// User: {"user":{"email","token","username","bio","image"}}
const USER_KEYS = ['bio', 'email', 'image', 'token', 'username'];
// Article: {"article":{"slug","title","description","body","tagList","createdAt","updatedAt","favorited","favoritesCount","author"}}
const ARTICLE_KEYS = [
  'author',
  'body',
  'createdAt',
  'description',
  'favorited',
  'favoritesCount',
  'slug',
  'tagList',
  'title',
  'updatedAt',
];
// Profile: {"profile":{"username","bio","image","following"}}; author is a Profile without the wrapper.
const PROFILE_KEYS = ['bio', 'following', 'image', 'username'];

// Dates are ISO 8601 text, for example 2026-01-05T12:00:00.000Z.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function sortedKeys(value: object): string[] {
  return Object.keys(value).sort();
}

// Sign up a new user with unique names. Returns the user and the token.
async function signUp(request: APIRequestContext, name: string) {
  const unique = `${name}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = {
    username: unique,
    email: `${unique}@example.com`,
    password: 'password123',
  };
  const response = await request.post('/api/users', { data: { user } });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { ...user, token: json.user.token as string };
}

// Create an article as the given user. Returns the slug.
async function createArticle(request: APIRequestContext, token: string) {
  const article = {
    title: `Contract test ${Date.now()}`,
    description: 'An article for the contract tests',
    body: 'This is the body of the article.',
    tagList: ['testing', 'api'],
  };
  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${token}` },
    data: { article },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { ...article, slug: json.article.slug as string };
}

test.describe('Schema checks', () => {
  test('GET /api/articles/:slug answers with the Article shape', async ({ request }) => {
    const author = await signUp(request, 'author');
    const article = await createArticle(request, author.token);

    const response = await request.get(`/api/articles/${article.slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();

    // Required fields and data types.
    expect(json).toMatchObject({
      article: {
        slug: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        body: expect.any(String),
        tagList: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: {
          username: expect.any(String),
          // A new user has bio and image set to null.
          bio: null,
          image: null,
          following: expect.any(Boolean),
        },
      },
    });

    // No unexpected fields.
    expect(sortedKeys(json)).toEqual(['article']);
    expect(sortedKeys(json.article)).toEqual(ARTICLE_KEYS);
    expect(sortedKeys(json.article.author)).toEqual(PROFILE_KEYS);

    // tagList is a list of text values.
    for (const tag of json.article.tagList) {
      expect(tag).toEqual(expect.any(String));
    }

    // Dates are ISO 8601 text.
    expect(json.article.createdAt).toMatch(ISO_DATE);
    expect(json.article.updatedAt).toMatch(ISO_DATE);

    // The answer is the article we created.
    expect(json.article).toMatchObject({
      slug: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      author: { username: author.username },
    });
  });

  test('GET /api/user answers with the User shape', async ({ request }) => {
    const user = await signUp(request, 'reader');

    const response = await request.get('/api/user', {
      headers: { Authorization: `Token ${user.token}` },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();

    // Required fields and data types.
    expect(json).toMatchObject({
      user: {
        email: expect.any(String),
        token: expect.any(String),
        username: expect.any(String),
        // A new user has bio and image set to null.
        bio: null,
        image: null,
      },
    });

    // No unexpected fields.
    expect(sortedKeys(json)).toEqual(['user']);
    expect(sortedKeys(json.user)).toEqual(USER_KEYS);

    // The answer is the signed-in user.
    expect(json.user).toMatchObject({
      email: user.email,
      username: user.username,
    });
  });
});

test.describe('Auth checks', () => {
  test('GET /api/user without a token answers 401 "is missing"', async ({ request }) => {
    const response = await request.get('/api/user');

    expect(response.status()).toBe(401);
    const json = await response.json();

    expect(json).toMatchObject({
      errors: { token: expect.any(Array) },
    });
    expect(sortedKeys(json)).toEqual(['errors']);
    expect(sortedKeys(json.errors)).toEqual(['token']);
    expect(json.errors.token).toEqual(['is missing']);
  });

  test('GET /api/user with a wrong token answers 401 "is invalid"', async ({ request }) => {
    const response = await request.get('/api/user', {
      headers: { Authorization: 'Token this-is-not-a-real-token' },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();

    expect(json).toMatchObject({
      errors: { token: expect.any(Array) },
    });
    expect(sortedKeys(json)).toEqual(['errors']);
    expect(sortedKeys(json.errors)).toEqual(['token']);
    expect(json.errors.token).toEqual(['is invalid']);
  });

  test("PUT /api/articles/:slug on someone else's article answers 403 and changes nothing", async ({
    request,
  }) => {
    const author = await signUp(request, 'owner');
    const other = await signUp(request, 'intruder');
    const article = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${article.slug}`, {
      headers: { Authorization: `Token ${other.token}` },
      data: { article: { title: 'Changed by someone else' } },
    });

    expect(response.status()).toBe(403);
    const json = await response.json();

    expect(json).toMatchObject({
      errors: { article: expect.any(Array) },
    });
    expect(sortedKeys(json)).toEqual(['errors']);
    expect(sortedKeys(json.errors)).toEqual(['article']);
    expect(json.errors.article).toEqual(['forbidden']);

    // The article stays as it was.
    const check = await request.get(`/api/articles/${article.slug}`);
    expect(check.status()).toBe(200);
    const checkJson = await check.json();
    expect(checkJson.article.title).toBe(article.title);
  });
});
