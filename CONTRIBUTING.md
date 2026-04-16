# Contributing to Nekomorto

Obrigado por se interessar em contribuir para o Nekomorto! Este guia ajudará você a configurar seu ambiente e entender como enviar contribuições.

## Desenvolvimento Local

### Pré-requisitos
- Node.js `24.14.x`
- npm `11.x`
- Docker (opcional, para rodar o PostgreSQL localmente)

### Configuração Inicial
1. Clone o repositório:
   ```bash
   git clone https://github.com/NekomataSub/nekomorto.git
   cd nekomorto
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o ambiente de desenvolvimento:
   ```bash
   npm run setup:dev
   ```
   *Este comando configura o banco de dados via Docker, cria o arquivo `.env` e aplica as migrations.*

## Padrões de Código

### Linting e Formatação
Usamos o **Biome** para manter a qualidade e consistência do código.
- Verificar lint: `npm run lint`
- Formatar código: `npm run format`

**Importante**: Antes de enviar um Pull Request, certifique-se de que seu código foi formatado corretamente.

### Testes
Sempre execute os testes antes de enviar mudanças:
- Rodar todos os testes: `npm test`
- Rodar testes em watch mode: `npm run test:watch`
- Testes de acessibilidade: `npm run test:a11y`

## Fluxo de Trabalho (Workflow)

1. Crie uma branch para sua alteração: `git checkout -b feature/minha-melhoria` ou `fix/problema-especifico`.
2. Implemente suas mudanças.
3. Garanta que o código passa no `lint`, `typecheck` e `test`.
4. Faça commit das suas alterações seguindo padrões claros.
5. Faça push para sua branch e abra um Pull Request para a branch `main`.

## Pull Requests

Ao abrir um PR, descreva claramente:
- Qual problema está sendo resolvido.
- Quais mudanças foram feitas.
- Como o revisor pode testar as alterações.

---

Agradecemos imensamente por ajudar a tornar o Nekomorto melhor! 🐱💀
