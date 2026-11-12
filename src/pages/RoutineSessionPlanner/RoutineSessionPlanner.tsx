import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Info,
  Layers,
  ExternalLink,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Search,
} from "lucide-react";
import Button from "../../components/Button/Button";
import Badge from "../../components/Badge/Badge";
import SportTag from "../../components/SportTag/SportTag";
import FormField from "../../components/FormField/FormField";
import WorkspaceDialog from "../../components/WorkspaceDialog/WorkspaceDialog";
import MetricFormModal from "../../components/MetricModal/MetricFormModal";
import { rotinaService } from "../../services/rotinaService";
import { metricaService } from "../../services/metricaService";
import {
  filterAndSortRoutineMetrics,
  getRequiredMetricIds,
  isRoutineActive,
  metricLabels,
} from "../../features/routines/routineModel";
import { getPreenchimentoLabel } from "../../features/metrics/metricModel";
import { authError } from "../../utils/authError";
import {
  buildSessionCardPreview,
  parseAtividades,
  serializeAtividades,
} from "../../utils/activityParser";
import type { MetricaResponseDTO } from "../../types/metric";
import type {
  PlanejamentoRotinaResponseDTO,
  RotinaResponse,
  SessaoTreinoPlanejadaDTO,
} from "../../types/rotina";
import "./RoutineSessionPlanner.css";

interface ActivityBlock {
  id: string;
  title: string;
  description: string;
}

const QUICK_BLOCK_PRESETS = [
  {
    label: "Aquecimento",
    title: "Aquecimento / Mobilidade",
    placeholder:
      "• 5 min mobilidade articular (quadril, torácica e ombros)\n• 2 × 15 ativação de core (prancha frontal + perdigueiro)",
  },
  {
    label: "Educativos",
    title: "Ativação & Educativos Técnicos",
    placeholder:
      "• 3 × 30m educativos coordenativos\n• Foco em postura e cadência · descanso 30s",
  },
  {
    label: "Série Principal",
    title: "Série Principal",
    placeholder:
      "• Exercício 1: 4 × 10-12 reps (descanso 60s)\n• Exercício 2: 4 × 12 reps (PSE 7-8)\n• Exercício 3: 3 × 15 reps",
  },
  {
    label: "Circuito / Metabólico",
    title: "Bloco Metabólico / Circuito",
    placeholder:
      "• 4 Rounds (40s estímulo : 20s pausa):\n  - Estação 1: Kettlebell Swing\n  - Estação 2: Corda Naval\n  - Estação 3: Burpees",
  },
  {
    label: "Volta à Calma",
    title: "Volta à Calma / Desaquecimento",
    placeholder:
      "• 5 min caminhada ou soltura leve (Z1)\n• Alongamento estático global e controle respiratório",
  },
];

const DURATION_PRESETS = ["30 min", "45 min", "50 min", "60 min", "75 min", "90 min"];

const FORMAT_SNIPPETS = [
  { label: "• Tópico", text: "\n• " },
  { label: "Séries × Reps", text: "4 × 12 reps · " },
  { label: "⏱ Descanso", text: " · descanso 45s" },
  { label: "🔥 PSE / Zona", text: " · PSE alvo 7-8" },
];

const MAX_VISIBLE_METRICS = 3;

function defaultPlannedDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso?: string | null, days = 0): string {
  if (!iso) return defaultPlannedDate();
  const base = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function formatDateBrWithWeekday(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!d) return iso;
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return `${d}/${m}/${y}`;
  }
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(parsed)
    .replace(".", "");
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized}, ${d}/${m}/${y}`;
}

export default function RoutineSessionPlanner() {
  const { routineId = "" } = useParams();
  const navigate = useNavigate();
  const formTopRef = useRef<HTMLDivElement>(null);
  const newDescTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [routine, setRoutine] = useState<RotinaResponse | null>(null);
  const [planning, setPlanning] = useState<PlanejamentoRotinaResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Semanas gerenciadas na tela
  const [extraWeeks, setExtraWeeks] = useState<number[]>([1]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Estados do formulário de Nova Sessão
  const [sessionName, setSessionName] = useState("");
  const [plannedDate, setPlannedDate] = useState<string>(() => defaultPlannedDate());
  const [duration, setDuration] = useState("45 min");
  const [orientations, setOrientations] = useState("");

  // Lista de blocos de atividades da sessão
  const [activities, setActivities] = useState<ActivityBlock[]>([]);

  // Edição inline de um bloco existente
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Adição de novo bloco
  const [addingNewActivity, setAddingNewActivity] = useState(false);
  const [newActTitle, setNewActTitle] = useState("");
  const [newActDesc, setNewActDesc] = useState("");
  const [newActPlaceholder, setNewActPlaceholder] = useState(
    "Descreva os exercícios em múltiplas linhas:\n• 4 × 12 Kettlebell Swing (descanso 45s)\n• 4 × 30s Corda Naval\n• 3 × 10 Burpees"
  );

  // Controle de expansão, filtro e busca dos cards de sessões da semana
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});
  const [weekSessionFilter, setWeekSessionFilter] = useState<"all" | "pending" | "completed">(
    "all"
  );
  const [weekSessionSearch, setWeekSessionSearch] = useState("");

  // Métricas da modalidade para vínculo por sessão (0..N)
  const [modalityMetrics, setModalityMetrics] = useState<MetricaResponseDTO[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [metricSearch, setMetricSearch] = useState("");
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<string>>(() => new Set());
  const [creatingMetric, setCreatingMetric] = useState(false);

  // Duplicação de semana (N -> N+1)
  const [confirmingWeekDup, setConfirmingWeekDup] = useState(false);
  const [duplicatingWeek, setDuplicatingWeek] = useState(false);

  // Duplicação de sessão para outra semana/data
  const [duplicatingSession, setDuplicatingSession] = useState<{
    session: SessaoTreinoPlanejadaDTO;
    headline: string;
    originWeek: number;
  } | null>(null);
  const [dupTargetWeek, setDupTargetWeek] = useState<number>(1);
  const [dupTargetDate, setDupTargetDate] = useState<string>("");
  const [dupDateTouched, setDupDateTouched] = useState(false);
  const [dupSubmitting, setDupSubmitting] = useState(false);
  const [dupError, setDupError] = useState("");

  const loadData = useCallback(async () => {
    if (!routineId) return;
    setLoading(true);
    setError("");
    try {
      const [routineData, planningData] = await Promise.all([
        rotinaService.buscarPorId(routineId),
        rotinaService.consultarPlanejamento(routineId),
      ]);
      setRoutine(routineData);
      setPlanning(planningData);

      if (planningData.semanas && planningData.semanas.length > 0) {
        const weekNums = planningData.semanas.map((s) => s.numeroSemana);
        setExtraWeeks((prev) => Array.from(new Set([...prev, ...weekNums])).sort((a, b) => a - b));
      }

      const modId = routineData.modalidadeId ?? routineData.modalidade?.id;
      if (modId) {
        setMetricsLoading(true);
        setMetricsError("");
        metricaService
          .listarPorModalidade(modId)
          .then((data) => {
            const activeList = (data || []).filter((m) => m.ativo);
            setModalityMetrics(activeList);
          })
          .catch(() => {
            setMetricsError("Não foi possível carregar as métricas da modalidade.");
            setModalityMetrics([]);
          })
          .finally(() => {
            setMetricsLoading(false);
          });
      }
    } catch (err) {
      setError(authError(err, "Não foi possível carregar o planejamento da rotina.").message);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Todas as semanas disponíveis nas abas
  const allWeekNumbers = useMemo(() => {
    const fromBackend = (planning?.semanas || []).map((w) => w.numeroSemana);
    return Array.from(new Set([1, ...extraWeeks, ...fromBackend])).sort((a, b) => a - b);
  }, [planning?.semanas, extraWeeks]);

  // Sessões da semana atualmente selecionada
  const currentWeekSessions = useMemo<SessaoTreinoPlanejadaDTO[]>(() => {
    const found = (planning?.semanas || []).find((w) => w.numeroSemana === selectedWeek);
    return found ? found.sessoes : [];
  }, [planning?.semanas, selectedWeek]);

  // Estatísticas da semana selecionada
  const weekStats = useMemo(() => {
    const totalMinutes = currentWeekSessions.reduce((acc, s) => acc + (s.duracao || 0), 0);
    const completedOrValidated = currentWeekSessions.filter(
      (s) => s.validadaPersonal || s.concluidaAluno || s.status === "CONCLUIDA"
    ).length;
    const pending = currentWeekSessions.length - completedOrValidated;
    return { totalMinutes, completedOrValidated, pending };
  }, [currentWeekSessions]);

  // Limpa filtros da barra lateral ao trocar de semana para evitar listas vazias acidentais
  useEffect(() => {
    setWeekSessionFilter("all");
    setWeekSessionSearch("");
  }, [selectedWeek]);

  // Lista filtrada mantendo o índice ordinal (#1, #2, ...) original da semana
  const indexedWeekSessions = useMemo(() => {
    const normalizedQuery = weekSessionSearch.trim().toLowerCase();
    return currentWeekSessions
      .map((session, idx) => ({
        session,
        weekIndex: idx + 1,
        preview: buildSessionCardPreview(session.atividades, idx + 1),
        isDone: Boolean(session.concluidaAluno || session.status === "CONCLUIDA"),
        isValidated: Boolean(session.validadaPersonal),
      }))
      .filter((item) => {
        const isCompleted = item.isValidated || item.isDone;
        if (weekSessionFilter === "pending" && isCompleted) return false;
        if (weekSessionFilter === "completed" && !isCompleted) return false;
        if (!normalizedQuery) return true;

        const metricNames = (item.session.metricas || [])
          .map((m) => m.titulo)
          .join(" ")
          .toLowerCase();
        const blockText = item.preview.blocks
          .map((b) => `${b.title} ${b.description}`)
          .join(" ")
          .toLowerCase();
        return (
          item.preview.headline.toLowerCase().includes(normalizedQuery) ||
          blockText.includes(normalizedQuery) ||
          metricNames.includes(normalizedQuery) ||
          `#${item.weekIndex}`.includes(normalizedQuery)
        );
      });
  }, [currentWeekSessions, weekSessionFilter, weekSessionSearch]);

  // Sessões de outras semanas para clonagem rápida quando a semana atual estiver vazia
  const previousWeeksSessions = useMemo(() => {
    return (planning?.semanas || [])
      .filter((w) => w.numeroSemana !== selectedWeek && w.sessoes.length > 0)
      .flatMap((w) =>
        w.sessoes.map((sess, idx) => ({
          weekNum: w.numeroSemana,
          sessionIndex: idx + 1,
          session: sess,
          preview: buildSessionCardPreview(sess.atividades, idx + 1),
        }))
      )
      .slice(-6);
  }, [planning?.semanas, selectedWeek]);

  // Total de sessões em toda a rotina
  const totalSessionsCount = useMemo(() => {
    return (planning?.semanas || []).reduce((acc, w) => acc + w.sessoes.length, 0);
  }, [planning?.semanas]);

  const handleAddWeekTab = () => {
    const nextWeek = (allWeekNumbers[allWeekNumbers.length - 1] || 1) + 1;
    setExtraWeeks((prev) => Array.from(new Set([...prev, nextWeek])).sort((a, b) => a - b));
    setSelectedWeek(nextWeek);
  };

  // Abre o compositor de bloco já preenchido com um preset rápido
  const handleSelectQuickPreset = (preset: (typeof QUICK_BLOCK_PRESETS)[number]) => {
    setAddingNewActivity(true);
    setNewActTitle(preset.title);
    setNewActPlaceholder(preset.placeholder);
    setTimeout(() => {
      newDescTextareaRef.current?.focus();
    }, 20);
  };

  // Insere snippet de formatação no textarea
  const insertSnippetInNewDesc = (snippet: string) => {
    setNewActDesc((prev) => {
      if (snippet.startsWith("\n•")) {
        return prev.trim() ? `${prev.replace(/\s+$/, "")}\n• ` : "• ";
      }
      return `${prev}${snippet}`;
    });
    setTimeout(() => {
      newDescTextareaRef.current?.focus();
    }, 10);
  };

  const insertSnippetInEditDesc = (snippet: string) => {
    setEditDesc((prev) => {
      if (snippet.startsWith("\n•")) {
        return prev.trim() ? `${prev.replace(/\s+$/, "")}\n• ` : "• ";
      }
      return `${prev}${snippet}`;
    });
  };

  // Manipulação de blocos de atividades
  const handleStartEditActivity = (act: ActivityBlock) => {
    setEditingActivityId(act.id);
    setEditTitle(act.title);
    setEditDesc(act.description);
  };

  const handleSaveEditActivity = (id: string) => {
    if (!editTitle.trim()) {
      toast.error("Informe o título do bloco de atividade.");
      return;
    }
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              title: editTitle.trim(),
              description: editDesc.trim(),
            }
          : a
      )
    );
    setEditingActivityId(null);
  };

  const handleMoveActivity = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= activities.length) return;
    setActivities((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const handleDuplicateActivity = (act: ActivityBlock, index: number) => {
    const copy: ActivityBlock = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${act.title} (cópia)`,
      description: act.description,
    };
    setActivities((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    toast.success("Bloco duplicado!");
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const handleConfirmAddActivity = () => {
    if (!newActTitle.trim()) {
      toast.error("Informe o título do bloco de atividade.");
      return;
    }
    const newBlock: ActivityBlock = {
      id: `act-${Date.now()}`,
      title: newActTitle.trim(),
      description: newActDesc.trim() || "Conforme orientação",
    };
    setActivities((prev) => [...prev, newBlock]);
    setNewActTitle("");
    setNewActDesc("");
    setAddingNewActivity(false);
  };

  const visibleModalityMetrics = useMemo(() => {
    return filterAndSortRoutineMetrics(modalityMetrics, selectedMetricIds, metricSearch);
  }, [modalityMetrics, selectedMetricIds, metricSearch]);

  const requiredMetricIds = useMemo(() => {
    return getRequiredMetricIds(modalityMetrics);
  }, [modalityMetrics]);

  const modalityOptions = useMemo(() => {
    const modId = routine?.modalidadeId ?? routine?.modalidade?.id;
    const modName = routine?.nomeModalidade || routine?.modalidade?.nome || "Modalidade";
    return modId ? [{ id: modId, nome: modName }] : [];
  }, [routine?.modalidadeId, routine?.modalidade?.id, routine?.nomeModalidade, routine?.modalidade?.nome]);

  const handleToggleMetric = (metricId: string) => {
    setSelectedMetricIds((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
  };

  // Clonar / Usar uma sessão existente como base no formulário (Etapa 2)
  const handleUseSessionAsTemplate = (sess: SessaoTreinoPlanejadaDTO, sourceLabel?: string) => {
    const parsed = parseAtividades(sess.atividades);
    const preview = buildSessionCardPreview(sess.atividades);

    setSessionName(parsed.sessionName || preview.headline || "");
    if (sess.duracao) {
      setDuration(`${sess.duracao} min`);
    }
    setOrientations(parsed.orientations || "");

    const sourceBlocks =
      parsed.activities.length > 0
        ? parsed.activities.map((a, idx) => ({
            id: `act-clone-${Date.now()}-${idx}`,
            title:
              parsed.activities.length === 1 && !a.description && a.title.length > 42
                ? "Série Principal"
                : a.title,
            description:
              parsed.activities.length === 1 && !a.description && a.title.length > 42
                ? a.title
                : a.description || "Conforme orientação",
          }))
        : [];

    setActivities(sourceBlocks);
    setAddingNewActivity(false);
    setEditingActivityId(null);

    const activeIds = new Set(modalityMetrics.map((m) => m.id));
    const sourceMetricIds =
      sess.metricas && sess.metricas.length > 0
        ? sess.metricas.map((m) => m.id)
        : sess.metricasIds || [];
    setSelectedMetricIds(new Set(sourceMetricIds.filter((id) => activeIds.has(id))));

    toast.success(
      sourceLabel
        ? `${sourceLabel} carregada no formulário! Ajuste a data, blocos ou métricas e salve.`
        : "Sessão carregada como base no formulário!"
    );

    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleClearDraft = () => {
    setSessionName("");
    setOrientations("");
    setActivities([]);
    setNewActTitle("");
    setNewActDesc("");
    setAddingNewActivity(false);
    setEditingActivityId(null);
    setSelectedMetricIds(new Set());
  };

  // Salvar Nova Sessão na Rotina (POST /api/personal-trainers/rotinas/{id}/sessoes)
  const handleCreateSession = async () => {
    if (!routine) return;

    if (!plannedDate) {
      toast.error("A data planejada é obrigatória.");
      return;
    }

    if (selectedWeek < 1) {
      toast.error("O número da semana deve ser no mínimo 1.");
      return;
    }

    const durMin = parseInt(duration.replace(/\D/g, ""), 10);
    if (!durMin || durMin < 1) {
      toast.error("A duração deve ser de no mínimo 1 minuto.");
      return;
    }

    // Se o personal preencheu um novo bloco mas esqueceu de clicar em "Confirmar bloco",
    // incluímos automaticamente para não perder o que ele digitou
    const finalActivities = [...activities];
    if (addingNewActivity && (newActTitle.trim() || newActDesc.trim())) {
      finalActivities.push({
        id: `act-${Date.now()}`,
        title: newActTitle.trim() || "Bloco de atividade",
        description: newActDesc.trim() || "Conforme orientação",
      });
    }

    if (finalActivities.length === 0 && !sessionName.trim() && !orientations.trim()) {
      toast.error("Adicione ao menos um bloco de atividade ou nome para a sessão.");
      return;
    }

    setSaving(true);
    try {
      const serialized = serializeAtividades({
        sessionName,
        activities: finalActivities,
        orientations,
      });

      await rotinaService.adicionarSessao(routineId, {
        semana: selectedWeek,
        dataPlanejada: plannedDate,
        duracao: durMin,
        atividades: serialized,
        metricasIds: Array.from(selectedMetricIds),
      });

      toast.success(`Sessão #${currentWeekSessions.length + 1} salva na Semana ${selectedWeek}!`);

      // Prepara o formulário para a próxima sessão da semana
      handleClearDraft();
      const nextDate = new Date(plannedDate + "T12:00:00");
      if (!Number.isNaN(nextDate.getTime())) {
        nextDate.setDate(nextDate.getDate() + 2);
        setPlannedDate(nextDate.toISOString().slice(0, 10));
      }

      await loadData();
    } catch (err) {
      toast.error(authError(err, "Erro ao adicionar sessão à rotina.").message);
    } finally {
      setSaving(false);
    }
  };

  const openDuplicateSessionModal = (sess: SessaoTreinoPlanejadaDTO, headline: string) => {
    const nextWeek = selectedWeek < 104 ? selectedWeek + 1 : selectedWeek;
    setDuplicatingSession({ session: sess, headline, originWeek: selectedWeek });
    setDupTargetWeek(nextWeek);
    setDupTargetDate(addDaysIso(sess.dataPlanejada, (nextWeek - selectedWeek) * 7));
    setDupDateTouched(false);
    setDupError("");
  };

  const handleConfirmDuplicateSession = async (event: FormEvent) => {
    event.preventDefault();
    if (!duplicatingSession) return;

    if (!Number.isInteger(dupTargetWeek) || dupTargetWeek < 1 || dupTargetWeek > 104) {
      setDupError("A semana de destino deve estar entre 1 e 104.");
      return;
    }
    if (!dupTargetDate) {
      setDupError("Informe a data planejada de destino.");
      return;
    }

    setDupSubmitting(true);
    setDupError("");
    try {
      await rotinaService.duplicarSessao(duplicatingSession.session.id, {
        semana: dupTargetWeek,
        dataPlanejada: dupTargetDate,
      });
      toast.success(`Sessão duplicada para a Semana ${dupTargetWeek}!`);
      setExtraWeeks((prev) =>
        Array.from(new Set([...prev, dupTargetWeek])).sort((a, b) => a - b)
      );
      setSelectedWeek(dupTargetWeek);
      setDuplicatingSession(null);
      await loadData();
    } catch (err) {
      setDupError(authError(err, "Não foi possível duplicar a sessão.").message);
    } finally {
      setDupSubmitting(false);
    }
  };

  const handleConfirmDuplicateWeek = async () => {
    if (!routineId || selectedWeek >= 104) return;
    setDuplicatingWeek(true);
    try {
      const updatedPlanning = await rotinaService.duplicarSemana(routineId, selectedWeek);
      const targetWeek = selectedWeek + 1;
      setPlanning(updatedPlanning);
      const backendWeeks = (updatedPlanning.semanas || []).map((w) => w.numeroSemana);
      setExtraWeeks((prev) =>
        Array.from(new Set([...prev, ...backendWeeks, targetWeek])).sort((a, b) => a - b)
      );
      setSelectedWeek(targetWeek);
      setConfirmingWeekDup(false);
      toast.success(`Semana ${selectedWeek} duplicada para a Semana ${targetWeek}!`);
    } catch (err) {
      toast.error(authError(err, "Não foi possível duplicar a semana.").message);
    } finally {
      setDuplicatingWeek(false);
    }
  };

  if (loading) {
    return (
      <div className="session-planner-loading" role="status">
        Carregando planejamento da rotina...
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className="session-planner-error" role="alert">
        <h2>Não foi possível carregar a rotina</h2>
        <p>{error || "Rotina não encontrada."}</p>
        <div className="session-planner-error__actions">
          <Button variant="secondary" onClick={() => navigate("/rotinas")}>
            Voltar às rotinas
          </Button>
          <Button onClick={() => void loadData()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const active = isRoutineActive(routine);
  const targetFreq = routine.frequenciaSemanal || 1;
  const plannedInWeek = currentWeekSessions.length;
  const progressPct = Math.min(100, Math.round((plannedInWeek / targetFreq) * 100));
  const firstStudent = routine.alunos?.[0];
  const modalityIdNum = routine.modalidadeId ?? routine.modalidade?.id;
  const sportName = routine.nomeModalidade || routine.modalidade?.nome;
  const hasDraft =
    Boolean(sessionName.trim()) ||
    Boolean(orientations.trim()) ||
    activities.length > 0 ||
    selectedMetricIds.size > 0 ||
    Boolean(newActTitle.trim()) ||
    Boolean(newActDesc.trim());

  return (
    <div className="session-planner-page">
      {/* Breadcrumb */}
      <nav className="session-planner__breadcrumb" aria-label="Navegação">
        <Link to="/rotinas">Rotinas</Link>
        <span>/</span>
        <span>{routine.titulo}</span>
        <span>/</span>
        <span>Planejar sessões</span>
      </nav>

      {/* Header */}
      <div className="session-planner__header">
        <div className="session-planner__title-section">
          <h1>Planejar sessões · {routine.titulo}</h1>

          <div className="session-planner__meta-bar">
            <SportTag sport={sportName} />

            <Badge tone={active ? "success" : "neutral"}>
              {active ? "Rotina ativa" : "Rotina encerrada"}
            </Badge>

            <Badge tone="info">Meta: {targetFreq}× por semana</Badge>

            <span className="session-planner__meta-text">
              {totalSessionsCount}{" "}
              {totalSessionsCount === 1 ? "sessão cadastrada" : "sessões cadastradas"} no total ·{" "}
              {routine.alunos?.length || 0}{" "}
              {(routine.alunos?.length || 0) === 1 ? "aluno vinculado" : "alunos vinculados"}
            </span>
          </div>
        </div>

        <div className="session-planner__actions">
          <Button
            variant="secondary"
            onClick={() => navigate("/rotinas")}
            disabled={saving}
          >
            Voltar às rotinas
          </Button>
          {active && (
            <Button
              variant="primary"
              onClick={() => void handleCreateSession()}
              disabled={saving}
            >
              {saving ? "Salvando..." : `+ Salvar sessão na Semana ${selectedWeek}`}
            </Button>
          )}
        </div>
      </div>

      {/* Barra de Semanas & Meta de Frequência Semanal (US-09 C5 / RN-011) */}
      <section className="workspace-card session-planner__weeks-bar" aria-label="Semanas da rotina">
        <div className="session-planner__weeks-top">
          <div className="session-planner__week-tabs" role="tablist">
            {allWeekNumbers.map((weekNum) => {
              const count =
                (planning?.semanas || []).find((w) => w.numeroSemana === weekNum)?.sessoes.length ||
                0;
              const isSelected = weekNum === selectedWeek;
              const isGoalMet = count >= targetFreq;
              return (
                <button
                  key={weekNum}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`session-planner__week-tab ${isSelected ? "is-active" : ""} ${
                    isGoalMet && !isSelected ? "is-complete" : ""
                  }`}
                  onClick={() => setSelectedWeek(weekNum)}
                >
                  <span>Semana {weekNum}</span>
                  <span className="week-tab-count">
                    {count}/{targetFreq}
                  </span>
                </button>
              );
            })}

            {active && (
              <button
                type="button"
                className="session-planner__add-week-btn"
                onClick={handleAddWeekTab}
                title="Adicionar nova semana ao planejamento"
              >
                <Plus size={14} /> Nova semana
              </button>
            )}
          </div>

          <div className="session-planner__freq-summary">
            <div className="freq-summary-text">
              <strong>
                {plannedInWeek} de {targetFreq} sessões planejadas na Semana {selectedWeek}
              </strong>
              {plannedInWeek < targetFreq ? (
                <Badge tone="warning">
                  Faltam {targetFreq - plannedInWeek} para a meta semanal
                </Badge>
              ) : plannedInWeek === targetFreq ? (
                <Badge tone="success">Meta semanal atingida</Badge>
              ) : (
                <Badge tone="info">
                  Meta atingida (+{plannedInWeek - targetFreq}{" "}
                  {plannedInWeek - targetFreq === 1 ? "sessão extra" : "sessões extras"})
                </Badge>
              )}
            </div>
            <div className="freq-progress-track" aria-hidden="true">
              <div
                className={`freq-progress-fill ${
                  plannedInWeek >= targetFreq ? "is-complete" : ""
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid Principal: Coluna Esquerda (Compositor de Nova Sessão) | Coluna Direita (Cronograma da Semana & Métricas) */}
      <div className={`session-planner__grid ${active ? "is-composer-active" : ""}`}>
        {/* Coluna Esquerda: Formulário de Nova Sessão */}
        <div className="session-planner__left-col" ref={formTopRef}>
          {!active ? (
            <div className="workspace-card session-planner__card">
              <h2>Rotina encerrada</h2>
              <p className="session-planner__muted">
                Esta rotina já foi encerrada e não recebe novas sessões planejadas. Você pode
                consultar as sessões históricas ao lado ou reutilizar esta rotina como modelo.
              </p>
            </div>
          ) : (
            <>
              {/* Card 1: Dados da sessão */}
              <section
                className="workspace-card session-planner__card"
                aria-label="Dados da nova sessão"
              >
                <div className="session-planner__card-head">
                  <div>
                    <h2>Nova sessão · Semana {selectedWeek}</h2>
                    <p>Defina o foco do treino, a data prevista e a duração estimada</p>
                  </div>
                  <Badge tone="info">Sessão #{plannedInWeek + 1} da Semana {selectedWeek}</Badge>
                </div>

                <div className="session-planner__form-row session-planner__form-row--3col">
                  <FormField
                    id="planner-session-name"
                    label="Nome / foco da sessão"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Ex: Força Explosiva & Core, Série Aeróbica Z3..."
                  />

                  <FormField
                    id="planner-planned-date"
                    label="Data planejada *"
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                  />

                  <FormField
                    id="planner-duration"
                    label="Duração estimada *"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="45 min"
                  />
                </div>

                {/* Atalhos rápidos de duração */}
                <div className="session-planner__duration-Bar">
                  <span className="duration-bar-label">
                    <Clock size={13} /> Duração rápida:
                  </span>
                  <div className="duration-pills" role="group" aria-label="Durações sugeridas">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`duration-pill ${
                          duration.trim().toLowerCase() === preset ? "is-selected" : ""
                        }`}
                        onClick={() => setDuration(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Card 2: Atividades planejadas (Editor Multilinhas Rico) */}
              <section
                className="workspace-card session-planner__card"
                aria-label="Atividades planejadas"
              >
                <header className="session-planner__activities-header">
                  <div>
                    <h2>Atividades planejadas</h2>
                    <p>
                      Estruture os blocos do treino com liberdade para múltiplas linhas, tópicos e
                      séries
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAddingNewActivity(true);
                      setTimeout(() => newDescTextareaRef.current?.focus(), 20);
                    }}
                  >
                    <Plus size={15} /> Novo bloco em branco
                  </Button>
                </header>

                {/* Chips de blocos estruturados em 1 clique */}
                <div className="session-planner__preset-blocks">
                  <span className="preset-blocks-label">
                    <Sparkles size={13} /> Inserir bloco rápido:
                  </span>
                  <div className="preset-blocks-list">
                    {QUICK_BLOCK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="preset-block-chip"
                        onClick={() => handleSelectQuickPreset(preset)}
                      >
                        <Plus size={12} /> {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compositor de Novo Bloco de Atividade (Multilinhas) */}
                {addingNewActivity && (
                  <div className="session-planner__add-activity-box">
                    <div className="add-activity-box__top">
                      <h4>Novo bloco de atividade</h4>
                      <span className="add-activity-box__hint">
                        Dica: use múltiplas linhas (Enter) para listar exercícios do bloco
                      </span>
                    </div>

                    <div className="activity-inputs">
                      <label className="act-field-label" htmlFor="new-act-title">
                        Título do bloco *
                      </label>
                      <input
                        id="new-act-title"
                        type="text"
                        placeholder="Ex: Aquecimento, Série Principal, Circuito Metabólico..."
                        value={newActTitle}
                        onChange={(e) => setNewActTitle(e.target.value)}
                        className="act-input-title"
                      />

                      <div className="act-desc-header">
                        <label className="act-field-label" htmlFor="new-act-desc">
                          Descrição detalhada (multilinhas)
                        </label>
                        <div className="act-format-toolbar" aria-label="Atalhos de formatação">
                          {FORMAT_SNIPPETS.map((snip) => (
                            <button
                              key={snip.label}
                              type="button"
                              className="act-format-btn"
                              onClick={() => insertSnippetInNewDesc(snip.text)}
                              title={`Inserir ${snip.label}`}
                            >
                              {snip.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        id="new-act-desc"
                        ref={newDescTextareaRef}
                        rows={4}
                        placeholder={newActPlaceholder}
                        value={newActDesc}
                        onChange={(e) => setNewActDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            handleConfirmAddActivity();
                          }
                        }}
                        className="act-input-desc act-textarea-multiline"
                      />
                    </div>

                    <div className="activity-buttons">
                      <span className="shortcut-hint">Ctrl + Enter para confirmar</span>
                      <div className="activity-buttons__right">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setAddingNewActivity(false);
                            setNewActTitle("");
                            setNewActDesc("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button variant="primary" onClick={handleConfirmAddActivity}>
                          Confirmar bloco
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de blocos adicionados */}
                {activities.length === 0 && !addingNewActivity ? (
                  <div className="session-planner__empty-activities">
                    <p>
                      Nenhum bloco adicionado ainda. Escolha um{" "}
                      <strong>bloco rápido acima</strong> ou clique em{" "}
                      <strong>"+ Novo bloco em branco"</strong>.
                    </p>
                  </div>
                ) : (
                  activities.length > 0 && (
                    <div className="session-planner__activities-list">
                      {activities.map((act, index) => (
                        <div key={act.id} className="session-planner__activity-item">
                          <div className="activity-num">{index + 1}</div>

                          {editingActivityId === act.id ? (
                            <div className="activity-edit-inline">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="act-input-title"
                                placeholder="Título do bloco"
                              />
                              <div className="act-format-toolbar">
                                {FORMAT_SNIPPETS.map((snip) => (
                                  <button
                                    key={snip.label}
                                    type="button"
                                    className="act-format-btn"
                                    onClick={() => insertSnippetInEditDesc(snip.text)}
                                  >
                                    {snip.label}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                rows={4}
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="act-input-desc act-textarea-multiline"
                                placeholder="Descrição detalhada em múltiplas linhas..."
                              />
                              <div className="inline-act-actions">
                                <button
                                  type="button"
                                  className="inline-btn save"
                                  onClick={() => handleSaveEditActivity(act.id)}
                                  title="Salvar alterações do bloco"
                                >
                                  <Check size={15} /> Salvar bloco
                                </button>
                                <button
                                  type="button"
                                  className="inline-btn cancel"
                                  onClick={() => setEditingActivityId(null)}
                                  title="Cancelar edição"
                                >
                                  <X size={15} /> Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="activity-details">
                                <div className="activity-title-line">
                                  <strong>{act.title}</strong>
                                </div>
                                <div className="activity-desc activity-desc--multiline">
                                  {act.description}
                                </div>
                              </div>

                              <div className="activity-actions">
                                <button
                                  type="button"
                                  className="act-action-btn"
                                  disabled={index === 0}
                                  onClick={() => handleMoveActivity(index, -1)}
                                  title="Mover bloco para cima"
                                  aria-label="Mover bloco para cima"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="act-action-btn"
                                  disabled={index === activities.length - 1}
                                  onClick={() => handleMoveActivity(index, 1)}
                                  title="Mover bloco para baixo"
                                  aria-label="Mover bloco para baixo"
                                >
                                  <ArrowDown size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="act-action-btn"
                                  onClick={() => handleDuplicateActivity(act, index)}
                                  title="Duplicar bloco"
                                  aria-label="Duplicar bloco"
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="act-action-btn"
                                  onClick={() => handleStartEditActivity(act)}
                                  title="Editar bloco"
                                  aria-label="Editar bloco"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="act-action-btn delete"
                                  onClick={() => handleDeleteActivity(act.id)}
                                  title="Remover bloco"
                                  aria-label="Remover bloco"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </section>

              {/* Card 3: Métricas acompanhadas nesta sessão (0..N) */}
              <section
                className="workspace-card session-planner__card"
                aria-label="Métricas acompanhadas nesta sessão"
              >
                <fieldset className="session-planner__metrics-fieldset">
                  <legend className="session-planner__metrics-legend">
                    <span>
                      Métricas acompanhadas nesta sessão ({selectedMetricIds.size})
                    </span>
                    {modalityIdNum && (
                      <button
                        type="button"
                        className="session-planner__new-metric-btn"
                        onClick={() => setCreatingMetric(true)}
                      >
                        <Plus size={13} /> Nova métrica
                      </button>
                    )}
                  </legend>

                  <p className="session-planner__metrics-hint">
                    Opcional (0 a N) na modalidade {sportName || "da rotina"}. Sem seleção, o
                    aluno registrará apenas RPE e duração.
                  </p>

                  {metricsLoading ? (
                    <p className="session-planner__muted">Carregando métricas da modalidade...</p>
                  ) : metricsError ? (
                    <p className="session-planner__metrics-error" role="alert">
                      {metricsError}
                    </p>
                  ) : modalityMetrics.length === 0 ? (
                    <div className="session-planner__metrics-empty">
                      <span>
                        Nenhuma métrica ativa cadastrada para {sportName || "esta modalidade"}.
                      </span>
                      {modalityIdNum && (
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => setCreatingMetric(true)}
                        >
                          + Cadastrar primeira métrica
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="session-planner__metrics-toolbar">
                        <input
                          type="search"
                          className="session-planner__metrics-search"
                          placeholder="Filtrar métricas da modalidade..."
                          aria-label="Filtrar métricas da modalidade"
                          value={metricSearch}
                          onChange={(e) => setMetricSearch(e.target.value)}
                        />
                        <div className="session-planner__metrics-quick">
                          {requiredMetricIds.length > 0 && (
                            <button
                              type="button"
                              className="session-planner__quick-metric-btn"
                              onClick={() =>
                                setSelectedMetricIds(new Set(requiredMetricIds))
                              }
                            >
                              Obrigatórias ({requiredMetricIds.length})
                            </button>
                          )}
                          <button
                            type="button"
                            className="session-planner__quick-metric-btn"
                            onClick={() =>
                              setSelectedMetricIds(
                                new Set(modalityMetrics.map((m) => m.id))
                              )
                            }
                          >
                            Todas ({modalityMetrics.length})
                          </button>
                          {selectedMetricIds.size > 0 && (
                            <button
                              type="button"
                              className="session-planner__quick-metric-btn is-clear"
                              onClick={() => setSelectedMetricIds(new Set())}
                            >
                              Limpar ({selectedMetricIds.size})
                            </button>
                          )}
                        </div>
                      </div>

                      {visibleModalityMetrics.length === 0 ? (
                        <p className="session-planner__muted">
                          Nenhuma métrica encontrada para “{metricSearch}”.
                        </p>
                      ) : (
                        <div className="session-planner__metrics-picker">
                          {visibleModalityMetrics.map((metric) => {
                            const checked = selectedMetricIds.has(metric.id);
                            return (
                              <label
                                key={metric.id}
                                className={`session-planner__metric-option ${
                                  checked ? "is-selected" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleMetric(metric.id)}
                                />
                                <span className="metric-option__info">
                                  <strong>{metric.titulo}</strong>
                                  <small>
                                    {metricLabels[metric.tipo] || metric.tipo} ·{" "}
                                    {metric.obrigatoria !== false
                                      ? "Obrigatória"
                                      : "Opcional"}{" "}
                                    · {getPreenchimentoLabel(metric.quemPreenche)}
                                  </small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </fieldset>
              </section>

              {/* Card 4: Orientações ao aluno + Barra de Salvamento Unificada */}
              <section
                className="workspace-card session-planner__card"
                aria-label="Orientações e salvamento"
              >
                <div className="session-planner__card-head session-planner__card-head--compact">
                  <div>
                    <h2>Orientações ao aluno</h2>
                    <p>Recomendações gerais de ritmo, intervalos, respiração ou cautelas</p>
                  </div>
                  <span className="char-count">{orientations.length}/500</span>
                </div>

                <div className="session-planner__orientations-box">
                  <textarea
                    rows={3}
                    value={orientations}
                    onChange={(e) => setOrientations(e.target.value.slice(0, 500))}
                    placeholder="Ex: Mantenha hidratação entre os rounds e interrompa caso sinta desconforto articular..."
                  />

                  <div className="session-planner__submit-bar">
                    <div className="submit-bar__summary">
                      <strong>
                        Semana {selectedWeek} · Sessão #{plannedInWeek + 1}
                      </strong>
                      <span>
                        {activities.length}{" "}
                        {activities.length === 1 ? "bloco" : "blocos"} ·{" "}
                        {selectedMetricIds.size > 0
                          ? `${selectedMetricIds.size} ${
                              selectedMetricIds.size === 1 ? "métrica" : "métricas"
                            }`
                          : "apenas RPE e duração"}{" "}
                        · {duration || "45 min"} · {formatDateBrWithWeekday(plannedDate)}
                      </span>
                    </div>

                    <div className="submit-bar__buttons">
                      {hasDraft && (
                        <Button
                          variant="ghost"
                          onClick={handleClearDraft}
                          disabled={saving}
                        >
                          <RotateCcw size={14} /> Limpar
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onClick={() => void handleCreateSession()}
                        disabled={saving}
                      >
                        {saving
                          ? "Salvando..."
                          : `+ Salvar sessão na Semana ${selectedWeek}`}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Coluna Direita: Sessões da Semana Selecionada */}
        <div className="session-planner__right-col">
          {/* Card 1: Sessões já planejadas na Semana selecionada */}
          <section
            className="workspace-card session-planner__card session-planner__week-panel"
            aria-label={`Sessões da Semana ${selectedWeek}`}
          >
            <header className="session-planner__card-head session-planner__week-panel-head">
              <div>
                <h2>Sessões da Semana {selectedWeek}</h2>
                <p>
                  {currentWeekSessions.length === 0
                    ? "Nenhuma sessão cadastrada nesta semana ainda"
                    : `Cronograma planejado para a Semana ${selectedWeek}`}
                </p>
              </div>
              <div className="session-planner__card-head-right">
                {active && currentWeekSessions.length > 0 && (
                  <button
                    type="button"
                    className="session-planner__dup-week-btn"
                    disabled={selectedWeek >= 104 || duplicatingWeek}
                    title={
                      selectedWeek >= 104
                        ? "Limite máximo de 104 semanas atingido"
                        : `Duplicar Semana ${selectedWeek} para Semana ${selectedWeek + 1}`
                    }
                    onClick={() => setConfirmingWeekDup(true)}
                  >
                    <Copy size={13} />{" "}
                    {selectedWeek >= 104
                      ? "Limite (Sem. 104)"
                      : `Duplicar Sem. ${selectedWeek} → ${selectedWeek + 1}`}
                  </button>
                )}
                <Layers size={18} className="card-head-icon" />
              </div>
            </header>

            {/* Resumo rápido de carga da semana */}
            {currentWeekSessions.length > 0 && (
              <div className="week-workload-strip" aria-label="Resumo de carga da semana">
                <div className="workload-kpi">
                  <span>Sessões</span>
                  <strong>
                    {currentWeekSessions.length}/{targetFreq}
                  </strong>
                </div>
                <div className="workload-kpi">
                  <span>Volume total</span>
                  <strong>{weekStats.totalMinutes} min</strong>
                </div>
                <div className="workload-kpi">
                  <span>Executadas</span>
                  <strong>
                    {weekStats.completedOrValidated}/{currentWeekSessions.length}
                  </strong>
                </div>
              </div>
            )}

            {/* Filtros rápidos e busca quando há múltiplas sessões */}
            {currentWeekSessions.length >= 2 && (
              <div
                className="week-sessions-toolbar"
                aria-label="Filtrar e localizar sessões da semana"
              >
                <div
                  className="week-sessions-filters"
                  role="group"
                  aria-label="Filtrar sessões por status"
                >
                  <button
                    type="button"
                    className={`week-filter-chip ${weekSessionFilter === "all" ? "is-active" : ""}`}
                    aria-pressed={weekSessionFilter === "all"}
                    onClick={() => setWeekSessionFilter("all")}
                  >
                    Todas <span>{currentWeekSessions.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`week-filter-chip ${
                      weekSessionFilter === "pending" ? "is-active" : ""
                    }`}
                    aria-pressed={weekSessionFilter === "pending"}
                    onClick={() => setWeekSessionFilter("pending")}
                  >
                    Pendentes <span>{weekStats.pending}</span>
                  </button>
                  <button
                    type="button"
                    className={`week-filter-chip ${
                      weekSessionFilter === "completed" ? "is-active" : ""
                    }`}
                    aria-pressed={weekSessionFilter === "completed"}
                    onClick={() => setWeekSessionFilter("completed")}
                  >
                    Concluídas <span>{weekStats.completedOrValidated}</span>
                  </button>
                </div>

                {currentWeekSessions.length >= 4 && (
                  <div className="week-sessions-search">
                    <Search size={14} className="week-sessions-search__icon" aria-hidden="true" />
                    <input
                      type="search"
                      value={weekSessionSearch}
                      onChange={(e) => setWeekSessionSearch(e.target.value)}
                      placeholder="Buscar por título, exercício ou métrica..."
                      aria-label="Buscar sessões desta semana"
                    />
                    {weekSessionSearch && (
                      <button
                        type="button"
                        className="week-sessions-search__clear"
                        aria-label="Limpar busca de sessões"
                        onClick={() => setWeekSessionSearch("")}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentWeekSessions.length === 0 ? (
              <div className="session-planner__empty-week">
                <Calendar size={28} />
                <p>
                  Preencha o formulário ao lado e clique em{" "}
                  <strong>"+ Salvar sessão na Semana {selectedWeek}"</strong> para montar o
                  cronograma.
                </p>

                {/* Clonar rapidamente de semanas anteriores quando a semana está vazia */}
                {active && previousWeeksSessions.length > 0 && (
                  <div className="empty-week__clone-box">
                    <span className="empty-week__clone-title">
                      <Copy size={12} /> Ou use uma sessão anterior como base:
                    </span>
                    <div className="empty-week__clone-list">
                      {previousWeeksSessions.map((item) => (
                        <button
                          key={item.session.id}
                          type="button"
                          className="empty-week__clone-btn"
                          onClick={() =>
                            handleUseSessionAsTemplate(
                              item.session,
                              `Semana ${item.weekNum} · Sessão #${item.sessionIndex}`
                            )
                          }
                        >
                          <span className="clone-btn__tag">
                            Sem {item.weekNum} · #{item.sessionIndex}
                          </span>
                          <span className="clone-btn__name">{item.preview.headline}</span>
                          <span className="clone-btn__action">Usar →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="session-planner__week-sessions-scroll"
                role="region"
                aria-label={`Lista rolável de sessões da Semana ${selectedWeek}`}
                tabIndex={0}
              >
                {indexedWeekSessions.length === 0 ? (
                  <div className="week-sessions-no-match">
                    <p>Nenhuma sessão encontrada com os filtros atuais.</p>
                    <button
                      type="button"
                      className="week-session-btn-clone"
                      onClick={() => {
                        setWeekSessionFilter("all");
                        setWeekSessionSearch("");
                      }}
                    >
                      <RotateCcw size={12} /> Limpar filtros
                    </button>
                  </div>
                ) : (
                  <div className="session-planner__week-sessions-list">
                    {indexedWeekSessions.map(
                      ({ session: sess, weekIndex, preview, isDone, isValidated }) => {
                        const isExpanded = Boolean(expandedSessionIds[sess.id]);

                        const totalDescLines = preview.blocks.reduce(
                          (acc, b) => acc + (b.description ? b.description.split("\n").length : 1),
                          0
                        );
                        const hasLongContent =
                          preview.blocks.length > 2 ||
                          totalDescLines > 4 ||
                          preview.blocks.some((b) => b.description.length > 120) ||
                          Boolean(preview.orientations);

                        const visibleBlocks = isExpanded
                          ? preview.blocks
                          : preview.blocks.slice(0, 2);

                        return (
                          <article
                            key={sess.id}
                            className={`week-session-card ${
                              isValidated
                                ? "is-validated"
                                : isDone
                                ? "is-completed"
                                : "is-planned"
                            }`}
                          >
                            <div className="week-session-card__top">
                              <div className="week-session-card__title">
                                <span className="session-index">#{weekIndex}</span>
                                <strong>{preview.headline}</strong>
                              </div>
                              {isValidated ? (
                                <Badge tone="success">Validada</Badge>
                              ) : isDone ? (
                                <Badge tone="warning">Concluída</Badge>
                              ) : (
                                <Badge tone="neutral">Planejada</Badge>
                              )}
                            </div>

                            <div className="week-session-card__meta">
                              <span>
                                <Calendar size={13} /> {formatDateBrWithWeekday(sess.dataPlanejada)}
                              </span>
                              {sess.duracao && (
                                <span>
                                  <Clock size={13} /> {sess.duracao} min
                                </span>
                              )}
                              {preview.blocks.length > 0 && (
                                <span className="meta-blocks-count">
                                  {preview.blocks.length}{" "}
                                  {preview.blocks.length === 1 ? "bloco" : "blocos"}
                                </span>
                              )}
                            </div>

                            {/* Métricas vinculadas à sessão */}
                            <div className="week-session-card__metrics">
                              {sess.metricas && sess.metricas.length > 0 ? (
                                <>
                                  {sess.metricas.slice(0, MAX_VISIBLE_METRICS).map((m) => (
                                    <span key={m.id} className="week-session-metric-pill">
                                      {m.titulo}
                                    </span>
                                  ))}
                                  {sess.metricas.length > MAX_VISIBLE_METRICS && (
                                    <span
                                      className="week-session-metric-more"
                                      title={sess.metricas
                                        .slice(MAX_VISIBLE_METRICS)
                                        .map((m) => m.titulo)
                                        .join(", ")}
                                    >
                                      +{sess.metricas.length - MAX_VISIBLE_METRICS}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="week-session-metric-empty">
                                  Apenas RPE e duração
                                </span>
                              )}
                            </div>

                            {/* Blocos estruturados sem repetir o headline */}
                            {visibleBlocks.length > 0 && (
                              <div className="week-session-card__blocks">
                                {visibleBlocks.map((block, bIdx) => {
                                  const showBlockTitle =
                                    block.title.trim().toLowerCase() !== "prescrição" &&
                                    block.title.trim() !== preview.headline.trim();
                                  return (
                                    <div key={block.id || bIdx} className="week-session-block">
                                      {showBlockTitle && (
                                        <span className="week-session-block__title">
                                          {bIdx + 1}. {block.title}
                                        </span>
                                      )}
                                      {block.description && (
                                        <p
                                          className={`week-session-block__desc ${
                                            !isExpanded ? "is-clamped" : ""
                                          }`}
                                        >
                                          {block.description}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}

                                {!isExpanded && preview.blocks.length > 2 && (
                                  <span className="more-blocks-indicator">
                                    +{preview.blocks.length - 2} bloco(s) adicional(is)
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Orientações (exibidas quando expandido ou se não houver blocos) */}
                            {preview.orientations &&
                              (isExpanded || preview.blocks.length === 0) && (
                                <div className="week-session-card__orientations">
                                  <strong>Orientações:</strong> {preview.orientations}
                                </div>
                              )}

                            {/* Rodapé de ações do card: Expandir | Usar como base | Editar / Validar */}
                            <div className="week-session-card__actions">
                              <div className="week-session-card__left-actions">
                                {hasLongContent && (
                                  <button
                                    type="button"
                                    className="week-session-btn-ghost"
                                    onClick={() =>
                                      setExpandedSessionIds((prev) => ({
                                        ...prev,
                                        [sess.id]: !prev[sess.id],
                                      }))
                                    }
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp size={13} /> Recolher
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown size={13} /> Detalhes
                                      </>
                                    )}
                                  </button>
                                )}

                                {active && (
                                  <>
                                    <button
                                      type="button"
                                      className="week-session-btn-clone"
                                      aria-label={`Usar sessão ${preview.headline} (${formatDateBrWithWeekday(sess.dataPlanejada)}) como base`}
                                      onClick={() =>
                                        handleUseSessionAsTemplate(sess, `Sessão #${weekIndex}`)
                                      }
                                      title="Copiar estrutura e métricas desta sessão para o formulário ao lado"
                                    >
                                      <Copy size={12} /> Usar como base
                                    </button>
                                    <button
                                      type="button"
                                      className="week-session-btn-clone"
                                      aria-label={`Duplicar sessão ${preview.headline} (${formatDateBrWithWeekday(sess.dataPlanejada)})`}
                                      onClick={() =>
                                        openDuplicateSessionModal(sess, preview.headline)
                                      }
                                      title="Duplicar sessão para outra semana ou data"
                                    >
                                      <Copy size={12} /> Duplicar
                                    </button>
                                  </>
                                )}
                              </div>

                              {firstStudent && (
                                <div className="week-session-card__right-actions">
                                  {!isDone && !isValidated ? (
                                    <Link
                                      to={`/alunos/${firstStudent.id}/sessoes/${sess.id}/editar`}
                                      className="week-session-link"
                                    >
                                      <Edit2 size={13} /> Editar
                                    </Link>
                                  ) : (
                                    <Link
                                      to={`/alunos/${firstStudent.id}/sessoes/${sess.id}`}
                                      className="week-session-link"
                                    >
                                      <ExternalLink size={13} /> Ver execução
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Card 2: Informativo de Regras (US-09 C5 / US-10 C1 / US-21 C2) */}
          <div className="session-planner__info-box" role="status">
            <Info size={20} className="info-icon" />
            <div>
              <strong>Planejamento semanal flexível</strong>
              <p>
                A frequência de {targetFreq}× por semana serve como guia visual de planejamento,
                mas você pode adicionar ou duplicar sessões e semanas livremente. Cada sessão define
                suas próprias métricas (0 a N); para alunos ativos, ficam visíveis a semana atual e
                a anterior no aplicativo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {modalityIdNum && (
        <MetricFormModal
          mode="create"
          isOpen={creatingMetric}
          onClose={() => setCreatingMetric(false)}
          modalidades={modalityOptions}
          defaultModalidadeId={modalityIdNum}
          existingMetrics={modalityMetrics}
          onSuccess={(created) => {
            setCreatingMetric(false);
            setModalityMetrics((prev) => [...prev, created]);
            setSelectedMetricIds((prev) => new Set(prev).add(created.id));
          }}
        />
      )}

      {confirmingWeekDup && (
        <WorkspaceDialog
          title={`Duplicar Semana ${selectedWeek} para Semana ${selectedWeek + 1}?`}
          description={`Todas as ${currentWeekSessions.length} sessões planejadas da Semana ${selectedWeek} serão copiadas com data +7 dias, mantendo blocos, duração e métricas vinculadas.`}
          icon="/design-system/imgIconDumbbell.svg"
          busy={duplicatingWeek}
          onClose={() => {
            if (!duplicatingWeek) setConfirmingWeekDup(false);
          }}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={duplicatingWeek}
                onClick={() => setConfirmingWeekDup(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={duplicatingWeek}
                disabled={duplicatingWeek}
                onClick={() => void handleConfirmDuplicateWeek()}
              >
                Confirmar duplicação
              </Button>
            </>
          }
        >
          <p className="session-planner__dup-modal-note">
            Se a Semana {selectedWeek + 1} ainda não existir nas abas, ela será adicionada
            automaticamente ao planejamento da rotina.
          </p>
        </WorkspaceDialog>
      )}

      {duplicatingSession && (
        <WorkspaceDialog
          title={`Duplicar “${duplicatingSession.headline}”`}
          description="Escolha a semana e a data de destino. As atividades, duração e métricas serão copiadas."
          icon="/design-system/imgIconDumbbell.svg"
          busy={dupSubmitting}
          onClose={() => {
            if (!dupSubmitting) setDuplicatingSession(null);
          }}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={dupSubmitting}
                onClick={() => setDuplicatingSession(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="duplicate-session-form"
                variant="primary"
                loading={dupSubmitting}
                disabled={dupSubmitting}
              >
                Duplicar sessão
              </Button>
            </>
          }
        >
          <form
            id="duplicate-session-form"
            className="session-planner__dup-form"
            onSubmit={(e) => void handleConfirmDuplicateSession(e)}
          >
            <div className="session-planner__dup-fields">
              <div className="session-planner__dup-field">
                <label htmlFor="dup-session-week">Semana de destino (1 a 104) *</label>
                <input
                  id="dup-session-week"
                  type="number"
                  min={1}
                  max={104}
                  required
                  disabled={dupSubmitting}
                  aria-invalid={Boolean(dupError)}
                  aria-describedby={dupError ? "dup-session-error" : undefined}
                  value={dupTargetWeek}
                  onChange={(e) => {
                    const nextWeek = Number(e.target.value) || 1;
                    setDupTargetWeek(nextWeek);
                    if (!dupDateTouched) {
                      setDupTargetDate(
                        addDaysIso(
                          duplicatingSession.session.dataPlanejada,
                          (nextWeek - duplicatingSession.originWeek) * 7
                        )
                      );
                    }
                  }}
                />
              </div>

              <div className="session-planner__dup-field">
                <label htmlFor="dup-session-date">Data planejada *</label>
                <input
                  id="dup-session-date"
                  type="date"
                  required
                  disabled={dupSubmitting}
                  aria-invalid={Boolean(dupError)}
                  aria-describedby={dupError ? "dup-session-error" : undefined}
                  value={dupTargetDate}
                  onChange={(e) => {
                    setDupDateTouched(true);
                    setDupTargetDate(e.target.value);
                  }}
                />
              </div>
            </div>

            {dupError && (
              <p id="dup-session-error" className="workspace-dialog__error" role="alert">
                {dupError}
              </p>
            )}
          </form>
        </WorkspaceDialog>
      )}
    </div>
  );
}
