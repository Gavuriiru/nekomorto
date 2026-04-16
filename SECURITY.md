# Security Policy

A segurança do Nekomorto é uma prioridade. Se você descobrir uma vulnerabilidade de segurança, pedimos que siga este guia para reportá-la de forma privada e segura.

## Regras de Segurança

Todas as contribuições e alterações no código devem seguir rigorosamente as diretrizes de segurança definidas no arquivo [AGENTS.md](AGENTS.md). 

Principais áreas de atenção:
- Gestão de segredos e variáveis de ambiente.
- Segurança de banco de dados (RLS, queries parametrizadas).
- Fluxos de autenticação e autorização (OAuth, Session hygiene).
- Saneamento de inputs e prevenção de SSRF.

## Reportando Vulnerabilidades

**Não utilize Issues públicas para reportar problemas de segurança.**

Se você encontrar uma vulnerabilidade, utilize um dos seguintes meios de contato privado:

1. **GitHub Security Advisories**: Utilize a funcionalidade original de "Private security reporting" no repositório.
2. **Discord**: Entre em contato com a administração da Nekomata.

### Processo de Divulgação

Ao recebermos um reporte de vulnerabilidade, seguiremos os seguintes passos:
1. Confirmar o recebimento em até 48 horas.
2. Investigar e reproduzir o problema.
3. Trabalhar em uma correção.
4. Divulgar a correção e, se apropriado, dar os devidos créditos ao reportador.

Agradecemos o seu esforço em manter a plataforma Nekomorto segura! ✨
