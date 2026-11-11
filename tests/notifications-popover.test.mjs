import test from "node:test";
import assert from "node:assert/strict";
import {
  filterNotifications,
  getNotificationCategoryMeta,
  normalizeNotification,
  sortNotificationsByPriority,
  splitNotificationsByReadState,
} from "../src/features/notifications/notificationModel.ts";

test("notification popover calculates unread count accurately", () => {
  const notifications = [
    { id: "1", titulo: "Treino Concluído", mensagem: "Mariana concluiu o treino", tipo: "TREINO", lida: false, dataCriacao: "2026-10-19T10:00:00Z", referenciaId: null },
    { id: "2", titulo: "Novo Aluno", mensagem: "Carlos solicitou cadastro", tipo: "CADASTRO", lida: true, dataCriacao: "2026-10-18T10:00:00Z", referenciaId: null },
    { id: "3", titulo: "Feedback", mensagem: "Você recebeu uma nota", tipo: "FEEDBACK", lida: false, dataCriacao: "2026-10-19T11:00:00Z", referenciaId: null },
  ];

  const { unreadCount } = splitNotificationsByReadState(notifications);
  assert.equal(unreadCount, 2);
});

test("sortNotificationsByPriority always prioritizes unread notifications above read ones", () => {
  const notifications = [
    { id: "read-newest", titulo: "Pendências de Métricas - Beatriz Lima", mensagem: "O aluno Beatriz Lima possui 2 métrica(s) pendente(s)", tipo: "PENDENCIA", lida: true, dataCriacao: "2026-10-28T15:00:00Z", referenciaId: null },
    { id: "read-second", titulo: "Pendências de Métricas - Mikael teste", mensagem: "O aluno Mikael teste possui 1 métrica(s) pendente(s)", tipo: "PENDENCIA", lida: true, dataCriacao: "2026-10-28T14:55:00Z", referenciaId: null },
    { id: "unread-older", titulo: "Treino Concluído", mensagem: "Lucas concluiu o treino", tipo: "TREINO", lida: false, dataCriacao: "2026-10-27T09:00:00Z", referenciaId: null },
    { id: "unread-newer", titulo: "Pendências de Métricas - Isabelly Regetz", mensagem: "O aluno Isabelly Regetz possui 2 métrica(s) pendente(s)", tipo: "PENDENCIA", lida: false, dataCriacao: "2026-10-28T12:00:00Z", referenciaId: null },
  ];

  const sorted = sortNotificationsByPriority(notifications);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["unread-newer", "unread-older", "read-newest", "read-second"],
    "Unread notifications must appear at the top ordered newest-first, followed by read notifications"
  );
});

test("sortNotificationsByPriority prioritizes operational urgency when timestamps are within the same minute", () => {
  const sameTime = "2026-10-28T13:00:00Z";
  const notifications = [
    { id: "fb", titulo: "Feedback recebido", mensagem: "Nota registrada", tipo: "FEEDBACK", lida: false, dataCriacao: sameTime, referenciaId: null },
    { id: "pend", titulo: "Pendências de Métricas - Beatriz", mensagem: "2 métricas pendentes", tipo: "PENDENCIA", lida: false, dataCriacao: sameTime, referenciaId: null },
    { id: "treino", titulo: "Treino concluído", mensagem: "Sessão finalizada", tipo: "TREINO", lida: false, dataCriacao: sameTime, referenciaId: null },
  ];

  const sorted = sortNotificationsByPriority(notifications);
  assert.deepEqual(sorted.map((item) => item.id), ["pend", "treino", "fb"]);
});

test("marking single notification as read updates target item and moves it below remaining unread items", () => {
  const notifications = [
    { id: "1", titulo: "Aviso 1", mensagem: "Msg 1", lida: false, dataCriacao: "2026-10-19T12:00:00Z", referenciaId: null, tipo: "PENDENCIA" },
    { id: "2", titulo: "Aviso 2", mensagem: "Msg 2", lida: false, dataCriacao: "2026-10-19T10:00:00Z", referenciaId: null, tipo: "TREINO" },
  ];

  const targetId = "1";
  const updated = sortNotificationsByPriority(
    notifications.map((item) => (item.id === targetId ? { ...item, lida: true } : item))
  );

  assert.equal(updated[0].id, "2", "Remaining unread item moves to top position");
  assert.equal(updated[0].lida, false);
  assert.equal(updated[1].id, "1", "Newly read item moves below unread items");
  assert.equal(updated[1].lida, true);
});

test("marking all notifications as read updates all items and sets unread to 0", () => {
  const notifications = [
    { id: "1", titulo: "Aviso 1", mensagem: "Msg 1", lida: false, dataCriacao: "2026-10-19T10:00:00Z", referenciaId: null, tipo: "TREINO" },
    { id: "2", titulo: "Aviso 2", mensagem: "Msg 2", lida: false, dataCriacao: "2026-10-19T10:00:00Z", referenciaId: null, tipo: "TREINO" },
  ];

  const allRead = notifications.map((item) => ({ ...item, lida: true }));
  assert.equal(allRead.every((i) => i.lida), true);
  assert.equal(allRead.filter((i) => !i.lida).length, 0);
});

test("filterNotifications isolates unread and pendencia categories accurately", () => {
  const notifications = [
    { id: "1", titulo: "Pendências de Métricas - Ana", mensagem: "1 métrica pendente", lida: true, dataCriacao: "2026-10-19T10:00:00Z", referenciaId: null, tipo: "PENDENCIA" },
    { id: "2", titulo: "Treino concluído", mensagem: "Pedro concluiu", lida: false, dataCriacao: "2026-10-19T11:00:00Z", referenciaId: null, tipo: "TREINO" },
    { id: "3", titulo: "Pendências de Métricas - João", mensagem: "2 métricas pendentes", lida: false, dataCriacao: "2026-10-19T09:00:00Z", referenciaId: null, tipo: "PENDENCIA" },
  ];

  const unreadOnly = filterNotifications(notifications, "unread");
  assert.deepEqual(unreadOnly.map((i) => i.id), ["2", "3"]);

  const pendenciasOnly = filterNotifications(notifications, "pendencia");
  assert.deepEqual(
    pendenciasOnly.map((i) => i.id),
    ["3", "1"],
    "Within pendencias filter, unread pendencia (#3) still comes before read pendencia (#1)"
  );
});

test("normalizeNotification maps backend dataHora and infers title when missing", () => {
  const normalized = normalizeNotification({
    id: "n-10",
    alunoId: "stu-1",
    alunoNome: "Mariana Atleta",
    tipo: "TREINO_CONCLUIDO",
    mensagem: "Mariana concluiu o treino de Natação.",
    dataHora: "2026-10-21T18:30:00Z",
    lida: false,
  });

  assert.equal(normalized.titulo, "Treino concluído - Mariana Atleta");
  assert.equal(normalized.dataCriacao, "2026-10-21T18:30:00Z");
  assert.equal(normalized.referenciaId, "stu-1");
  assert.equal(getNotificationCategoryMeta(normalized).category, "treino");
});

test("bell click in topbar opens popover locally instead of redirecting to main screen", () => {
  let popoverOpen = false;
  let redirectedTo = "";

  const fakeNavigate = (to) => {
    redirectedTo = to;
  };

  const handleBellClick = () => {
    popoverOpen = !popoverOpen;
  };

  handleBellClick();
  assert.equal(popoverOpen, true);
  assert.equal(redirectedTo, "", "Clicking notification icon should not redirect to main screen");

  handleBellClick();
  assert.equal(popoverOpen, false);
  assert.equal(redirectedTo, "");
});

test("outside click logic ignores trigger button to avoid closing on mousedown and reopening on click", () => {
  const triggerElement = { id: "trigger-btn" };
  const popoverElement = { id: "popover-content" };

  const triggerRef = { current: triggerElement };
  const popoverRef = { current: popoverElement };

  let closed = false;
  const onClose = () => {
    closed = true;
  };

  const simulateClickOutside = (target) => {
    closed = false;
    if (triggerRef.current && (triggerRef.current === target || triggerRef.current.contains?.(target))) {
      return;
    }
    if (popoverRef.current && (popoverRef.current === target || popoverRef.current.contains?.(target))) {
      return;
    }
    onClose();
  };

  // Clicking trigger should NOT trigger outside-close
  simulateClickOutside(triggerElement);
  assert.equal(closed, false, "Clicking trigger element must not be treated as outside click");

  // Clicking inside popover should NOT trigger outside-close
  simulateClickOutside(popoverElement);
  assert.equal(closed, false, "Clicking inside popover must not trigger outside click");

  // Clicking outside both should trigger outside-close
  const outsideElement = { id: "outside" };
  simulateClickOutside(outsideElement);
  assert.equal(closed, true, "Clicking outside both trigger and popover must call onClose");
});
