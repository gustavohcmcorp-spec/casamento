# Convidados: faixas infantis e famílias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar crianças até 5 anos das crianças 6+, totalizar famílias e tornar a aba Convidados confortável no computador e no celular sem alterar o financeiro.

**Architecture:** `index.html` continua sendo a SPA única. A migração normaliza os dados legados antes da renderização; funções de contagem passam a derivar adultos, crianças até 5, crianças 6+ e total. A aba Convidados usa esses dados para KPI, família, cartões, tabela e impressão.

**Tech Stack:** HTML, CSS, JavaScript sem dependências, Firebase Realtime Database e Playwright.

## Global Constraints

- Preserve pagamentos, fornecedores e a fórmula atual de cobrança por pessoa.
- Crianças até 5 anos são isentas; crianças 6+ permanecem potencialmente cobradas.
- Migre `cr` legado para `crMais5`, sem apagar convidados ou nomes.
- Normalize somente `F | Noivo` para `Noivo` e `F | Noiva` para `Noiva`.
- Use `apply_patch` para editar arquivos locais e publique o `index.html` na branch `main` pelo GitHub autorizado.

---

### Task 1: Migrar e contar faixas infantis e famílias

**Files:**
- Modify: `C:\Users\Mottta\casamento-workspace\index.html:funções de migração e guestCounts`
- Test: `C:\Users\Mottta\casamento-workspace\tests\migration.spec.mjs`
- Test: `C:\Users\Mottta\casamento-workspace\tests\app.spec.mjs`

**Interfaces:**
- Consumes: convidados antigos com `ad`, `cr` e `grupo`.
- Produces: convidados com `crAte5`, `crMais5` e `grupo` normalizado; `guestCounts(g)` retorna `{adults, childrenUnder5, children6Plus, children, total}`.

- [ ] **Step 1: Write the failing migration test**

```js
test('migra crianças legadas para 6+ e normaliza famílias', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const migrated=await page.evaluate(() => migrateDB({
    ...defaultDB(),
    convidados:[{nome:'Família',ad:'2',cr:'3',grupo:'F | Noiva'}]
  }).data);
  expect(migrated.convidados[0]).toMatchObject({crAte5:'',crMais5:'3',grupo:'Noiva'});
  expect(guestCounts(migrated.convidados[0])).toMatchObject({adults:2,childrenUnder5:0,children6Plus:3,children:3,total:5});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/migration.spec.mjs -g "migra crianças legadas"`

Expected: FAIL because the migration and count object do not yet expose the two child ranges.

- [ ] **Step 3: Implement minimal migration and count helpers**

```js
function normalizeFamily(value){
  var family=(value||'').trim();
  if(family==='F | Noivo')return 'Noivo';
  if(family==='F | Noiva')return 'Noiva';
  return family;
}
function guestCounts(g){
  var adults=pn(g.ad), childrenUnder5=pn(g.crAte5), children6Plus=pn(g.crMais5);
  if(!adults&&!childrenUnder5&&!children6Plus)adults=1;
  return {adults:adults,childrenUnder5:childrenUnder5,children6Plus:children6Plus,children:childrenUnder5+children6Plus,total:adults+childrenUnder5+children6Plus};
}
```

During migration, when `crMais5` is absent and legacy `cr` exists, assign `crMais5=cr`; retain `crAte5=''`; then normalize `grupo` with `normalizeFamily`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/migration.spec.mjs -g "migra crianças legadas"`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `Separa faixas infantis dos convidados`

### Task 2: Exibir faixas, famílias e impressão

**Files:**
- Modify: `C:\Users\Mottta\casamento-workspace\index.html:renderConvidados, guestMobileCard, impressão A4`
- Test: `C:\Users\Mottta\casamento-workspace\tests\app.spec.mjs`

**Interfaces:**
- Consumes: `guestCounts(g)` com as faixas infantis e `grupo` normalizado.
- Produces: campos `Até 5`, `6+`, coluna `Família`, totalizadores de família e impressão com ambas as faixas.

- [ ] **Step 1: Write failing UI tests**

```js
test('mostra faixas infantis e totalizadores por família', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.convidados=[
      {nome:'A',grupo:'Noiva',ad:'2',crAte5:'1',crMais5:'2'},
      {nome:'B',grupo:'Noivo',ad:'1',crAte5:'2',crMais5:''}
    ];
    renderConvidados();
  });
  await page.getByRole('button',{name:'Convidados'}).click();
  await expect(page.getByTestId('guest-children-under-5')).toContainText('3');
  await expect(page.getByTestId('guest-children-6-plus')).toContainText('2');
  await expect(page.getByTestId('family-totals')).toContainText('Noiva · 5 pessoas');
  await expect(page.getByTestId('family-totals')).toContainText('Noivo · 3 pessoas');
  await expect(page.locator('.guest-print th')).toHaveText(['Nome / família','Ad','Até 5','6+','Pessoas convidadas']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/app.spec.mjs -g "mostra faixas infantis"`

Expected: FAIL because the UI still exposes only `Cr`, Grupo and the old A4 columns.

- [ ] **Step 3: Implement only the requested render changes**

```js
function familyTotals(){
  return (DB.convidados||[]).reduce(function(totals,g){
    var family=normalizeFamily(g.grupo), count=guestCounts(g).total;
    if(family)totals[family]=(totals[family]||0)+count;
    return totals;
  },{});
}
```

Replace the `Cr` inputs/labels with `Até 5` and `6+` in the desktop table, mobile card and guest summary. Render a compact `data-testid="family-totals"` block below the KPI cards. Change the desktop label from Grupo to Família. Generate people-editor child rows from each child range and print both child counts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/app.spec.mjs -g "mostra faixas infantis"`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `Mostra famílias e faixas infantis`

### Task 3: Ampliar somente a área de convidados e validar regressões

**Files:**
- Modify: `C:\Users\Mottta\casamento-workspace\index.html:CSS responsivo e showTab`
- Test: `C:\Users\Mottta\casamento-workspace\tests\app.spec.mjs`

**Interfaces:**
- Consumes: aba ativa em `showTab(name)`.
- Produces: classe `wide` somente quando `name==='convidados'`; cartões móveis preservados abaixo de 620px.

- [ ] **Step 1: Write failing responsive test**

```js
test('amplia somente a aba Convidados e preserva cartões móveis', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();
  await expect(page.locator('.wrap')).toHaveClass(/wide/);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.guest-cards')).toBeVisible();
  await expect(page.locator('.guest-table')).toBeHidden();
  await page.getByRole('button',{name:'Início'}).click();
  await expect(page.locator('.wrap')).not.toHaveClass(/wide/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/app.spec.mjs -g "amplia somente a aba Convidados"`

Expected: FAIL because no tab-specific width class exists.

- [ ] **Step 3: Implement scoped responsive styling**

```css
.wrap.wide{max-width:1120px}
@media(max-width:620px){.wrap.wide{max-width:840px}.guest-counts{grid-template-columns:1fr 1fr}}
```

```js
document.querySelector('.wrap').classList.toggle('wide',name==='convidados');
```

Add a `guest-counts` container for the mobile adult/child inputs. Do not change other tab widths or the existing `@media print` rule beyond the new A4 columns.

- [ ] **Step 4: Run targeted and full verification**

Run: `npm test`

Expected: all tests pass, including Payments, Fornecedores, convidados, impressão and migrations.

- [ ] **Step 5: Publish and confirm production source**

Publish `C:\Users\Mottta\casamento-workspace\index.html` to `main` with commit message `Aprimora convidados por faixa e família`.

Run: request the public page with a cache-busting `?v=<timestamp>` query and confirm it contains `crAte5`, `family-totals` and `.wrap.wide`.
