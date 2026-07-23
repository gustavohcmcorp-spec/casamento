import { test, expect } from '@playwright/test';

test('cria quatro categorias independentes para beleza e traje', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => ({
    version: defaultDB().__v,
    names: defaultDB().categorias.map(category => category.nome),
    count: defaultDB().categorias.length
  }));

  expect(result.version).toBe(4);
  expect(result.count).toBe(24);
  expect(result.names.slice(15, 19)).toEqual([
    '16A. Beleza da noiva',
    '16B. Beleza do noivo',
    '17A. Traje da noiva',
    '17B. Traje do noivo'
  ]);
  expect(result.names).toContain('18. Alianças');
});

test('migra fornecedores combinados para a noiva sem duplicar', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.categorias.splice(15, 4,
      {
        nome: '16. Beleza (noiva e noivo)',
        itens: [],
        opcoes: [{
          id: 'beleza-antiga',
          nome: 'Salão atual',
          pagamentoId: 'pag-beleza',
          pagamentoVinculo: 'categoria:16. Beleza (noiva e noivo)'
        }],
        opcaoEscolhida: 0,
        status: 'Reservado',
        obs: 'Manter'
      },
      {
        nome: '17. Traje dos noivos',
        itens: [],
        opcoes: [{
          id: 'traje-antigo',
          nome: 'Ateliê atual',
          pagamentoId: 'pag-traje',
          pagamentoVinculo: 'categoria:17. Traje dos noivos'
        }],
        opcaoEscolhida: 0,
        status: 'Contratado / pago',
        obs: 'Manter traje'
      }
    );
    legacy.pagamentos = [
      {
        id: 'pag-beleza',
        forn: 'Salão atual',
        vinculoFornecedor: 'categoria:16. Beleza (noiva e noivo)'
      },
      {
        id: 'pag-traje',
        forn: 'Ateliê atual',
        vinculoFornecedor: 'categoria:17. Traje dos noivos'
      }
    ];

    const first = migrateDB(legacy).data;
    const second = migrateDB(first);
    return { first, second };
  });

  expect(result.first.categorias).toHaveLength(24);
  expect(result.first.categorias[15]).toMatchObject({
    nome: '16A. Beleza da noiva',
    status: 'Reservado',
    obs: 'Manter',
    opcaoEscolhida: 0
  });
  expect(result.first.categorias[16]).toMatchObject({
    nome: '16B. Beleza do noivo',
    status: '',
    decisao: ''
  });
  expect(result.first.categorias[17]).toMatchObject({
    nome: '17A. Traje da noiva',
    status: 'Contratado / pago',
    obs: 'Manter traje',
    opcaoEscolhida: 0
  });
  expect(result.first.categorias[18]).toMatchObject({
    nome: '17B. Traje do noivo',
    status: '',
    decisao: ''
  });
  expect(result.first.pagamentos.map(payment => payment.vinculoFornecedor)).toEqual([
    'categoria:16A. Beleza da noiva',
    'categoria:17A. Traje da noiva'
  ]);
  expect(result.second.changed).toBe(false);
  expect(result.second.data).toEqual(result.first);
});

test('preserva tarefas da noiva e cria pendências datadas do noivo', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    const phase = legacy.cronograma.find(item => item.fase.includes('8 a 10 meses'));
    phase.tarefas = phase.tarefas.filter(task => ![
      'Escolher vestido da noiva',
      'Escolher traje do noivo',
      'Escolher vestido da noiva e traje do noivo (iniciar)'
    ].includes(task.t));
    phase.tarefas.push({
      t: 'Escolher vestido da noiva e traje do noivo (iniciar)',
      done: true,
      obs: 'Já resolvido'
    });

    return migrateDB(legacy).data.cronograma.flatMap(item => item.tarefas);
  });

  expect(result.find(task => task.t === 'Escolher vestido da noiva')).toMatchObject({
    done: true,
    obs: 'Já resolvido',
    prazo: '2026-10-31'
  });
  expect(result.find(task => task.t === 'Escolher traje do noivo')).toMatchObject({
    done: false,
    prazo: '2026-10-31'
  });
  expect(result.find(task => task.t === 'Contratar beleza da noiva')).toMatchObject({
    done: false,
    prazo: '2026-12-31'
  });
  expect(result.find(task => task.t === 'Fazer teste de cabelo e maquiagem da noiva')).toMatchObject({
    prazo: '2027-02-28'
  });
  expect(result.find(task => task.t === 'Reservar cabelo e barba do noivo')).toMatchObject({
    done: false,
    prazo: '2027-03-31'
  });
  expect(result.find(task => task.t === 'Concluir ajustes finais do traje do noivo')).toMatchObject({
    done: false,
    prazo: '2027-04-30'
  });
});

test('mostra a pendência mais urgente com prazo sugerido', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await page.evaluate(() => {
    DB.cronograma.forEach(phase => phase.tarefas.forEach(task => {
      task.done = true;
    }));
    const task = DB.cronograma
      .flatMap(phase => phase.tarefas)
      .find(item => item.t === 'Reservar cabelo e barba do noivo');
    if (task) task.done = false;
    renderInicio();
  });

  await expect(page.getByTestId('next-steps')).toContainText('Reservar cabelo e barba do noivo');
  await expect(page.getByTestId('next-steps')).toContainText('31/03/2027');
});

test('calcula progresso com 24 categorias e exclusão individual', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await expect(page.getByTestId('supplier-progress')).toContainText('0 de 24 escolhidos · 0%');

  await page.evaluate(() => {
    DB.categorias.find(category => category.nome === '16B. Beleza do noivo').naoTera = 'Não terá';
    renderInicio();
  });

  await expect(page.getByTestId('supplier-progress')).toContainText('0 de 23 escolhidos · 0%');
});

test('mantém pagamentos da noiva e do noivo independentes', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    DB.pagamentos = [ensurePayment({ forn: 'Beleza', total: '' })];
    const bride = DB.categorias.find(category => category.nome === '16A. Beleza da noiva');
    const groom = DB.categorias.find(category => category.nome === '16B. Beleza do noivo');
    bride.opcoes[0].nome = 'Salão da noiva';
    groom.opcoes[0].nome = 'Barbearia do noivo';

    chooseSupplierOption(bride, bride.opcoes[0], 0);
    const countAfterBride = DB.pagamentos.length;
    chooseSupplierOption(groom, groom.opcoes[0], 0);
    const before = DB.pagamentos.map(payment => ({
      forn: payment.forn,
      vinculo: payment.vinculoFornecedor
    }));
    unchooseSupplierOption(groom);

    return {
      countAfterBride,
      before,
      after: DB.pagamentos.map(payment => ({
        forn: payment.forn,
        vinculo: payment.vinculoFornecedor
      }))
    };
  });

  expect(result.countAfterBride).toBe(1);
  expect(result.before).toEqual([
    { forn: 'Salão da noiva', vinculo: 'categoria:16A. Beleza da noiva' },
    { forn: 'Barbearia do noivo', vinculo: 'categoria:16B. Beleza do noivo' }
  ]);
  expect(result.after).toEqual([
    { forn: 'Salão da noiva', vinculo: 'categoria:16A. Beleza da noiva' }
  ]);
});

test('escolher fornecedor não conclui a pendência manual', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const category = DB.categorias.find(item => item.nome === '16B. Beleza do noivo');
    const task = DB.cronograma
      .flatMap(phase => phase.tarefas)
      .find(item => item.t === 'Reservar cabelo e barba do noivo');
    category.opcoes[0].nome = 'Barbearia escolhida';
    task.done = false;
    chooseSupplierOption(category, category.opcoes[0], 0);
    return { chosen: category.opcaoEscolhida, taskDone: task.done };
  });

  expect(result).toEqual({ chosen: 0, taskDone: false });
});
