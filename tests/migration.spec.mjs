import { test, expect } from '@playwright/test';

test('migra dados v2 sem apagar nomes e convidados', async ({ page }) => {
  await page.goto('/index.html?test=1');

  const result = await page.evaluate(() => window.__test.migrateDB({
    __v: 2,
    noiva: 'Gleicianne',
    noivo: 'Gustavo',
    convidados: [{ nome: 'Família Silva', conf: 'Pendente' }]
  }));

  expect(result.data.__v).toBe(4);
  expect(result.data.config.noiva).toBe('Gleicianne');
  expect(result.data.config.noivo).toBe('Gustavo');
  expect(result.data.convidados[0].nome).toBe('Família Silva');
  expect(result.data.convidados[0].id).toMatch(/^con_/);
});

test('a migração v3 é idempotente', async ({ page }) => {
  await page.goto('/index.html?test=1');

  const result = await page.evaluate(() => {
    const first = window.__test.migrateDB({ __v: 2, convidados: [] }).data;
    const second = window.__test.migrateDB(first);
    return { first, second };
  });

  expect(result.second.changed).toBe(false);
  expect(result.second.data).toEqual(result.first);
});

test('migra crianças legadas para 6+ e normaliza famílias', async ({ page }) => {
  await page.goto('/index.html?test=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.convidados = [{ nome: 'Família', ad: '2', cr: '3', grupo: 'F | Noiva' }];
    const migrated = migrateDB(legacy);
    return { guest: migrated.data.convidados[0], counts: guestCounts(migrated.data.convidados[0]), changed: migrated.changed };
  });

  expect(result.changed).toBe(true);
  expect(result.guest).toMatchObject({ crAte5: '', crMais5: '3', grupo: 'Noiva' });
  expect(result.counts).toMatchObject({ adults: 2, childrenUnder5: 0, children6Plus: 3, children: 3, total: 5 });
});

test('migra crianças 6+ para 11+ e preserva seus nomes para realocação', async ({ page }) => {
  await page.goto('/index.html?test=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.convidados = [{ nome: 'Família', ad: '1', crMais5: '2', pessoas: [
      { tipo: 'Adulto', nome: 'Ana' },
      { tipo: 'Criança 6+', nome: 'Bia' },
      { tipo: 'Criança 6+', nome: 'Caio' }
    ] }];
    const guest = migrateDB(legacy).data.convidados[0];
    return { guest, counts: guestCounts(guest) };
  });

  expect(result.guest).toMatchObject({ cr6a10: '', cr11mais: '2' });
  expect(result.guest.pessoas.map(person => person.nome)).toEqual(['Ana', 'Bia', 'Caio']);
  expect(result.guest.pessoas.map(person => person.tipo)).toEqual(['Adulto', 'Criança 11+', 'Criança 11+']);
  expect(result.counts).toMatchObject({ adults: 1, childrenUnder5: 0, children6To10: 0, children11Plus: 2, total: 3 });
});

test('configura a regra etária do JF Churrasco sem substituir regra já personalizada', async ({ page }) => {
  await page.goto('/index.html?test=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.categorias = [{nome:'2. Buffet / comida',opcoes:[{nome:'JF CHURRASCO',tipoCobranca:'porPessoa',valorUnitario:'112'}]}];
    legacy.pagamentos = [{forn:'JF CHURRASCO',tipoCobranca:'porPessoa',valorUnitario:'112'}];
    const migrated = migrateDB(legacy).data;
    return {supplier:migrated.categorias.find(category => category.nome==='2. Buffet / comida').opcoes[0],payment:migrated.pagamentos[0]};
  });

  expect(result.supplier).toMatchObject({tipoCobranca:'porFaixa',valorAdulto:'112',valorAte5:'0',valor6a10:'56',valor11mais:'112'});
  expect(result.payment).toMatchObject({tipoCobranca:'porFaixa',valorAdulto:'112',valorAte5:'0',valor6a10:'56',valor11mais:'112'});
});

test('completa dados v3 antigos e neutraliza textos prescritivos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    delete legacy.preferenciasNoivos;
    legacy.cronograma[0].tarefas[0].t = 'Definir estilo, nº de convidados (~60) e orçamento (meta R$30 mil / teto R$60 mil)';
    legacy.cronograma[1].tarefas[0].t = 'Fechar o buffet com degustação e contrato (parrilla + costela fogo de chão)';
    legacy.diad[9].ativ = 'Início do jantar (parrilla / costela fogo de chão)';
    const migrated = migrateDB(legacy);
    DB = migrated.data;
    renderNoivos();
    return { migrated, docsVisible: !!document.querySelector('.tab[data-tab="noivos"] h2') };
  });

  expect(result.migrated.changed).toBe(true);
  expect(result.migrated.data.preferenciasNoivos.buffet).toBeTruthy();
  expect(result.migrated.data.cronograma[0].tarefas[0].t).toBe('Definir estilo e prioridades do casamento');
  expect(result.migrated.data.cronograma[1].tarefas[0].t).toBe('Fechar buffet, degustação e contrato');
  expect(result.migrated.data.diad[9].ativ).toBe('Início do jantar');
  expect(result.docsVisible).toBe(true);
});

test('migra a data antiga em cronograma e mensagens personalizadas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.cronograma[0].tarefas[0].t = 'Confirmar a data: 15/05/2027';
    legacy.cronograma[9].fase = 'Dia 15/05/2027 — Dia D';
    legacy.mensagens.convite = 'Esperamos você em 15 de maio de 2027 (15/05/2027).';
    return migrateDB(legacy);
  });

  expect(result.changed).toBe(true);
  expect(result.data.cronograma[0].tarefas[0].t).toBe('Confirmar a data: 29/05/2027');
  expect(result.data.cronograma[9].fase).toBe('Dia 29/05/2027 — Dia D');
  expect(result.data.mensagens.convite).toBe('Esperamos você em 29 de maio de 2027 (29/05/2027).');
  expect(JSON.stringify(result.data)).not.toContain('15/05/2027');
});

test('salva no Firebase a normalização recebida com a data antiga', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const written = await page.evaluate(async () => {
    let listener;
    let persisted = null;
    makeSyncService(
      {},
      () => 'casamento/shared',
      (_root, callback) => { listener = callback; },
      async (_root, data) => { persisted = data; }
    );
    const legacy = defaultDB();
    legacy.cronograma[9].fase = 'Dia 15/05/2027 — Dia D';
    listener({ exists: () => true, val: () => legacy });
    await new Promise(resolve => setTimeout(resolve, 0));
    return persisted;
  });

  expect(written.cronograma[9].fase).toBe('Dia 29/05/2027 — Dia D');
});

test('carregamento local migra dados v2 automaticamente', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('casamento_2027_goiania_v2', JSON.stringify({
      __v: 2,
      noiva: 'Gleicianne',
      noivo: 'Gustavo',
      convidados: [{ nome: 'Família Silva', conf: 'Pendente' }]
    }));
  });

  await page.goto('/index.html?test=1');

  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem('casamento_2027_goiania_v2')
  ));

  expect(saved.__v).toBe(4);
  expect(saved.config.noiva).toBe('Gleicianne');
  expect(saved.convidados[0].id).toMatch(/^con_/);
});
