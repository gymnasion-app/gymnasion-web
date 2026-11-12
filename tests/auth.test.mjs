import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadModule(path, globals = {}, dependencies = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, atob, ...globals, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

function sessionFixture() {
  const localStorage = storage();
  const sessionStorage = storage();
  return { localStorage, sessionStorage, ...loadModule("services/session.ts", { localStorage, sessionStorage }) };
}

const token = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
const loginResponse = () => ({ token: token(Math.floor(Date.now() / 1000) + 3600), id: "test-personal", role: "PERSONAL_TRAINER" });

test("student login keeps the session and has a separate authenticated destination", async () => {
  const { session, homeForRole } = sessionFixture();
  const response = { ...loginResponse(), id: "test-student", role: "ALUNO" };
  const { authService } = loadModule("services/authService.ts", {}, {
    "./api": { api: { post: async () => ({ data: response }) } },
    "./session": { session },
  });
  await authService.login({ email: "student@example.test", password: "test", captchaToken: "captcha-test" });
  assert.equal(session.getUser().role, "ALUNO");
  assert.equal(session.getToken(), response.token);
  assert.equal(homeForRole("ALUNO"), "/conta");
  assert.equal(homeForRole("PERSONAL_TRAINER"), "/home");
  assert.equal(homeForRole("ADMIN"), "/conta");
  authService.logout();
  assert.equal(session.getUser(), null);
});

test("login without remember only survives in session storage", () => {
  const { session, localStorage, sessionStorage } = sessionFixture();
  const response = loginResponse();
  session.save(response);
  assert.equal(session.getToken(), response.token);
  assert.equal(session.getUser().role, "PERSONAL_TRAINER");
  assert.equal(localStorage.getItem("@Gymnasion:token"), null);
  assert.equal(sessionStorage.getItem("@Gymnasion:token"), response.token);
});

test("changing remember preference removes the previous session", () => {
  const { session, localStorage, sessionStorage } = sessionFixture();
  session.save(loginResponse(), true);
  assert.ok(localStorage.getItem("@Gymnasion:token"));
  session.save({ ...loginResponse(), id: "another-personal" }, false);
  assert.equal(localStorage.getItem("@Gymnasion:token"), null);
  assert.equal(session.getUser().id, "another-personal");
  session.save(loginResponse(), true);
  assert.equal(sessionStorage.getItem("@Gymnasion:token"), null);
  session.clear();
  assert.equal(session.getToken(), null);
  assert.equal(session.getUser(), null);
});

test("expired or malformed tokens are never sent or treated as authenticated", () => {
  const { session, localStorage } = sessionFixture();
  for (const invalid of [token(1), "invalid-token"]) {
    session.save({ ...loginResponse(), token: invalid }, true);
    assert.equal(session.getToken(), null);
    assert.equal(session.getUser(), null);
    assert.equal(localStorage.getItem("@Gymnasion:user"), null);
  }
});

test("failed login does not create a session; successful login honors persistence", async () => {
  const fixture = sessionFixture();
  let fail = true;
  const response = loginResponse();
  const { authService } = loadModule("services/authService.ts", {}, {
    "./session": fixture,
    "./api": { api: { post: async () => { if (fail) throw new Error("Unauthorized"); return { data: response }; } } },
  });
  await assert.rejects(authService.login({ email: "test@example.invalid", password: "test", captchaToken: "captcha-test" }), /Unauthorized/);
  assert.equal(fixture.session.getToken(), null);
  fail = false;
  await authService.login({ email: "test@example.invalid", password: "test", captchaToken: "captcha-test" }, true);
  assert.equal(fixture.localStorage.getItem("@Gymnasion:token"), response.token);
  assert.equal(fixture.session.getRememberedEmail(), "test@example.invalid");
  authService.logout();
  assert.equal(fixture.session.getUser(), null);
  assert.equal(fixture.session.getRememberedEmail(), "test@example.invalid");
  fixture.session.clearRememberedEmail();
  assert.equal(fixture.session.getRememberedEmail(), null);
});

test("web login uses the reCAPTCHA-protected endpoint and sends the token (US-02)", async () => {
  const fixture = sessionFixture();
  let request;
  const { authService } = loadModule("services/authService.ts", {}, {
    "./session": fixture,
    "./api": { api: { post: async (...args) => { request = args; return { data: loginResponse() }; } } },
  });
  await authService.login({ email: "user@example.com", password: "secret", captchaToken: "captcha-test" });
  assert.equal(request[0], "/api/auth/login-web");
  assert.equal(request[1].captchaToken, "captcha-test");
});

test("remember me stores email and unchecking remember clears it on login", async () => {
  const fixture = sessionFixture();
  const response = loginResponse();
  const { authService } = loadModule("services/authService.ts", {}, {
    "./session": fixture,
    "./api": { api: { post: async () => ({ data: response }) } },
  });

  await authService.login({ email: "user@example.com", password: "secret", captchaToken: "captcha-test" }, true);
  assert.equal(fixture.session.getRememberedEmail(), "user@example.com");

  await authService.login({ email: "user@example.com", password: "secret", captchaToken: "captcha-test" }, false);
  assert.equal(fixture.session.getRememberedEmail(), null);
});

const { validateSignUp, formatPhone } = loadModule("pages/SignUp/validation.ts");
const valid = { name: "Teste Personal", email: "test@example.invalid", cpf: "123.456.789-00", phone: "(11) 99999-0000", modality: "1", password: "Teste123?", confirmPassword: "Teste123?" };

test("cellphone mask handles typing, pasted punctuation and excess digits", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("a"), "");
  assert.equal(formatPhone("1"), "(1");
  assert.equal(formatPhone("11"), "(11");
  assert.equal(formatPhone("119"), "(11) 9");
  assert.equal(formatPhone("11987654321"), "(11) 98765-4321");
  assert.equal(formatPhone("(11) 98765-4321"), "(11) 98765-4321");
  assert.equal(formatPhone("1198765432199999999"), "(11) 98765-4321");
});

test("cellphone validation rejects incomplete, excess and non-mobile numbers", () => {
  for (const phone of ["1198765432", "119876543210", "(00) 98765-4321", "(11) 88765-4321"]) {
    assert.ok(validateSignUp({ ...valid, phone }).phone, phone);
  }
  assert.equal(validateSignUp({ ...valid, phone: "(21) 98765-4321" }).phone, undefined);
});

test("registration validates required backend fields, limits, and password confirmation", () => {
  assert.equal(Object.keys(validateSignUp(valid)).length, 0);
  assert.ok(validateSignUp({ ...valid, phone: "" }).phone);
  assert.ok(validateSignUp({ ...valid, phone: "123" }).phone);
  assert.ok(validateSignUp({ ...valid, cpf: "123" }).cpf);
  assert.ok(validateSignUp({ ...valid, modality: "abc" }).modality);
  assert.ok(validateSignUp({ ...valid, name: "x".repeat(151) }).name);
  assert.ok(validateSignUp({ ...valid, confirmPassword: "different" }).confirmPassword);
  assert.ok(validateSignUp({ ...valid, password: "short" }).password);
});

const { authError } = loadModule("utils/authError.ts", {}, { axios: { default: { isAxiosError: value => value?.isAxiosError === true } } });
const apiError = (status, data) => ({ isAxiosError: true, response: { status, data } });

test("backend duplicate and validation errors attach to the correct fields", () => {
  assert.ok(authError(apiError(409, { detail: "Este CPF já está cadastrado no sistema." }), "fallback").fields.cpf);
  assert.ok(authError(apiError(400, { detail: "Já possui um usuário vinculado a esse e-mail." }), "fallback").fields.email);
  const error = authError(apiError(400, { invalidFields: { celular: "Obrigatório", modalidade: "Inválida", nome: "Obrigatório" } }), "fallback");
  assert.equal(error.fields.phone, "Obrigatório");
  assert.equal(error.fields.modality, "Inválida");
  assert.equal(error.fields.name, "Obrigatório");
});

test("network and server failures are not misreported as invalid credentials", () => {
  assert.match(authError({ isAxiosError: true }, "Credenciais inválidas").message, /conectar ao servidor/);
  assert.match(authError(apiError(500, {}), "Credenciais inválidas").message, /indisponível/);
});

test("student registration validates account fields without requiring a modality", () => {
  const { validateStudentSignUp } = loadModule("pages/SignUp/validation.ts");
  const student = { name: "Aluno Teste", email: "teste@example.com", cpf: "123.456.789-00", phone: "(11) 99999-9999", password: "Teste123!", confirmPassword: "Teste123!" };
  assert.equal(Object.keys(validateStudentSignUp(student)).length, 0);
  assert.ok(validateStudentSignUp({ ...student, email: "invalido", phone: "123" }).email);
  assert.ok(validateStudentSignUp({ ...student, confirmPassword: "outra" }).confirmPassword);
});

test("student invitation registration passes token as a query parameter without creating a session", async () => {
  let request;
  const response = { id: "student-test", status: "PENDENTE" };
  const { authService } = loadModule("services/authService.ts", {}, {
    "./api": { api: { post: async (...args) => { request = args; return { data: response }; } } },
    "./session": { session: { save: () => { throw new Error("Student registration must not sign in"); } } },
  });
  const payload = { nome: "Aluno Teste", email: "teste@example.com", password: "Teste123!", cpf: "12345678900", celular: "11999999999", aceitouTermos: true };
  assert.equal(await authService.registroAlunoConvite("invite-test", payload), response);
  assert.equal(request[0], "/api/auth/registro-aluno-convite");
  assert.equal(request[1], payload);
  assert.equal(request[2].params.token, "invite-test");
});

test("personal registration sends aceitouTermos to satisfy US-17 and RN-013", async () => {
  let request;
  const response = { id: "personal-test", role: "PERSONAL_TRAINER" };
  const { authService } = loadModule("services/authService.ts", {}, {
    "./api": { api: { post: async (...args) => { request = args; return { data: response }; } } },
    "./session": { session: {} },
  });
  const payload = { nome: "Amanda Souza", email: "amanda@example.com", password: "SenhaForte@2026", cpf: "12345678900", celular: "11999999999", modalidade: 1, aceitouTermos: true, captchaToken: "captcha-test" };
  assert.equal(await authService.registroPersonal(payload), response);
  assert.equal(request[0], "/api/auth/registro-personal");
  assert.equal(request[1].aceitouTermos, true);
  assert.equal(request[1].captchaToken, "captcha-test");
});

test("invitation generation can include student email for direct dispatch", async () => {
  let request;
  const response = { url: "http://localhost:5173/cadastro-aluno?token=xyz", emailEnviado: "aluno@example.com" };
  const { personalTrainerService } = loadModule("services/personalTrainerService.ts", {}, {
    "./api": { api: { post: async (...args) => { request = args; return { data: response }; } } },
    "../types/api": { unpackPage: d => d },
  });
  const result = await personalTrainerService.gerarConvite(1, " aluno@example.com ");
  assert.equal(result.emailEnviado, "aluno@example.com");
  assert.equal(request[0], "/api/personal-trainers/convites");
  assert.equal(request[1].modalidadeId, 1);
  assert.equal(request[1].emailAluno, "aluno@example.com");
});
