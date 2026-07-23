# Prontidão de Fornecedores e Tarefas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguir fornecedor pesquisado, escolhido, contratado e realmente pronto, exibindo pendências objetivas sem alterar decisões já preenchidas.

**Architecture:** Adicionar funções derivadas de prontidão sobre o esquema atual, evitando gravar estados calculáveis ou sobrescrever `status`. A migração apenas completa campos ausentes. Dashboard e cartões consomem o mesmo cálculo central para não divergirem.

**Tech Stack:** HTML/CSS/JavaScript, Firebase Realtime Database, localStorage, Playwright 1.54.1, pnpm.

## Global Constraints

- Nenhum campo existente será apagado ou reinterpretado silenciosamente.
- O estado antigo `status` continua preservado e editável.
- Prontidão é calculada a partir de evidências, não marcada automaticamente como concluída.
- “Não terá” continua fora dos denominadores.
- Toda mudança começa por teste falhando e termina com a suíte completa verde.

---

### Task 1: Criar cálculo central de prontidão

**Files:**
- Create: `tests/readiness.spec.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: categoria, proposta escolhida, pagamento vinculado e contrato.
- Produces: `supplierReadiness(category): {stage,score,checks,pending}`.

- [ ] **Step 1: Escrever os testes falhando**

```javascript
test('fornecedor sem escolha permanece em pesquisa', async ({page}) => {
  await page.goto('/index.html?test=1&authenticated=1');
  expect(await page.evaluate(() => supplierReadiness(DB.categorias[0]).stage)).toBe('Em pesquisa');
});

test('fornecedor só fica pronto com contrato escopo financeiro e operação', async ({page}) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    const cat=DB.categorias[0], option=cat.opcoes[0];
    option.nome='Espaço'; option.valor='5000'; option.contratoStatus='Assinado';
    option.itens.forEach(item => item.inc='Sim');
    option.contratoPontos.forEach(point => point.status='Conferido');
    chooseSupplierOption(cat,option,0);
    cat.operacaoConfirmada=true;
    return supplierReadiness(cat);
  });
  expect(result).toMatchObject({stage:'Pronto',score:100,pending:[]});
});
```

- [ ] **Step 2: Confirmar RED**

Run: `pnpm exec playwright test readiness.spec.mjs`

Expected: FAIL porque `supplierReadiness` não existe.

- [ ] **Step 3: Implementar cálculo único**

```javascript
function supplierReadiness(cat){
  if(cat.naoTera==='Não terá')return {stage:'Não se aplica',score:100,checks:[],pending:[]};
  var option=cat.opcoes&&cat.opcoes[cat.opcaoEscolhida],pending=[];
  if(!option)pending.push('Escolher fornecedor');
  if(option&&option.contratoStatus!=='Assinado'&&option.contratoStatus!=='N/A')pending.push('Confirmar contrato');
  if(option&&(option.itens||[]).some(item => item.inc!=='Sim'&&item.inc!=='N/A'))pending.push('Resolver itens do escopo');
  if(option&&(option.contratoPontos||[]).some(point => point.status!=='Conferido'&&point.status!=='N/A'))pending.push('Conferir pontos críticos');
  var payment=option&&(DB.pagamentos||[]).find(item => item.id===option.pagamentoId||item.vinculoFornecedor==='categoria:'+cat.nome);
  if(option&&(!payment||paymentCommitted(payment)<=0))pending.push('Definir valor financeiro');
  if(option&&!cat.operacaoConfirmada)pending.push('Confirmar operação do dia');
  var total=6,done=total-pending.length,score=Math.max(0,Math.round(done/total*100));
  var stage=!option?'Em pesquisa':pending.length===0?'Pronto':option.contratoStatus==='Assinado'?'Contratado':'Escolhido';
  return {stage:stage,score:score,pending:pending};
}
```

- [ ] **Step 4: Testar estados intermediários e compatibilidade**

Run: `pnpm exec playwright test readiness.spec.mjs suppliers-split.spec.mjs`

Expected: pesquisa, escolhido, contratado, pronto e não aplicável passam; estados antigos permanecem.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/readiness.spec.mjs
git commit -m "feat: calcular prontidao real de fornecedores"
```

### Task 2: Exibir prontidão e alertas acionáveis

**Files:**
- Modify: `tests/readiness.spec.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `supplierReadiness(category)`.
- Produces: resumo do dashboard e chips nos cartões de fornecedores.

- [ ] **Step 1: Escrever testes do dashboard**

```javascript
test('dashboard separa escolhidos contratados e prontos', async ({page}) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    const cat=DB.categorias[0], option=cat.opcoes[0];
    option.nome='Espaço'; option.valor='5000';
    chooseSupplierOption(cat,option,0); renderInicio();
  });
  await expect(page.getByTestId('supplier-readiness')).toContainText('1 escolhido');
  await expect(page.getByTestId('supplier-readiness')).toContainText('0 prontos');
});
```

- [ ] **Step 2: Confirmar RED**

Run: `pnpm exec playwright test readiness.spec.mjs -g "dashboard separa"`

Expected: FAIL porque `supplier-readiness` não existe.

- [ ] **Step 3: Implementar resumo derivado**

Adicionar ao dashboard contadores de escolhidos, contratados e prontos, percentual de prontidão média e a principal pendência de cada fornecedor escolhido. Manter o indicador antigo de escolhidos para compatibilidade.

- [ ] **Step 4: Implementar chips e operação confirmada**

No título de cada categoria, exibir o estágio calculado. Dentro da decisão, adicionar checkbox `Operação do dia confirmada`, com explicação de endereço, horário, responsável e quantidade final alinhados.

- [ ] **Step 5: Testar alertas vizinhos**

Run: `pnpm exec playwright test readiness.spec.mjs app.spec.mjs -g "pront|contrato|alerta|fornecedor"`

Expected: alertas existentes e novos usam o mesmo cálculo sem duplicar categorias “Não terá”.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/readiness.spec.mjs
git commit -m "feat: mostrar prontidao e pendencias de fornecedores"
```

### Task 3: Priorizar tarefas críticas e responsáveis

**Files:**
- Modify: `tests/readiness.spec.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: tarefas de cronograma com `prioridade`, `resp`, `prazo` e `dependencia` opcionais.
- Produces: `taskPriority(task): number` e próximos passos ordenados por vencimento e criticidade.

- [ ] **Step 1: Escrever teste de ordenação crítica**

```javascript
test('prioriza tarefa crítica quando os prazos são iguais', async ({page}) => {
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
});
```

- [ ] **Step 2: Confirmar RED**

Run: `pnpm exec playwright test readiness.spec.mjs -g "prioriza tarefa crítica"`

Expected: FAIL porque a ordenação usa apenas prazo e posição.

- [ ] **Step 3: Implementar prioridade compatível**

```javascript
function taskPriority(task){return task.prioridade==='Crítica'?0:task.prioridade==='Alta'?1:task.prioridade==='Normal'?2:3;}
```

Ordenar por prazo, depois `taskPriority`, depois posição original. Adicionar seletor `Crítica`, `Alta`, `Normal`, `Opcional` e campo de dependência no cronograma, preservando tarefas antigas sem esses campos.

- [ ] **Step 4: Mostrar riscos no dashboard**

Exibir quantidades de tarefas críticas pendentes, vencidas e sem responsável. Não alterar automaticamente `done`.

- [ ] **Step 5: Executar suíte completa e revisão visual**

Run: `pnpm test`

Expected: todos os testes passam. Validar desktop e celular nas abas Início, Cronograma e Fornecedores.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/readiness.spec.mjs
git commit -m "feat: priorizar tarefas criticas e responsaveis"
```

