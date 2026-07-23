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
