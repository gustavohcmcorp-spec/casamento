import { test, expect } from '@playwright/test';

test('não conta linha de convidado totalmente vazia', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const counts = await page.evaluate(() => guestCounts({
    nome: '', familia: '', whats: '', ad: '', crAte5: '', cr6a10: '', cr11mais: '', pessoas: []
  }));
  expect(counts).toMatchObject({ adults: 0, total: 0 });
});

test('preserva um adulto para registro legado com conteúdo', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const counts = await page.evaluate(() => guestCounts({ nome: 'Maria', ad: '', crAte5: '' }));
  expect(counts).toMatchObject({ adults: 1, total: 1 });
});

test('desfazer fornecedor preserva pagamento e parcelas pagas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    DB.pagamentos = [];
    const category = DB.categorias.find(item => item.nome === '16A. Beleza da noiva');
    const option = category.opcoes[0];
    option.nome = 'Salão';
    option.valor = '1500';
    chooseSupplierOption(category, option, 0);
    DB.pagamentos[0].entradaValor = '300';
    DB.pagamentos[0].entradaStatus = 'Pago';
    DB.pagamentos[0].parcelasDetalhes = [{ numero: 1, valor: '600', status: 'Pago' }];
    unchooseSupplierOption(category);
    return DB.pagamentos[0] || null;
  });
  expect(result).toMatchObject({ forn: 'Salão', entradaStatus: 'Pago', vinculoFornecedor: '' });
  expect(result.parcelasDetalhes[0].status).toBe('Pago');
});

test('desfazer fornecedor preserva também pagamento ainda vazio', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    DB.pagamentos = [];
    const category = DB.categorias.find(item => item.nome === '16B. Beleza do noivo');
    const option = category.opcoes[0];
    option.nome = 'Barbearia';
    option.valor = '350';
    chooseSupplierOption(category, option, 0);
    const id = DB.pagamentos[0].id;
    unchooseSupplierOption(category);
    return { id, payments: DB.pagamentos };
  });
  expect(result.payments).toHaveLength(1);
  expect(result.payments[0]).toMatchObject({ id: result.id, forn: 'Barbearia', vinculoFornecedor: '' });
});

test('restauração inválida não substitui os dados atuais', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    DB.noiva = 'Dado preservado';
    DB.pagamentos[0].total = '9876';
    doRestore(JSON.stringify({ categorias: 'inválido' }));
    return { noiva: DB.noiva, total: DB.pagamentos[0].total };
  });
  expect(result).toEqual({ noiva: 'Dado preservado', total: '9876' });
});

test('restauração migra backup antigo antes de substituir o banco', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    doRestore(JSON.stringify({
      __v: 2,
      noiva: 'Gleicianne',
      noivo: 'Gustavo',
      categorias: defaultDB().categorias,
      convidados: [{ nome: 'Família Silva', conf: 'Pendente' }],
      pagamentos: [{ forn: 'Buffet', total: '5000' }]
    }));
    return { version: DB.__v, noiva: DB.config.noiva, guest: DB.convidados[0], payment: DB.pagamentos[0] };
  });
  expect(result.version).toBe(4);
  expect(result.noiva).toBe('Gleicianne');
  expect(result.guest.nome).toBe('Família Silva');
  expect(result.payment).toMatchObject({ forn: 'Buffet', total: '5000' });
});
