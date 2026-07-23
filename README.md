# Painel privado do casamento

Aplicação estática para planejamento compartilhado do casamento. O acesso é feito pelo Firebase Authentication: a tela pede apenas o perfil e a senha; os e-mails não são exibidos ao usuário.

## Publicação

Publique o conteúdo da branch `main` pelo GitHub Pages. Antes da primeira publicação, copie o conteúdo de `firebase.database.rules.json` para a aba **Realtime Database → Regras** do Firebase e publique as regras. Não inclua senhas, chaves privadas ou credenciais de administrador no repositório.

## Proteção dos dados

- Backups de versões anteriores são migrados e validados antes de substituir os dados atuais.
- Um backup inválido não altera o painel.
- Desfazer a escolha de um fornecedor preserva o registro financeiro, suas entradas e parcelas; apenas o vínculo com a proposta é removido.
- Linhas de convidados totalmente vazias não entram nas quantidades nem nos cálculos do buffet.

Para acrescentar a cerimonial, crie a conta dela no Firebase Authentication e atualize as duas condições de UID no arquivo de regras e no console.
