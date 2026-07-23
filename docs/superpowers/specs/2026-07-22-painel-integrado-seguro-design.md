# Painel Integrado e Seguro do Casamento — Especificação

## Objetivo

Transformar o painel atual em uma central confiável para os noivos, integrando convidados, fornecedores, financeiro, cronograma, documentos e operação do dia, sem perder nem reinterpretar silenciosamente nenhum dado já preenchido.

## Princípios obrigatórios

- Nenhuma migração pode apagar campos antigos, pagamentos, parcelas, pessoas, observações, prazos ou estados.
- Toda mudança de esquema deve ser idempotente: executá-la novamente não altera dados já migrados.
- Registros antigos incompatíveis devem ser preservados em campos de legado ou arquivados, nunca descartados.
- Exclusões relevantes exigem confirmação e devem preferir arquivamento reversível.
- Cada fase começa por testes que falham com o comportamento atual e termina somente com toda a suíte passando.
- O painel deve continuar funcionando durante a implantação; cada fase precisa ser publicável isoladamente.

## Estratégia escolhida

A implantação será incremental, mantendo a aplicação estática e o Firebase atuais. O esquema evoluirá por versões compatíveis. A interface continuará lendo dados antigos, enquanto novas estruturas serão preenchidas por migrações conservadoras. A reestruturação do arquivo monolítico só ocorrerá onde for necessária para testar regras críticas; não haverá reescrita geral do produto.

## Fase 1 — Proteção de dados e regressão

### Pagamentos vinculados

Desfazer a escolha de um fornecedor não excluirá seu pagamento. O usuário escolherá entre:

- manter o pagamento e remover apenas o vínculo;
- arquivar o pagamento e a escolha;
- excluir definitivamente, somente quando não houver valor pago, parcela paga ou histórico financeiro.

Pagamentos com qualquer movimentação financeira nunca poderão ser excluídos diretamente. Registros arquivados permanecem recuperáveis e não entram nos totais ativos.

### Convidados vazios

Uma linha só contará como pessoa quando possuir nome, família, telefone ou quantidade explícita. Linhas totalmente vazias terão total zero. Registros antigos com conteúdo e quantidades vazias continuarão usando um adulto como compatibilidade.

### Sincronização

Cada gravação terá versão, data e autor. A sincronização será dividida por módulo ou registro para reduzir sobrescritas. Conflitos detectáveis serão preservados e exibidos; o sistema não descartará silenciosamente uma versão.

### Testes

A suíte ampla existente fora do repositório será reconciliada com a versão atual e incorporada ao projeto. Serão obrigatórios testes de migração, exclusão protegida, convidados vazios, alterações rápidas e edições simultâneas simuladas.

## Fase 2 — Modelo de prontidão

### Fornecedores

Cada categoria terá estágios separados:

1. Em pesquisa
2. Escolhido
3. Contratado
4. Pronto para o casamento

“Pronto” exige fornecedor escolhido, contrato resolvido ou marcado como não aplicável, itens críticos conferidos, valor financeiro definido e pendências operacionais encerradas. “Não terá” continua fora do denominador.

As categorias iniciais de beleza e traje permanecerão separadas para noiva e noivo também no financeiro. O sistema migrará a linha antiga “Beleza” para a noiva somente quando isso não destruir um vínculo existente; ambiguidades serão sinalizadas.

Categorias adicionais serão opcionais e ativadas por configuração, sem reduzir o percentual de quem não precisa delas: mobiliário/louças, gerador, banheiros adicionais, músicos, projeção/transmissão, suporte médico, seguro, taxas, estacionamento/transporte de convidados, limpeza/desmontagem, recreação infantil e lista/site de presentes.

### Tarefas

Tarefas terão prioridade, responsável, prazo e dependências. O progresso geral distinguirá tarefas críticas de opcionais. Marcar um fornecedor como escolhido não concluirá tarefas automaticamente.

## Fase 3 — Convidados como fonte operacional

O cadastro será organizado por família e pessoas. Cada pessoa poderá ter:

- nome;
- faixa etária ou data de nascimento;
- presença na cerimônia e na recepção;
- restrição alimentar ou alergia;
- acessibilidade;
- mesa/setor;
- grupo ou lado do casal;
- transporte/hospedagem;
- necessidade de cadeira infantil ou recreação;
- observações e situação de check-in.

O painel separará planejados, cadastrados, convidados, confirmados, recusados, pendentes, sem nome e sem faixa etária. WhatsApp e RSVP continuarão funcionando por família, sem perder os nomes individuais.

## Fase 4 — Buffet e cálculos por cenário

Fornecedores por pessoa ou faixa etária terão três cenários:

- Confirmado: somente pessoas com RSVP confirmado.
- Provável: confirmados mais uma estimativa transparente dos pendentes.
- Máximo: todos os convidados previstos ou cadastrados, o que for maior.

Cada cenário exibirá quantidade por faixa, valor unitário, total, pessoas ainda sem classificação e data da última atualização. Pessoas sem faixa serão consideradas adultas apenas no cenário conservador e isso será destacado.

O fornecedor poderá ter uma data de congelamento da quantidade. Alterações posteriores nos convidados gerarão alerta para reenviar o número ao buffet, bebidas, mobiliário e outros fornecedores dependentes.

## Fase 5 — Financeiro planejado e realizado

Cada categoria poderá registrar orçamento previsto, menor proposta, valor contratado, pago, saldo e diferença. O financeiro terá:

- fluxo mensal de vencimentos;
- parcelas vencidas;
- multas, juros e descontos;
- cancelamentos e reembolsos;
- beneficiário e chave ou destino do pagamento;
- responsável pelo pagamento;
- referência para contrato ou comprovante;
- origem do valor e indicação de divergência entre fornecedor e ajuste manual.

Valores manuais nunca serão sobrescritos sem confirmação. Alterações no número de convidados recalcularão estimativas, mas não alterarão parcelas contratuais ou valores já pagos.

## Fase 6 — Dashboard e navegação

O painel inicial terá cinco pilares: convidados, fornecedores, financeiro, cronograma e documentos/operação. Cada pilar mostrará prontidão, principal pendência, risco, próxima ação, responsável e prazo.

Indicadores mínimos:

- saúde geral e dias restantes;
- tarefas vencidas, próximas e críticas;
- convidados confirmados, pendentes, sem nome e sem faixa;
- custo por convidado nos três cenários;
- previsto, contratado, pago e próximo vencimento;
- fornecedores escolhidos, contratados e prontos;
- contratos, itens não inclusos e quantidades não comunicadas.

No celular, a navegação principal terá Início, Fornecedores, Convidados e Financeiro; os demais módulos ficarão em Planejamento. Telas longas terão filtros, busca, resumos recolhíveis, estados vazios explicativos e ações de exclusão protegidas.

## Histórico, auditoria e recuperação

Alterações críticas registrarão autor, data, módulo, campo e valores anterior/novo. O painel permitirá desfazer ações recentes quando tecnicamente seguro. Backup e restauração continuarão aceitando versões antigas e validarão o conteúdo antes de substituir dados locais.

## Migração de dados

1. Clonar o objeto recebido antes de migrar.
2. Detectar a versão e aplicar cada transformação uma única vez.
3. Completar somente campos ausentes; nunca substituir conteúdo preenchido.
4. Preservar registros ambíguos e emitir alertas de reconciliação.
5. Validar totais de convidados, pagamentos, parcelas e fornecedores antes e depois.
6. Gravar a nova versão apenas após validação completa.
7. Manter restauração compatível com backups anteriores.

## Critérios de aceite

- Todos os 15 testes atuais continuam passando.
- A suíte histórica relevante é incorporada e adaptada sem reduzir cobertura.
- Backups representativos das versões anteriores migram sem perda de campos ou registros.
- Linhas vazias não contam como convidados.
- Desfazer fornecedor não apaga movimentação financeira.
- Edições concorrentes não descartam silenciosamente mudanças em módulos distintos.
- Os três cenários de buffet conciliam convidados e financeiro.
- Dashboard e percentuais explicam o que está completo e o que falta.
- Fluxos principais funcionam em computador e celular, com navegação por teclado e textos legíveis.

## Ordem de implantação

1. Proteção de dados, suíte de regressão e migrações.
2. Prontidão de fornecedores e tarefas.
3. Modelo enriquecido de convidados.
4. Cenários de buffet e dependências.
5. Financeiro previsto versus realizado.
6. Dashboard, busca, filtros e navegação móvel.
7. Histórico, recuperação e revisão final de acessibilidade.

