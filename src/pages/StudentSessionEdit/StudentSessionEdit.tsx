// src/pages/StudentSessionEdit/StudentSessionEdit.tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  Edit2,
  Info,
  Shield,
  Check,
  X,
} from "lucide-react";
import Button from "../../components/Button/Button";
import FormField from "../../components/FormField/FormField";
import Badge from "../../components/Badge/Badge";
import SportTag from "../../components/SportTag/SportTag";
import Avatar from "../../components/Avatar/Avatar";
import Checkbox from "../../components/Checkbox/Checkbox";
import { sessionDetailService } from "../../services/sessionDetailService";
import { rotinaService } from "../../services/rotinaService";
import { metricaService } from "../../services/metricaService";
import { metricLabels } from "../../features/routines/routineModel";
import { getPreenchimentoLabel } from "../../features/metrics/metricModel";
import { authError } from "../../utils/authError";
import { parseAtividades, serializeAtividades } from "../../utils/activityParser";
import type { MetricaResponseDTO } from "../../types/metric";
import type { TrainingSession } from "../../types/personalDashboard";
import type { RotinaResponse } from "../../types/rotina";
import type { Sport } from "../../components/SportTag/SportTag";
import "./StudentSessionEdit.css";

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  altered?: boolean;
}

export default function StudentSessionEdit() {
  const { studentId = "", sessionId = "" } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [routine, setRoutine] = useState<RotinaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [sessionName, setSessionName] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [duration, setDuration] = useState("");
  const [orientations, setOrientations] = useState("");

  // Atividades
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Nova atividade inline
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Métricas da modalidade e selecionadas nesta sessão
  const [modalityMetrics, setModalityMetrics] = useState<MetricaResponseDTO[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const sessionData = await sessionDetailService.obterSessao(sessionId);
      setSession(sessionData);

      if (sessionData.status !== "PLANEJADA" || sessionData.concluidaAluno) {
        toast.error("Somente sessões planejadas futuras podem ser editadas.");
        navigate(`/alunos/${studentId}`);
        return;
      }

      setPlannedDate(sessionData.dataPlanejada || "");
      setDuration(sessionData.duracao ? `${sessionData.duracao} min` : "40 min");

      // Parse atividades reais do backend sem valores estáticos
      const parsedAtividades = parseAtividades(sessionData.atividades);
      setActivities(parsedAtividades.activities);
      setSessionName(parsedAtividades.sessionName);
      setOrientations(parsedAtividades.orientations);

      const sessionMetricIds = new Set(
        sessionData.metricas && sessionData.metricas.length > 0
          ? sessionData.metricas.map((m) => m.id)
          : sessionData.metricasIds || []
      );
      const initialMetrics: Record<string, boolean> = {};
      sessionMetricIds.forEach((id) => {
        initialMetrics[id] = true;
      });
      setSelectedMetrics(initialMetrics);

      // Carrega rotina e métricas ativas da modalidade
      if (sessionData.rotinaTreinoId) {
        try {
          const routineData = await rotinaService.buscarPorId(sessionData.rotinaTreinoId);
          setRoutine(routineData);

          const modId = routineData.modalidadeId ?? routineData.modalidade?.id;
          if (modId) {
            const modMetrics = await metricaService.listarPorModalidade(modId);
            setModalityMetrics((modMetrics || []).filter((m) => m.ativo));
          } else {
            setModalityMetrics([]);
          }
        } catch {
          setModalityMetrics([]);
        }
      }
    } catch (err) {
      setError(authError(err, "Não foi possível carregar a sessão.").message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, studentId, navigate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="session-edit-loading" role="status">
        Carregando formulário de edição...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="session-edit-error" role="alert">
        <h2>Sessão indisponível</h2>
        <p>{error || "A sessão não foi encontrada."}</p>
        <Link to={`/alunos/${studentId}`}>← Voltar ao perfil do aluno</Link>
      </div>
    );
  }

  const handleAddActivity = () => {
    if (!newTitle.trim()) {
      toast.error("Informe o título da atividade.");
      return;
    }
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || newTitle.trim(),
      altered: true,
    };
    setActivities((prev) => [...prev, newAct]);
    setNewTitle("");
    setNewDesc("");
    setIsAddingActivity(false);
  };

  const handleSaveEditActivity = (id: string) => {
    if (!editTitle.trim()) return;
    setActivities((prev) =>
      prev.map((act) =>
        act.id === id
          ? {
              ...act,
              title: editTitle.trim(),
              description: editDesc.trim() || act.description,
              altered: true,
            }
          : act
      )
    );
    setEditingActivityId(null);
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((act) => act.id !== id));
  };

  const handleSaveSession = async () => {
    if (!plannedDate) {
      toast.error("A data planejada é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      // Monta string de atividades completa com orientações e nome
      const serialized = serializeAtividades({
        sessionName,
        activities,
        orientations,
      });

      const durMin = parseInt(duration.replace(/\D/g, ""), 10) || 40;
      const metricasIds = modalityMetrics
        .filter((m) => Boolean(selectedMetrics[m.id]))
        .map((m) => m.id);

      await sessionDetailService.editarSessaoFutura(sessionId, {
        semana: session.semana,
        dataPlanejada: plannedDate,
        duracao: durMin,
        atividades: serialized,
        metricasIds,
      });

      toast.success("Planejamento da sessão futura atualizado com sucesso!");
      navigate(`/alunos/${studentId}`);
    } catch (err) {
      toast.error(authError(err, "Erro ao salvar alterações da sessão futura.").message);
    } finally {
      setSaving(false);
    }
  };

  const sportName = (routine?.nomeModalidade || routine?.modalidade?.nome || "academia")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") as Sport;

  return (
    <div className="session-edit-page">
      {/* Breadcrumb */}
      <nav className="session-edit__breadcrumb" aria-label="Navegação">
        <Link to="/alunos">Alunos</Link>
        <span>/</span>
        <Link to={`/alunos/${studentId}`}>{routine?.alunos?.[0]?.nome || "Aluno"}</Link>
        <span>/</span>
        <span>{routine?.titulo || "Rotina"}</span>
        <span>/</span>
        <span>Semana {session.semana}</span>
      </nav>

      {/* Header */}
      <div className="session-edit__header">
        <div className="session-edit__title-section">
          <h1>
            Editar sessão {session.semana} · {sessionName || "Sessão"}
          </h1>

          <div className="session-edit__meta-bar">
            <div className="session-edit__student-badge">
              <Avatar name={routine?.alunos?.[0]?.nome || "Aluno"} tone="info" />
              <span className="session-edit__student-name">
                {routine?.alunos?.[0]?.nome || "Aluno"}
              </span>
            </div>

            <Badge tone="neutral">● Planejada</Badge>
            <SportTag sport={sportName} />
            <span className="session-edit__date-status">Ainda não executada</span>
          </div>
        </div>

        <div className="session-edit__actions">
          <Button
            variant="secondary"
            onClick={() => navigate(`/alunos/${studentId}`)}
            disabled={saving}
          >
            Descartar
          </Button>
          <Button variant="primary" onClick={handleSaveSession} loading={saving}>
            Salvar alterações
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="session-edit__grid">
        {/* Left Column: Form Details & Activities */}
        <div className="session-edit__left-col">
          {/* Card: Dados da sessão */}
          <section className="workspace-card session-edit__card" aria-label="Dados da sessão">
            <h2>Dados da sessão</h2>

            <div className="session-edit__form-row">
              <FormField
                id="session-name"
                label="Nome da sessão"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Ex: Recuperação ativa"
              />
              <FormField
                id="session-date"
                label="Data planejada"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                required
              />
              <FormField
                id="session-duration"
                label="Duração estimada"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 40 min"
              />
            </div>
          </section>

          {/* Card: Atividades */}
          <section className="workspace-card session-edit__card" aria-label="Atividades">
            <header className="session-edit__activities-header">
              <div>
                <h2>Atividades</h2>
                <p>Edite ou remova atividades · a aluna verá a versão salva</p>
              </div>
              <Button
                variant="secondary"
                icon={<Plus size={16} />}
                onClick={() => setIsAddingActivity(true)}
              >
                Adicionar atividade
              </Button>
            </header>

            {/* Nova atividade form */}
            {isAddingActivity && (
              <div className="session-edit__add-activity-box">
                <h4>Nova atividade</h4>
                <div className="activity-inputs">
                  <input
                    type="text"
                    placeholder="Título (ex: Aquecimento)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="act-input-title"
                  />
                  <textarea
                    rows={3}
                    placeholder="Descrição / séries em múltiplas linhas (ex: • 300 m nado livre · ritmo leve)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="act-input-desc act-textarea-multiline"
                  />
                </div>
                <div className="activity-buttons">
                  <Button variant="ghost" onClick={() => setIsAddingActivity(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={handleAddActivity}>
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {/* Lista de atividades */}
            <div className="session-edit__activities-list">
              {activities.length === 0 && !isAddingActivity && (
                <p className="session-edit__empty-activities" style={{ color: "#64748b", padding: "1rem 0" }}>
                  Nenhum exercício cadastrado. Clique em "+ Adicionar exercício" para incluir atividades nesta sessão.
                </p>
              )}
              {activities.map((act, index) => {
                const isEditing = editingActivityId === act.id;

                return (
                  <div
                    key={act.id}
                    className={`session-edit__activity-item ${act.altered ? "is-altered" : ""}`}
                  >
                    <div className="activity-num">{index + 1}</div>

                    {isEditing ? (
                      <div className="activity-edit-inline">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="act-input-title"
                        />
                        <textarea
                          rows={3}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="act-input-desc act-textarea-multiline"
                        />
                        <div className="inline-act-actions">
                          <button
                            type="button"
                            className="inline-btn save"
                            onClick={() => handleSaveEditActivity(act.id)}
                            aria-label="Salvar atividade"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            className="inline-btn cancel"
                            onClick={() => setEditingActivityId(null)}
                            aria-label="Cancelar edição"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="activity-details">
                          <div className="activity-title-line">
                            <strong>{act.title}</strong>
                            {act.altered && <Badge tone="info">● Alterada</Badge>}
                          </div>
                          <span className="activity-desc">{act.description}</span>
                        </div>

                        <div className="activity-actions">
                          <button
                            type="button"
                            className="act-action-btn"
                            onClick={() => {
                              setEditingActivityId(act.id);
                              setEditTitle(act.title);
                              setEditDesc(act.description);
                            }}
                            aria-label="Editar atividade"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="act-action-btn delete"
                            onClick={() => handleDeleteActivity(act.id)}
                            aria-label="Excluir atividade"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card: Orientações para a aluna */}
          <section className="workspace-card session-edit__card" aria-label="Orientações">
            <header className="session-edit__card-header">
              <div>
                <h2>Orientações para a aluna</h2>
                <p>Texto exibido no detalhe da sessão</p>
              </div>
            </header>

            <div className="session-edit__orientations-box">
              <textarea
                rows={3}
                maxLength={500}
                value={orientations}
                onChange={(e) => setOrientations(e.target.value)}
                placeholder="Orientações técnicas, cuidados ou foco da sessão..."
              />
              <span className="char-count">Opcional · até 500 caracteres</span>
            </div>
          </section>
        </div>

        {/* Right Column: Métricas desta sessão & Regras */}
        <div className="session-edit__right-col">
          {/* Card: Métricas desta sessão */}
          <section className="workspace-card session-edit__card" aria-label="Métricas">
            <header className="session-edit__card-header">
              <div>
                <h2>Métricas desta sessão</h2>
                <p>
                  Da modalidade {routine?.nomeModalidade || routine?.modalidade?.nome || "da rotina"}{" "}
                  · marque de 0 a N métricas para o registro
                </p>
              </div>
            </header>

            <div className="session-edit__metrics-checklist">
              {modalityMetrics.length > 0 ? (
                modalityMetrics.map((m) => (
                  <div key={m.id} className="metric-check-item">
                    <Checkbox
                      label=""
                      aria-label={`Incluir métrica ${m.titulo}`}
                      checked={Boolean(selectedMetrics[m.id])}
                      onChange={(e) =>
                        setSelectedMetrics((prev) => ({
                          ...prev,
                          [m.id]: e.target.checked,
                        }))
                      }
                    />
                    <div className="metric-check-text">
                      <strong>{m.titulo}</strong>
                      <span className="metric-type-hint">
                        {metricLabels[m.tipo] || m.tipo} · preenche:{" "}
                        {getPreenchimentoLabel(m.quemPreenche)}
                      </span>
                    </div>
                    <Badge tone={m.obrigatoria !== false ? "danger" : "info"}>
                      {m.obrigatoria !== false ? "Obrigatória" : "Opcional"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="no-metrics-msg">
                  <p>
                    Nenhuma métrica ativa cadastrada para esta modalidade. A sessão registrará
                    apenas RPE e duração.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Card Informativo: Regra US-10 C2 */}
          <div className="session-edit__info-box" role="status">
            <Info size={20} className="info-icon" />
            <div>
              <strong>Somente sessões futuras podem ser editadas</strong>
              <p>
                As sessões já executadas e seus resultados são preservados. Se a aluna já tiver
                iniciado o registro desta sessão, a edição é bloqueada.
              </p>
            </div>
          </div>

          <div className="session-edit__footer-compliance">
            <Shield size={16} />
            <span>Alterações no planejamento ficam registradas com seu nome, data e hora.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
