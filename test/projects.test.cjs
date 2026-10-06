require('reflect-metadata');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');
const { ProjectsModule } = require('../dist/projects/projects.module');
const { ProjectsService } = require('../dist/projects/projects.service');
const { PROJECTS_REPOSITORY } = require('../dist/projects/ports/projects.repository');
const { InMemoryProjectsRepository } = require('../dist/projects/repositories/in-memory-projects.repository');

let app;
let baseUrl;
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => { if (app) await app.close(); });

async function request(method, path = '', body) {
  const response = await fetch(`${baseUrl}/projects${path}`, {
    signal: AbortSignal.timeout(5000),
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test('HTTP: повний CRUD-цикл та часткове оновлення', async () => {
  assert.deepEqual(await request('GET'), { status: 200, body: [] });
  const created = await request('POST', '', { name: '  ПР 3  ', description: '  NestJS  ' });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'ПР 3');
  assert.equal(created.body.description, 'NestJS');
  assert.match(created.body.id, /^[0-9a-f-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(created.body.createdAt)));
  const path = `/${created.body.id}`;
  assert.deepEqual((await request('GET', path)).body, created.body);
  assert.deepEqual((await request('GET')).body, [created.body]);

  const updated = await request('PATCH', path, { name: '  Оновлений проєкт  ' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'Оновлений проєкт');
  assert.equal(updated.body.description, 'NestJS');
  assert.equal(updated.body.id, created.body.id);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  assert.ok(updated.body.updatedAt >= created.body.updatedAt);
  assert.equal((await request('PATCH', path, { description: '' })).body.description, '');

  assert.deepEqual(await request('DELETE', path), { status: 204, body: null });
  assert.equal((await request('GET', path)).status, 404);
  assert.deepEqual((await request('GET')).body, []);
});

test('HTTP: опис за замовчуванням та незалежність проєктів', async () => {
  const first = await request('POST', '', { name: 'First' });
  const second = await request('POST', '', { name: 'Second' });
  assert.equal(first.body.description, '');
  assert.notEqual(first.body.id, second.body.id);
  await request('DELETE', `/${first.body.id}`);
  assert.equal((await request('GET', `/${second.body.id}`)).body.name, 'Second');
  await request('DELETE', `/${second.body.id}`);
});

test('HTTP: невалідні DTO, UUID та порожній PATCH дають 400', async () => {
  for (const body of [{}, { name: '' }, { name: '   ' }, { name: 42 },
    { name: null }, { name: 'x'.repeat(121) }, { name: 'Test', id: 'forbidden' },
    { name: 'Test', description: null }, { name: 'Test', description: 1 },
    { name: 'Test', description: 'x'.repeat(2001) }]) {
    assert.equal((await request('POST', '', body)).status, 400, JSON.stringify(body));
  }
  const created = await request('POST', '', { name: 'Valid' });
  const path = `/${created.body.id}`;
  for (const body of [{}, { name: null }, { name: '  ' }, { description: null },
    { description: 42 }, { createdAt: 'forbidden' }, { name: 'x'.repeat(121) }]) {
    assert.equal((await request('PATCH', path, body)).status, 400);
  }
  assert.equal((await request('GET', path)).body.name, 'Valid');
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal((await request(method, '/invalid-id', method === 'PATCH' ? { name: 'x' } : undefined)).status, 400);
  }
  await request('DELETE', path);
});

test('HTTP: невідомий UUID дає 404 для читання, оновлення та видалення', async () => {
  const path = `/${randomUUID()}`;
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal((await request(method, path, method === 'PATCH' ? { name: 'x' } : undefined)).status, 404);
  }
});

test('DI: repository port можна підмінити без зміни сервісу', async () => {
  const stored = { id: randomUUID(), name: 'From fake repository' };
  const fake = {
    create: async (project) => project,
    findAll: async () => [stored],
    findOne: async (id) => id === stored.id ? stored : null,
    update: async () => null,
    remove: async () => false,
  };
  const module = await Test.createTestingModule({ imports: [ProjectsModule] })
    .overrideProvider(PROJECTS_REPOSITORY).useValue(fake).compile();
  try {
    const service = module.get(ProjectsService);
    assert.deepEqual(await service.findAll(), [stored]);
    assert.equal(await service.findOne(stored.id), stored);
    assert.equal((await service.create({ name: '  Test  ' })).name, 'Test');
    assert.throws(() => service.create({ name: '  ' }), { status: 400 });
    await assert.rejects(service.update(stored.id, {}), { status: 400 });
    await assert.rejects(service.findOne(randomUUID()), { status: 404 });
    await assert.rejects(service.update(stored.id, { name: 'Updated' }), { status: 404 });
    await assert.rejects(service.remove(stored.id), { status: 404 });
  } finally {
    await module.close();
  }
});

test('Repository: зміна повернутих об’єктів не змінює сховище', async () => {
  const repository = new InMemoryProjectsRepository();
  const source = { id: randomUUID(), name: 'Original', description: '', createdAt: 'now', updatedAt: 'now' };
  const created = await repository.create(source);
  source.name = 'Changed input';
  created.name = 'Changed output';
  const found = await repository.findOne(source.id);
  assert.equal(found.name, 'Original');
  found.name = 'Changed read';
  const all = await repository.findAll();
  all[0].name = 'Changed list';
  assert.equal((await repository.findOne(source.id)).name, 'Original');
  const updated = await repository.update(source.id, { name: 'Updated' });
  updated.name = 'Changed update output';
  assert.equal((await repository.findOne(source.id)).name, 'Updated');
  assert.equal(await repository.remove(source.id), true);
  assert.equal(await repository.remove(source.id), false);
  assert.equal(await repository.findOne(source.id), null);
  assert.equal(await repository.update(source.id, { name: 'Missing' }), null);
});
