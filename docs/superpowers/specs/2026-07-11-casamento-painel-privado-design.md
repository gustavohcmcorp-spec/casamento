# Painel privado de planejamento de casamento — desenho

Data: 11 de julho de 2026  
Evento: 29 de maio de 2027, Goiânia/GO  
Repositório: `gustavohcmcorp-spec/casamento`

## 1. Objetivo

Evoluir o `index.html` existente para um painel privado de planejamento usado apenas pelo casal e pela cerimonial. O painel deve ser completo, fácil de entender no celular e no computador, visualmente leve e editável pela própria interface, sem exigir alterações manuais no código.

## 2. Decisões aprovadas

- Continuar como um único `index.html`, sem framework e compatível com GitHub Pages.
- Preservar a identidade visual leve atual, refinando hierarquia, espaçamento e responsividade.
- Acesso exclusivo de três pessoas por uma única senha compartilhada.
- A tela exibirá somente o campo de senha; internamente, o Firebase Authentication usará uma conta fixa.
- A senha nunca será incluída no HTML nem armazenada no banco.
- As regras do Realtime Database liberarão leitura e escrita somente para o UID autorizado.
- Sincronização em tempo real por registros e campos, evitando substituir o banco inteiro.
- Cache local automático para leitura e edição durante interrupções de internet.
- Remover da interface e do código as funções manuais “Salvar cópia” e “Restaurar”.
- Inclusões futuras serão feitas pelo próprio painel, não pela edição do HTML.
- O sistema continuará sendo um painel privado; não haverá página pública para convidados.

## 3. Não objetivos

- Não criar área pública, lista pública de presentes ou convite público.
- Não criar contas individuais nem níveis diferentes de permissão.
- Não registrar qual das três pessoas realizou cada alteração.
- Não migrar para framework.
- Não armazenar arquivos binários no Firebase Storage nesta fase.
- Não adicionar funcionalidades comerciais ou suporte a vários casamentos.

## 4. Navegação e apresentação

A navegação principal será reduzida a cinco áreas:

1. **Início** — resumo do andamento, próximos passos, atrasos, orçamento, vencimentos e RSVP.
2. **Planejamento** — cronograma, documentos, beleza, lua de mel e listas essenciais.
3. **Fornecedores** — cotações, decisões, contratos por link, equipe e pagamentos.
4. **Convidados** — famílias, quantidades, contatos, confirmação, restrições alimentares, mesas e convite por WhatsApp.
5. **Dia D** — programação, responsáveis, contatos e conferência final.

Cada área mostrará primeiro resumos e alertas. Formulários longos, listas concluídas e detalhes secundários ficarão recolhidos e poderão ser expandidos. No celular, tabelas extensas serão substituídas ou complementadas por cartões editáveis para evitar rolagem horizontal excessiva.

## 5. Capacidades de edição

Nas áreas aplicáveis, os usuários poderão:

- criar, editar, duplicar, reordenar e arquivar registros;
- acrescentar categorias, fases, tarefas e itens de checklist;
- reabrir tarefas concluídas;
- recuperar itens arquivados ou excluídos recentemente;
- adicionar observações, responsáveis e links externos;
- pesquisar e filtrar listas maiores;
- confirmar ações destrutivas.

A exclusão comum será lógica: o registro irá para uma lixeira temporária. A remoção definitiva não será a ação padrão.

## 6. Conteúdo funcional

### 6.1 Início

- Contagem regressiva e informações principais do evento.
- Progresso geral das tarefas.
- Próximas tarefas, tarefas atrasadas e tarefas concluídas recolhidas.
- Resumo financeiro: contratado, pago, saldo, meta e teto.
- Próximos vencimentos.
- Resumo de convidados: previstos, confirmados, pendentes e recusados.
- Estado discreto da sincronização.

### 6.2 Planejamento

- Fases e tarefas com prazo, responsável, estado, prioridade e observação.
- Criação e reordenação de fases e tarefas.
- Documentação civil com aviso para confirmar exigências diretamente no cartório.
- Beleza, bem-estar, lua de mel, kit de emergência e listas da semana.
- Seções recolhíveis com contagem de itens concluídos.

### 6.3 Fornecedores

- Categorias editáveis e opções de orçamento.
- Nome, contato, valor, itens incluídos, validade, observações e link do contrato.
- Estado: pesquisando, orçamento recebido, reservado, contratado, concluído ou descartado.
- Comparação de opções e indicação da escolhida.
- Equipe do evento com função, quantidade, custo, horário e contato.
- Pagamentos com total, entrada, parcelas, vencimento, pago e saldo.

### 6.4 Convidados

- Registro por pessoa ou família.
- Grupo, adultos, crianças, telefone, RSVP, mesa e observações.
- Restrições alimentares e necessidades de acessibilidade.
- Mensagem de convite editável com variáveis de nome e nomes dos noivos.
- Link de WhatsApp com normalização de telefone brasileiro.
- Indicadores e filtros por grupo, confirmação e mesa.

### 6.5 Dia D

- Linha do tempo editável e ordenada por horário.
- Responsável, contato, local, observação e estado.
- Inclusão e reordenação de momentos.
- Visual de conferência para celular.
- Contatos críticos e pendências do dia.

## 7. Autenticação e segurança

O Firebase Authentication utilizará uma conta de e-mail/senha criada exclusivamente para o painel. O endereço interno poderá estar na configuração pública do cliente; a senha será informada na tela e enviada diretamente ao Firebase.

As regras do Realtime Database deverão:

- negar tudo por padrão;
- liberar leitura e escrita somente quando `auth.uid` corresponder ao UID autorizado;
- limitar o acesso ao caminho exclusivo deste casamento;
- validar estruturas essenciais e tamanhos máximos onde for viável;
- nunca usar regras públicas como `".read": true` ou `".write": true`.

A sessão poderá permanecer ativa no aparelho. Haverá botão “Sair”. Mensagens de login não revelarão se o endereço interno existe, e tentativas repetidas receberão espera progressiva na interface.

## 8. Estrutura e sincronização dos dados

O banco usará um esquema versionado, dividido em:

- `config`
- `tarefas`
- `fornecedores`
- `equipe`
- `pagamentos`
- `convidados`
- `diaD`
- `checklists`
- `lixeira`

Registros editáveis terão identificador estável, `createdAt` e `updatedAt`. Alterações serão enviadas ao caminho do registro ou campo correspondente, com debounce para digitação. Edições simultâneas em módulos diferentes não se substituem. Se o mesmo campo for alterado simultaneamente, prevalece a atualização mais recente apenas naquele campo.

O navegador manterá cópia local automática. Enquanto estiver offline, alterações ficarão pendentes e serão reenviadas após a reconexão. O Firebase será a fonte oficial após a autenticação.

## 9. Migração dos dados existentes

O carregamento verificará a versão do esquema:

- dados compatíveis serão usados diretamente;
- dados da versão local atual serão transformados uma única vez;
- campos ausentes receberão valores padrão sem apagar preenchimentos;
- a migração será idempotente;
- o esquema novo será gravado somente após autenticação e validação;
- erros impedirão a substituição dos dados remotos e serão explicados na interface.

## 10. Estados e tratamento de falhas

A interface mostrará:

- **Salvando**
- **Sincronizado**
- **Offline — alterações pendentes**
- **Erro ao salvar — tentar novamente**

Falhas de autenticação manterão o painel bloqueado. Falhas de rede preservarão a edição local. Operações destrutivas exigirão confirmação ou oferecerão desfazer. Erros inesperados serão registrados sem expor dados sensíveis.

## 11. Acessibilidade e responsividade

- Uso completo por teclado e foco visível.
- Rótulos associados aos controles.
- Contraste adequado e textos legíveis.
- Áreas de toque confortáveis no celular.
- Respeito à redução de movimento.
- Mensagens de estado anunciáveis por tecnologias assistivas.
- Impressão sem controles de edição.

## 12. Verificação

A implementação somente será concluída após verificar:

- login correto, senha incorreta, saída e persistência;
- bloqueio sem autenticação e para UID diferente;
- sincronização entre dois navegadores ou aparelhos;
- edição simultânea em áreas diferentes;
- funcionamento offline e reconexão;
- migração sem perda;
- criação, edição, duplicação, ordenação, arquivamento e recuperação;
- cálculos financeiros e vencimentos;
- contagem de convidados e filtros;
- WhatsApp com telefone brasileiro;
- celular, computador, teclado e impressão;
- ausência de erros no console nos fluxos principais.

## 13. Implantação

O site continuará no GitHub Pages. A configuração pública do Firebase ficará no `index.html`; a segurança dependerá do Firebase Authentication e das regras do servidor. A senha compartilhada não será incluída no repositório.

A configuração do Firebase será feita com orientação passo a passo ao proprietário. Toda etapa que exigir ação no Firebase ou no GitHub deverá pausar e explicar exatamente onde clicar.
