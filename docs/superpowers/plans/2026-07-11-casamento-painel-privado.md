# Painel privado do casamento — plano de implementação

> **Para agentes de execução:** HABILIDADE OBRIGATÓRIA: usar `executing-plans` para executar este plano tarefa por tarefa. Os passos usam caixas de seleção para acompanhamento.

**Objetivo:** Transformar o `index.html` existente em um painel privado, seguro, sincronizado e editável para o casal e a cerimonial.

**Arquitetura:** O site de produção continuará em um único `index.html`, com JavaScript modular interno e Firebase 12.15.0 carregado pelo CDN oficial. O acesso será protegido pelo Firebase Authentication e por regras limitadas a um UID. Uma camada `DataService` fará gravações granulares e uma fila persistente em `localStorage` protegerá alterações feitas sem internet até que sejam confirmadas pelo servidor.

**Tecnologias:** HTML5, CSS3, JavaScript ES2022, Firebase Web SDK modular 12.15.0, Firebase Authentication, Realtime Database, Node.js, Playwright Test.

## Restrições globais

- Produção em um único `index.html`, sem framework e compatível com GitHub Pages.
- Somente três usuários, compartilhando uma senha; sem página pública.
- A senha nunca será gravada no HTML, no GitHub ou no Realtime Database.
- Regras públicas de leitura ou escrita são proibidas.
- Remover backup e restauração manuais.
- Preservar o visual leve e usar expansão progressiva para formulários extensos.
- Não armazenar arquivos; aceitar apenas links externos para documentos.
- Não substituir o banco inteiro em uma edição comum.
- Nenhuma etapa que dependa do Firebase Console será presumida; pausar e orientar o proprietário.

## Estrutura de arquivos

- Modificar: `index.html` — aplicação completa publicada.
- Modificar: `README.md` — configuração, publicação e uso.
- Criar: `firebase.database.rules.json` — regras do Realtime Database.
- Criar: `package.json` — comandos e dependências de desenvolvimento.
- Criar: `playwright.config.mjs` — servidor local e navegadores de teste.
- Criar: `tests/app.spec.mjs` — login, navegação, CRUD e acessibilidade básica.
- Criar: `tests/migration.spec.mjs` — migração do esquema atual.
- Criar: `tests/offline.spec.mjs` — fila persistente e reconexão.

---

### Tarefa 1: Criar o ambiente de testes e preservar o comportamento atual

**Arquivos:**
- Criar: `package.json`
- Criar: `playwright.config.mjs`
- Criar: `tests/app.spec.mjs`
- Modificar: `.gitignore`

**Interfaces:**
- Produz: comandos `npm test` e `npm run test:headed`.
- Produz: servidor local em `http://127.0.0.1:4173`.

- [ ] **Passo 1: criar o manifesto de testes**

```json
{
  "name": "casamento-painel-privado",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "1.54.1",
    "http-server": "14.1.1"
  }
}
```

- [ ] **Passo 2: configurar o servidor do Playwright**

```js
// playwright.config.mjs
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } },
  webServer: {
    command: 'npx http-server . -a 127.0.0.1 -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: true
  }
});
```

- [ ] **Passo 3: escrever o teste de preservação antes da mudança**

```js
// tests/app.spec.mjs
import { test, expect } from '@playwright/test';

test('carrega o painel atual sem erro fatal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/index.html');
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.getByText('Próximos passos')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Passo 4: instalar e executar**

Executar: `npm install && npx playwright install chromium && npm test`  
Esperado: `1 passed`.

- [ ] **Passo 5: ignorar dependências locais e confirmar**

```gitignore
node_modules/
playwright-report/
test-results/
```

Executar: `npm test`  
Esperado: `1 passed`.

- [ ] **Passo 6: commit**

```bash
git add package.json package-lock.json playwright.config.mjs tests/app.spec.mjs .gitignore
git commit -m "test: add browser regression harness"
```

---

### Tarefa 2: Introduzir esquema v3, IDs estáveis e migração segura

**Arquivos:**
- Modificar: `index.html`
- Criar: `tests/migration.spec.mjs`

**Interfaces:**
- Produz: `SCHEMA_VERSION`, `makeId(prefix)`, `migrateDB(raw)` e `validateDB(data)`.
- `migrateDB(raw)` retorna `{ data, changed }` e nunca altera o objeto recebido.

- [ ] **Passo 1: escrever testes de migração que falham**

```js
// tests/migration.spec.mjs
import { test, expect } from '@playwright/test';

test('migra v2 sem apagar nomes nem convidados', async ({ page }) => {
  await page.goto('/index.html?test=1');
  const result = await page.evaluate(() => window.__test.migrateDB({
    __v: 2,
    noiva: 'Gleicianne',
    noivo: 'Gustavo',
    convidados: [{ nome: 'Família Silva', conf: 'Pendente' }]
  }));
  expect(result.data.__v).toBe(3);
  expect(result.data.config.noiva).toBe('Gleicianne');
  expect(result.data.convidados[0].nome).toBe('Família Silva');
  expect(result.data.convidados[0].id).toMatch(/^con_/);
});

test('a migração é idempotente', async ({ page }) => {
  await page.goto('/index.html?test=1');
  const result = await page.evaluate(() => {
    const first = window.__test.migrateDB({ __v: 2, convidados: [] }).data;
    const second = window.__test.migrateDB(first);
    return { first, second };
  });
  expect(result.second.changed).toBe(false);
  expect(result.second.data).toEqual(result.first);
});
```

- [ ] **Passo 2: executar para confirmar falha**

Executar: `npx playwright test tests/migration.spec.mjs`  
Esperado: falha porque `window.__test.migrateDB` ainda não existe.

- [ ] **Passo 3: adicionar as funções de esquema ao script principal**

```js
const SCHEMA_VERSION = 3;

function makeId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}

function withMeta(item, prefix) {
  const now = Date.now();
  return { ...item, id: item.id || makeId(prefix), createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now, archivedAt: item.archivedAt || null };
}

const migrateList = (items, prefix) => (items || []).map(item => withMeta(item, prefix));

function migrateDB(raw = {}) {
  const source = structuredClone(raw || {});
  if (source.__v === SCHEMA_VERSION) return { data: source, changed: false };
  const defaults = defaultDB();
  const data = {
    ...defaults,
    ...source,
    __v: SCHEMA_VERSION,
    config: {
      ...defaults.config,
      noiva: source.noiva ?? source.config?.noiva ?? '',
      noivo: source.noivo ?? source.config?.noivo ?? '',
      cidade: source.cidade ?? source.config?.cidade ?? 'Goiânia/GO',
      local: source.local ?? source.config?.local ?? '',
      hora: source.hora ?? source.config?.hora ?? '16:00',
      meta: source.meta ?? source.config?.meta ?? '30000',
      teto: source.teto ?? source.config?.teto ?? '60000'
    },
    categorias: migrateList(source.categorias || defaults.categorias, 'cat'),
    cronograma: (source.cronograma || defaults.cronograma).map(fase => withMeta({
      ...fase, tarefas: migrateList(fase.tarefas, 'tar')
    }, 'fase')),
    equipe: migrateList(source.equipe || defaults.equipe, 'eqp'),
    diad: migrateList(source.diad || defaults.diad, 'dia'),
    pagamentos: migrateList(source.pagamentos || defaults.pagamentos, 'pag'),
    convidados: migrateList(source.convidados || defaults.convidados, 'con'),
    essenciais: Object.fromEntries(Object.entries(source.essenciais || defaults.essenciais)
      .map(([key, items]) => [key, migrateList(items, `ck_${key}`)])),
    docs: migrateList(source.docs || defaults.docs, 'doc'),
    beleza: migrateList(source.beleza || defaults.beleza, 'bel'),
    luademel: migrateList(source.luademel || defaults.luademel, 'lua')
  };
  for (const legacy of ['noiva', 'noivo', 'cidade', 'local', 'hora', 'meta', 'teto']) delete data[legacy];
  return { data, changed: true };
}

function validateDB(data) {
  return Boolean(data && data.__v === SCHEMA_VERSION && data.config &&
    Array.isArray(data.categorias) && Array.isArray(data.cronograma) &&
    Array.isArray(data.pagamentos) && Array.isArray(data.convidados));
}

if (new URLSearchParams(location.search).has('test')) {
  window.__test = { makeId, migrateDB, validateDB };
}
```

- [ ] **Passo 4: adaptar `defaultDB()` para `__v: 3` e `config`**

Mover `noiva`, `noivo`, `cidade`, `local`, `hora`, `meta` e `teto` para `config`; aplicar `withMeta` a itens editáveis sem alterar textos predefinidos.

- [ ] **Passo 5: executar migração e regressão**

Executar: `npm test`  
Esperado: testes de migração e regressão passam.

- [ ] **Passo 6: commit**

```bash
git add index.html tests/migration.spec.mjs
git commit -m "feat: add versioned wedding data migration"
```

---

### Tarefa 3: Criar autenticação por senha e regras fechadas

**Arquivos:**
- Modificar: `index.html`
- Criar: `firebase.database.rules.json`
- Modificar: `tests/app.spec.mjs`

**Interfaces:**
- Produz: `AuthService.init()`, `AuthService.login(password)` e `AuthService.logout()`.
- Consome: `FIREBASE_CONFIG`, `INTERNAL_AUTH_EMAIL` e `ALLOWED_UID` preenchidos durante configuração orientada.

- [ ] **Passo 1: escrever teste da barreira de login**

```js
test('mantém o painel oculto antes da autenticação', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await expect(page.getByRole('heading', { name: 'Acesso privado' })).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await expect(page.getByLabel('Senha compartilhada')).toBeVisible();
});
```

- [ ] **Passo 2: executar e confirmar falha**

Executar: `npx playwright test tests/app.spec.mjs`  
Esperado: falha porque a barreira de login ainda não existe.

- [ ] **Passo 3: converter o script principal para módulo e importar Firebase**

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getDatabase, ref, onValue, get, update, set, remove, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';
```

- [ ] **Passo 4: implementar a barreira e o serviço de autenticação**

```js
const FIREBASE_CONFIG = Object.freeze({ apiKey: '', authDomain: '', databaseURL: '', projectId: '', appId: '' });
const INTERNAL_AUTH_EMAIL = '';
let firebaseApp, firebaseAuth, firebaseDb;

const TEST_MODE = new URLSearchParams(location.search).has('test');

const AuthService = {
  async init() {
    if (TEST_MODE) {
      return new URLSearchParams(location.search).has('authenticated')
        ? startPrivateApp({ uid: 'test-user' }) : showLogin();
    }
    if (!FIREBASE_CONFIG.apiKey || !INTERNAL_AUTH_EMAIL) return showSetupRequired();
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getDatabase(firebaseApp);
    await setPersistence(firebaseAuth, browserLocalPersistence);
    onAuthStateChanged(firebaseAuth, user => user ? startPrivateApp(user) : showLogin());
  },
  login(password) {
    if (TEST_MODE) {
      if (!password) return Promise.reject(new Error('auth/invalid-credential'));
      startPrivateApp({ uid: 'test-user' });
      return Promise.resolve({ user: { uid: 'test-user' } });
    }
    return signInWithEmailAndPassword(firebaseAuth, INTERNAL_AUTH_EMAIL, password);
  },
  logout() {
    if (TEST_MODE) { showLogin(); return Promise.resolve(); }
    return signOut(firebaseAuth);
  }
};
```

A tela de login deve conter um único campo `type="password"`, botão Entrar, mensagem genérica e espera progressiva local após falhas.

- [ ] **Passo 5: criar regras fechadas**

Criar inicialmente um arquivo que nega tudo, para que nenhuma implantação acidental exponha os dados:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

- [ ] **Passo 6: pausar para configuração do Firebase**

Orientar o proprietário a criar projeto, app web, Realtime Database, Authentication por e-mail/senha e a conta interna; copiar a configuração e o UID. Depois de receber o UID real, substituir o arquivo de negação total por regras que comparem `auth.uid` ao valor real em ambos os acessos. O plano pausa aqui enquanto esse valor externo não existir; nenhum valor simbólico pode ser publicado.

- [ ] **Passo 7: testar no Firebase Rules Playground**

Verificar: sem autenticação = negado; UID diferente = negado; UID autorizado = leitura e escrita permitidas somente em `/casamento/<uid>`.

- [ ] **Passo 8: executar testes e commit**

Executar: `npm test`  
Esperado: todos passam com o adaptador de teste.

```bash
git add index.html firebase.database.rules.json tests/app.spec.mjs
git commit -m "feat: protect wedding panel with Firebase Auth"
```

---

### Tarefa 4: Implementar sincronização granular e fila offline persistente

**Arquivos:**
- Modificar: `index.html`
- Criar: `tests/offline.spec.mjs`

**Interfaces:**
- Produz: `DataService.listen(module, callback)`, `DataService.patch(module, id, changes)`, `DataService.put(module, record)`, `DataService.archive(module, id)` e `DataService.flushOutbox()`.
- Produz: estados `saving`, `synced`, `offline` e `error`.

- [ ] **Passo 1: escrever testes da fila offline**

```js
import { test, expect } from '@playwright/test';

test('preserva alteração pendente após recarregar', async ({ page }) => {
  await page.goto('/index.html?test=1&offline=1');
  await page.evaluate(() => window.__test.queueMutation({
    path: 'tarefas/tar_1', value: { titulo: 'Confirmar buffet' }
  }));
  await page.reload();
  const outbox = await page.evaluate(() => window.__test.readOutbox());
  expect(outbox).toHaveLength(1);
  expect(outbox[0].path).toBe('tarefas/tar_1');
});
```

- [ ] **Passo 2: executar e confirmar falha**

Executar: `npx playwright test tests/offline.spec.mjs`  
Esperado: falha porque `queueMutation` não existe.

- [ ] **Passo 3: implementar fila local**

```js
const OUTBOX_KEY = 'casamento_v3_outbox';
const readOutbox = () => JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
const writeOutbox = list => localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));

function queueMutation(mutation) {
  const item = { id: makeId('mut'), createdAt: Date.now(), attempts: 0, ...mutation };
  writeOutbox([...readOutbox(), item]);
  setSyncState('offline');
  return item;
}
```

- [ ] **Passo 4: implementar serviço granular**

```js
const DataService = {
  base(uid) { return `casamento/${uid}`; },
  listen(module, callback) {
    return onValue(ref(firebaseDb, `${this.base(firebaseAuth.currentUser.uid)}/${module}`),
      snap => callback(snap.val() || {}), () => setSyncState('error'));
  },
  async patch(module, id, changes) {
    const path = `${this.base(firebaseAuth.currentUser.uid)}/${module}/${id}`;
    const value = { ...changes, updatedAt: serverTimestamp() };
    setSyncState(navigator.onLine ? 'saving' : 'offline');
    if (!navigator.onLine) return queueMutation({ operation: 'update', path, value: changes });
    try { await update(ref(firebaseDb, path), value); setSyncState('synced'); }
    catch (error) { queueMutation({ operation: 'update', path, value: changes }); throw error; }
  },
  put(module, record) {
    return this.patch(module, record.id, record);
  },
  archive(module, id) {
    return this.patch(module, id, { archivedAt: Date.now() });
  }
};
```

- [ ] **Passo 5: implementar `flushOutbox()` em ordem**

```js
DataService.flushOutbox = async function flushOutbox() {
  const pending = readOutbox();
  for (const item of pending) {
    try {
      await update(ref(firebaseDb, item.path), {
        ...item.value, updatedAt: serverTimestamp()
      });
      writeOutbox(readOutbox().filter(current => current.id !== item.id));
    } catch (error) {
      setSyncState('error');
      throw error;
    }
  }
  setSyncState('synced');
};

if (!TEST_MODE) {
  window.addEventListener('online', () => DataService.flushOutbox().catch(console.error));
  onValue(ref(firebaseDb, '.info/connected'), snapshot => {
    if (snapshot.val() === true) DataService.flushOutbox().catch(console.error);
  });
}
```

- [ ] **Passo 6: executar testes e commit**

Executar: `npm test`  
Esperado: testes de fila e regressão passam.

```bash
git add index.html tests/offline.spec.mjs
git commit -m "feat: add granular sync and persistent offline outbox"
```

---

### Tarefa 5: Simplificar navegação e criar componentes CRUD reutilizáveis

**Arquivos:**
- Modificar: `index.html`
- Modificar: `tests/app.spec.mjs`

**Interfaces:**
- Produz: cinco rotas internas: `inicio`, `planejamento`, `fornecedores`, `convidados`, `diad`.
- Produz: `accordion()`, `recordActions()`, `confirmArchive()` e `renderEmptyState()`.

- [ ] **Passo 1: atualizar testes para cinco áreas**

```js
test('oferece cinco áreas principais', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  for (const label of ['Início', 'Planejamento', 'Fornecedores', 'Convidados', 'Dia D']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});
```

- [ ] **Passo 2: confirmar falha e substituir `TABS`**

Executar: `npx playwright test tests/app.spec.mjs`  
Esperado: falha porque existem nove abas.

```js
const TABS = [
  ['inicio', 'Início'], ['planejamento', 'Planejamento'],
  ['fornecedores', 'Fornecedores'], ['convidados', 'Convidados'], ['diad', 'Dia D']
];
```

- [ ] **Passo 3: agrupar telas existentes sem apagar conteúdo**

`renderPlanejamento()` deve compor cronograma, essenciais e noivos/documentos; `renderFornecedores()` deve compor categorias, equipe e pagamentos. Manter resumos visíveis e detalhes recolhidos.

- [ ] **Passo 4: implementar ações comuns**

```js
function recordActions({ onDuplicate, onArchive }) {
  return h('div', { class: 'record-actions' },
    h('button', { class: 'btn s mini', onclick: onDuplicate }, 'Duplicar'),
    h('button', { class: 'btn del mini', onclick: onArchive }, 'Arquivar'));
}

function accordion(title, body, { open = false, count = null } = {}) {
  const panel = h('div', { class: `acc-b${open ? ' open' : ''}` }, body);
  const chevron = h('span', { class: `chev${open ? ' up' : ''}` }, '▸');
  const button = h('button', { class: 'acc-h', 'aria-expanded': String(open),
    onclick() {
      const expanded = panel.classList.toggle('open');
      button.setAttribute('aria-expanded', String(expanded));
      chevron.className = `chev${expanded ? ' up' : ''}`;
    }
  }, title, count == null ? null : h('span', { class: 'chip n' }, String(count)), chevron);
  return h('div', { class: 'card' }, button, panel);
}

function renderEmptyState(message) {
  return h('p', { class: 'empty-state' }, message);
}

function confirmArchive(label, action) {
  openConfirm(`Arquivar “${label || 'este item'}”?`,
    'Você poderá recuperá-lo na lixeira.', action);
}
```

- [ ] **Passo 5: substituir tabelas largas por cartões em até 640 px**

Adicionar CSS com `@media(max-width:640px)` para esconder cabeçalhos de tabela, exibir cada linha como cartão e usar `data-label` nos campos. Nenhum formulário deve exigir rolagem horizontal em 390 px.

- [ ] **Passo 6: executar testes e commit**

Executar: `npm test`  
Esperado: todos passam.

```bash
git add index.html tests/app.spec.mjs
git commit -m "feat: simplify navigation and reusable CRUD actions"
```

---

### Tarefa 6: Completar planejamento, fornecedores e finanças

**Arquivos:**
- Modificar: `index.html`
- Modificar: `tests/app.spec.mjs`

**Interfaces:**
- Consome: `DataService` e componentes CRUD.
- Produz: tarefas com prazo, responsável, prioridade e estado; fornecedores comparáveis; pagamentos e vencimentos.

- [ ] **Passo 1: escrever testes de tarefa e finanças**

```js
test('cria tarefa e calcula saldo financeiro', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Planejamento' }).click();
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
  await page.getByLabel('Título da tarefa').fill('Confirmar buffet');
  await page.getByRole('button', { name: 'Salvar tarefa' }).click();
  await expect(page.getByText('Confirmar buffet')).toBeVisible();
  expect(await page.evaluate(() => window.__test.financialSummary([
    { total: '10000', pago: '2500' }
  ]))).toEqual({ contratado: 10000, pago: 2500, saldo: 7500 });
});
```

- [ ] **Passo 2: implementar campos e funções puras**

```js
function financialSummary(rows) {
  return rows.reduce((sum, row) => {
    const total = pn(row.total), pago = pn(row.pago);
    return { contratado: sum.contratado + total, pago: sum.pago + pago,
      saldo: sum.saldo + total - pago };
  }, { contratado: 0, pago: 0, saldo: 0 });
}
```

Tarefas recebem `titulo`, `prazo`, `responsavel`, `prioridade`, `status`, `observacao` e metadados. Fornecedores recebem contato, proposta, validade, itens incluídos, status, link e opção escolhida. Pagamentos recebem total, entrada, parcelas, próximo vencimento e pago.

- [ ] **Passo 3: adicionar alertas no início**

Exibir até cinco tarefas vencidas e cinco pagamentos com vencimento nos próximos 30 dias; se não houver, mostrar estado vazio curto.

- [ ] **Passo 4: testar e commit**

Executar: `npm test`  
Esperado: todos passam.

```bash
git add index.html tests/app.spec.mjs
git commit -m "feat: complete planning vendors and finances"
```

---

### Tarefa 7: Completar convidados, WhatsApp e Dia D

**Arquivos:**
- Modificar: `index.html`
- Modificar: `tests/app.spec.mjs`

**Interfaces:**
- Produz: `normalizeBrazilPhone(value)`, `buildWhatsAppUrl(guest, template)` e `guestSummary(list)`.

- [ ] **Passo 1: escrever testes puros**

```js
test('normaliza telefone brasileiro e personaliza convite', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const result = await page.evaluate(() => ({
    phone: window.__test.normalizeBrazilPhone('(62) 99999-0000'),
    url: window.__test.buildWhatsAppUrl(
      { nome: 'Ana', tel: '(62) 99999-0000' }, 'Olá {nome}, convite de {noivos}!')
  }));
  expect(result.phone).toBe('5562999990000');
  expect(decodeURIComponent(result.url)).toContain('Olá Ana');
});
```

- [ ] **Passo 2: implementar funções**

```js
function normalizeBrazilPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits && digits.length <= 11 && !digits.startsWith('55')) digits = `55${digits}`;
  return digits;
}

function buildWhatsAppUrl(guest, template) {
  const phone = normalizeBrazilPhone(guest.tel);
  const message = String(template || '')
    .replaceAll('{nome}', guest.nome || '')
    .replaceAll('{noivos}', coupleName());
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function guestSummary(list) {
  return list.reduce((sum, guest) => {
    const people = pn(guest.ad) + pn(guest.cr) || 1;
    sum.total += people;
    if (guest.conf === 'Confirmado') sum.confirmados += people;
    else if (guest.conf === 'Não vai') sum.recusados += people;
    else sum.pendentes += people;
    return sum;
  }, { total: 0, confirmados: 0, pendentes: 0, recusados: 0 });
}
```

- [ ] **Passo 3: completar cadastro e filtros**

Adicionar grupo, adultos, crianças, telefone, RSVP, mesa, restrição alimentar, acessibilidade e observações. Implementar filtros por texto, grupo, RSVP e mesa sem alterar os dados.

- [ ] **Passo 4: completar Dia D**

Cada momento recebe horário, atividade, responsável, telefone, local, observação, status e posição. Reordenação deve atualizar somente `position` dos itens afetados.

- [ ] **Passo 5: testar e commit**

Executar: `npm test`  
Esperado: todos passam.

```bash
git add index.html tests/app.spec.mjs
git commit -m "feat: complete guests WhatsApp and wedding day timeline"
```

---

### Tarefa 8: Lixeira, acessibilidade, impressão e verificação final

**Arquivos:**
- Modificar: `index.html`
- Modificar: `README.md`
- Modificar: `tests/app.spec.mjs`

**Interfaces:**
- Produz: `TrashService.list()`, `TrashService.restore(module, id)` e `TrashService.removeForever(module, id)`.

- [ ] **Passo 1: testar arquivamento e recuperação**

```js
test('arquiva e recupera sem perda', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => window.__test.seedTask({ id: 'tar_1', titulo: 'Teste' }));
  await page.evaluate(() => window.__test.archiveTask('tar_1'));
  expect(await page.evaluate(() => window.__test.visibleTaskIds())).not.toContain('tar_1');
  await page.evaluate(() => window.__test.restoreTask('tar_1'));
  expect(await page.evaluate(() => window.__test.visibleTaskIds())).toContain('tar_1');
});
```

- [ ] **Passo 2: implementar lixeira recolhida**

```js
const TrashService = {
  list(module) {
    return Object.values(DB[module] || {}).filter(record => record.archivedAt);
  },
  restore(module, id) {
    return DataService.patch(module, id, { archivedAt: null });
  },
  async removeForever(module, id) {
    const uid = firebaseAuth.currentUser.uid;
    await remove(ref(firebaseDb, `casamento/${uid}/${module}/${id}`));
  }
};
```

Registros com `archivedAt` não aparecem nas listas normais. A lixeira agrupa por módulo, mostra data e oferece Restaurar. Remover definitivamente exige modal com o nome do item.

- [ ] **Passo 3: finalizar acessibilidade e impressão**

Adicionar `aria-live="polite"` ao estado de sincronização, rótulos explícitos, foco inicial nos modais, retorno de foco ao fechar, tecla Escape, `prefers-reduced-motion` e estilos de impressão sem login, navegação ou botões.

- [ ] **Passo 4: atualizar README com configuração exata**

Documentar: criação do projeto Firebase, registro do app web, conta interna, UID, regras, configuração do `index.html`, GitHub Pages e troca da senha compartilhada. Não incluir credenciais reais.

- [ ] **Passo 5: executar suíte completa**

Executar: `npm test`  
Esperado: todos os testes passam.

- [ ] **Passo 6: teste manual em dois contextos**

Abrir computador e celular; editar áreas diferentes simultaneamente; desligar a rede, editar, recarregar, reconectar e confirmar envio da fila; verificar impressão e console.

- [ ] **Passo 7: revisão de segurança**

Confirmar no GitHub que não existem senha, chave privada ou credencial secreta. Confirmar no Firebase Rules Playground que UID incorreto não lê nem escreve.

- [ ] **Passo 8: commit final**

```bash
git add index.html README.md tests/app.spec.mjs
git commit -m "feat: finalize private wedding planning panel"
```

## Critério de encerramento

O projeto estará concluído somente quando os testes automatizados passarem, os fluxos manuais em dois aparelhos forem confirmados, as regras negarem usuários não autorizados e o GitHub Pages publicar a versão verificada sem erros de console.
