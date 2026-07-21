# Convidados: faixas de crianças, famílias e leitura responsiva

## Objetivo

Melhorar a operação da aba Convidados sem alterar pagamentos ou fornecedores: separar crianças isentas das potencialmente cobradas, tornar os agrupamentos familiares legíveis e ampliar a visualização da própria aba.

## Dados de convidados

Cada convidado continuará representando uma família, grupo ou pessoa. As quantidades serão:

- Adultos (`ad`), sem alteração de significado.
- Crianças até 5 anos (`crAte5`), isentas para referência de cotação.
- Crianças de 6 anos ou mais (`crMais5`), potencialmente cobradas.

O total de crianças será a soma das duas faixas; o total de pessoas continuará sendo adultos mais ambas as faixas. As contagens existentes em `cr` serão migradas para `crMais5`, preservando a quantidade e evitando subestimar cotações. A interface informará que esses registros merecem revisão de faixa.

## Família

O campo e a coluna hoje chamados de Grupo passarão a se chamar Família. Na migração, os valores `F | Noivo` e `F | Noiva` serão normalizados para `Noivo` e `Noiva`; outros valores serão preservados.

O card superior exibirá totalizadores dinâmicos por família, contando pessoas, e não linhas. Assim, `Noivo` e `Noiva` aparecerão automaticamente quando existirem, assim como qualquer outra família preenchida. Linhas sem família não entram nesses totalizadores.

## Interface

No computador, somente a aba Convidados usará uma área de trabalho maior (aproximadamente 1.100px), para reduzir a necessidade de rolagem horizontal e dar espaço aos botões e ao editor de pessoas convidadas.

No celular, os cartões expansíveis permanecem como a interface principal. Adultos, crianças até 5 e crianças 6+ terão campos grandes, organizados para leitura e toque; os resumos do cartão usarão as mesmas contagens.

A lista de impressão A4 passará a ter colunas separadas para as duas faixas de crianças, mantendo nome/família, adultos e pessoas convidadas.

## Limites de escopo

Esta entrega não altera a fórmula de cobrança dos fornecedores nem os valores já encaminhados a Pagamentos. As faixas deixam os dados prontos para uma cotação diferenciada posterior, sem mudar o financeiro atual.

## Verificação

Os testes cobrirão a migração de crianças antigas, a soma correta de pessoas, a normalização de família, os totalizadores por família, a lista A4 e a preservação do cálculo por pessoa já existente.
