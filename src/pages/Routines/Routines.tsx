import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { usePersonal } from "../../features/personal/PersonalContext";
import {
  buildRoutineTemplates,
  extractProblemDetail,
  getAvatarColor,
  getModalityBadgeStyle,
  getRoutineScopeLabel,
  getRoutineStructureTag,
  getStudentInitials,
  isRoutineActive,
  normalize,
  routineModalityCounts,
  type RoutineWorkspaceTab,
} from "../../features/routines/routineModel";
import { modalidadeService } from "../../services/modalidadeService";
import { rotinaService } from "../../services/rotinaService";
import RoutineAssignModal from "../../components/RoutineAssignModal/RoutineAssignModal";
import RoutineDeleteModal from "../../components/RoutineDeleteModal/RoutineDeleteModal";
import RoutineReuseModal from "../../components/RoutineReuseModal/RoutineReuseModal";
import RoutineStatusDialog from "../../components/RoutineStatusDialog/RoutineStatusDialog";
import type { Modalidade } from "../../types/modalidade";
import type { RotinaResponse } from "../../types/rotina";
import "./Routines.css";

type ActiveSubFilter = "all" | "assigned" | "unassigned";
type SortOption = "alpha" | "students_desc" | "freq_desc";

const MAX_VISIBLE_AVATARS = 4;
const MAX_VISIBLE_METRICS = 3;

const WORKSPACE_TABS: { id: RoutineWorkspaceTab; label: string }[] = [
  { id: "active", label: "Treinos em Andamento" },
  { id: "templates", label: "Biblioteca de Modelos" },
  { id: "ended", label: "Ciclos Encerrados" },
];

export default function Routines() {
  const navigate = useNavigate();
  const { routines, students, groups, syncRoutine, refresh } = usePersonal();
  const [params, setParams] = useSearchParams();
  const tabRefs = useRef<Record<RoutineWorkspaceTab, HTMLButtonElement | null>>({
    active: null,
    templates: null,
    ended: null,
  });

  // Modalidades disponíveis
  const [modalities, setModalities] = useState<Modalidade[]>([]);

  // Aba principal (Em Andamento vs Biblioteca de Modelos vs Encerrados)
  const [activeTab, setActiveTab] = useState<RoutineWorkspaceTab>(() => {
    const t = params.get("aba");
    if (t === "templates" || t === "ended") return t;
    return "active";
  });

  // Filtros e ordenação
  const [selectedModalityId, setSelectedModalityId] = useState<number | null>(() => {
    const p = params.get("modalidade");
    return p ? Number(p) : null;
  });
  const [search, setSearch] = useState(() => params.get("busca") || "");
  const [subFilter, setSubFilter] = useState<ActiveSubFilter>(() => {
    const f = params.get("filtro");
    if (f === "assigned" || f === "unassigned") return f;
    return "all";
  });
  const [sortBy, setSortBy] = useState<SortOption>("alpha");

  // Menu de ações por linha (ID da rotina ou chave de template com menu aberto)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modais
  const [assigningRoutine, setAssigningRoutine] = useState<RotinaResponse | null>(null);
  const [deletingRoutine, setDeletingRoutine] = useState<RotinaResponse | null>(null);
  const [reusingRoutine, setReusingRoutine] = useState<RotinaResponse | null>(null);
  const [endingRoutine, setEndingRoutine] = useState<RotinaResponse | null>(null);

  // Carrega catálogo de modalidades
  useEffect(() => {
    modalidadeService
      .listarTodas()
      .then((data) => {
        setModalities(data);
      })
      .catch(() => {
        // Fallback para modalidades encontradas nas rotinas
      });
  }, []);

  // Fecha menu contextual ao pressionar Escape
  useEffect(() => {
    if (!openMenuId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenuId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMenuId]);

  const routinesList = useMemo(() => {
    return Array.isArray(routines?.data) ? routines.data : [];
  }, [routines?.data]);

  // Modalidades consolidadas
  const allModalities = useMemo(() => {
    const map = new Map<number, { id: number; nome: string }>();
    for (const m of modalities) map.set(m.id, { id: m.id, nome: m.nome });
    for (const r of routinesList) {
      const id = r.modalidadeId ?? r.modalidade?.id;
      const nome = r.nomeModalidade || r.modalidade?.nome;
      if (id && nome && !map.has(id)) map.set(id, { id, nome });
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [modalities, routinesList]);

  // Modelos consolidados para a aba "Biblioteca de Modelos"
  const allTemplates = useMemo(() => {
    return buildRoutineTemplates(routinesList);
  }, [routinesList]);

  // Contadores das 3 abas principais (respeitando filtro de modalidade se selecionado)
  const tabCounts = useMemo(() => {
    const byModality =
      selectedModalityId === null
        ? routinesList
        : routinesList.filter(
            (r) => (r.modalidadeId ?? r.modalidade?.id) === selectedModalityId
          );

    let active = 0;
    let ended = 0;
    for (const r of byModality) {
      if (isRoutineActive(r)) active++;
      else ended++;
    }

    const templates = buildRoutineTemplates(byModality).length;
    return { active, templates, ended };
  }, [routinesList, selectedModalityId]);

  // Contadores para as pills de modalidades
  const modalityTabs = useMemo(() => {
    return routineModalityCounts(routinesList, allModalities, {
      activeModalityId: selectedModalityId,
    });
  }, [routinesList, allModalities, selectedModalityId]);

  // Contadores de sub-filtro dentro da aba "Treinos em Andamento"
  const activeSummary = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;
    for (const r of routinesList) {
      if (!isRoutineActive(r)) continue;
      if (
        selectedModalityId !== null &&
        (r.modalidadeId ?? r.modalidade?.id) !== selectedModalityId
      ) {
        continue;
      }
      if ((r.alunos?.length || 0) > 0) assigned++;
      else unassigned++;
    }
    return {
      all: assigned + unassigned,
      assigned,
      unassigned,
    };
  }, [routinesList, selectedModalityId]);

  // Atualiza query params
  function handleSelectWorkspaceTab(tab: RoutineWorkspaceTab) {
    setActiveTab(tab);
    setOpenMenuId(null);
    const next = new URLSearchParams(params);
    if (tab !== "active") next.set("aba", tab);
    else next.delete("aba");
    setParams(next, { replace: true });
  }

  // Navegação por teclado nas abas WAI-ARIA (ArrowLeft, ArrowRight, Home, End)
  function handleTabKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = WORKSPACE_TABS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const targetTab = WORKSPACE_TABS[nextIndex].id;
      handleSelectWorkspaceTab(targetTab);
      tabRefs.current[targetTab]?.focus();
    }
  }

  function handleSelectModality(id: number | null) {
    setSelectedModalityId(id);
    const next = new URLSearchParams(params);
    if (id !== null) next.set("modalidade", String(id));
    else next.delete("modalidade");
    setParams(next, { replace: true });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    const next = new URLSearchParams(params);
    if (value) next.set("busca", value);
    else next.delete("busca");
    setParams(next, { replace: true });
  }

  function handleSubFilterChange(nextFilter: ActiveSubFilter) {
    setSubFilter(nextFilter);
    const next = new URLSearchParams(params);
    if (nextFilter !== "all") next.set("filtro", nextFilter);
    else next.delete("filtro");
    setParams(next, { replace: true });
  }

  // Filtragem de rotinas para as abas "active" e "ended"
  const filteredRoutines = useMemo(() => {
    const query = normalize(search.trim());

    const filtered = routinesList.filter((r) => {
      const active = isRoutineActive(r);
      if (activeTab === "active" && !active) return false;
      if (activeTab === "ended" && active) return false;

      // Filtro de modalidade
      if (selectedModalityId !== null) {
        const rModId = r.modalidadeId ?? r.modalidade?.id;
        if (rModId !== selectedModalityId) return false;
      }

      // Sub-filtro de vínculo (apenas na aba "active")
      if (activeTab === "active") {
        const hasStudents = (r.alunos?.length || 0) > 0;
        if (subFilter === "assigned" && !hasStudents) return false;
        if (subFilter === "unassigned" && hasStudents) return false;
      }

      // Filtro de busca
      if (query) {
        const titleMatch = normalize(r.titulo).includes(query);
        const goalMatch = r.objetivos ? normalize(r.objetivos).includes(query) : false;
        const studentMatch = (r.alunos || []).some(
          (a) => a.nome && normalize(a.nome).includes(query)
        );
        const modalityMatch = normalize(
          r.nomeModalidade || r.modalidade?.nome || ""
        ).includes(query);
        const metricMatch = (r.metricas || []).some(
          (m) => m.titulo && normalize(m.titulo).includes(query)
        );
        if (!titleMatch && !goalMatch && !studentMatch && !modalityMatch && !metricMatch) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "students_desc") {
        const diff = (b.alunos?.length || 0) - (a.alunos?.length || 0);
        if (diff !== 0) return diff;
      } else if (sortBy === "freq_desc") {
        const diff = (b.frequenciaSemanal || 0) - (a.frequenciaSemanal || 0);
        if (diff !== 0) return diff;
      }
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });
  }, [routinesList, activeTab, selectedModalityId, subFilter, search, sortBy]);

  // Filtragem de modelos para a aba "templates"
  const filteredTemplates = useMemo(() => {
    const query = normalize(search.trim());

    const filtered = allTemplates.filter((tpl) => {
      const r = tpl.baseRoutine;

      if (selectedModalityId !== null) {
        const rModId = r.modalidadeId ?? r.modalidade?.id;
        if (rModId !== selectedModalityId) return false;
      }

      if (query) {
        const titleMatch = normalize(tpl.displayTitle).includes(query);
        const goalMatch = r.objetivos ? normalize(r.objetivos).includes(query) : false;
        const modalityMatch = normalize(
          r.nomeModalidade || r.modalidade?.nome || ""
        ).includes(query);
        const metricMatch = (r.metricas || []).some(
          (m) => m.titulo && normalize(m.titulo).includes(query)
        );
        const studentMatch = tpl.students.some(
          (a) => a.nome && normalize(a.nome).includes(query)
        );
        if (!titleMatch && !goalMatch && !modalityMatch && !metricMatch && !studentMatch) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "students_desc") {
        const diff = b.totalStudentsCount - a.totalStudentsCount;
        if (diff !== 0) return diff;
      } else if (sortBy === "freq_desc") {
        const diff =
          (b.baseRoutine.frequenciaSemanal || 0) -
          (a.baseRoutine.frequenciaSemanal || 0);
        if (diff !== 0) return diff;
      }
      return a.displayTitle.localeCompare(b.displayTitle, "pt-BR");
    });
  }, [allTemplates, selectedModalityId, search, sortBy]);

  // Confirmação de exclusão
  async function handleConfirmDelete() {
    if (!deletingRoutine) return;
    try {
      await rotinaService.excluir(deletingRoutine.id);
      toast.success(`Rotina “${deletingRoutine.titulo}” excluída com sucesso!`);
      setDeletingRoutine(null);
      await refresh();
    } catch (err: unknown) {
      const msg = extractProblemDetail(err, "Não foi possível excluir a rotina.");
      toast.error(msg);
    }
  }

  const hasActiveFilters =
    Boolean(search) ||
    selectedModalityId !== null ||
    (activeTab === "active" && subFilter !== "all");

  return (
    <div className="routines-page">
      {/* Navegação Principal em Abas: Em Andamento vs Biblioteca de Modelos vs Encerrados */}
      <div className="routines-page__header-bar">
        <div
          className="routines-page__workspace-tabs"
          role="tablist"
          aria-label="Visualização de rotinas e modelos"
        >
          {WORKSPACE_TABS.map((tab, index) => {
            const isSelected = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`routines-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="routines-workspace-tabpanel"
                tabIndex={isSelected ? 0 : -1}
                className={`routines-page__workspace-tab ${
                  isSelected ? "is-selected" : ""
                }`}
                onClick={() => handleSelectWorkspaceTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
              >
                <span>{tab.label}</span>
                <span className="routines-page__workspace-tab-badge">{count}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="routines-page__btn-create"
          onClick={() => navigate("/rotinas/nova")}
        >
          + Nova rotina
        </button>
      </div>

      {/* Barra de Ferramentas: Modalidades, Sub-filtros, Busca e Ordenação */}
      <div className="routines-page__toolbar">
        <div
          className="routines-page__tabs"
          role="group"
          aria-label="Filtrar por modalidade esportiva"
        >
          {modalityTabs.map((tab) => {
            const isActive = selectedModalityId === tab.id;
            return (
              <button
                key={tab.id ?? "all"}
                type="button"
                aria-pressed={isActive}
                className={`routines-page__tab-btn ${isActive ? "is-active" : ""}`}
                onClick={() => handleSelectModality(tab.id)}
              >
                <span>{tab.nome}</span>
                <span className="routines-page__tab-count">{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="routines-page__FilterRow">
          {/* Sub-filtros de vínculo (apenas na aba Treinos em Andamento) */}
          {activeTab === "active" ? (
            <div
              className="routines-page__quick-filters"
              role="group"
              aria-label="Filtrar treinos ativos por vínculo"
            >
              <button
                type="button"
                aria-pressed={subFilter === "all"}
                className={`routines-page__filter-chip ${
                  subFilter === "all" ? "is-active" : ""
                }`}
                onClick={() => handleSubFilterChange("all")}
              >
                Todos os ativos ({activeSummary.all})
              </button>
              <button
                type="button"
                aria-pressed={subFilter === "assigned"}
                className={`routines-page__filter-chip ${
                  subFilter === "assigned" ? "is-active" : ""
                }`}
                onClick={() => handleSubFilterChange("assigned")}
              >
                <span className="routines-page__status-dot routines-page__status-dot--active" />
                Com alunos ({activeSummary.assigned})
              </button>
              <button
                type="button"
                aria-pressed={subFilter === "unassigned"}
                className={`routines-page__filter-chip ${
                  subFilter === "unassigned" ? "is-active" : ""
                }`}
                onClick={() => handleSubFilterChange("unassigned")}
              >
                <span className="routines-page__status-dot routines-page__status-dot--free" />
                Sem vínculo ({activeSummary.unassigned})
              </button>
            </div>
          ) : activeTab === "templates" ? (
            <p className="routines-page__tab-hint">
              Catálogo consolidado sem duplicações — prescreva modelos prontos para novos alunos ou turmas.
            </p>
          ) : (
            <p className="routines-page__tab-hint">
              Histórico de ciclos finalizados — consulte sessões anteriores ou inicie um novo ciclo.
            </p>
          )}

          <div className="routines-page__controls-right">
            <div className="routines-page__search-wrap">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="routines-page__search-input"
                placeholder={
                  activeTab === "templates"
                    ? "Buscar modelo, objetivo ou métrica..."
                    : "Buscar rotina, aluno ou métrica..."
                }
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Buscar por título, aluno ou métrica"
              />
            </div>

            <select
              className="routines-page__sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Ordenar lista"
            >
              <option value="alpha">Ordem: A–Z</option>
              <option value="students_desc">Mais alunos</option>
              <option value="freq_desc">Maior frequência</option>
            </select>
          </div>
        </div>
      </div>

      {/* Painel da Aba Selecionada */}
      <div
        id="routines-workspace-tabpanel"
        role="tabpanel"
        aria-labelledby={`routines-tab-${activeTab}`}
        className="routines-page__card"
      >
        {routines.loading ? (
          <div className="routines-page__empty-box" role="status">
            <p>Carregando rotinas de treino...</p>
          </div>
        ) : activeTab === "templates" ? (
          /* ================= ABA 2: BIBLIOTECA DE MODELOS ================= */
          filteredTemplates.length === 0 ? (
            <div className="routines-page__empty-box">
              <h3>Nenhum modelo encontrado</h3>
              <p>
                {hasActiveFilters
                  ? "Nenhum modelo corresponde aos filtros aplicados."
                  : "Crie sua primeira rotina para formar sua biblioteca de modelos reutilizáveis."}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="routines-page__btn-clear"
                  onClick={() => {
                    handleSelectModality(null);
                    handleSearchChange("");
                  }}
                >
                  Limpar filtros
                </button>
              ) : (
                <button
                  type="button"
                  className="routines-page__btn-create"
                  onClick={() => navigate("/rotinas/nova")}
                >
                  + Criar primeiro modelo
                </button>
              )}
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Tabela de modelos de treino da consultoria"
              className="routines-page__table-wrapper"
            >
              <table className="routines-page__table routines-page__table--templates">
                <thead>
                  <tr>
                    <th scope="col">MODELO DA CONSULTORIA</th>
                    <th scope="col">MODALIDADE</th>
                    <th scope="col">ESTRUTURA PADRÃO</th>
                    <th scope="col">MÉTRICAS PADRÃO</th>
                    <th scope="col">ADOÇÃO &amp; CICLOS</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((tpl) => {
                    const base = tpl.baseRoutine;
                    const modName =
                      base.nomeModalidade || base.modalidade?.nome || "Geral";
                    const badgeStyle = getModalityBadgeStyle(modName);
                    const structureTag = getRoutineStructureTag(
                      base.frequenciaSemanal,
                      modName
                    );

                    const metricsList = base.metricas || [];
                    const metricsCount = metricsList.length;
                    const visibleMetrics = metricsList.slice(0, MAX_VISIBLE_METRICS);
                    const extraMetricsCount = Math.max(
                      0,
                      metricsCount - MAX_VISIBLE_METRICS
                    );

                    const visibleStudents = tpl.students.slice(0, MAX_VISIBLE_AVATARS);
                    const extraStudentsCount = Math.max(
                      0,
                      tpl.students.length - MAX_VISIBLE_AVATARS
                    );

                    const menuKey = `tpl-${tpl.key}`;
                    const isMenuOpen = openMenuId === menuKey;

                    return (
                      <tr key={tpl.key}>
                        {/* 1. MODELO DA CONSULTORIA */}
                        <td
                          className="routines-page__col-routine routines-page__col-routine--clickable"
                          onClick={() => navigate(`/rotinas/${base.id}/planejamento`)}
                          title="Clique para visualizar a estrutura e sessões deste modelo"
                        >
                          <div className="routines-page__routine-header">
                            <h3>{tpl.displayTitle}</h3>
                            <div className="routines-page__status-badges">
                              <span className="routines-page__status-pill routines-page__status-pill--template">
                                Modelo Base
                              </span>
                              {tpl.cyclesCount > 1 && (
                                <span className="routines-page__scope-pill">
                                  {tpl.cyclesCount} ciclos criados
                                </span>
                              )}
                            </div>
                          </div>
                          {base.objetivos && (
                            <p title={base.objetivos}>{base.objetivos}</p>
                          )}
                        </td>

                        {/* 2. MODALIDADE */}
                        <td>
                          <span
                            className="routines-page__modality-badge"
                            style={{
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                            }}
                          >
                            <img src={badgeStyle.icon} alt="" aria-hidden="true" />
                            {modName}
                          </span>
                        </td>

                        {/* 3. ESTRUTURA PADRÃO */}
                        <td>
                          <div className="routines-page__structure-cell">
                            <span className="routines-page__freq-badge">
                              {base.frequenciaSemanal}x / semana
                            </span>
                            <span className="routines-page__division-tag">
                              {structureTag}
                            </span>
                          </div>
                        </td>

                        {/* 4. MÉTRICAS PADRÃO */}
                        <td>
                          <div
                            className="routines-page__metrics-cell"
                            title={
                              metricsCount > 0
                                ? `Métricas nas sessões: ${metricsList
                                    .map((m) => m.titulo)
                                    .join(", ")}`
                                : "Apenas RPE e duração"
                            }
                          >
                            <div className="routines-page__metrics-summary">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                              </svg>
                              <span>
                                {metricsCount > 0
                                  ? `${metricsCount} ${metricsCount === 1 ? "métrica" : "métricas"}`
                                  : "Apenas RPE e duração"}
                              </span>
                            </div>
                            {visibleMetrics.length > 0 && (
                              <div className="routines-page__metrics-pills">
                                {visibleMetrics.map((m) => (
                                  <span
                                    key={m.id}
                                    className="routines-page__metric-mini-tag"
                                  >
                                    {m.titulo}
                                  </span>
                                ))}
                                {extraMetricsCount > 0 && (
                                  <span
                                    className="routines-page__metric-mini-tag routines-page__metric-mini-tag--more"
                                    title={metricsList
                                      .slice(MAX_VISIBLE_METRICS)
                                      .map((m) => m.titulo)
                                      .join(", ")}
                                  >
                                    +{extraMetricsCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. ADOÇÃO & CICLOS */}
                        <td>
                          <div className="routines-page__adoption-cell">
                            <span className="routines-page__adoption-count">
                              {tpl.activeCyclesCount}{" "}
                              {tpl.activeCyclesCount === 1
                                ? "ciclo ativo"
                                : "ciclos ativos"}
                            </span>
                            {visibleStudents.length > 0 ? (
                              <div
                                className="routines-page__students-stack"
                                title={`Alunos que já utilizaram este modelo: ${tpl.students
                                  .map((s) => s.nome || "Aluno")
                                  .join(", ")}`}
                              >
                                {visibleStudents.map((aluno, index) => {
                                  const color = getAvatarColor(index);
                                  return (
                                    <div
                                      key={aluno.id}
                                      className="routines-page__student-avatar"
                                      style={{
                                        backgroundColor: color.bg,
                                        color: color.text,
                                      }}
                                      title={aluno.nome || "Aluno"}
                                    >
                                      {getStudentInitials(aluno.nome || "Aluno")}
                                    </div>
                                  );
                                })}
                                {extraStudentsCount > 0 && (
                                  <div className="routines-page__student-avatar routines-page__student-avatar--more">
                                    +{extraStudentsCount}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="routines-page__division-tag">
                                Sem alunos ainda
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. AÇÕES DO MODELO */}
                        <td>
                          <div className="routines-page__actions-cell">
                            <button
                              type="button"
                              className="routines-page__btn-plan"
                              title="Prescrever este modelo para um aluno em novo ciclo"
                              aria-label={`Usar modelo ${tpl.displayTitle}`}
                              onClick={() => setReusingRoutine(base)}
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              <span>Usar modelo</span>
                            </button>

                            <div className="routines-page__menu-wrap">
                              <button
                                type="button"
                                className={`routines-page__action-icon-btn routines-page__menu-trigger ${
                                  isMenuOpen ? "is-open" : ""
                                }`}
                                title="Mais opções do modelo"
                                aria-label={`Mais ações do modelo ${tpl.displayTitle}`}
                                aria-expanded={isMenuOpen}
                                aria-haspopup="menu"
                                onClick={() =>
                                  setOpenMenuId(isMenuOpen ? null : menuKey)
                                }
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>

                              {isMenuOpen && (
                                <>
                                  <div
                                    className="routines-page__menu-backdrop"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <div
                                    className="routines-page__dropdown"
                                    role="menu"
                                    aria-label={`Opções do modelo ${tpl.displayTitle}`}
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/rotinas/nova?modelo=${base.id}`);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                      Criar variação / Para turma
                                    </button>

                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/rotinas/${base.id}/planejamento`);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                      Ver sessões do modelo
                                    </button>

                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/rotinas/${base.id}/editar`);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                      Editar configurações base
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ================= ABAS 1 & 3: EM ANDAMENTO / ENCERRADAS ================= */
          filteredRoutines.length === 0 ? (
            <div className="routines-page__empty-box">
              <h3>
                {activeTab === "ended"
                  ? "Nenhum ciclo encerrado"
                  : "Nenhuma rotina em andamento encontrada"}
              </h3>
              <p>
                {hasActiveFilters
                  ? "Nenhum resultado corresponde aos filtros aplicados."
                  : activeTab === "ended"
                  ? "Quando você encerrar o ciclo de uma rotina para preservar o histórico do aluno, ela aparecerá aqui."
                  : "Você ainda não possui rotinas ativas cadastradas."}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="routines-page__btn-clear"
                  onClick={() => {
                    handleSelectModality(null);
                    handleSearchChange("");
                    handleSubFilterChange("all");
                  }}
                >
                  Limpar filtros
                </button>
              ) : (
                activeTab === "active" && (
                  <button
                    type="button"
                    className="routines-page__btn-create"
                    onClick={() => navigate("/rotinas/nova")}
                  >
                    + Criar primeira rotina
                  </button>
                )
              )}
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label={
                activeTab === "ended"
                  ? "Tabela de ciclos de treino encerrados"
                  : "Tabela de rotinas de treino em andamento"
              }
              className="routines-page__table-wrapper"
            >
              <table className="routines-page__table">
                <thead>
                  <tr>
                    <th scope="col">ROTINA &amp; ESCOPO</th>
                    <th scope="col">MODALIDADE</th>
                    <th scope="col">DIVISÃO &amp; FREQUÊNCIA</th>
                    <th scope="col">MÉTRICAS</th>
                    <th scope="col">ALUNOS</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutines.map((routine) => {
                    const active = isRoutineActive(routine);
                    const modName =
                      routine.nomeModalidade || routine.modalidade?.nome || "Geral";
                    const badgeStyle = getModalityBadgeStyle(modName);
                    const structureTag = getRoutineStructureTag(
                      routine.frequenciaSemanal,
                      modName
                    );
                    const scopeLabel = getRoutineScopeLabel(routine);
                    const studentsList = routine.alunos || [];
                    const visibleStudents = studentsList.slice(0, MAX_VISIBLE_AVATARS);
                    const extraStudentsCount = Math.max(
                      0,
                      studentsList.length - MAX_VISIBLE_AVATARS
                    );

                    const metricsList = routine.metricas || [];
                    const metricsCount = metricsList.length;
                    const visibleMetrics = metricsList.slice(0, MAX_VISIBLE_METRICS);
                    const extraMetricsCount = Math.max(
                      0,
                      metricsCount - MAX_VISIBLE_METRICS
                    );

                    const isMenuOpen = openMenuId === routine.id;

                    return (
                      <tr
                        key={routine.id}
                        className={!active ? "routines-page__row--ended" : ""}
                      >
                        {/* 1. ROTINA & ESCOPO */}
                        <td
                          className="routines-page__col-routine routines-page__col-routine--clickable"
                          onClick={() => navigate(`/rotinas/${routine.id}/planejamento`)}
                          title="Clique para abrir o planejamento de sessões desta rotina"
                        >
                          <div className="routines-page__routine-header">
                            <h3>{routine.titulo}</h3>
                            <div className="routines-page__status-badges">
                              {!active ? (
                                <span className="routines-page__status-pill routines-page__status-pill--ended">
                                  Encerrada
                                </span>
                              ) : studentsList.length > 0 ? (
                                <span className="routines-page__status-pill routines-page__status-pill--active">
                                  <span className="routines-page__status-dot routines-page__status-dot--active" />
                                  Em execução
                                </span>
                              ) : (
                                <span className="routines-page__status-pill routines-page__status-pill--free">
                                  Livre
                                </span>
                              )}

                              {studentsList.length > 0 && (
                                <span className="routines-page__scope-pill">
                                  {scopeLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          {routine.objetivos && (
                            <p title={routine.objetivos}>{routine.objetivos}</p>
                          )}
                        </td>

                        {/* 2. MODALIDADE */}
                        <td>
                          <span
                            className="routines-page__modality-badge"
                            style={{
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                            }}
                          >
                            <img src={badgeStyle.icon} alt="" aria-hidden="true" />
                            {modName}
                          </span>
                        </td>

                        {/* 3. DIVISÃO & FREQUÊNCIA */}
                        <td>
                          <div className="routines-page__structure-cell">
                            <span className="routines-page__freq-badge">
                              {routine.frequenciaSemanal}x / semana
                            </span>
                            <span className="routines-page__division-tag">
                              {structureTag}
                            </span>
                          </div>
                        </td>

                        {/* 4. MÉTRICAS */}
                        <td>
                          <div
                            className="routines-page__metrics-cell"
                            title={
                              metricsCount > 0
                                ? `Métricas nas sessões: ${metricsList
                                    .map((m) => m.titulo)
                                    .join(", ")}`
                                : "Apenas RPE e duração"
                            }
                          >
                            <div className="routines-page__metrics-summary">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                              </svg>
                              <span>
                                {metricsCount > 0
                                  ? `${metricsCount} ${metricsCount === 1 ? "métrica" : "métricas"}`
                                  : "Apenas RPE e duração"}
                              </span>
                            </div>
                            {visibleMetrics.length > 0 && (
                              <div className="routines-page__metrics-pills">
                                {visibleMetrics.map((m) => (
                                  <span
                                    key={m.id}
                                    className="routines-page__metric-mini-tag"
                                  >
                                    {m.titulo}
                                  </span>
                                ))}
                                {extraMetricsCount > 0 && (
                                  <span
                                    className="routines-page__metric-mini-tag routines-page__metric-mini-tag--more"
                                    title={metricsList
                                      .slice(MAX_VISIBLE_METRICS)
                                      .map((m) => m.titulo)
                                      .join(", ")}
                                  >
                                    +{extraMetricsCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. ALUNOS */}
                        <td>
                          {studentsList.length === 0 ? (
                            active ? (
                              <button
                                type="button"
                                className="routines-page__empty-assign-btn"
                                onClick={() => setAssigningRoutine(routine)}
                                title="Vincular alunos ou turma a esta rotina"
                              >
                                + Vincular
                              </button>
                            ) : (
                              <span className="routines-page__student-avatar--empty">
                                Sem alunos
                              </span>
                            )
                          ) : (
                            <div
                              className="routines-page__students-cell"
                              title={studentsList.map((s) => s.nome || "Aluno").join(", ")}
                            >
                              <div className="routines-page__students-stack">
                                {visibleStudents.map((aluno, index) => {
                                  const color = getAvatarColor(index);
                                  return (
                                    <div
                                      key={aluno.id}
                                      className="routines-page__student-avatar"
                                      style={{
                                        backgroundColor: color.bg,
                                        color: color.text,
                                      }}
                                      title={aluno.nome || "Aluno"}
                                    >
                                      {getStudentInitials(aluno.nome || "Aluno")}
                                    </div>
                                  );
                                })}
                                {extraStudentsCount > 0 && (
                                  <div
                                    className="routines-page__student-avatar routines-page__student-avatar--more"
                                    title={`Mais ${extraStudentsCount} ${
                                      extraStudentsCount === 1 ? "aluno" : "alunos"
                                    }: ${studentsList
                                      .slice(MAX_VISIBLE_AVATARS)
                                      .map((s) => s.nome || "Aluno")
                                      .join(", ")}`}
                                  >
                                    +{extraStudentsCount}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 6. AÇÕES */}
                        <td>
                          <div className="routines-page__actions-cell">
                            {active ? (
                              <button
                                type="button"
                                className="routines-page__btn-plan"
                                title="Planejar semanas e sessões de treino"
                                aria-label={`Planejar ${routine.titulo}`}
                                onClick={() =>
                                  navigate(`/rotinas/${routine.id}/planejamento`)
                                }
                              >
                                <svg
                                  width="15"
                                  height="15"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span>Planejar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="routines-page__btn-plan"
                                title="Iniciar novo ciclo a partir desta rotina"
                                aria-label={`Reutilizar ${routine.titulo}`}
                                onClick={() => setReusingRoutine(routine)}
                              >
                                <svg
                                  width="15"
                                  height="15"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="23 4 23 10 17 10" />
                                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                                <span>Reutilizar</span>
                              </button>
                            )}

                            {active && (
                              <button
                                type="button"
                                className="routines-page__action-icon-btn"
                                title="Vincular turma ou alunos à rotina"
                                aria-label={`Vincular turma ou alunos à rotina ${routine.titulo}`}
                                onClick={() => setAssigningRoutine(routine)}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="8.5" cy="7" r="4" />
                                  <line x1="20" y1="8" x2="20" y2="14" />
                                  <line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                              </button>
                            )}

                            {/* Menu Contextual (⋮) */}
                            <div className="routines-page__menu-wrap">
                              <button
                                type="button"
                                className={`routines-page__action-icon-btn routines-page__menu-trigger ${
                                  isMenuOpen ? "is-open" : ""
                                }`}
                                title="Mais opções da rotina"
                                aria-label={`Mais ações da rotina ${routine.titulo}`}
                                aria-expanded={isMenuOpen}
                                aria-haspopup="menu"
                                onClick={() =>
                                  setOpenMenuId(isMenuOpen ? null : routine.id)
                                }
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>

                              {isMenuOpen && (
                                <>
                                  <div
                                    className="routines-page__menu-backdrop"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <div
                                    className="routines-page__dropdown"
                                    role="menu"
                                    aria-label={`Opções para ${routine.titulo}`}
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/rotinas/${routine.id}/planejamento`);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                      Planejar / Ver sessões
                                    </button>

                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/rotinas/${routine.id}/editar`);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                      Editar configurações
                                    </button>

                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setReusingRoutine(routine);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                      Reutilizar como modelo
                                    </button>

                                    {active && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="routines-page__dropdown-item"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          setAssigningRoutine(routine);
                                        }}
                                      >
                                        <svg
                                          width="15"
                                          height="15"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                          <circle cx="8.5" cy="7" r="4" />
                                          <line x1="20" y1="8" x2="20" y2="14" />
                                          <line x1="23" y1="11" x2="17" y2="11" />
                                        </svg>
                                        Vincular alunos / turma
                                      </button>
                                    )}

                                    {active && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="routines-page__dropdown-item"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          setEndingRoutine(routine);
                                        }}
                                      >
                                        <svg
                                          width="15"
                                          height="15"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                          <line x1="12" y1="2" x2="12" y2="12" />
                                        </svg>
                                        Encerrar ciclo da rotina
                                      </button>
                                    )}

                                    <div
                                      className="routines-page__dropdown-divider"
                                      role="separator"
                                    />

                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="routines-page__dropdown-item routines-page__dropdown-item--danger"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setDeletingRoutine(routine);
                                      }}
                                    >
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                      Excluir rotina
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Modal de Vincular Turma / Alunos */}
      {assigningRoutine && (
        <RoutineAssignModal
          routine={assigningRoutine}
          students={students.data}
          routines={routines.data}
          groups={groups.data}
          onClose={() => setAssigningRoutine(null)}
          onAssigned={(updated) => {
            syncRoutine(updated);
            setAssigningRoutine(null);
            toast.success(`Vínculo atualizado na rotina “${updated.titulo}”!`, {
              id: "routine-assigned",
            });
            void refresh();
          }}
        />
      )}

      {/* Modal de Encerramento de Ciclo */}
      {endingRoutine && (
        <RoutineStatusDialog
          routine={endingRoutine}
          action="encerrar"
          onClose={() => setEndingRoutine(null)}
          onSuccess={(message, updated) => {
            if (updated) syncRoutine(updated);
            setEndingRoutine(null);
            toast.success(message);
            void refresh();
          }}
        />
      )}

      {/* Modal de Exclusão */}
      {deletingRoutine && (
        <RoutineDeleteModal
          routine={deletingRoutine}
          onClose={() => setDeletingRoutine(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Modal de Reutilizar como Modelo */}
      {reusingRoutine && (
        <RoutineReuseModal
          routine={reusingRoutine}
          students={students.data}
          routines={routines.data}
          onClose={() => setReusingRoutine(null)}
          onReused={(created) => {
            setReusingRoutine(null);
            toast.success(`Nova rotina “${created.titulo}” criada a partir do modelo!`);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
