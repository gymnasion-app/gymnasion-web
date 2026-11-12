# Login e cadastro de personal

As páginas `/login` e `/cadastro` usam o design system e os assets locais de `public/auth`, conforme o Figma (seção 410:4916). Nenhum arquivo do backend foi alterado.

## Integração existente

- `POST /api/auth/login-web`: `{ email, password, captchaToken }`; resposta `{ token, id, role }`. O app mobile continua usando `POST /api/auth/login`, sem CAPTCHA.
- `POST /api/auth/registro-personal`: `{ nome, email, password, cpf, celular, modalidade, aceitouTermos, captchaToken }`.
- `GET /api/modalidades`: opções reais para a modalidade principal.
- `VITE_API_URL` deve conter a origem, por exemplo `http://localhost:8080`, sem `/api` ao final, seguindo os serviços existentes.
- CPF e celular são enviados somente com números. Celular foi mantido no formulário porque é obrigatório na API, apesar de ausente no Figma.
- “Lembrar de mim” usa localStorage (persistindo a sessão e o e-mail para logins futuros); desmarcado usa sessionStorage e limpa o e-mail lembrado. Logout encerra a sessão ativa. Tokens expirados não são enviados. Requisições de autenticação não levam um token anterior.
- A área web continua exclusiva para `PERSONAL_TRAINER`, conforme a proteção de rotas existente.
- O cadastro retorna ao login com confirmação e e-mail preenchido. Não realiza login automático.
- Erros `ProblemDetail` e `invalidFields` são exibidos; conflitos de e-mail/CPF aparecem nos campos correspondentes. As senhas fortes mantêm a regra do frontend/Figma; o backend aceita mínimo de seis caracteres.

## CAPTCHA (Google reCAPTCHA v2)

Login e cadastro de personal exibem o widget "Não sou um robô" (US-01, US-02). O botão de envio fica desabilitado até o desafio ser concluído (US-02 C5). O token é enviado à API, que o valida no Google com a chave secreta antes de conferir credenciais ou criar a conta. Como cada token vale uma única vez, o widget é reiniciado após qualquer erro da API.

- `VITE_RECAPTCHA_SITE_KEY` (chave pública) no `.env` local e como variável do GitHub Actions para o build da imagem.
- `RECAPTCHA_SECRET` (chave secreta) apenas no back-end.
- Sem a site key, o formulário mostra que a verificação não pôde ser carregada e o envio fica bloqueado.

## Recursos pendentes na API

Recuperação de senha e persistência do aceite dos termos não possuem endpoints/contratos implementados no backend atual; recuperação exibe a indisponibilidade.

O modal de termos mantém a composição do Figma, mas o texto não promete CAPTCHA, prazo de exclusão ou armazenamento de aceite inexistentes. O checkbox exige aceite apenas no formulário; não há comprovação persistida no servidor. O conteúdo definitivo dos termos ainda precisa ser definido pelo projeto.

O cadastro de aluno por convite permanece no fluxo existente e não foi redesenhado nesta etapa.

## Verificação

`npm run build`

`node --test tests/auth.test.mjs`

Os testes isolam armazenamento de sessão, validação e tratamento de erros, sem criar usuários no banco. A verificação no navegador cobre layout desktop/mobile, formulários vazios, senha visível, modal por teclado, carregamento real de modalidades e login inválido na API local.
