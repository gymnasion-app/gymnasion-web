# Login e cadastro de personal

As páginas `/login` e `/cadastro` usam o design system e os assets locais de `public/auth`, conforme o Figma (seção 410:4916). Nenhum arquivo do backend foi alterado.

## Integração existente

- `POST /api/auth/login`: `{ email, password }`; resposta `{ token, id, role }`.
- `POST /api/auth/registro-personal`: `{ nome, email, password, cpf, celular, modalidade }`.
- `GET /api/modalidades`: opções reais para a modalidade principal.
- `VITE_API_URL` deve conter a origem, por exemplo `http://localhost:8080`, sem `/api` ao final, seguindo os serviços existentes.
- CPF e celular são enviados somente com números. Celular foi mantido no formulário porque é obrigatório na API, apesar de ausente no Figma.
- “Lembrar de mim” usa localStorage (persistindo a sessão e o e-mail para logins futuros); desmarcado usa sessionStorage e limpa o e-mail lembrado. Logout encerra a sessão ativa. Tokens expirados não são enviados. Requisições de autenticação não levam um token anterior.
- A área web continua exclusiva para `PERSONAL_TRAINER`, conforme a proteção de rotas existente.
- O cadastro retorna ao login com confirmação e e-mail preenchido. Não realiza login automático.
- Erros `ProblemDetail` e `invalidFields` são exibidos; conflitos de e-mail/CPF aparecem nos campos correspondentes. As senhas fortes mantêm a regra do frontend/Figma; o backend aceita mínimo de seis caracteres.

## Recursos pendentes na API

CAPTCHA, recuperação de senha, bloqueio após cinco tentativas e persistência do aceite dos termos não possuem endpoints/contratos implementados no backend atual. O CAPTCHA fica desabilitado e identificado como indisponível; recuperação exibe a indisponibilidade. Não se simula proteção por CAPTCHA ou bloqueio de login.

O modal de termos mantém a composição do Figma, mas o texto não promete CAPTCHA, prazo de exclusão ou armazenamento de aceite inexistentes. O checkbox exige aceite apenas no formulário; não há comprovação persistida no servidor. O conteúdo definitivo dos termos ainda precisa ser definido pelo projeto.

O cadastro de aluno por convite permanece no fluxo existente e não foi redesenhado nesta etapa.

## Verificação

`npm run build`

`node --test tests/auth.test.mjs`

Os testes isolam armazenamento de sessão, validação e tratamento de erros, sem criar usuários no banco. A verificação no navegador cobre layout desktop/mobile, formulários vazios, senha visível, modal por teclado, carregamento real de modalidades e login inválido na API local.
