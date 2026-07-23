# Fornecedores separados para Noiva e Noivo

## Objetivo

Separar os atuais itens 16 e 17 da aba Fornecedores para que Noiva e Noivo possam contratar profissionais, endereços e serviços diferentes. A separação também deve aparecer corretamente nas pendências, nos próximos passos, nos pagamentos vinculados e no percentual do painel, sem perder os dados já preenchidos.

## Categorias de fornecedores

Os dois itens combinados serão substituídos por quatro categorias independentes, mantendo a posição atual e sem renumerar as categorias posteriores:

- `16A. Beleza da noiva`
- `16B. Beleza do noivo`
- `17A. Traje da noiva`
- `17B. Traje do noivo`

Cada categoria terá sua própria escolha de fornecedor, endereço, visita, contrato, pagamento, observações e opção `Não terá`. Uma decisão registrada para a Noiva nunca contará como decisão do Noivo, e vice-versa.

As listas de conferência sugeridas serão:

- Beleza da noiva: cabelo, maquiagem, teste, espaço ou preparação no dia, madrinhas e mães quando aplicável, e retoque.
- Beleza do noivo: corte de cabelo, barba, teste ou corte anterior, preparação e local no dia, e atendimento de pais ou padrinhos quando aplicável.
- Traje da noiva: vestido, provas e ajustes, sapatos, véu, acessórios e joias, e segundo traje quando aplicável.
- Traje do noivo: terno, provas e ajustes, camisa, gravata, cinto, sapatos, acessórios e segundo traje quando aplicável.

## Migração dos dados existentes

Todo o conteúdo já salvo em `Beleza (noiva e noivo)` será preservado em `16A. Beleza da noiva`. Todo o conteúdo de `Traje dos noivos` será preservado em `17A. Traje da noiva`. As duas categorias do Noivo nascerão vazias e pendentes.

A migração localizará as categorias antigas pelo nome e significado, sem depender apenas da posição no vetor. Ela será idempotente: poderá rodar novamente sem duplicar categorias, opções, tarefas ou pagamentos. Em registros incompletos, os campos ausentes serão completados com os valores padrão, preservando tudo o que estiver válido.

Serão mantidos na categoria da Noiva as opções, escolha atual, estado da contratação, visitas, observações, dados de contrato e identificadores de pagamentos. Vínculos antigos em `pagamentoVinculo` e em `DB.pagamentos[].vinculoFornecedor` serão atualizados para o novo nome da categoria da Noiva, sem apagar nem duplicar lançamentos financeiros. Se as categorias novas já existirem, a migração apenas completará o que estiver faltando.

As categorias posteriores continuarão com a numeração atual. Não haverá deslocamento de Alianças, Assessoria ou de qualquer outro item.

## Pendências, próximos passos e prazos

As tarefas combinadas serão separadas por pessoa. Conclusão, prazo e observações existentes nas tarefas antigas serão preservados na tarefa equivalente da Noiva; as novas tarefas do Noivo começarão pendentes. O estado continuará sendo marcado manualmente: escolher ou contratar um fornecedor não concluirá automaticamente uma tarefa.

Os prazos iniciais sugeridos, todos editáveis, serão:

- 31/10/2026: escolher o vestido da Noiva.
- 31/10/2026: escolher o traje do Noivo.
- 31/12/2026: contratar beleza da Noiva.
- 28/02/2027: fazer o teste de cabelo e maquiagem da Noiva.
- 31/03/2027: reservar cabelo e barba do Noivo.
- 30/04/2027: concluir ajustes finais do vestido da Noiva.
- 30/04/2027: concluir ajustes finais do traje do Noivo.
- Semana do casamento: confirmar separadamente horários, endereços e transporte da Noiva e do Noivo.

Os próximos passos continuarão mostrando as primeiras pendências por prazo, incluindo a sugestão de dias ou a fase quando não houver data explícita. Tarefas equivalentes já existentes em `DB.beleza` serão preservadas como cuidados pessoais, mas a migração evitará duplicar no cronograma as tarefas de seleção, contratação e prova de fornecedor.

Com a separação, a contagem geral de tarefas, os avisos de atraso e os avisos dos próximos 14 dias serão recalculados usando as novas pendências.

## Painel e pagamentos

O total-base de categorias de fornecedores passará de 22 para 24. O percentual de fornecedores definidos, a quantidade pendente e os avisos do painel usarão as quatro categorias independentes. Cada categoria marcada como `Não terá` será excluída individualmente do denominador, conforme a regra atual.

Os pagamentos de `Beleza`, `Traje da noiva` e `Traje do noivo` continuarão disponíveis. Quando uma opção for escolhida, seu vínculo financeiro apontará apenas para a categoria correspondente. Remover a escolha de uma categoria não poderá apagar ou alterar o pagamento ligado à outra pessoa.

## Interface

As quatro categorias usarão o mesmo cartão expansível e o mesmo fluxo de propostas já existentes na aba Fornecedores. A mudança ficará restrita à separação e aos textos necessários; não haverá redesenho das demais abas.

## Casos especiais

- Dados antigos incompletos serão preservados e receberão apenas os campos padrão ausentes.
- Uma base que já possua uma ou mais categorias novas não receberá duplicatas.
- Vínculos financeiros com os nomes antigos serão convertidos para a categoria da Noiva.
- A execução repetida da migração produzirá o mesmo resultado da primeira execução.
- Marcar `Não terá` para a Noiva não afetará o Noivo, nem o contrário.

## Verificação

Os testes cobrirão:

- preservação e idempotência da migração de categorias, tarefas e pagamentos;
- ausência de categorias, tarefas e vínculos duplicados;
- total, percentual e pendências de fornecedores, inclusive com `Não terá` separado;
- preservação das tarefas concluídas da Noiva e criação das pendências do Noivo;
- datas, ordenação, contagem e alertas dos próximos passos;
- vínculos financeiros independentes para cada fornecedor;
- remoção de uma escolha sem afetar a outra pessoa;
- regressões nas demais categorias, nos pagamentos e na sincronização existente.

## Fora do escopo

Esta entrega não concluirá tarefas automaticamente, não renumerará as categorias posteriores, não trocará a tecnologia do site, não fará uma refatoração ampla do arquivo principal e não alterará o visual das áreas que não dependem desta separação.
