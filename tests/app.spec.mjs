import { test, expect } from '@playwright/test';

async function openFirstSupplierProposal(page) {
  await page.getByRole('button', { name: 'Fornecedores' }).click();
  await page.getByRole('button', { name: /1\. Espaço de eventos/ }).click();
  await page.locator('details.opt > summary').first().click();
}

async function openFirstGuestCard(page) {
  await page.getByRole('button', { name: 'Convidados' }).click();
  await page.locator('.guest-card > summary').first().click();
}

test('carrega o painel atual sem erro fatal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/index.html?test=1&authenticated=1');

  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.getByText('Próximos passos')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mostra acesso privado sem expor campo de e-mail', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page.getByRole('heading', { name: 'Acesso privado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar como Gustavo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar como Gleicianne' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar como Nanny' })).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveCount(0);
});

test('abre o painel quando encontra uma sessão autorizada já persistida', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const restored=await page.evaluate(() => {
    authSessionStarted=false;
    const started=startAuthenticatedSession(
      {email:'gustavohenriquecm@gmail.com'},
      {},
      {ref:() => ({}),onValue:() => {},set:async () => {}}
    );
    return {started,loginHidden:document.getElementById('login').hidden};
  });

  expect(restored).toEqual({started:true,loginHidden:true});
});

test('exibe o estado de sincronização no painel autenticado', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await expect(page.getByTestId('sync-status')).toBeVisible();
  await expect(page.getByTestId('sync-status')).toContainText('Salvo localmente');
});

test('atualiza imediatamente o texto do orçamento', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await page.getByTestId('budget-meta').fill('15000');
  await page.getByTestId('budget-teto').fill('20000');

  await expect(page.getByTestId('budget-summary')).toContainText('R$ 15.000');
  await expect(page.getByTestId('budget-summary')).toContainText('R$ 20.000');
});

test('cronograma não repete números mantidos em orçamento e convidados', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Cronograma' }).click();
  const planningTask=page.getByText('Definir estilo e prioridades do casamento', { exact: true });
  await expect(planningTask).toBeVisible();
  await expect(planningTask).not.toContainText('R$');
});

test('mostra o período inicial correto para casamento em maio de 2027', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await page.getByRole('button', { name: 'Cronograma' }).click();
  await expect(page.getByRole('button', { name: '12+ meses antes (até mai/2026)' })).toBeVisible();
});

test('usa 29/05/2027 em todas as fontes da data e na contagem regressiva', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await expect(page).toHaveTitle(/29\/05\/2027/);
  await expect(page.locator('.hero .date')).toHaveText('29 de maio de 2027 · sábado');

  const result = await page.evaluate(() => ({
    countdown: days(),
    expected: Math.max(0, Math.ceil((new Date(2027, 4, 29) - new Date()) / 86400000)),
    invitation: resolveGuestMessage('Olá, {{nome}}. O casamento será em {{data}}.', { nome: 'Ana' }),
    defaults: JSON.stringify(defaultDB())
  }));

  expect(result.countdown).toBe(result.expected);
  expect(result.invitation).toContain('29/05/2027');
  expect(result.defaults).toContain('29/05/2027');
  expect(result.defaults).not.toContain('15/05/2027');
});

test('mantém buffet neutro no cronograma e preferência em Noivos & Docs', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Cronograma' }).click();
  await expect(page.getByText('Fechar buffet, degustação e contrato').last()).toBeVisible();
  await expect(page.getByText(/parrilla \+ costela fogo de chão/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Noivos & Docs' }).click();
  await expect(page.getByText('Preferências dos noivos')).toBeVisible();
});

test('restringe o atalho de testes ao servidor local', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  expect(await page.evaluate(() => window.__test.isLocalTestMode('gustavohcmcorp-spec.github.io', '?test=1&authenticated=1'))).toBe(false);
  expect(await page.evaluate(() => window.__test.isLocalTestMode('127.0.0.1', '?test=1&authenticated=1'))).toBe(true);
});

test('normaliza campo monetário ao sair', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const input = page.getByTestId('budget-meta');

  await input.fill('1000');
  await input.blur();

  await expect(input).toHaveValue('R$ 1.000,00');
});

test('normaliza a diária da equipe como valor monetário', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Equipe' }).click();
  const daily = page.locator('.tab[data-tab="equipe"] tbody tr').first().locator('input').nth(2);

  await daily.fill('1250');
  await daily.blur();

  await expect(daily).toHaveValue('R$ 1.250,00');
});

test('usa convidados previstos como fonte de verdade', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Convidados' }).click();
  await page.getByTestId('guests-planned').fill('80');

  await page.getByRole('button', { name: 'Início' }).click();
  await expect(page.getByTestId('home-guests-planned')).toContainText('80');
});

test('salva imediatamente os convidados previstos e prioriza 60 sobre lista de 8', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    window.__plannedSnapshots=[];
    syncService={queueSnapshot(snapshot){window.__plannedSnapshots.push(snapshot.convidadosPrevistos);}};
    DB.convidados=[{nome:'Família',ad:'8',cr:''}];
    renderConvidados();
  });

  await page.getByRole('button', { name: 'Convidados' }).click();
  await page.getByTestId('guests-planned').fill('60');

  expect(await page.evaluate(() => ({base:guestPlanningBase(), snapshots:window.__plannedSnapshots}))).toEqual({base:60,snapshots:['60']});
});

test('mostra o avanço de confirmações em relação aos convidados previstos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.convidadosPrevistos='10'; DB.convidados[0]={nome:'Família',ad:'2',cr:'',conf:'Confirmado'}; renderConvidados(); });
  await expect(page.getByTestId('rsvp-progress')).toContainText('2 de 10');
});

test('separa adultos e crianças nas métricas de convidados', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.convidados=[{nome:'Família',ad:'2',cr:'3',conf:'Confirmado'}]; renderConvidados(); });
  await expect(page.getByTestId('guest-adults')).toContainText('2');
  await expect(page.getByTestId('guest-children')).toContainText('3');
});

test('mostra faixas infantis e totalizadores por família', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.convidados=[
      {nome:'A',grupo:'Noiva',ad:'2',crAte5:'1',crMais5:'2',conf:'Pendente'},
      {nome:'B',grupo:'Noivo',ad:'1',crAte5:'2',crMais5:'',conf:'Pendente'}
    ];
    renderConvidados();
  });

  await page.getByRole('button',{name:'Convidados'}).click();
  await expect(page.getByTestId('guest-children-under-5')).toContainText('3');
  await expect(page.getByTestId('guest-children-6-to-10')).toContainText('0');
  await expect(page.getByTestId('guest-children-11-plus')).toContainText('2');
  await expect(page.getByTestId('family-totals')).toContainText('Família Noiva · 5 pessoas');
  await expect(page.getByTestId('family-totals')).toContainText('Família Noivo · 3 pessoas');
  await expect(page.locator('.guest-print th')).toHaveText(['Nome / família','Ad','Até 5','6–10','11+','Pessoas convidadas']);
});

test('contabiliza confirmações nas duas faixas infantis', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  expect(await page.evaluate(() => {
    DB.convidados=[{nome:'Família',ad:'2',crAte5:'1',crMais5:'2',conf:'Confirmado'}];
    return confirmados();
  })).toBe(5);
});

test('preserva nomes ao realocar crianças entre as faixas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const people = await page.evaluate(() => {
    const guest={
      nome:'Família Silva', ad:'2', crAte5:'1', cr6a10:'', cr11mais:'0',
      pessoas:[
        {tipo:'Adulto',nome:'Ana'},
        {tipo:'Adulto',nome:'Bruno'},
        {tipo:'Criança até 5',nome:'Clara'}
      ]
    };
    guest.crAte5='0';
    ensureGuestPeople(guest);
    guest.cr11mais='1';
    return ensureGuestPeople(guest);
  });

  expect(people).toEqual([
    {tipo:'Adulto',nome:'Ana'},
    {tipo:'Adulto',nome:'Bruno'},
    {tipo:'Criança 11+',nome:'Clara'}
  ]);
});

test('preserva nomes quando a realocação acontece pelos campos da tabela', async ({ page }) => {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.convidados=[{nome:'Família Silva',ad:'2',crAte5:'1',cr6a10:'',cr11mais:'0',convite:'Não enviado',conf:'Pendente',pessoas:[
      {tipo:'Adulto',nome:'Ana'}, {tipo:'Adulto',nome:'Bruno'}, {tipo:'Criança até 5',nome:'Clara'}
    ]}];
    renderConvidados();
  });
  await page.getByRole('button',{name:'Convidados'}).click();

  await page.locator('.guest-table .guest-under-five input').fill('0');
  await page.locator('.guest-table .guest-under-five input').press('Tab');
  await page.locator('.guest-table .guest-eleven-plus input').fill('1');
  await page.locator('.guest-table .guest-eleven-plus input').press('Tab');

  expect(await page.evaluate(() => DB.convidados[0].pessoas)).toEqual([
    {tipo:'Adulto',nome:'Ana'},
    {tipo:'Adulto',nome:'Bruno'},
    {tipo:'Criança 11+',nome:'Clara'}
  ]);
});

test('envia a versão mais nova quando duas alterações são sincronizadas rapidamente', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const sent=await page.evaluate(async () => {
    localStorage.removeItem(OUTBOX_KEY);
    const calls=[],release=[];
    const service=makeSyncService({},() => ({}),() => {},(_root,snapshot) => new Promise(resolve => {
      calls.push(snapshot.version);
      release.push(resolve);
    }));
    service.queueSnapshot({version:1});
    await new Promise(resolve => setTimeout(resolve,0));
    service.queueSnapshot({version:2});
    release.shift()();
    await new Promise(resolve => setTimeout(resolve,0));
    if(release.length)release.shift()();
    await new Promise(resolve => setTimeout(resolve,0));
    return calls;
  });

  expect(sent).toEqual([1,2]);
});

test('grava imediatamente um nome digitado em Pessoas convidadas', async ({ page }) => {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    window.__guestSnapshots=[];
    syncService={queueSnapshot(snapshot){window.__guestSnapshots.push(JSON.parse(JSON.stringify(snapshot)));}};
    DB.convidados=[{nome:'Família Silva',ad:'1',crAte5:'0',crMais5:'0',convite:'Não enviado',conf:'Pendente',pessoas:[{tipo:'Adulto',nome:''}]}];
    renderConvidados();
  });
  await page.getByRole('button',{name:'Convidados'}).click();
  await page.locator('.guest-table .guest-people summary').first().click();
  await page.locator('.guest-table .guest-people input').first().fill('Ana');

  expect(await page.evaluate(() => ({
    value:document.querySelector('.guest-table .guest-people input').value,
    db:DB.convidados[0].pessoas[0].nome,
    snapshots:window.__guestSnapshots.map(snapshot => snapshot.convidados[0].pessoas[0].nome)
  }))).toEqual({value:'Ana',db:'Ana',snapshots:['Ana']});
});

test('amplia somente a aba Convidados e preserva cartões móveis', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();
  await expect(page.locator('.wrap')).toHaveClass(/wide/);
  await expect(page.locator('.wrap')).toHaveCSS('max-width','1720px');
  await expect(page.locator('.guest-overview')).toHaveCSS('max-width','840px');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.guest-cards')).toBeVisible();
  await expect(page.locator('.guest-table')).toBeHidden();
  await page.getByRole('button',{name:'Início'}).click();
  await expect(page.locator('.wrap')).not.toHaveClass(/wide/);
});

test('prioriza tabela legível e totais da família dos noivos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.convidados=[
      {nome:'Ana',grupo:'Noiva',ad:'2',crAte5:'1',crMais5:'0',conf:'Pendente'},
      {nome:'Bruno',grupo:'Noivo',ad:'1',crAte5:'0',crMais5:'2',conf:'Pendente'}
    ];
    renderConvidados();
  });
  await page.getByRole('button',{name:'Convidados'}).click();

  await expect(page.getByTestId('family-totals')).toContainText('Família Noiva · 3 pessoas');
  await expect(page.getByTestId('family-totals')).toContainText('Família Noivo · 3 pessoas');
  await expect(page.locator('.guest-table thead')).toContainText('Crianças até 5 anos');
  await expect(page.locator('.guest-table thead')).toContainText('Crianças de 6 a 10 anos');
  await expect(page.locator('.guest-table thead')).toContainText('Crianças com 11 anos ou mais');
  await expect(page.locator('.guest-table thead')).not.toContainText('Mesa');
});

test('estrutura a tabela de convidados com larguras e ações explícitas', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error => errors.push(error.message));
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();

  expect(errors).toEqual([]);
  await expect(page.locator('.guest-table th')).toHaveText([
    'Nome','Família','Adultos','Crianças até 5 anos','Crianças de 6 a 10 anos','Crianças com 11 anos ou mais',
    'WhatsApp','Convite','Confirmação','Pessoas convidadas','Ações'
  ]);
  await expect(page.locator('.guest-table colgroup col')).toHaveCount(11);
  const widths=await page.locator('.guest-table tbody tr').first().evaluate(row => ({
    name:row.querySelector('.guest-name').getBoundingClientRect().width,
    people:row.querySelector('.guest-people').getBoundingClientRect().width,
    actions:row.querySelector('.guest-actions').getBoundingClientRect().width
  }));
  expect(widths.people).toBeGreaterThan(widths.name);
  expect(widths.actions).toBeGreaterThan(100);
});

test('permite ajustar e salvar larguras da tabela somente no computador', async ({ page }) => {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();

  await expect(page.locator('.guest-col-resize')).toHaveCount(11);
  const desktop=await page.evaluate(() => {
    setGuestColumnWidth(0,280);
    renderConvidados();
    return {saved:DB.guestColumnWidths[0],width:document.querySelector('.guest-table col').style.width};
  });
  expect(desktop).toEqual({saved:280,width:'280px'});

  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.guest-table')).toBeHidden();
  await expect(page.locator('.guest-cards')).toBeVisible();
});

test('mantém resumo compacto e cartões móveis sem mesa', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();

  await expect(page.locator('.guest-overview')).toHaveCSS('max-width','840px');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.guest-cards')).toBeVisible();
  expect((await page.locator('.guest-card').allTextContents()).join(' ')).not.toContain('Mesa');
});

test('oferece cartões móveis e lista A4 própria para a portaria', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.convidados=[{nome:'Família Silva',ad:'2',cr:'1',pessoas:[{tipo:'Adulto',nome:'Ana'},{tipo:'Adulto',nome:'Bruno'},{tipo:'Criança',nome:'Clara'}],conf:'Confirmado'}]; renderConvidados(); });
  await page.getByRole('button', { name: 'Convidados' }).click();

  await expect(page.locator('.guest-cards')).toBeVisible();
  await expect(page.locator('.guest-table')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imprimir Convidados' })).toBeVisible();
  await expect(page.locator('.bar')).toHaveCount(0);
  await expect(page.locator('.guest-print th')).toHaveText(['Nome / família','Ad','Até 5','6–10','11+','Pessoas convidadas']);
  await expect(page.locator('.guest-print')).toContainText('Ana, Bruno, Clara');
});

test('permite preparar convite individual no WhatsApp', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstGuestCard(page);
  await expect(page.getByRole('button', { name: 'Preparar WhatsApp' }).first()).toBeVisible();
});

test('inclui horário e local na mensagem do WhatsApp', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { window.__openedWhatsApp=''; window.open=(url)=>{window.__openedWhatsApp=url;}; DB.local='Espaço Jardim'; DB.hora='16:00'; DB.convidados[0].nome='Ana'; DB.convidados[0].telefone='5562999999999'; renderConvidados(); });
  await openFirstGuestCard(page);
  await page.getByRole('button', { name: 'Preparar WhatsApp' }).first().click();
  const message=decodeURIComponent(await page.evaluate(() => window.__openedWhatsApp));
  expect(message).toContain('16:00');
  expect(message).toContain('Espaço Jardim');
});

test('usa mensagem-base personalizada preservando o nome do convidado', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    window.__openedWhatsApp=''; window.open=(url)=>{window.__openedWhatsApp=url;};
    DB.mensagens={convite:'Olá, {{nome}}! Mensagem especial para {{local}}.',lembrete:''};
    DB.local='Espaço Jardim'; DB.convidados[0]={nome:'Ana',telefone:'5562999999999',ad:'1',cr:'',conf:'Pendente'};
    prepareWhatsAppInvite(DB.convidados[0],false);
  });
  const message=decodeURIComponent(await page.evaluate(() => window.__openedWhatsApp));
  expect(message).toContain('Olá, Ana!');
  expect(message).toContain('Mensagem especial para Espaço Jardim');
});

test('oferece lembrete final para RSVP pendente', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstGuestCard(page);
  await expect(page.getByRole('button', { name: 'Lembrete RSVP' }).first()).toBeVisible();
});

test('abre o detalhamento de parcelas sem poluir a tabela', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();

  await page.getByRole('button', { name: 'Parcelas' }).first().click();
  await expect(page.getByRole('button', { name: 'Gerar parcelas' })).toBeVisible();
});

test('mantém parcelas abertas enquanto digita o valor da entrada', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByRole('button', { name: 'Parcelas' }).first().click();

  const details = page.locator('.tab[data-tab="pagamentos"] .acc-b.open');
  await expect(details).toHaveCount(1);
  await details.getByRole('textbox', { name: 'Entrada' }).fill('2100');

  await expect(details.getByRole('button', { name: 'Gerar parcelas' })).toBeVisible();
  await expect(details.getByRole('textbox', { name: 'Entrada' })).toHaveValue('2100');
});

test('permite controlar a entrada e cada parcela separadamente', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByRole('button', { name: 'Parcelas' }).first().click();

  await expect(page.getByLabel('Status da entrada').first()).toBeVisible();
});

test('considera a entrada paga antes de gerar as parcelas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const paid = await page.evaluate(() => paymentPaid(ensurePayment({
    total: '1000',
    entradaValor: '100',
    entradaStatus: 'Pago',
    parcelasDetalhes: []
  })));

  expect(paid).toBe(100);
});

test('calcula a condição do Espaço Nobre com entrada e quatro parcelas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const payment = await page.evaluate(() => {
    const nobre = ensurePayment({
      forn: 'Espaço Nobre', total: '7000', entradaTipo: 'percentual', entradaValor: '30',
      entradaStatus: 'Pago', entradaDataPagamento: '2026-07-21', parcelasQtd: '4', primeiroVencimento: '2027-01-15'
    });
    generateInstallments(nobre);
    return nobre;
  });

  expect(payment.entradaDataPagamento).toBe('2026-07-21');
  expect(payment.parcelasDetalhes.map(item => item.vencimento)).toEqual(['2027-01-15', '2027-02-15', '2027-03-15', '2027-04-15']);
  expect(payment.parcelasDetalhes.map(item => item.valor)).toEqual(['R$ 1.225,00', 'R$ 1.225,00', 'R$ 1.225,00', 'R$ 1.225,00']);
});

test('migra Pix parcelado para forma Pix e condição parcelada', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    const nobre = ensurePayment({
      total: '7000', modalidadeEscolhida: 'pix', entradaTipo: 'percentual', entradaValor: '30', entradaStatus: 'Pago',
      parcelasDetalhes: [{ numero: 1, vencimento: '2027-01-15', valor: '1225', status: 'Pendente' }]
    });
    return { forma: nobre.formaPagamento, condicao: nobre.condicaoPagamento, pago: paymentPaid(nobre) };
  });

  expect(result.forma).toBe('pix');
  expect(result.condicao).toBe('parcelado');
  expect(result.pago).toBe(2100);
});

test('oferece cartão de crédito como forma para pagamento parcelado', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  const forms = page.getByRole('combobox', { name: 'Forma de pagamento' });
  await expect(forms).toHaveCount(23);
  await forms.first().selectOption('cartao');

  await expect(forms.first()).toHaveValue('cartao');
});

test('mantém parcelas abertas depois de marcar a entrada como paga', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByRole('button', { name: 'Parcelas' }).first().click();

  const details = page.locator('.tab[data-tab="pagamentos"] .acc-b.open');
  await expect(details).toHaveCount(1);
  await details.getByRole('combobox', { name: 'Status da entrada' }).selectOption('Pago');

  await expect(page.locator('.tab[data-tab="pagamentos"] .acc-b.open')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Gerar parcelas' })).toBeVisible();
});

test('permite marcar pagamento à vista por Pix', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByLabel('Condição de pagamento').first().selectOption('avista');
  await page.getByLabel('Forma de pagamento').first().selectOption('pix');
  await page.getByRole('button', { name: 'Parcelas' }).first().click();

  await expect(page.getByLabel('Pagamento à vista realizado').first()).toBeVisible();
});

test('mostra o próximo vencimento pendente no painel', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.pagamentos[0] = ensurePayment({ forn: 'Fornecedor mais próximo', parcelasDetalhes: [{ numero: 1, vencimento: '2026-07-25', valor: 'R$ 250,00', status: 'Pendente' }] });
    DB.pagamentos[1] = ensurePayment({ forn: 'Fornecedor posterior', parcelasDetalhes: [{ numero: 1, vencimento: '2026-08-25', valor: 'R$ 300,00', status: 'Pendente' }] });
    renderInicio();
  });

  await expect(page.getByTestId('next-payment')).toContainText('Fornecedor mais próximo');
  await expect(page.getByTestId('next-payment')).toContainText('R$ 250,00');
});

test('mostra progresso de fornecedores escolhidos no painel', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.categorias[0].opcaoEscolhida=0; renderInicio(); });
  await expect(page.getByTestId('supplier-progress')).toContainText('1 de');
});

test('mostra Não terá no título e exclui a categoria das métricas', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.categorias.find(category => category.nome==='20. Transporte').naoTera='Não terá'; renderInicio(); });
  await expect(page.getByTestId('supplier-progress')).toContainText('de 23');
  await page.getByRole('button', { name: 'Fornecedores' }).click();
  await expect(page.getByRole('button', { name: /20\. Transporte.*Não terá/ })).toBeVisible();
});

test('mantém itens incluídos dentro de cada proposta de fornecedor', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await expect(page.getByText('Itens incluídos e pendências').first()).toBeVisible();
});

test('mantém propostas de fornecedores recolhidas no celular', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Fornecedores' }).click();
  await page.getByRole('button', { name: /1\. Espaço de eventos/ }).click();
  const proposal=page.locator('details.opt').first();
  await expect(proposal).not.toHaveAttribute('open','');
  await expect(proposal.getByRole('button', { name: 'Escolher esta opção' })).toBeHidden();
  await proposal.locator('summary').first().click();
  await expect(proposal.getByRole('button', { name: 'Escolher esta opção' })).toBeVisible();
});

test('explica a fonte do cálculo por pessoa em fornecedores e pagamentos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.convidadosPrevistos='80'; DB.categorias[0].opcoes[0].tipoCobranca='porPessoa'; DB.categorias[0].opcoes[0].valorUnitario='100'; renderFornecedores(); });
  await openFirstSupplierProposal(page);
  await expect(page.getByTestId('supplier-per-person-hint').first()).toContainText('Base: 80 convidados');

  await page.evaluate(() => { DB.pagamentos[0]=ensurePayment({forn:'Buffet',tipoCobranca:'porPessoa',valorUnitario:'100'}); renderPagamentos(); });
  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByRole('button', { name: 'Parcelas' }).first().click();
  await expect(page.getByTestId('payment-per-person-hint').first()).toContainText('Base: 80 convidados');
});

test('mantém a proposta aberta e usa a maior base de convidados no valor por pessoa', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.convidadosPrevistos='60';
    DB.convidados=[{nome:'Família',ad:'50',cr:'20'}];
    renderFornecedores();
  });

  await openFirstSupplierProposal(page);
  const proposal=page.locator('details.opt').first();
  await proposal.locator('select').first().selectOption('porPessoa');
  await expect(proposal).toHaveAttribute('open','open');
  const price=proposal.locator('.proposal-body > .grid2').nth(1).locator('input');
  await price.fill('100');
  await price.blur();
  await expect(page.getByTestId('supplier-per-person-hint').first()).toContainText('Total estimado: R$ 7.000,00');
  await expect(page.getByTestId('supplier-per-person-hint').first()).toContainText('Base: 70 convidados');

  await page.getByRole('button', { name: 'Escolher esta opção' }).first().click();
  expect(await page.evaluate(() => paymentTotal(DB.pagamentos[0]))).toBe(7000);
});

test('permite desfazer a escolha preservando o financeiro', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await page.getByRole('button', { name: 'Escolher esta opção' }).first().click();
  await expect(page.getByRole('button', { name: 'Desfazer escolha' }).first()).toBeVisible();
  const countAfterChoice = await page.evaluate(() => DB.pagamentos.length);
  await page.getByRole('button', { name: 'Desfazer escolha' }).first().click();
  await expect(page.getByRole('button', { name: 'Escolher esta opção' }).first()).toBeVisible();
  expect(await page.evaluate(() => DB.pagamentos.length)).toBe(countAfterChoice);
  expect(await page.evaluate(() => DB.pagamentos.find(payment => payment.forn==='Espaço de eventos').vinculoFornecedor)).toBe('');
});

test('desvincula e preserva pagamento antigo sem id', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  const remaining = await page.evaluate(() => {
    DB.pagamentos=[ensurePayment({forn:'Espaço',total:'1000'})];
    const category=DB.categorias[0];
    chooseSupplierOption(category,category.opcoes[0],0);
    unchooseSupplierOption(category);
    return {length:DB.pagamentos.length,link:DB.pagamentos[0].vinculoFornecedor};
  });
  expect(remaining).toEqual({length:1,link:''});
});

test('oferece rota do Google Maps para visita de fornecedor', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await page.getByText('Visita ao fornecedor').first().click();
  await expect(page.getByRole('link', { name: 'Abrir no Google Maps' }).first()).toBeVisible();
});

test('oferece evento de agenda para visita de fornecedor', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await page.getByText('Visita ao fornecedor').first().click();
  await expect(page.getByRole('button', { name: 'Adicionar à agenda' }).first()).toBeVisible();
});

test('oferece controle de contrato por proposta de fornecedor', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await expect(page.locator('summary').filter({hasText:'Contrato'}).first()).toBeVisible();
});

test('oferece conferência preventiva do contrato por proposta', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await openFirstSupplierProposal(page);
  await expect(page.locator('summary').filter({hasText:'Pontos críticos do contrato'}).first()).toBeVisible();
});

test('central de alertas mostra riscos de orçamento e fornecedores', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.teto='100'; DB.pagamentos[0]=ensurePayment({forn:'Espaço',total:'150'}); renderInicio(); });
  await expect(page.getByTestId('preventive-alerts')).toContainText('teto');
  await expect(page.getByTestId('preventive-alerts')).toContainText('fornecedores');
});

test('central alerta item não incluso na proposta escolhida', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.categorias[0].opcaoEscolhida=0; DB.categorias[0].opcoes[0].itens=[{label:'Gerador',inc:'Não'}]; renderInicio(); });
  await expect(page.getByTestId('preventive-alerts')).toContainText('itens não inclusos');
});

test('central alerta tarefa com prazo vencido', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.cronograma[0].tarefas[0].done=false; DB.cronograma[0].tarefas[0].prazo='2020-01-01'; renderInicio(); });
  await expect(page.getByTestId('preventive-alerts')).toContainText('tarefas vencidas');
});

test('central diferencia convite não enviado de RSVP pendente', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => { DB.convidados=[{nome:'Ana',ad:'1',cr:'',convite:'Não enviado',conf:'Pendente'}]; renderInicio(); });
  await expect(page.getByTestId('preventive-alerts')).toContainText('convites ainda não foram enviados');
});

test('oferece checklist de contingências do casamento', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button', { name: 'Essenciais' }).click();
  await expect(page.getByText('Plano B e contingências')).toBeVisible();
});

test('prioriza próximos passos pelo prazo mais urgente', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.cronograma.forEach(fase => fase.tarefas.forEach(tarefa => { tarefa.done = true; tarefa.prazo = ''; }));
    DB.cronograma[0].tarefas[0].done = false;
    DB.cronograma[0].tarefas[0].prazo = '2027-05-01';
    DB.cronograma[5].tarefas[0].done = false;
    DB.cronograma[5].tarefas[0].prazo = '2026-08-01';
    renderInicio();
  });
  const steps = page.getByTestId('next-steps');
  await expect(steps.locator('.ct').first()).toContainText('habilitação');
  await expect(steps).toContainText('01/08/2026');
});

test('permite editar vencimento, valor e situação de cada parcela', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    const payment = DB.pagamentos[0];
    payment.total = '1000';
    payment.entradaValor = '100';
    payment.parcelasQtd = '2';
    payment.primeiroVencimento = '2026-08-10';
    generateInstallments(payment);
    renderPagamentos();
  });

  await page.getByRole('button', { name: 'Pagamentos' }).click();
  await page.getByRole('button', { name: 'Parcelas' }).first().click();
  await expect(page.getByLabel('Vencimento da parcela 1').first()).toBeVisible();
  await expect(page.getByLabel('Valor da parcela 1').first()).toBeVisible();
  await expect(page.getByLabel('Situação da parcela 1').first()).toBeVisible();
});

test('mostra barras de orçamento comprometido e pago', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  await expect(page.getByText('Comprometido do teto')).toBeVisible();
  await expect(page.getByText('Pago do teto')).toBeVisible();
});

test('calcula fornecedor por idade e considera previstos pendentes como adultos', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result = await page.evaluate(() => {
    DB.convidadosPrevistos='10';
    DB.convidados=[{nome:'Família',ad:'2',crAte5:'1',cr6a10:'3',cr11mais:'1'}];
    const supplier={tipoCobranca:'porFaixa',valorAdulto:'112',valorAte5:'0',valor6a10:'56',valor11mais:'112'};
    const payment=ensurePayment(Object.assign({forn:'Buffet'},supplier));
    return {supplier:supplierTotal(supplier),payment:paymentTotal(payment)};
  });

  expect(result).toEqual({supplier:840,payment:840});
});

test('separa crianças até 5, de 6 a 10 e com 11 anos ou mais', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();

  const headers=await page.locator('.guest-table thead th').allTextContents();
  expect(headers).toContain('Crianças até 5 anos');
  expect(headers).toContain('Crianças de 6 a 10 anos');
  expect(headers).toContain('Crianças com 11 anos ou mais');
});

test('mostra valores por faixa apenas ao selecionar o modelo por faixa', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.categorias=[{nome:'1. Buffet',itens:[],open:true,opcoes:[{nome:'Buffet teste',tipoCobranca:'fechado',valor:'',open:true}]}];
    renderFornecedores();
    showTab('fornecedores');
  });

  const proposal=page.locator('.tab[data-tab="fornecedores"] details.opt').first();
  await proposal.locator('select').first().selectOption('porFaixa');
  await expect(proposal.getByText('Crianças de 6 a 10 anos')).toBeVisible();
});

test('envia pacote escolhido para pagamento com o total da opção', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const total=await page.evaluate(() => {
    DB.pagamentos=[];
    const category={nome:'1. Bebidas',itens:[],opcoes:[]};
    const option={id:'bebidas',nome:'Bebidas',tipoCobranca:'pacote',pacotes:[{id:'gold-4',nome:'Gold · 4 horas',duracao:'4 horas',valor:'2800'}],pacoteEscolhido:'gold-4'};
    category.opcoes.push(option);
    chooseSupplierOption(category,option,0);
    return paymentTotal(DB.pagamentos[0]);
  });

  expect(total).toBe(2800);
});

test('mostra o detalhamento por faixa no pagamento vinculado', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.pagamentos=[ensurePayment({forn:'Buffet',tipoCobranca:'porFaixa',valorAdulto:'112',valorAte5:'0',valor6a10:'56',valor11mais:'112'})];
    renderPagamentos();
    showTab('pagamentos');
  });

  await page.getByRole('button',{name:'Parcelas'}).click();
  await expect(page.getByText('Crianças de 6 a 10 anos (R$)')).toBeVisible();
  await expect(page.getByTestId('payment-per-person-hint')).toContainText('ainda sem faixa');
});

test('só envia pacote selecionado ao financeiro com a condição contratada', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const result=await page.evaluate(() => {
    DB.pagamentos=[];
    const category={nome:'1. Bebidas',itens:[],opcoes:[]};
    const option={nome:'TropicalDrinks',tipoCobranca:'pacote',pacotes:[
      {id:'gold-4',nome:'Gold',duracao:'4 horas',valor:'2800'},
      {id:'gold-6',nome:'Gold',duracao:'6 horas',valor:'4200'}
    ]};
    category.opcoes.push(option);
    chooseSupplierOption(category,option,0);
    const withoutPackage=DB.pagamentos.length;
    option.pacoteEscolhido='gold-6';
    chooseSupplierOption(category,option,0);
    return {withoutPackage,payment:DB.pagamentos[0]};
  });

  expect(result.withoutPackage).toBe(0);
  expect(result.payment).toMatchObject({forn:'TropicalDrinks',tipoCobranca:'pacote',pacoteEscolhido:'gold-6',pacoteDescricao:'Gold · 6 horas'});
  expect(result.payment.pacotes).toHaveLength(2);
  expect(result.payment.pacotes.find(item => item.id==='gold-6').valor).toBe('4200');
});

test('permite selecionar uma condição de pacote antes de contratar o fornecedor', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.evaluate(() => {
    DB.categorias=[{nome:'1. Bebidas',itens:[],open:true,opcoes:[{nome:'TropicalDrinks',open:true,tipoCobranca:'pacote',pacotes:[{id:'gold-4',nome:'Gold',duracao:'4 horas',valor:'2800'}]}]}];
    showTab('fornecedores');
  });

  await page.getByRole('button',{name:'Selecionar Gold · 4 horas'}).click();
  await expect(page.getByRole('button',{name:'Contratar Gold · 4 horas'})).toBeVisible();
  await expect(page.getByText('Escolha',{exact:true})).toHaveCount(0);
});

test('menciona todos os convidados preenchidos na mensagem individual da família', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');

  const text=await page.evaluate(() => resolveGuestMessage(
    'Olá, {{nomes_convidados}}! Acompanhantes: {{acompanhantes}}. {{mapa}}',
    {nome:'Gleison Sousa Carvalho',pessoas:[
      {tipo:'Adulto',nome:'Gleison Sousa Carvalho'},
      {tipo:'Adulto',nome:'Matheus'},
      {tipo:'Adulto',nome:'Gabriel'},
      {tipo:'Adulto',nome:'Victor'},
      {tipo:'Criança',nome:''}
    ]}
  ));

  expect(text).toBe('Olá, Gleison Sousa Carvalho, Matheus, Gabriel e Victor! Acompanhantes: Matheus, Gabriel e Victor. https://maps.app.goo.gl/iP4X9CYTqkDAZXWH7');
  expect(await page.evaluate(() => defaultDB().mensagens.convite)).toContain('{{nomes_convidados}}');
});

test('explica os novos placeholders de nomes nas mensagens do WhatsApp', async ({ page }) => {
  await page.goto('/index.html?test=1&authenticated=1');
  await page.getByRole('button',{name:'Convidados'}).click();
  await page.getByText('Personalizar mensagens do WhatsApp',{exact:true}).click();

  await expect(page.getByText('{{nomes_convidados}}')).toBeVisible();
  await expect(page.getByText('{{acompanhantes}}')).toBeVisible();
});
