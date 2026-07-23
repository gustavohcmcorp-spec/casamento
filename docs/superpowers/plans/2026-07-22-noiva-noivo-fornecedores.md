# Fornecedores da Noiva e do Noivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir Beleza e Traje em fornecedores independentes para Noiva e Noivo, migrando dados existentes para a Noiva e refletindo as novas pendências no cronograma, no painel e nos pagamentos.

**Architecture:** Manter a aplicação estática e monolítica em `index.html`, acrescentando uma normalização idempotente executada por `migrateDB`. Os testes Playwright exercitarão diretamente as funções expostas no modo local e a interface renderizada, cobrindo dados legados, métricas, tarefas e pagamentos.

**Tech Stack:** HTML, CSS e JavaScript sem framework; LocalStorage/Firebase já existentes; Playwright 1.54.1; pnpm.

## Global Constraints

- Os dados combinados existentes ficam com a Noiva; as categorias do Noivo começam vazias e pendentes.
- O total-base de fornecedores passa de 22 para 24, com exclusão individual de cada categoria marcada como `Não terá`.
- Conclusão de tarefa permanece manual e não é acionada pela escolha de fornecedor.
- Alianças e categorias posteriores mantêm sua numeração atual.
- A migração não pode duplicar categorias, tarefas ou pagamentos quando executada novamente.
- Não haverá redesenho das outras abas nem refatoração ampla do arquivo principal.

---

### Task 1: Testes de migração e categorias padrão

**Files:**
- Create: `tests/suppliers-split.spec.mjs`
- Modify: `index.html` (`SCHEMA_VERSION`, `defaultDB`, `normalizeWeddingContent` e auxiliares de migração)
- Create: `pnpm-lock.yaml` (gerado pelo gerenciador de pacotes)

**Interfaces:**
- Consumes: `defaultDB()`, `migrateDB(raw)` e `window.__test` existentes.
- Produces: `splitBrideGroomSuppliers(data, defaults): boolean`, quatro categorias nomeadas e esquema de dados versão 4.

- [ ] **Step 1: Escrever testes que falham para as quatro categorias e a preservação dos dados antigos**

```javascript
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
    '16A. Beleza da noiva', '16B. Beleza do noivo',
    '17A. Traje da noiva', '17B. Traje do noivo'
  ]);
  expect(result.names).toContain('18. Alianças');
});

test('migra fornecedores combinados para a noiva sem duplicar', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    const legacy = defaultDB();
    legacy.__v = 3;
    legacy.categorias.splice(15, 4,
      { nome:'16. Beleza (noiva e noivo)', itens:[], opcoes:[{id:'beleza-antiga',nome:'Salão atual',pagamentoId:'pag-beleza',pagamentoVinculo:'categoria:16. Beleza (noiva e noivo)'}], opcaoEscolhida:0, status:'Reservado', obs:'Manter' },
      { nome:'17. Traje dos noivos', itens:[], opcoes:[{id:'traje-antigo',nome:'Ateliê atual',pagamentoId:'pag-traje',pagamentoVinculo:'categoria:17. Traje dos noivos'}], opcaoEscolhida:0, status:'Contratado / pago', obs:'Manter traje' }
    );
    legacy.pagamentos=[
      {id:'pag-beleza',forn:'Salão atual',vinculoFornecedor:'categoria:16. Beleza (noiva e noivo)'},
      {id:'pag-traje',forn:'Ateliê atual',vinculoFornecedor:'categoria:17. Traje dos noivos'}
    ];
    const first=migrateDB(legacy).data;
    const second=migrateDB(first);
    return {first,second};
  });
  expect(result.first.categorias).toHaveLength(24);
  expect(result.first.categorias[15]).toMatchObject({nome:'16A. Beleza da noiva',status:'Reservado',obs:'Manter',opcaoEscolhida:0});
  expect(result.first.categorias[16]).toMatchObject({nome:'16B. Beleza do noivo',status:'',decisao:''});
  expect(result.first.categorias[17]).toMatchObject({nome:'17A. Traje da noiva',status:'Contratado / pago',obs:'Manter traje',opcaoEscolhida:0});
  expect(result.first.categorias[18]).toMatchObject({nome:'17B. Traje do noivo',status:'',decisao:''});
  expect(result.first.pagamentos.map(payment => payment.vinculoFornecedor)).toEqual([
    'categoria:16A. Beleza da noiva', 'categoria:17A. Traje da noiva'
  ]);
  expect(result.second.changed).toBe(false);
  expect(result.second.data).toEqual(result.first);
});
```

- [ ] **Step 2: Instalar dependências e executar o teste para confirmar a falha**

Run: `pnpm install && pnpm exec playwright test tests/suppliers-split.spec.mjs`

Expected: FAIL porque a base ainda contém 22 categorias combinadas e esquema versão 3.

- [ ] **Step 3: Criar os padrões separados e a migração idempotente**

Em `defaultDB()`, trocar as duas chamadas combinadas por quatro chamadas `CAT(...)`, usando os nomes aprovados e as listas específicas da especificação. Definir `__v:4` e `SCHEMA_VERSION=4`.

Adicionar a normalização estrutural antes de `normalizeWeddingContent`:

```javascript
function splitBrideGroomSuppliers(data,defaults){
  var changed=false, categories=data.categorias||(data.categorias=[]);
  function byName(name){return categories.find(function(category){return category&&category.nome===name;});}
  function defaultCategory(name){return JSON.parse(JSON.stringify(defaults.categorias.find(function(category){return category.nome===name;})));}
  function migratePair(legacyName,brideName,groomName){
    var bride=byName(brideName), legacy=byName(legacyName), groom=byName(groomName);
    if(!bride&&legacy){bride=legacy;bride.nome=brideName;changed=true;}
    if(!bride){bride=defaultCategory(brideName);categories.push(bride);changed=true;}
    var brideDefaults=defaultCategory(brideName);
    bride.itens=brideDefaults.itens;
    if(!Array.isArray(bride.opcoes))bride.opcoes=brideDefaults.opcoes;
    if(!groom){groom=defaultCategory(groomName);categories.splice(categories.indexOf(bride)+1,0,groom);changed=true;}
  }
  migratePair('16. Beleza (noiva e noivo)','16A. Beleza da noiva','16B. Beleza do noivo');
  migratePair('17. Traje dos noivos','17A. Traje da noiva','17B. Traje do noivo');
  var order=defaults.categorias.map(function(category){return category.nome;});
  categories.sort(function(a,b){return order.indexOf(a.nome)-order.indexOf(b.nome);});
  var links={
    'categoria:16. Beleza (noiva e noivo)':'categoria:16A. Beleza da noiva',
    'categoria:17. Traje dos noivos':'categoria:17A. Traje da noiva'
  };
  categories.forEach(function(category){(category.opcoes||[]).forEach(function(option){if(links[option.pagamentoVinculo]){option.pagamentoVinculo=links[option.pagamentoVinculo];changed=true;}});});
  (data.pagamentos||[]).forEach(function(payment){if(links[payment.vinculoFornecedor]){payment.vinculoFornecedor=links[payment.vinculoFornecedor];changed=true;}});
  return changed;
}
```

Chamar `splitBrideGroomSuppliers(data,defaults)` dentro de `normalizeWeddingContent` e incorporar o retorno a `changed`.

- [ ] **Step 4: Executar os testes de migração**

Run: `pnpm exec playwright test tests/suppliers-split.spec.mjs`

Expected: PASS nos dois testes de categorias e migração.

- [ ] **Step 5: Registrar a etapa**

```bash
git add index.html tests/suppliers-split.spec.mjs pnpm-lock.yaml
git commit -m "Separa fornecedores da noiva e do noivo"
```

### Task 2: Cronograma, prazos e próximos passos

**Files:**
- Modify: `tests/suppliers-split.spec.mjs`
- Modify: `index.html` (`defaultDB().cronograma`, `normalizeWeddingContent` e auxiliar de tarefas)

**Interfaces:**
- Consumes: `migrateDB(raw)`, `countTasks()` e a renderização existente de `next-steps`.
- Produces: `splitBrideGroomTasks(data, defaults): boolean` com tarefas manuais e prazos ISO editáveis.

- [ ] **Step 1: Acrescentar testes que falham para tarefas, estado antigo e datas**

```javascript
test('preserva tarefas da noiva e cria pendências datadas do noivo', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    const legacy=defaultDB(); legacy.__v=3;
    legacy.cronograma=legacy.cronograma.map(phase => ({...phase,tarefas:phase.tarefas.map(task => ({...task}))}));
    const combined=legacy.cronograma.flatMap(phase => phase.tarefas).find(task => task.t==='Escolher vestido da noiva e traje do noivo (iniciar)');
    combined.done=true; combined.obs='Já resolvido';
    const migrated=migrateDB(legacy).data;
    return migrated.cronograma.flatMap(phase => phase.tarefas);
  });
  expect(result.find(task => task.t==='Escolher vestido da noiva')).toMatchObject({done:true,obs:'Já resolvido',prazo:'2026-10-31'});
  expect(result.find(task => task.t==='Escolher traje do noivo')).toMatchObject({done:false,prazo:'2026-10-31'});
  expect(result.find(task => task.t==='Contratar beleza da noiva')).toMatchObject({done:false,prazo:'2026-12-31'});
  expect(result.find(task => task.t==='Reservar cabelo e barba do noivo')).toMatchObject({done:false,prazo:'2027-03-31'});
  expect(result.find(task => task.t==='Concluir ajustes finais do traje do noivo')).toMatchObject({done:false,prazo:'2027-04-30'});
});

test('mostra a pendência mais urgente com prazo sugerido', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.cronograma.forEach(phase => phase.tarefas.forEach(task => {task.done=true;}));
    const task=DB.cronograma.flatMap(phase => phase.tarefas).find(item => item.t==='Reservar cabelo e barba do noivo');
    task.done=false; renderInicio();
  });
  await expect(page.getByTestId('next-steps')).toContainText('Reservar cabelo e barba do noivo');
  await expect(page.getByTestId('next-steps')).toContainText('31/03/2027');
});
```

- [ ] **Step 2: Executar os novos testes para confirmar a falha**

Run: `pnpm exec playwright test tests/suppliers-split.spec.mjs -g "tarefas|pendência"`

Expected: FAIL porque as tarefas ainda estão combinadas e não possuem os prazos aprovados.

- [ ] **Step 3: Implementar a divisão idempotente das tarefas**

Adicionar `splitBrideGroomTasks(data,defaults)` para localizar tarefas por texto, renomear a tarefa combinada preservando `done` e `obs`, aplicar os prazos aprovados e inserir somente quando ausentes:

```javascript
function splitBrideGroomTasks(data){
  var changed=false;
  function phaseTasks(fragment){var phase=(data.cronograma||[]).find(function(item){return item.fase.indexOf(fragment)>=0;});return phase?phase.tarefas:[];}
  function rename(tasks,oldText,newText,due){var task=tasks.find(function(item){return item.t===oldText||item.t===newText;});if(task&&task.t!==newText){task.t=newText;changed=true;}if(task&&task.prazo!==due){task.prazo=due;changed=true;}return task;}
  function add(tasks,text,due){if(!tasks.some(function(item){return item.t===text;})){tasks.push({t:text,done:false,obs:'',prazo:due});changed=true;}}
  var eight=phaseTasks('8 a 10 meses'), six=phaseTasks('6 a 8 meses'), three=phaseTasks('3 meses'), one=phaseTasks('1 mês'), week=phaseTasks('1 semana');
  rename(eight,'Escolher vestido da noiva e traje do noivo (iniciar)','Escolher vestido da noiva','2026-10-31');
  add(eight,'Escolher traje do noivo','2026-10-31');
  add(six,'Contratar beleza da noiva','2026-12-31');
  rename(six,'Fazer teste de beleza (cabelo e maquiagem)','Fazer teste de cabelo e maquiagem da noiva','2027-02-28');
  add(three,'Reservar cabelo e barba do noivo','2027-03-31');
  rename(three,'Prova do vestido / ajustes','Fazer prova e ajustes do vestido da noiva','2027-04-30');
  rename(one,'Última prova de vestido / traje','Concluir ajustes finais do vestido da noiva','2027-04-30');
  add(one,'Concluir ajustes finais do traje do noivo','2027-04-30');
  add(week,'Confirmar horários, endereços e transporte da noiva','2027-05-24');
  add(week,'Confirmar horários, endereços e transporte do noivo','2027-05-24');
  return changed;
}
```

Chamar o auxiliar dentro de `normalizeWeddingContent`. Atualizar `defaultDB().cronograma` com o mesmo conjunto final para instalações novas, sem vincular `done` à escolha de fornecedores.

- [ ] **Step 4: Executar testes de cronograma e migração**

Run: `pnpm exec playwright test tests/suppliers-split.spec.mjs`

Expected: PASS em migração, datas e próximos passos.

- [ ] **Step 5: Registrar a etapa**

```bash
git add index.html tests/suppliers-split.spec.mjs
git commit -m "Atualiza pendencias da noiva e do noivo"
```

### Task 3: Métricas e pagamentos independentes

**Files:**
- Modify: `tests/suppliers-split.spec.mjs`
- Modify: `index.html` (`chooseSupplierOption`, `unchooseSupplierOption` e prefixo de nomes de categorias)

**Interfaces:**
- Consumes: categorias migradas, `ensurePayment`, `renderInicio` e `renderFornecedores`.
- Produces: vínculos `categoria:<nome completo>` independentes e painel com denominador 24.

- [ ] **Step 1: Acrescentar testes que falham para percentual, `Não terá` e pagamentos separados**

```javascript
test('calcula progresso com 24 categorias e exclusão individual', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await expect(page.getByTestId('supplier-progress')).toContainText('0 de 24 escolhidos · 0%');
  await page.evaluate(() => {DB.categorias.find(cat => cat.nome==='16B. Beleza do noivo').naoTera='Não terá';renderInicio();});
  await expect(page.getByTestId('supplier-progress')).toContainText('0 de 23 escolhidos · 0%');
});

test('mantém pagamentos da noiva e do noivo independentes', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(() => {
    DB.pagamentos=[];
    const bride=DB.categorias.find(cat => cat.nome==='16A. Beleza da noiva');
    const groom=DB.categorias.find(cat => cat.nome==='16B. Beleza do noivo');
    bride.opcoes[0].nome='Salão da noiva'; groom.opcoes[0].nome='Barbearia do noivo';
    chooseSupplierOption(bride,bride.opcoes[0],0);
    chooseSupplierOption(groom,groom.opcoes[0],0);
    const before=DB.pagamentos.map(payment => ({forn:payment.forn,vinculo:payment.vinculoFornecedor}));
    unchooseSupplierOption(groom);
    return {before,after:DB.pagamentos.map(payment => ({forn:payment.forn,vinculo:payment.vinculoFornecedor}))};
  });
  expect(result.before).toEqual([
    {forn:'Salão da noiva',vinculo:'categoria:16A. Beleza da noiva'},
    {forn:'Barbearia do noivo',vinculo:'categoria:16B. Beleza do noivo'}
  ]);
  expect(result.after).toEqual([{forn:'Salão da noiva',vinculo:'categoria:16A. Beleza da noiva'}]);
});
```

- [ ] **Step 2: Executar os testes para confirmar a falha financeira**

Run: `pnpm exec playwright test tests/suppliers-split.spec.mjs -g "progresso|pagamentos"`

Expected: o progresso poderá passar após a migração, mas o teste financeiro falhará porque a busca atual reaproveita pagamentos pelo primeiro termo do nome.

- [ ] **Step 3: Tornar a seleção e remoção de pagamentos estáveis por ID e vínculo**

Em `chooseSupplierOption`, aceitar o prefixo alfanumérico e procurar primeiro por identificadores estáveis:

```javascript
var label=cat.nome.replace(/^\d+[A-Z]?\.\s*/,'').replace(/\s*\(.*/,''), link='categoria:'+cat.nome;
var p=DB.pagamentos.find(function(item){return item.vinculoFornecedor===link||(o.pagamentoId&&item.id===o.pagamentoId);});
if(!p){
  var fallback={'16A. Beleza da noiva':'Beleza','17A. Traje da noiva':'Traje da noiva','17B. Traje do noivo':'Traje do noivo'}[cat.nome];
  if(fallback)p=DB.pagamentos.find(function(item){return !item.vinculoFornecedor&&(item.forn||'').trim().toLowerCase()===fallback.toLowerCase();});
}
```

Para as demais categorias, manter a compatibilidade procurando somente pagamentos ainda sem vínculo. Em `unchooseSupplierOption`, remover por `pagamentoId` ou por `pagamentoVinculo`; usar comparação por nome apenas para dados realmente legados que não tenham nenhum dos dois campos.

- [ ] **Step 4: Executar toda a suíte e conferir a interface no celular e computador**

Run: `pnpm exec playwright test`

Expected: todos os testes PASS, sem erros de página.

Run: `git diff --check`

Expected: nenhuma saída.

- [ ] **Step 5: Registrar a etapa final**

```bash
git add index.html tests/suppliers-split.spec.mjs
git commit -m "Isola pagamentos e metricas dos noivos"
```

### Task 4: Verificação integrada e publicação

**Files:**
- Verify: `index.html`
- Verify: `tests/suppliers-split.spec.mjs`
- Verify: `docs/superpowers/specs/2026-07-22-noiva-noivo-fornecedores-design.md`

**Interfaces:**
- Consumes: implementação completa das Tasks 1–3.
- Produces: branch `main` verificada e pronta para envio ao repositório `gustavohcmcorp-spec/casamento`.

- [ ] **Step 1: Executar a suíte completa em estado limpo**

Run: `pnpm exec playwright test`

Expected: todos os testes PASS.

- [ ] **Step 2: Conferir requisitos diretamente no navegador**

Abrir `http://127.0.0.1:4173/index.html?test=1&authenticated=1` e conferir:

```text
Fornecedores: quatro cartões 16A, 16B, 17A e 17B.
Início: progresso com 24 categorias e próximos passos ordenados por prazo.
Pagamentos: escolhas de Noiva e Noivo aparecem separadas.
Celular 390x844: cartões continuam legíveis e utilizáveis.
Computador 1440x900: nenhuma aba alheia à mudança foi redesenhada.
```

- [ ] **Step 3: Verificar histórico e ausência de mudanças acidentais**

Run: `git status --short --branch && git diff origin/main...HEAD --check && git log --oneline origin/main..HEAD`

Expected: somente arquivos previstos, nenhuma advertência de whitespace e commits da especificação, plano e implementação.

- [ ] **Step 4: Enviar a branch principal**

Run: `git push origin main`

Expected: `main -> main` no repositório `gustavohcmcorp-spec/casamento`.
