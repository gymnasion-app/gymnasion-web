import { useEffect, useState, type FormEvent } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import AppSidebar from "../AppSidebar/AppSidebar";
import AppTopbar from "../AppTopbar/AppTopbar";
import SidebarCallout from "../SidebarCallout/SidebarCallout";
import TermsModal from "../TermsModal/TermsModal";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Badge from "../Badge/Badge";
import Button from "../Button/Button";
import StudentRpeModal from "../StudentRpeModal/StudentRpeModal";
import ReportDialog from "../ReportDialog/ReportDialog";
import StravaModal from "../StravaModal/StravaModal";
import { useStudentArea } from "../../features/studentArea/StudentContext";
import { authService } from "../../services/authService";
import { relatorioService } from "../../services/relatorioService";
import { session } from "../../services/session";
import { parseAtividades } from "../../utils/activityParser";
import "./StudentLayout.css";

export default function StudentLayout() {
  const user = session.getUser();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    student,
    activeRoutine,
    activeRoutines,
    unreadNotifications,
    setSearchQuery,
    rpeModalSessionId,
    rpeBusy,
    openRpeModal,
    closeRpeModal,
    confirmRpeExecution,
    inspectedSession,
    setInspectedSession,
    inspectedRoutine,
    setInspectedRoutine,
    messageModalOpen,
    setMessageModalOpen,
    stravaModalOpen,
    setStravaModalOpen,
    sendObservationToPersonal,
    notifications,
    readNotification,
    refreshData,
  } = useStudentArea();

  const [menuOpen, setMenuOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (user?.role === "PERSONAL_TRAINER") {
    return <Navigate to="/home" replace />;
  }

  const isWorkouts = location.pathname.startsWith("/conta/treinos");
  const isEvolution = location.pathname.startsWith("/conta/evolucao");

  const title = location.pathname === "/conta/configuracoes" ? "Configurações" : isWorkouts
    ? "Meus treinos"
    : isEvolution
    ? "Minha evolução"
    : `Olá, ${student.firstName}`;

  const subtitle = location.pathname === "/conta/configuracoes" ? "Personalize sua experiência no Gymnasion" : isWorkouts
    ? "Sua rotina ativa, organizada por semanas"
    : isEvolution
    ? "Os mesmos gráficos que seu personal acompanha"
    : "Quarta-feira, 07 de outubro · Bora treinar?";

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageText.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      await sendObservationToPersonal(messageText);
      setMessageText("");
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <div className="student-layout">
      <a className="student-layout__skip" href="#student-content">
        Ir para o conteúdo
      </a>

      {menuOpen && (
        <div
          className="student-layout__backdrop"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        id="student-sidebar"
        className={`student-layout__sidebar${menuOpen ? " student-layout__sidebar--open" : ""}`}
      >
        <AppSidebar
          role="student"
          onCloseMobile={() => setMenuOpen(false)}
          user={{
            name: student.name,
            subtitle: student.roleLabel,
            initials: student.initials,
          }}
          menu={[
            { id: "panel", label: "Meu painel", icon: "imgIconHome", to: "/conta" },
            { id: "workouts", label: "Meus treinos", icon: "imgIconDumbbell", to: "/conta/treinos" },
            { id: "evolution", label: "Minha evolução", icon: "imgIconChart", to: "/conta/evolucao" },
            { id: "reports", label: "Meus relatórios", icon: "imgIconFile", onClick: () => setReportOpen(true) },
          ]}
          general={[
            {
              id: "integrations",
              label: "Integrações (Strava)",
              icon: "imgIconZap",
              onClick: () => setStravaModalOpen?.(true),
            },
            { id: "settings", label: "Configurações", icon: "imgIconSliders", to: "/conta/configuracoes" },
            {
              id: "terms",
              label: "Termos e privacidade",
              icon: "imgIconShield",
              onClick: () => setTermsOpen(true),
            },
          ]}
          footer={
            <SidebarCallout
              variant="personal"
              name={student.personal.name}
              registration={student.personal.cref}
              onAction={() => setMessageModalOpen(true)}
            />
          }
          onLogout={() => {
            authService.logout();
            navigate("/login", { replace: true });
          }}
        />
      </div>

      <div className="student-layout__body">
        <AppTopbar
          menuOpen={menuOpen}
          sidebarId="student-sidebar"
          onToggleMenu={() => setMenuOpen((prev) => !prev)}
          title={title}
          subtitle={subtitle}
          userName={student.name}
          userInitials={student.initials}
          avatarTone="info"
          searchLabel="Buscar treinos e sessões"
          notificationCount={unreadNotifications}
          notificationDot={unreadNotifications > 0}
          onSearch={(query) => {
            setSearchQuery(query);
            if (!isWorkouts) {
              navigate(
                query
                  ? `/conta/treinos?busca=${encodeURIComponent(query)}`
                  : "/conta/treinos"
              );
            }
          }}
          notifications={notifications}
          onReadNotification={readNotification}
          onRefreshNotifications={() => {
            if (refreshData) void refreshData();
          }}
        />

        <main id="student-content" className="student-layout__main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {reportOpen && (
        <ReportDialog
          studentName={student.name}
          modalidades={activeRoutines
            .filter((r) => r.modalidadeId != null)
            .map((r) => ({ id: r.modalidadeId!, nome: r.modalidade }))}
          onClose={() => setReportOpen(false)}
          generate={(filter, signal) => relatorioService.gerarPeloAluno(filter, signal)}
          loadAvailability={signal => relatorioService.disponibilidadePeloAluno(signal)}
        />
      )}

      {rpeModalSessionId && (
        <StudentRpeModal
          sessionId={rpeModalSessionId}
          initialRpe={7}
          busy={rpeBusy}
          onClose={closeRpeModal}
          onConfirm={(rpe, details) => void confirmRpeExecution(rpe, details)}
        />
      )}

      {inspectedSession && (() => {
        const parsed = parseAtividades(inspectedSession.descricao);
        return (
          <WorkspaceDialog
            title={inspectedSession.titulo}
            description={`Semana ${inspectedSession.semana} · ${inspectedSession.diaSemana}, ${inspectedSession.dataPlanejada}${
              inspectedSession.modalidadeNome
                ? ` · ${inspectedSession.modalidadeNome}`
                : activeRoutine
                ? ` · ${activeRoutine.modalidade}`
                : ""
            }`}
            icon="/student-profile/imgIconActivity2.svg"
            onClose={() => setInspectedSession(null)}
            actions={
              <>
                <Button variant="secondary" onClick={() => setInspectedSession(null)}>
                  Fechar
                </Button>
                {inspectedSession.status === "PLANEJADA" && (
                  <Button
                    onClick={() => {
                      const id = inspectedSession.id;
                      setInspectedSession(null);
                      openRpeModal(id);
                    }}
                  >
                    Finalizar sessão
                  </Button>
                )}
              </>
            }
          >
            <div className="student-session-dialog">
              <div className="student-session-dialog__badges">
                <Badge
                  tone={
                    inspectedSession.status === "CONCLUIDA"
                      ? "success"
                      : inspectedSession.status === "VALIDADA"
                      ? "info"
                      : "neutral"
                  }
                >
                  {inspectedSession.status === "CONCLUIDA"
                    ? "Sessão finalizada"
                    : inspectedSession.status === "VALIDADA"
                    ? "Validada pelo personal"
                    : "Planejada"}
                </Badge>
                {inspectedSession.duracaoPlanejada && (
                  <span className="student-session-dialog__meta">
                    Duração estimada: {inspectedSession.duracaoPlanejada} min
                  </span>
                )}
                {typeof inspectedSession.rpe === "number" && (
                  <span className="student-session-dialog__meta">
                    RPE (Borg): {inspectedSession.rpe}/10
                  </span>
                )}
              </div>

              {parsed.activities.length > 0 ? (
                <div className="student-session-dialog__block">
                  <h3>Atividades planejadas</h3>
                  <div className="student-session-dialog__activities">
                    {parsed.activities.map((act, idx) => (
                      <div key={act.id} className="student-session-dialog__activity-item">
                        <span className="student-session-dialog__activity-num">{idx + 1}</span>
                        <div>
                          <strong>{act.title}</strong>
                          {act.description && <p>{act.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !parsed.orientations &&
                inspectedSession.descricao && (
                  <div className="student-session-dialog__block">
                    <h3>Descrição da sessão</h3>
                    <p>{inspectedSession.descricao}</p>
                  </div>
                )
              )}

              {parsed.orientations && (
                <div className="student-session-dialog__orientations">
                  <Info size={16} aria-hidden="true" />
                  <div>
                    <strong>Orientações do personal</strong>
                    <p>{parsed.orientations}</p>
                  </div>
                </div>
              )}

              {inspectedSession.resultados && inspectedSession.resultados.length > 0 && (
                <div className="student-session-dialog__block">
                  <h3>Métricas enviadas</h3>
                  <div className="student-session-dialog__results">
                    {inspectedSession.resultados.map((res) => (
                      <div key={res.metricaId} className="student-session-dialog__result-card">
                        <span>{res.titulo}</span>
                        <strong>{res.valor}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </WorkspaceDialog>
        );
      })()}

      {inspectedRoutine && (
        <WorkspaceDialog
          title={inspectedRoutine.titulo}
          description={inspectedRoutine.periodo}
          icon="/design-system/imgIconDumbbell.svg"
          onClose={() => setInspectedRoutine(null)}
          actions={
            <Button variant="secondary" onClick={() => setInspectedRoutine(null)}>
              Fechar
            </Button>
          }
        >
          <div className="student-session-dialog">
            <div className="student-session-dialog__badges">
              <Badge tone="neutral">Encerrada</Badge>
              <span className="student-session-dialog__meta">
                {inspectedRoutine.sessoesConcluidas} sessões concluídas
              </span>
            </div>
            <div className="student-session-dialog__block">
              <h3>Objetivo do ciclo</h3>
              <p>{inspectedRoutine.objetivo}</p>
            </div>
          </div>
        </WorkspaceDialog>
      )}

      {messageModalOpen && (
        <WorkspaceDialog
          title={`Enviar mensagem para ${student.personal.name}`}
          description="Registre uma observação ou dúvida sobre sua rotina de treinos."
          icon="/design-system/imgIconMsg.svg"
          busy={sendingMessage}
          onClose={() => setMessageModalOpen(false)}
        >
          <form className="student-message-dialog" onSubmit={handleSendMessage}>
            <label htmlFor="student-observation-input">Sua mensagem ou observação</label>
            <textarea
              id="student-observation-input"
              rows={4}
              maxLength={2000}
              placeholder="Ex.: Senti ótima evolução nas viradas hoje, mas tive leve fadiga nos últimos 200m..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={sendingMessage}
              required
            />
            <footer className="workspace-dialog__actions">
              <Button
                variant="secondary"
                type="button"
                disabled={sendingMessage}
                onClick={() => setMessageModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={sendingMessage} disabled={!messageText.trim()}>
                Enviar mensagem
              </Button>
            </footer>
          </form>
        </WorkspaceDialog>
      )}

      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {stravaModalOpen && <StravaModal onClose={() => setStravaModalOpen?.(false)} />}
    </div>
  );
}
