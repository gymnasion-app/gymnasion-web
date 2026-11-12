import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { alunoService } from "../../services/alunoService";
import { localDateKey } from "../personal/dashboardModel";
import { StudentContext, type StudentActiveRoutineInfo, type StudentIdentityInfo } from "./StudentContext";
import {
  applySessionExecution,
  buildUnifiedCalendarWeeks,
  buildWeekDaysSummary,
  countCompletedSessions,
  formatDataPlanejadaDdMm,
  mapPlanningToWeeks,
} from "./studentAreaModel";
import { sortNotificationsByPriority } from "../notifications/notificationModel";
import type {
  StudentFeedbackItem,
  StudentHistoricalRoutine,
  StudentRoutineWeek,
  StudentWorkoutSession,
} from "../../types/studentArea";
import type { PersonalNotification } from "../../types/personalDashboard";

interface RoutineEntry {
  info: StudentActiveRoutineInfo;
  weeks: StudentRoutineWeek[];
  currentWeekNum: number;
}

function resolveWeeksForFilter(
  entries: RoutineEntry[],
  filter: number | "ALL"
): StudentRoutineWeek[] {
  const matching =
    filter === "ALL"
      ? entries
      : entries.filter((e) => e.info.modalidadeId === filter);
  if (matching.length === 0) return [];
  if (matching.length === 1) return matching[0].weeks;
  return buildUnifiedCalendarWeeks(
    matching.map((e) => ({ routine: e.info, weeks: e.weeks })),
    localDateKey(new Date())
  );
}

export default function StudentProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [routineEntries, setRoutineEntries] = useState<RoutineEntry[]>([]);
  const [selectedModalityFilterState, setSelectedModalityFilterState] = useState<number | "ALL">("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [historicalRoutines, setHistoricalRoutines] = useState<StudentHistoricalRoutine[]>([]);
  const filterInitialized = useRef(false);
  const userPickedFilter = useRef(false);
  const selectedFilterRef = useRef<number | "ALL">("ALL");
  const [feedbacks, setFeedbacks] = useState<StudentFeedbackItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notifications, setNotifications] = useState<{
    data: PersonalNotification[];
    loading: boolean;
    error: string;
  }>({ data: [], loading: false, error: "" });
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get("busca") || "");
  const [rpeModalSessionId, setRpeModalSessionId] = useState<string | null>(() =>
    searchParams.get("modal") === "rpe" ? "w3-s3" : null
  );
  const [rpeBusy, setRpeBusy] = useState<boolean>(false);
  const [inspectedSession, setInspectedSession] = useState<StudentWorkoutSession | null>(null);
  const [inspectedRoutine, setInspectedRoutine] = useState<StudentHistoricalRoutine | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState<boolean>(false);
  const [stravaModalOpen, setStravaModalOpen] = useState<boolean>(false);

  const [student, setStudent] = useState<StudentIdentityInfo>({
    name: "Aluno",
    firstName: "Aluno",
    initials: "AL",
    roleLabel: "Aluno(a)",
    personal: {
      name: "Personal Trainer",
      initials: "PT",
      cref: "CREF Gymnasion",
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carrega dados do perfil real do aluno
      try {
        const perfil = await alunoService.obterMeuPerfil();
        if (perfil) {
          const fullName = perfil.usuario?.nome || "Aluno";
          const parts = fullName.trim().split(/\s+/);
          const first = parts[0] || fullName;
          const inits = [parts[0]?.[0], parts.length > 1 ? parts[parts.length - 1]?.[0] : ""]
            .filter(Boolean)
            .join("")
            .toUpperCase() || "AL";

          const pName = perfil.nomePersonal || "Personal Trainer";
          const pParts = pName.trim().split(/\s+/);
          const pInits = [pParts[0]?.[0], pParts.length > 1 ? pParts[pParts.length - 1]?.[0] : ""]
            .filter(Boolean)
            .join("")
            .toUpperCase() || "PT";

          setStudent({
            name: fullName,
            firstName: first,
            initials: inits,
            roleLabel: "Aluno(a)",
            personal: {
              name: pName,
              initials: pInits,
              cref: "CREF Gymnasion",
            },
          });
        }
      } catch {
        // Fallback gracioso
      }

      // 2. Carrega notificações e feedbacks
      alunoService.contagemNaoLidas().then((c) => setUnreadNotifications(c)).catch(() => {});
      alunoService
        .listarNotificacoes()
        .then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            const sorted = sortNotificationsByPriority(items);
            setNotifications({ data: sorted, loading: false, error: "" });
            setUnreadNotifications(sorted.filter((i) => !i.lida).length);
          } else {
            alunoService
              .listarFeedbacks()
              .then((fbs) => {
                if (Array.isArray(fbs) && fbs.length > 0) {
                  const synched: PersonalNotification[] = sortNotificationsByPriority(
                    fbs.map((fb, idx) => ({
                      id: fb.id,
                      titulo: `Feedback de ${fb.autorNome || "Personal"}`,
                      mensagem: fb.conteudo,
                      tipo: "FEEDBACK",
                      lida: idx >= 2,
                      referenciaId: null,
                      dataCriacao: new Date().toISOString(),
                    }))
                  );
                  setNotifications({ data: synched, loading: false, error: "" });
                  setUnreadNotifications(synched.filter((i) => !i.lida).length);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          alunoService
            .listarFeedbacks()
            .then((fbs) => {
              if (Array.isArray(fbs) && fbs.length > 0) {
                const synched: PersonalNotification[] = sortNotificationsByPriority(
                  fbs.map((fb, idx) => ({
                    id: fb.id,
                    titulo: `Feedback de ${fb.autorNome || "Personal"}`,
                    mensagem: fb.conteudo,
                    tipo: "FEEDBACK",
                    lida: idx >= 2,
                    referenciaId: null,
                    dataCriacao: new Date().toISOString(),
                  }))
                );
                setNotifications({ data: synched, loading: false, error: "" });
                setUnreadNotifications(synched.filter((i) => !i.lida).length);
              }
            })
            .catch(() => {});
        });

      alunoService
        .listarFeedbacks()
        .then((items) => {
          if (Array.isArray(items)) {
            const mapped: StudentFeedbackItem[] = items.slice(0, 5).map((item, idx) => {
              const words = (item.autorNome || "Personal").trim().split(/\s+/);
              const inits = [words[0]?.[0], words.length > 1 ? words[words.length - 1]?.[0] : ""]
                .join("")
                .toUpperCase();
              return {
                id: item.id,
                autorNome: item.autorNome || "Personal",
                autorIniciais: inits || "PT",
                tempoRelativo: idx === 0 ? "recente" : "anterior",
                conteudo: item.conteudo,
                novo: idx < 2,
              };
            });
            setFeedbacks(mapped);
          }
        })
        .catch(() => {});

      // 3. Carrega rotinas reais do aluno (suporta múltiplas rotinas ativas para atleta híbrido)
      const rotinas = await alunoService.listarRotinas();
      if (Array.isArray(rotinas) && rotinas.length > 0) {
        const rotinasAtivasRaw = rotinas.filter(
          (r) => r.ativo !== false && r.status !== "ENCERRADA"
        );
        const rotinasEncerradas = rotinas.filter(
          (r) => r.ativo === false || r.status === "ENCERRADA"
        );

        setHistoricalRoutines(
          rotinasEncerradas.map((r) => ({
            id: r.id,
            titulo: r.titulo,
            periodo: `${r.frequenciaSemanal}x por semana`,
            semanas: 4,
            status: "ENCERRADA",
            modalidade: r.nomeModalidade || r.modalidade?.nome || "Treino",
            objetivo: r.objetivos || "Sem objetivos cadastrados.",
            sessoesConcluidas: 0,
          }))
        );

        if (rotinasAtivasRaw.length > 0) {
          const planResults = await Promise.allSettled(
            rotinasAtivasRaw.map((r) => alunoService.consultarPlanejamento(r.id))
          );

          const nextEntries: RoutineEntry[] = [];
          rotinasAtivasRaw.forEach((rotina, idx) => {
            const res = planResults[idx];
            if (res.status === "fulfilled") {
              nextEntries.push(mapPlanningToWeeks(rotina, res.value.semanas || []));
            } else {
              nextEntries.push(mapPlanningToWeeks(rotina, []));
            }
          });

          setRoutineEntries(nextEntries);

          let nextFilter: number | "ALL" = selectedFilterRef.current;
          const hasCurrentFilter =
            nextFilter === "ALL" ||
            nextEntries.some((e) => e.info.modalidadeId === nextFilter);

          if (!filterInitialized.current || !userPickedFilter.current || !hasCurrentFilter) {
            nextFilter =
              nextEntries.length === 1
                ? (nextEntries[0].info.modalidadeId ?? "ALL")
                : "ALL";
            selectedFilterRef.current = nextFilter;
            setSelectedModalityFilterState(nextFilter);
          }

          if (!filterInitialized.current) {
            const initialWeeks = resolveWeeksForFilter(nextEntries, nextFilter);
            const atual = initialWeeks.find((w) => w.estado === "atual") || initialWeeks[0];
            if (atual) {
              setSelectedWeekNum(atual.numero);
            }
            filterInitialized.current = true;
          }
        } else {
          setRoutineEntries([]);
          selectedFilterRef.current = "ALL";
          setSelectedModalityFilterState("ALL");
        }
      } else {
        // Aluno sem rotinas no backend ainda
        setRoutineEntries([]);
        setHistoricalRoutines([]);
        selectedFilterRef.current = "ALL";
        setSelectedModalityFilterState("ALL");
      }
    } catch {
      // Se der erro ao carregar do backend, inicializa vazio em vez de mock antigo
      setRoutineEntries([]);
      setHistoricalRoutines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const activeRoutines = useMemo(
    () => routineEntries.map((entry) => entry.info),
    [routineEntries]
  );

  const setSelectedModalityFilter = useCallback(
    (filter: number | "ALL") => {
      userPickedFilter.current = true;
      selectedFilterRef.current = filter;
      setSelectedModalityFilterState(filter);
      const nextWeeks = resolveWeeksForFilter(routineEntries, filter);
      const atual = nextWeeks.find((w) => w.estado === "atual") || nextWeeks[0];
      setSelectedWeekNum(atual?.numero ?? 1);
    },
    [routineEntries]
  );

  const filteredEntries = useMemo(
    () =>
      selectedModalityFilterState === "ALL"
        ? routineEntries
        : routineEntries.filter(
            (e) => e.info.modalidadeId === selectedModalityFilterState
          ),
    [routineEntries, selectedModalityFilterState]
  );

  const weeks = useMemo(
    () => resolveWeeksForFilter(routineEntries, selectedModalityFilterState),
    [routineEntries, selectedModalityFilterState]
  );

  const activeRoutine = useMemo(
    () => filteredEntries[0]?.info ?? activeRoutines[0] ?? null,
    [filteredEntries, activeRoutines]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const weekDays = useMemo(() => {
    const currentWeek = weeks.find((w) => w.estado === "atual") || weeks[0];
    return buildWeekDaysSummary(currentWeek);
  }, [weeks]);

  const openRpeModal = useCallback(
    (sessionId?: string) => {
      if (sessionId) {
        setRpeModalSessionId(sessionId);
        return;
      }
      const currentWeek = weeks.find((w) => w.estado === "atual");
      const nextSession =
        currentWeek?.sessoes.find((s) => s.destaque && s.status === "PLANEJADA") ||
        currentWeek?.sessoes.find((s) => s.status === "PLANEJADA") ||
        weeks.flatMap((w) => w.sessoes).find((s) => s.status === "PLANEJADA");
      setRpeModalSessionId(nextSession?.id || null);
    },
    [weeks]
  );

  const closeRpeModal = useCallback(() => {
    setRpeModalSessionId(null);
    if (searchParams.get("modal") === "rpe") {
      const next = new URLSearchParams(searchParams);
      next.delete("modal");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const confirmRpeExecution = useCallback(
    async (
      rpe: number | null,
      details?: {
        dataReal?: string;
        duracao?: number | null;
        resultados?: StudentWorkoutSession["resultados"];
        alreadySavedOnBackend?: boolean;
      }
    ) => {
      if (!rpeModalSessionId) return;
      setRpeBusy(true);
      try {
        const realIso = details?.dataReal || localDateKey(new Date());
        if (!details?.alreadySavedOnBackend) {
          await alunoService.registrarExecucao(rpeModalSessionId, {
            dataReal: realIso,
            duracao: details?.duracao ?? 50,
            nivelCansaco: rpe,
            resultados: (details?.resultados || []).map((r) => ({
              metricaId: r.metricaId,
              valor: r.valor,
            })),
          });
        }

        const formattedRealDate = formatDataPlanejadaDdMm(realIso);
        setRoutineEntries((prev) =>
          prev.map((entry) => ({
            ...entry,
            weeks: applySessionExecution(
              entry.weeks,
              rpeModalSessionId,
              rpe,
              formattedRealDate,
              details?.resultados,
              details?.duracao
            ),
          }))
        );
        toast.success(
          rpe !== null
            ? `Sessão finalizada com sucesso (RPE ${rpe}/10)!`
            : "Sessão finalizada com sucesso!"
        );
        closeRpeModal();
        void loadData();
      } finally {
        setRpeBusy(false);
      }
    },
    [rpeModalSessionId, closeRpeModal, loadData]
  );

  const sendObservationToPersonal = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        await alunoService.registrarObservacao(trimmed);
      } catch {
        // Confirma localmente
      }
      toast.success(`Mensagem enviada para ${student.personal.name}!`);
      setMessageModalOpen(false);
    },
    [student.personal.name]
  );

  const markFeedbacksRead = useCallback(() => {
    setUnreadNotifications(0);
    setFeedbacks((prev) => prev.map((f) => ({ ...f, novo: false })));
    setNotifications((prev) => ({
      ...prev,
      data: prev.data.map((item) => ({ ...item, lida: true })),
    }));
    alunoService.lerTodasNotificacoes().catch(() => {});
  }, []);

  const readNotification = useCallback(async (id?: string) => {
    try {
      if (id) {
        await alunoService.lerNotificacao(id);
        setNotifications((prev) => ({
          ...prev,
          data: sortNotificationsByPriority(
            prev.data.map((item) => (item.id === id ? { ...item, lida: true } : item))
          ),
        }));
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      } else {
        await alunoService.lerTodasNotificacoes();
        setNotifications((prev) => ({
          ...prev,
          data: sortNotificationsByPriority(prev.data.map((item) => ({ ...item, lida: true }))),
        }));
        setUnreadNotifications(0);
      }
    } catch {
      if (id) {
        setNotifications((prev) => ({
          ...prev,
          data: sortNotificationsByPriority(
            prev.data.map((item) => (item.id === id ? { ...item, lida: true } : item))
          ),
        }));
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      } else {
        setNotifications((prev) => ({
          ...prev,
          data: sortNotificationsByPriority(prev.data.map((item) => ({ ...item, lida: true }))),
        }));
        setUnreadNotifications(0);
      }
    }
  }, []);

  const completedCount = useMemo(() => countCompletedSessions(weeks, 0), [weeks]);
  const totalSessionsCount = useMemo(() => {
    const total = weeks.reduce((acc, w) => acc + w.sessoes.length, 0);
    return Math.max(1, total);
  }, [weeks]);
  const monthlySessionsCount = completedCount;

  const averageRpe = useMemo(() => {
    const validRpes = weeks
      .flatMap((w) => w.sessoes)
      .map((s) => s.rpe)
      .filter((v): v is number => typeof v === "number");
    if (validRpes.length === 0) return "—";
    const avg = validRpes.reduce((a, b) => a + b, 0) / validRpes.length;
    return avg.toFixed(1).replace(".", ",");
  }, [weeks]);

  return (
    <StudentContext.Provider
      value={{
        student,
        activeRoutine,
        activeRoutines,
        selectedModalityFilter: selectedModalityFilterState,
        setSelectedModalityFilter,
        loading,
        selectedWeekNum,
        setSelectedWeekNum,
        weeks,
        weekDays,
        historicalRoutines,
        feedbacks,
        completedCount,
        totalSessionsCount,
        monthlySessionsCount,
        averageRpe,
        unreadNotifications,
        searchQuery,
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
        markFeedbacksRead,
        notifications,
        readNotification,
        refreshData: loadData,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}
