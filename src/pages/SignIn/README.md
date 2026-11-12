# SignIn

## Overview
Authentication sign-in page component handling email/password validation, remembered email persistence, and role-aware post-login redirection.

## Interface
- `[SignIn.tsx:SignIn]` — default exported React component rendering the `/login` page.

## Invariants
- `[SignIn.tsx:errors.email]` — Trimmed email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` or error `'Insira um e-mail válido.'` is set.
- `[SignIn.tsx:errors.password]` — Password must be non-empty or error `'Preencha a senha.'` is set.
- `[SignIn.tsx:handleSubmit]` — Ignores concurrent submissions when `isSubmitting` is `true` and aborts submission if any field in `errors` is invalid.
- `[SignIn.tsx:canUseFrom]` — Post-login redirect to `routeState.from` is only allowed when `from` starts with `/` and not `//`, and matches role namespace (`!from.startsWith("/conta")` for `PERSONAL_TRAINER`, `from.startsWith("/conta")` otherwise).

## Side Effects
- `[SignIn.tsx:session.getRememberedEmail]` — Reads remembered email from storage on initial component render.
- `[SignIn.tsx:handleRememberChange]` — Calls `session.clearRememberedEmail()` immediately when the `'Lembrar de mim'` checkbox is unchecked.
- `[SignIn.tsx:handleSubmit]` — Focuses the first invalid form element (`field.focus()`) on validation failure.
- `[SignIn.tsx:handleSubmit]` — Calls `authService.login({ email: values.email.trim().toLowerCase(), password: values.password, captchaToken }, remember)`.
- `[SignIn.tsx:handleSubmit]` — Navigates via `navigate(canUseFrom ? from : homeForRole(role), { replace: true })` upon successful login.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
