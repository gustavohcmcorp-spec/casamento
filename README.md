# Painel privado do casamento

Aplicação estática para planejamento compartilhado do casamento. O acesso é feito pelo Firebase Authentication: a tela pede apenas o perfil e a senha; os e-mails não são exibidos ao usuário.

## Publicação

Publique o conteúdo da branch `feature/painel-privado` pelo GitHub Pages. Antes da primeira publicação, copie o conteúdo de `firebase.database.rules.json` para a aba **Realtime Database → Regras** do Firebase e publique as regras. Não inclua senhas, chaves privadas ou credenciais de administrador no repositório.

Para acrescentar a cerimonial, crie a conta dela no Firebase Authentication e atualize as duas condições de UID no arquivo de regras e no console.
