import { test, expect } from '@playwright/test';

test('fornecedor sem escolha permanece em pesquisa', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  expect(await page.evaluate(() => supplierReadiness(DB.categorias[0]).stage)).toBe('Em pesquisa');
});

test('fornecedor escolhido não aparece como contratado', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    DB.pagamentos=[];
    const category=DB.categorias[0], option=category.opcoes[0];
    option.nome='Espaço'; option.valor='5000';
    chooseSupplierOption(category,option,0);
    return supplierReadiness(category);
  });
  expect(result.stage).toBe('Escolhido');
  expect(result.pending).toContain('Confirmar contrato');
});

test('fornecedor contratado ainda mostra pendências operacionais', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    DB.pagamentos=[];
    const category=DB.categorias[0], option=category.opcoes[0];
    option.nome='Espaço'; option.valor='5000'; option.contratoStatus='Assinado';
    option.itens=(category.itens||[]).map(item => ({label:item.label,inc:'Sim',obs:''}));
    option.contratoPontos=(option.contratoPontos||[]).map(point => ({label:point.label,status:'Conferido',obs:''}));
    chooseSupplierOption(category,option,0);
    return supplierReadiness(category);
  });
  expect(result.stage).toBe('Contratado');
  expect(result.pending).toContain('Confirmar operação do dia');
});

test('fornecedor só fica pronto com contrato escopo financeiro e operação', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    DB.pagamentos=[];
    const category=DB.categorias[0], option=category.opcoes[0];
    option.nome='Espaço'; option.valor='5000'; option.contratoStatus='Assinado';
    option.itens=(category.itens||[]).map(item => ({label:item.label,inc:'Sim',obs:''}));
    option.contratoPontos=(option.contratoPontos||[]).map(point => ({label:point.label,status:'Conferido',obs:''}));
    chooseSupplierOption(category,option,0);
    category.operacaoConfirmada=true;
    return supplierReadiness(category);
  });
  expect(result).toMatchObject({stage:'Pronto',score:100,pending:[]});
});

test('categoria Não terá fica fora da prontidão', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    DB.categorias[0].naoTera='Não terá';
    return supplierReadiness(DB.categorias[0]);
  });
  expect(result).toMatchObject({stage:'Não se aplica',score:100,pending:[]});
});

test('dashboard separa escolhidos contratados e prontos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.pagamentos=[];
    const category=DB.categorias[0], option=category.opcoes[0];
    option.nome='Espaço'; option.valor='5000';
    chooseSupplierOption(category,option,0);
    renderInicio();
  });
  const summary=page.getByTestId('supplier-readiness');
  await expect(summary).toContainText('1 escolhido');
  await expect(summary).toContainText('0 contratados');
  await expect(summary).toContainText('0 prontos');
  await expect(summary).toContainText('Confirmar contrato');
});

test('fornecedores exibem estágio e confirmação operacional', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Fornecedores'}).click();
  await expect(page.getByRole('button',{name:/1\. Espaço de eventos.*Em pesquisa/})).toBeVisible();
  await page.getByRole('button',{name:/1\. Espaço de eventos/}).click();
  await expect(page.getByLabel('Operação do dia confirmada').first()).toBeVisible();
});

test('prioriza tarefa crítica quando os prazos são iguais', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.cronograma.forEach(phase => phase.tarefas.forEach(task => task.done=true));
    const tasks=DB.cronograma[0].tarefas.slice(0,2);
    tasks[0].done=false; tasks[0].prazo='2027-01-01'; tasks[0].prioridade='Normal';
    tasks[1].done=false; tasks[1].prazo='2027-01-01'; tasks[1].prioridade='Crítica';
    renderInicio();
  });
  const labels=await page.getByTestId('next-steps').locator('.ct').allTextContents();
  expect(labels[0]).toContain('lista preliminar');
  await expect(page.getByTestId('next-steps')).toContainText('1 tarefa crítica');
  await expect(page.getByTestId('next-steps')).toContainText('1 sem responsável');
});

test('cronograma permite definir prioridade e dependência', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Cronograma'}).click();
  await expect(page.getByLabel('Prioridade').first()).toBeVisible();
  await expect(page.getByPlaceholder('Depende de...').first()).toBeVisible();
});
