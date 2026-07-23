# Proteção de Dados e Regressão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar os riscos imediatos de perda de pagamentos, contagem de convidados vazios e regressões não detectadas, preservando todos os dados existentes.

**Architecture:** Manter a aplicação estática atual e evoluir o esquema com migração idempotente. Introduzir arquivamento reversível para pagamentos, distinguir linhas de convidados vazias de registros legados reais e reincorporar a suíte histórica ao repositório antes das demais fases.

**Tech Stack:** HTML/CSS/JavaScript sem framework, Firebase Authentication/Realtime Database, localStorage, Playwright 1.54.1, pnpm.

## Global Constraints

- Nenhuma migração pode apagar campos antigos, pagamentos, parcelas, pessoas, observações, prazos ou estados.
- Toda mudança de esquema deve ser idempotente.
- Cada comportamento novo deve começar por um teste que falhe pelo motivo esperado.
- O painel deve permanecer utilizável e publicável ao final de cada tarefa.
- Registros financeiros com movimentação não podem ser excluídos definitivamente.
- Backups antigos devem continuar restauráveis.

---

### Task 1: Incorporar a suíte histórica de regressão

**Files:**
- Create: `tests/app.spec.mjs`
- Create: `tests/migration.spec.mjs`
- Modify: `playwright.config.mjs`
- Test: `tests/app.spec.mjs`
- Test: `tests/migration.spec.mjs`

**Interfaces:**
- Consumes: funções globais expostas pelo `index.html` em modo local de teste.
- Produces: suíte oficial cobrindo autenticação, convidados, WhatsApp, fornecedores, pagamentos, alertas, sincronização e migrações.

- [ ] **Step 1: Copiar somente os testes históricos compatíveis**

Usar como fonte `C:\Users\Mottta\casamento-workspace\tests\app.spec.mjs` e `migration.spec.mjs`. Preservar os cenários, removendo apenas duplicações já presentes em `tests/suppliers-split.spec.mjs`.

- [ ] **Step 2: Executar a suíte incorporada**

Run: `pnpm test`

Expected: os testes compatíveis passam; qualquer falha real é mantida como evidência antes de alteração no produto.

- [ ] **Step 3: Corrigir apenas infraestrutura de teste desatualizada**

Atualizar seletores ou inicialização que tenham mudado, sem alterar as expectativas funcionais dos testes.

- [ ] **Step 4: Executar novamente a suíte completa**

Run: `pnpm test`

Expected: todos os testes históricos compatíveis e os 15 testes atuais passam.

- [ ] **Step 5: Commit**

```bash
git add tests/app.spec.mjs tests/migration.spec.mjs playwright.config.mjs
git commit -m "test: restaurar cobertura completa do painel"
```

### Task 2: Corrigir contagem de linhas vazias sem quebrar dados legados

**Files:**
- Modify: `tests/app.spec.mjs`
- Modify: `tests/migration.spec.mjs`
- Modify: `index.html:857`

**Interfaces:**
- Consumes: `guestCounts(guest)` e registros existentes de `DB.convidados`.
- Produces: `guestHasContent(guest): boolean` e `guestCounts(guest): GuestCount` com total zero para linha totalmente vazia.

- [ ] **Step 1: Escrever testes que reproduzem o bug**

```javascript
test('não conta linha de convidado totalmente vazia', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const counts = await page.evaluate(() => guestCounts({
    nome: '', familia: '', whats: '', ad: '', crAte5: '', cr6a10: '', cr11mais: ''
  }));
  expect(counts.total).toBe(0);
  expect(counts.adults).toBe(0);
});

test('preserva um adulto para registro legado com conteúdo', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const counts = await page.evaluate(() => guestCounts({ nome: 'Maria', ad: '', crAte5: '' }));
  expect(counts).toMatchObject({ adults: 1, total: 1 });
});
```

- [ ] **Step 2: Rodar os testes e confirmar a falha correta**

Run: `pnpm exec playwright test tests/app.spec.mjs -g "linha de convidado|registro legado"`

Expected: o primeiro teste falha com total `1`; o segundo passa ou continua documentando a compatibilidade.

- [ ] **Step 3: Implementar detecção explícita de conteúdo**

```javascript
function guestHasContent(g){
  return !!(
    (g.nome||'').trim() || (g.familia||'').trim() || (g.whats||'').trim() ||
    pn(g.ad) || pn(g.crAte5) || pn(g.cr6a10) || pn(g.cr11mais) ||
    (g.pessoas||[]).some(function(person){ return (person.nome||'').trim(); })
  );
}

function guestCounts(g){
  var adults=pn(g.ad), childrenUnder5=pn(g.crAte5), children6To10=pn(g.cr6a10),
      children11Plus=pn(g.cr11mais==null?(g.crMais5==null?g.cr:g.crMais5):g.cr11mais),
      children=childrenUnder5+children6To10+children11Plus;
  if(!adults&&!children&&guestHasContent(g)) adults=1;
  return {adults:adults,childrenUnder5:childrenUnder5,children6To10:children6To10,
    children11Plus:children11Plus,children6Plus:children11Plus,
    children:children,total:adults+children};
}
```

- [ ] **Step 4: Verificar resumos, RSVP e buffet**

Run: `pnpm exec playwright test tests/app.spec.mjs -g "convidado|confirma|faixa|buffet"`

Expected: linhas vazias não entram nos totais; convidados reais e cálculos por faixa continuam corretos.

- [ ] **Step 5: Executar toda a suíte e commit**

```bash
pnpm test
git add index.html tests/app.spec.mjs tests/migration.spec.mjs
git commit -m "fix: ignorar linhas vazias de convidados"
```

### Task 3: Tornar o desfazer de fornecedor não destrutivo

**Files:**
- Modify: `tests/app.spec.mjs`
- Modify: `tests/suppliers-split.spec.mjs`
- Modify: `index.html:739-752`

**Interfaces:**
- Consumes: `unchooseSupplierOption(category)` e pagamentos vinculados por `pagamentoId` ou `vinculoFornecedor`.
- Produces: `paymentHasHistory(payment): boolean`, `detachSupplierPayment(category, option, payment): void` e pagamento preservado sem vínculo.

- [ ] **Step 1: Escrever testes de preservação**

```javascript
test('desfazer fornecedor preserva pagamento e parcelas pagas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => {
    DB.pagamentos=[];
    const category=DB.categorias.find(item => item.nome==='16A. Beleza da noiva');
    const option=category.opcoes[0];
    option.nome='Salão'; option.valor='1500';
    chooseSupplierOption(category,option,0);
    DB.pagamentos[0].entradaValor='300';
    DB.pagamentos[0].entradaStatus='Pago';
    DB.pagamentos[0].parcelasDetalhes=[{numero:1,valor:'600',status:'Pago'}];
    unchooseSupplierOption(category);
    return DB.pagamentos[0];
  });
  expect(result).toMatchObject({ forn:'Salão', entradaStatus:'Pago' });
  expect(result.parcelasDetalhes[0].status).toBe('Pago');
  expect(result.vinculoFornecedor).toBe('');
});
```

- [ ] **Step 2: Rodar e confirmar que o teste falha porque o pagamento é removido**

Run: `pnpm exec playwright test tests/app.spec.mjs -g "preserva pagamento"`

Expected: FAIL porque `DB.pagamentos[0]` é `undefined`.

- [ ] **Step 3: Implementar desvinculação conservadora**

```javascript
function paymentHasHistory(payment){
  return !!(
    paymentEntryPaid(payment) || paymentPaid(payment) ||
    (payment.parcelasDetalhes||[]).some(function(parcel){
      return parcel.status==='Pago' || parcel.dataPagamento;
    })
  );
}

function detachSupplierPayment(cat,option,payment){
  payment.vinculoFornecedor='';
  payment.arquivado=false;
  payment.desvinculadoEm=new Date().toISOString();
  delete option.pagamentoId;
  delete option.pagamentoVinculo;
}
```

Alterar `unchooseSupplierOption` para localizar o pagamento e apenas desvinculá-lo. Nesta primeira fase, nenhum pagamento será excluído por esse botão, mesmo quando vazio.

- [ ] **Step 4: Atualizar a mensagem da interface**

Exibir: `Escolha desfeita. O registro financeiro foi preservado e desvinculado.`

- [ ] **Step 5: Executar testes específicos e completos**

Run: `pnpm exec playwright test tests/app.spec.mjs tests/suppliers-split.spec.mjs -g "desfazer|independentes|preserva pagamento"`

Run: `pnpm test`

Expected: todos passam, sem perda de entrada, parcelas ou ajustes manuais.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/app.spec.mjs tests/suppliers-split.spec.mjs
git commit -m "fix: preservar financeiro ao desfazer fornecedor"
```

### Task 4: Normalizar beleza da noiva e do noivo no financeiro

**Files:**
- Modify: `tests/migration.spec.mjs`
- Modify: `tests/suppliers-split.spec.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `migrateDB(data)`, pagamentos legados “Beleza” e vínculos das categorias 16A/16B.
- Produces: linha padrão “Beleza da noiva”, linha independente para o noivo e reconciliação sem duplicação.

- [ ] **Step 1: Escrever teste de migração sem perda**

```javascript
test('migra pagamento Beleza para noiva sem perder parcelas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const migrated=await page.evaluate(() => {
    const legacy=defaultDB();
    const payment=legacy.pagamentos.find(item => item.forn==='Beleza');
    payment.total='1500';
    payment.parcelasDetalhes=[{numero:1,valor:'500',status:'Pago'}];
    return migrateDB(legacy).data.pagamentos;
  });
  const bride=migrated.find(item => item.forn==='Beleza da noiva');
  expect(bride.total).toBe('1500');
  expect(bride.parcelasDetalhes[0].status).toBe('Pago');
});
```

- [ ] **Step 2: Rodar e confirmar a falha pela nomenclatura antiga**

Run: `pnpm exec playwright test tests/migration.spec.mjs -g "Beleza para noiva"`

Expected: FAIL porque o pagamento ainda se chama `Beleza`.

- [ ] **Step 3: Implementar migração idempotente**

Renomear apenas o pagamento padrão ou inequivocamente vinculado à noiva. Se houver vínculo ambíguo ou dois pagamentos preenchidos, manter ambos e registrar alerta de reconciliação em `DB.alertasMigracao`.

- [ ] **Step 4: Testar instalação nova, dado legado e execução repetida**

Run: `pnpm exec playwright test tests/migration.spec.mjs tests/suppliers-split.spec.mjs -g "Beleza|idempotente|independentes"`

Expected: valores, parcelas, IDs e vínculos permanecem; segunda migração não altera o resultado.

- [ ] **Step 5: Executar suíte completa e commit**

```bash
pnpm test
git add index.html tests/migration.spec.mjs tests/suppliers-split.spec.mjs
git commit -m "fix: separar beleza no financeiro sem perda"
```

### Task 5: Adicionar metadados de versão e autoria à gravação

**Files:**
- Modify: `tests/app.spec.mjs`
- Modify: `index.html:1066`

**Interfaces:**
- Consumes: `makeSyncService(db, ref, onValue, set)` e perfil autenticado.
- Produces: `DB.__meta.modules[module] = {version, updatedAt, updatedBy}` e fila que preserva o snapshot mais recente por módulo.

- [ ] **Step 1: Escrever testes para alterações rápidas em módulos distintos**

```javascript
test('preserva snapshots pendentes de módulos distintos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result=await page.evaluate(async () => {
    const writes=[];
    const service=makeSyncService({},()=>({}),()=>{},async (_ref,value)=>writes.push(value));
    service.queueModule('convidados',{convidados:[{nome:'Ana'}]});
    service.queueModule('pagamentos',{pagamentos:[{forn:'Buffet',total:'5000'}]});
    await service.flush();
    return writes;
  });
  expect(result.some(value => value.convidados)).toBe(true);
  expect(result.some(value => value.pagamentos)).toBe(true);
});
```

- [ ] **Step 2: Rodar e confirmar que a API modular ainda não existe**

Run: `pnpm exec playwright test tests/app.spec.mjs -g "módulos distintos"`

Expected: FAIL com `queueModule is not a function`.

- [ ] **Step 3: Implementar fila modular compatível**

Adicionar `queueModule(moduleName,payload)` sem remover `queueSnapshot`. Cada item incluirá módulo, versão crescente, data ISO e autor. Enquanto a interface continuar chamando `queueSnapshot`, o comportamento atual será preservado.

- [ ] **Step 4: Fazer a gravação modular por caminho do Firebase**

Gravar `casamento/shared/modules/<moduleName>` e seus metadados. A leitura deverá combinar módulos com dados legados de `casamento/shared`, priorizando a maior versão e preservando campos desconhecidos.

- [ ] **Step 5: Verificar offline, reconexão e compatibilidade**

Run: `pnpm exec playwright test tests/app.spec.mjs -g "sincroniza|alterações rapidamente|módulos distintos|offline"`

Expected: nenhuma alteração de módulo distinto é descartada; snapshots legados ainda carregam.

- [ ] **Step 6: Executar suíte completa e commit**

```bash
pnpm test
git add index.html tests/app.spec.mjs
git commit -m "feat: versionar sincronizacao por modulo"
```

### Task 6: Validar migração, backup e restauração ponta a ponta

**Files:**
- Modify: `tests/migration.spec.mjs`
- Modify: `tests/app.spec.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `migrateDB`, `validateDB`, `doRestore`, backup JSON e esquema corrente.
- Produces: relatório de validação com contagens antes/depois e bloqueio de restauração inválida.

- [ ] **Step 1: Criar fixtures em memória para versões anteriores**

Cobrir versões 2, 3 e 4 com convidados nomeados, pessoas, pagamentos, entrada paga, parcelas, fornecedores escolhidos, observações e prazos personalizados.

- [ ] **Step 2: Escrever teste de invariantes**

```javascript
expect(after.convidados.length).toBe(before.convidados.length);
expect(after.pagamentos.length).toBeGreaterThanOrEqual(before.pagamentos.length);
expect(after.pagamentos.flatMap(p => p.parcelasDetalhes||[]).length)
  .toBe(before.pagamentos.flatMap(p => p.parcelasDetalhes||[]).length);
expect(JSON.stringify(after)).toContain('Observação preservada');
```

- [ ] **Step 3: Rodar os testes e registrar qualquer perda atual**

Run: `pnpm exec playwright test tests/migration.spec.mjs`

Expected: fixtures válidas migram; qualquer falha indica exatamente qual invariante foi perdido.

- [ ] **Step 4: Implementar validação pré-gravação**

Antes de substituir `DB`, comparar quantidades e IDs críticos. Em divergência destrutiva, manter o banco anterior e exibir `Não foi possível restaurar com segurança; nenhum dado foi alterado.`

- [ ] **Step 5: Executar toda a suíte duas vezes**

Run: `pnpm test && pnpm test`

Expected: duas execuções verdes, demonstrando que migrações repetidas são estáveis.

- [ ] **Step 6: Verificar árvore limpa e commit**

```bash
git diff --check
git status --short
git add index.html tests/app.spec.mjs tests/migration.spec.mjs
git commit -m "test: garantir restauracao sem perda de dados"
```

### Task 7: Revisão visual e publicação segura da fase

**Files:**
- Modify: `README.md`
- Test: `tests/app.spec.mjs`
- Test: `tests/migration.spec.mjs`
- Test: `tests/suppliers-split.spec.mjs`

**Interfaces:**
- Consumes: todos os comportamentos entregues nas Tasks 1–6.
- Produces: fase 1 documentada e pronta para revisão/publicação.

- [ ] **Step 1: Testar fluxos reais no navegador**

Validar computador e largura móvel: convidado vazio, convidado real, buffet por faixa, escolha/desfazer fornecedor, pagamento preservado, backup e restauração.

- [ ] **Step 2: Verificar acessibilidade básica e erros de console**

Confirmar navegação por teclado, rótulos das confirmações destrutivas e ausência de erros durante os fluxos testados.

- [ ] **Step 3: Atualizar documentação operacional**

Corrigir a referência de publicação para `main` e documentar que desfazer fornecedor preserva o financeiro e que backups antigos são migrados automaticamente.

- [ ] **Step 4: Executar verificação final**

Run: `pnpm test`

Run: `git diff --check`

Expected: todos os testes passam, sem avisos de whitespace e sem arquivos de resultados rastreados.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: atualizar operacao segura do painel"
```

