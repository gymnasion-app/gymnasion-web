import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { metricaService } from "../../services/metricaService";
import { modalidadeService } from "../../services/modalidadeService";
import type { MetricaResponseDTO } from "../../types/metric";
import type { ModalidadeResponseDTO } from "../../types/modalidade";
import { handleApiError } from "../../utils/handleApiError";
import {
  filterMetrics,
  getMarketMetricPresets,
  getMetricStudentCount,
  getMetricTypeBadgeStyle,
  getModalityBadgeStyle,
  getPreenchimentoLabel,
  getStravaFieldLabel,
  hasStravaSync,
  isMetricActive,
  metricModalityCounts,
  normalizeTipo,
  paginateMetrics,
  type MetricPresetItem,
  type MetricQuickFilter,
  type MetricSortOption,
  type MetricWorkspaceTab,
} from "../../features/metrics/metricModel";
import MetricFormModal from "../../components/MetricModal/MetricFormModal";
import MetricDeleteModal from "../../components/MetricModal/MetricDeleteModal";
import "./Metrics.css";

const WORKSPACE_TABS: MetricWorkspaceTab[] = ["active", "presets", "discontinued"];

export const Metrics: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalityParam = searchParams.get("modalidadeId");
  const tabParam = searchParams.get("aba") as MetricWorkspaceTab | null;
  const actionParam = searchParams.get("acao");
  const returnToParam = searchParams.get("retorno");

  const [workspaceTab, setWorkspaceTab] = useState<MetricWorkspaceTab>(() => {
    if (tabParam === "presets" || tabParam === "discontinued" || tabParam === "active") {
      return tabParam;
    }
    return "active";
  });

  const [modalidades, setModalidades] = useState<ModalidadeResponseDTO[]>([]);
  const [selectedModalidadeId, setSelectedModalidadeId] = useState<number | null>(() => {
    return modalityParam ? Number(modalityParam) : null;
  });
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get("busca") || ""
  );
  const [typeFilter, setTypeFilter] = useState<MetricQuickFilter>("ALL");
  const [sortBy, setSortBy] = useState<MetricSortOption>("alpha");

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  const [allMetrics, setAllMetrics] = useState<MetricaResponseDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Menu contextual por linha
  const [openMenuMetricId, setOpenMenuMetricId] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(
    () => actionParam === "nova"
  );
  const [metricToEdit, setMetricToEdit] = useState<MetricaResponseDTO | null>(null);
  const [metricToDuplicate, setMetricToDuplicate] = useState<MetricaResponseDTO | null>(
    null
  );
  const [metricToDelete, setMetricToDelete] = useState<MetricaResponseDTO | null>(null);

  // Carrega modalidades da API
  useEffect(() => {
    async function loadModalidades() {
      try {
        const data = await modalidadeService.listarTodas();
        setModalidades(data);
      } catch (err) {
        handleApiError(err);
      }
    }
    loadModalidades();
  }, []);

  // Fecha menu contextual ao pressionar Escape
  useEffect(() => {
    if (!openMenuMetricId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenuMetricId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMenuMetricId]);

  // Carrega todas as métricas do personal
  const fetchAllMetrics = useCallback(
    async (currentModalities: ModalidadeResponseDTO[]) => {
      setLoading(true);
      try {
        try {
          const list = await metricaService.listarTodas();
          if (list && list.length > 0) {
            const enriched = list.map((m) => {
              if (!m.nomeModalidade) {
                const found = currentModalities.find((mod) => mod.id === m.modalidadeId);
                return { ...m, nomeModalidade: found?.nome || "Modalidade" };
              }
              return m;
            });
            setAllMetrics(enriched);
            return;
          }
        } catch {
          // Fallback: se o backend exigir modalidadeId
        }

        if (currentModalities.length > 0) {
          const results = await Promise.all(
            currentModalities.map(async (mod) => {
              try {
                const items = await metricaService.listarPorModalidade(mod.id);
                return items.map((item) => ({
                  ...item,
                  modalidadeId: mod.id,
                  nomeModalidade: mod.nome,
                }));
              } catch {
                return [];
              }
            })
          );
          setAllMetrics(results.flat());
        } else {
          setAllMetrics([]);
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (modalidades.length > 0) {
      fetchAllMetrics(modalidades);
    }
  }, [modalidades, fetchAllMetrics]);

  // Sincroniza com parâmetros de URL
  useEffect(() => {
    if (modalityParam) {
      setSelectedModalidadeId(Number(modalityParam));
    }
  }, [modalityParam]);

  useEffect(() => {
    if (actionParam === "nova") {
      setIsCreateOpen(true);
    }
  }, [actionParam]);

  function handleSelectWorkspaceTab(tab: MetricWorkspaceTab) {
    setWorkspaceTab(tab);
    setCurrentPage(1);
    setOpenMenuMetricId(null);
    const newParams = new URLSearchParams(searchParams);
    if (tab !== "active") {
      newParams.set("aba", tab);
    } else {
      newParams.delete("aba");
    }
    setSearchParams(newParams, { replace: true });
  }

  function handleWorkspaceTabKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: MetricWorkspaceTab
  ) {
    const idx = WORKSPACE_TABS.indexOf(currentTab);
    let nextTab: MetricWorkspaceTab | null = null;
    if (e.key === "ArrowRight") {
      nextTab = WORKSPACE_TABS[(idx + 1) % WORKSPACE_TABS.length];
    } else if (e.key === "ArrowLeft") {
      nextTab =
        WORKSPACE_TABS[(idx - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length];
    } else if (e.key === "Home") {
      nextTab = WORKSPACE_TABS[0];
    } else if (e.key === "End") {
      nextTab = WORKSPACE_TABS[WORKSPACE_TABS.length - 1];
    }
    if (nextTab) {
      e.preventDefault();
      handleSelectWorkspaceTab(nextTab);
      const nextEl = document.getElementById(`metrics-workspace-tab-${nextTab}`);
      nextEl?.focus();
    }
  }

  function handleSelectModalityTab(modId: number | null) {
    setSelectedModalidadeId(modId);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (modId !== null) {
      newParams.set("modalidadeId", String(modId));
    } else {
      newParams.delete("modalidadeId");
    }
    setSearchParams(newParams, { replace: true });
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set("busca", value);
    } else {
      newParams.delete("busca");
    }
    setSearchParams(newParams, { replace: true });
  }

  // Contadores globais das abas de workspace
  const workspaceCounts = useMemo(() => {
    const activeCount = allMetrics.filter((m) => isMetricActive(m)).length;
    const discontinuedCount = allMetrics.filter((m) => !isMetricActive(m)).length;
    const allPresets = getMarketMetricPresets(modalidades, allMetrics, null, "");
    return {
      active: activeCount,
      presets: allPresets.length,
      discontinued: discontinuedCount,
    };
  }, [allMetrics, modalidades]);

  // Lista base conforme a aba de workspace (Ativas vs Descontinuadas)
  const statusScopedMetrics = useMemo(() => {
    if (workspaceTab === "discontinued") {
      return allMetrics.filter((m) => !isMetricActive(m));
    }
    return allMetrics.filter((m) => isMetricActive(m));
  }, [allMetrics, workspaceTab]);

  // Contadores de tipos dentro da modalidade e aba selecionada
  const typeCounts = useMemo(() => {
    const base =
      selectedModalidadeId === null
        ? statusScopedMetrics
        : statusScopedMetrics.filter((m) => m.modalidadeId === selectedModalidadeId);

    let tempo = 0;
    let numerico = 0;
    let fc = 0;
    let texto = 0;
    let strava = 0;

    for (const m of base) {
      const t = normalizeTipo(m.tipo);
      if (t === "TEMPO") tempo++;
      else if (t === "NUMERICO") numerico++;
      else if (t === "FREQUENCIA_CARDIACA") fc++;
      else if (t === "TEXTO") texto++;

      if (hasStravaSync(m)) strava++;
    }

    return {
      ALL: base.length,
      TEMPO: tempo,
      NUMERICO: numerico,
      FREQUENCIA_CARDIACA: fc,
      TEXTO: texto,
      STRAVA: strava,
    };
  }, [statusScopedMetrics, selectedModalidadeId]);

  // Filtragem e ordenação da lista de métricas (abas "active" e "discontinued")
  const visibleMetrics = useMemo(() => {
    return filterMetrics(allMetrics, selectedModalidadeId, searchQuery, {
      typeFilter,
      sortBy,
      statusFilter: workspaceTab === "discontinued" ? "discontinued" : "active",
    });
  }, [allMetrics, selectedModalidadeId, searchQuery, typeFilter, sortBy, workspaceTab]);

  // Filtragem de Presets de Mercado (aba "presets")
  const visiblePresets = useMemo(() => {
    let presets = getMarketMetricPresets(
      modalidades,
      allMetrics,
      selectedModalidadeId,
      searchQuery
    );
    if (typeFilter === "STRAVA") {
      presets = presets.filter((p) => p.campoStrava !== "NENHUM");
    } else if (typeFilter !== "ALL") {
      presets = presets.filter((p) => normalizeTipo(p.tipo) === typeFilter);
    }
    return presets;
  }, [modalidades, allMetrics, selectedModalidadeId, searchQuery, typeFilter]);

  // Paginação aplicada sobre a aba ativa
  const paginatedMetrics = useMemo(
    () => paginateMetrics(visibleMetrics, currentPage, pageSize),
    [visibleMetrics, currentPage, pageSize]
  );

  const paginatedPresets = useMemo(
    () => paginateMetrics(visiblePresets, currentPage, pageSize),
    [visiblePresets, currentPage, pageSize]
  );

  const activePagination =
    workspaceTab === "presets" ? paginatedPresets : paginatedMetrics;

  const tabCounts = useMemo(() => {
    if (workspaceTab === "presets") {
      const allPresets = getMarketMetricPresets(modalidades, allMetrics, null, "");
      const asFakeMetrics = allPresets.map((p) => ({
        id: p.presetId,
        titulo: p.titulo,
        tipo: p.tipo,
        modalidadeId: p.modalidadeId,
        nomeModalidade: p.nomeModalidade,
      }));
      return metricModalityCounts(asFakeMetrics, modalidades, {
        includeZero: true,
        activeModalityId: selectedModalidadeId,
      });
    }
    return metricModalityCounts(statusScopedMetrics, modalidades, {
      activeModalityId: selectedModalidadeId,
    });
  }, [workspaceTab, statusScopedMetrics, modalidades, allMetrics, selectedModalidadeId]);

  // Callbacks de sucesso dos modais
  function handleMetricCreated(newMetric: MetricaResponseDTO) {
    setAllMetrics((prev) => [newMetric, ...prev]);

    if (returnToParam && returnToParam.startsWith("/")) {
      navigate(returnToParam);
    }
  }

  function handleMetricUpdated(updated: MetricaResponseDTO) {
    setAllMetrics((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    );
  }

  function handleMetricDeleted(deletedId: string) {
    setAllMetrics(
      (prev) =>
        prev
          .map((m) => {
            if (m.id === deletedId) {
              if (getMetricStudentCount(m) > 0) {
                return { ...m, descontinuada: true, ativo: false };
              }
              return null;
            }
            return m;
          })
          .filter(Boolean) as MetricaResponseDTO[]
    );
  }

  function handleUsePreset(preset: MetricPresetItem) {
    setMetricToDuplicate({
      id: "",
      titulo: preset.titulo,
      tipo: preset.tipo,
      modalidadeId: preset.modalidadeId,
      nomeModalidade: preset.nomeModalidade,
      obrigatoria: preset.obrigatoria,
      quemPreenche: preset.quemPreenche,
      campoStrava: preset.campoStrava,
      ativo: true,
      descontinuada: false,
      quantidadeAlunosComRegistro: 0,
    });
  }

  const hasActiveFilters =
    Boolean(searchQuery) || selectedModalidadeId !== null || typeFilter !== "ALL";

  return (
    <div className="metrics-page">
      {returnToParam && returnToParam.startsWith("/") && (
        <div className="metrics-page__return-banner" role="region" aria-label="Retorno para rotina">
          <div className="metrics-page__return-banner-info">
            <strong>Criação de rotina em andamento</strong>
            <span>
              Seus dados da rotina foram salvos em cache. Ao cadastrar a nova métrica, você voltará automaticamente para concluir a rotina.
            </span>
          </div>
          <button
            type="button"
            className="metrics-page__return-banner-btn"
            onClick={() => navigate(returnToParam)}
          >
            ← Voltar para a rotina
          </button>
        </div>
      )}

      {/* Abas de Workspace (Etapa 2): Métricas Ativas, Catálogo de Presets e Descontinuadas */}
      <div
        className="metrics-page__workspace-tabs"
        role="tablist"
        aria-label="Visões do catálogo de métricas"
      >
        <button
          id="metrics-workspace-tab-active"
          type="button"
          role="tab"
          aria-selected={workspaceTab === "active"}
          aria-controls="metrics-workspace-panel"
          tabIndex={workspaceTab === "active" ? 0 : -1}
          className={`metrics-page__workspace-tab ${
            workspaceTab === "active" ? "is-active" : ""
          }`}
          onClick={() => handleSelectWorkspaceTab("active")}
          onKeyDown={(e) => handleWorkspaceTabKeyDown(e, "active")}
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Métricas Ativas</span>
          <span className="metrics-page__workspace-badge">{workspaceCounts.active}</span>
        </button>

        <button
          id="metrics-workspace-tab-presets"
          type="button"
          role="tab"
          aria-selected={workspaceTab === "presets"}
          aria-controls="metrics-workspace-panel"
          tabIndex={workspaceTab === "presets" ? 0 : -1}
          className={`metrics-page__workspace-tab ${
            workspaceTab === "presets" ? "is-active" : ""
          }`}
          onClick={() => handleSelectWorkspaceTab("presets")}
          onKeyDown={(e) => handleWorkspaceTabKeyDown(e, "presets")}
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
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>Catálogo de Presets</span>
          <span className="metrics-page__workspace-badge">
            {workspaceCounts.presets}
          </span>
        </button>

        <button
          id="metrics-workspace-tab-discontinued"
          type="button"
          role="tab"
          aria-selected={workspaceTab === "discontinued"}
          aria-controls="metrics-workspace-panel"
          tabIndex={workspaceTab === "discontinued" ? 0 : -1}
          className={`metrics-page__workspace-tab ${
            workspaceTab === "discontinued" ? "is-active" : ""
          }`}
          onClick={() => handleSelectWorkspaceTab("discontinued")}
          onKeyDown={(e) => handleWorkspaceTabKeyDown(e, "discontinued")}
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
          <span>Descontinuadas</span>
          <span className="metrics-page__workspace-badge">
            {workspaceCounts.discontinued}
          </span>
        </button>
      </div>

      {/* Toolbar: Modality Tabs, Type Filters, Search & Create Button */}
      <div className="metrics-page__toolbar">
        <div className="metrics-page__top-row">
          <div
            className="metrics-page__tabs"
            role="group"
            aria-label="Filtrar métricas por modalidade"
          >
            {tabCounts.map((tab) => {
              const isActive = selectedModalidadeId === tab.id;
              return (
                <button
                  key={tab.id ?? "todas"}
                  type="button"
                  aria-pressed={isActive}
                  className={`metrics-page__tab-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => handleSelectModalityTab(tab.id)}
                >
                  <span>{tab.nome}</span>
                  <span className="metrics-page__tab-count">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="metrics-page__btn-create"
            onClick={() => setIsCreateOpen(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Criar métrica</span>
          </button>
        </div>

        {/* Linha de Filtros por Tipo / Strava + Busca + Ordenação */}
        <div className="metrics-page__filter-row">
          <div
            className="metrics-page__type-filters"
            role="group"
            aria-label="Filtrar por tipo de grandeza ou integração"
          >
            <button
              type="button"
              aria-pressed={typeFilter === "ALL"}
              className={`metrics-page__filter-chip ${
                typeFilter === "ALL" ? "is-active" : ""
              }`}
              onClick={() => {
                setTypeFilter("ALL");
                setCurrentPage(1);
              }}
            >
              Todos os tipos {workspaceTab !== "presets" ? `(${typeCounts.ALL})` : ""}
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === "TEMPO"}
              className={`metrics-page__filter-chip ${
                typeFilter === "TEMPO" ? "is-active" : ""
              }`}
              onClick={() => {
                setTypeFilter("TEMPO");
                setCurrentPage(1);
              }}
            >
              Tempo {workspaceTab !== "presets" ? `(${typeCounts.TEMPO})` : ""}
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === "NUMERICO"}
              className={`metrics-page__filter-chip ${
                typeFilter === "NUMERICO" ? "is-active" : ""
              }`}
              onClick={() => {
                setTypeFilter("NUMERICO");
                setCurrentPage(1);
              }}
            >
              Numérico {workspaceTab !== "presets" ? `(${typeCounts.NUMERICO})` : ""}
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === "FREQUENCIA_CARDIACA"}
              className={`metrics-page__filter-chip ${
                typeFilter === "FREQUENCIA_CARDIACA" ? "is-active" : ""
              }`}
              onClick={() => {
                setTypeFilter("FREQUENCIA_CARDIACA");
                setCurrentPage(1);
              }}
            >
              Freq. Cardíaca{" "}
              {workspaceTab !== "presets" ? `(${typeCounts.FREQUENCIA_CARDIACA})` : ""}
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === "TEXTO"}
              className={`metrics-page__filter-chip ${
                typeFilter === "TEXTO" ? "is-active" : ""
              }`}
              onClick={() => {
                setTypeFilter("TEXTO");
                setCurrentPage(1);
              }}
            >
              Texto {workspaceTab !== "presets" ? `(${typeCounts.TEXTO})` : ""}
            </button>
            {(workspaceTab === "presets" || typeCounts.STRAVA > 0) && (
              <button
                type="button"
                aria-pressed={typeFilter === "STRAVA"}
                className={`metrics-page__filter-chip metrics-page__filter-chip--strava ${
                  typeFilter === "STRAVA" ? "is-active" : ""
                }`}
                onClick={() => {
                  setTypeFilter("STRAVA");
                  setCurrentPage(1);
                }}
              >
                <span>
                  ⚡ Com Strava{" "}
                  {workspaceTab !== "presets" ? `(${typeCounts.STRAVA})` : ""}
                </span>
              </button>
            )}
          </div>

          <div className="metrics-page__controls-right">
            <search>
              <div className="metrics-page__search-wrap">
                <svg
                  width="17"
                  height="17"
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
                  className="metrics-page__search-input"
                  placeholder="Buscar métrica, tipo ou Strava..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  aria-label="Buscar métrica por nome, modalidade ou tipo"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            </search>

            {workspaceTab !== "presets" && (
              <select
                className="metrics-page__sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as MetricSortOption);
                  setCurrentPage(1);
                }}
                aria-label="Ordenar métricas"
              >
                <option value="alpha">Ordem: A–Z</option>
                <option value="students_desc">Mais alunos c/ registro</option>
                <option value="type">Agrupar por tipo</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner Contextual por Aba */}
      <div className="metrics-page__banner">
        <div className="metrics-page__banner-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        {workspaceTab === "presets" ? (
          <p>
            <strong>Catálogo de Presets Esportivos:</strong> adicione indicadores padrão
            de mercado (<em>TrainingPeaks</em>, <em>Strava</em>, <em>TrueCoach</em> e{" "}
            <em>Hevy</em>) com 1 clique. O tipo de grandeza e o mapeamento automático do{" "}
            <strong>Strava</strong> já vêm pré-configurados.
          </p>
        ) : workspaceTab === "discontinued" ? (
          <p>
            <strong>Métricas Descontinuadas:</strong> estas métricas não aparecem mais
            para preenchimento em novas sessões, mas são preservadas para manter os
            gráficos e o histórico de evolução dos alunos intactos.
          </p>
        ) : (
          <p>
            Métricas ficam disponíveis no registro de sessões dos alunos da modalidade.
            Métricas com histórico têm o <strong>tipo protegido</strong> e não são
            apagadas fisicamente — elas são marcadas como{" "}
            <strong>descontinuadas</strong> para preservar a evolução dos alunos.
          </p>
        )}
      </div>

      {/* Table / Presets Card */}
      <div
        id="metrics-workspace-panel"
        role="tabpanel"
        aria-labelledby={`metrics-workspace-tab-${workspaceTab}`}
        className="metrics-page__card"
      >
        {loading ? (
          <div className="metrics-page__empty" role="status">
            <p>Carregando métricas...</p>
          </div>
        ) : workspaceTab === "presets" ? (
          visiblePresets.length === 0 ? (
            <div className="metrics-page__empty">
              <div className="metrics-page__empty-icon" aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h3>Nenhum preset encontrado para este filtro</h3>
              <p>Limpe a busca ou altere o filtro de modalidade/tipo para ver sugestões.</p>
              <button
                type="button"
                className="metrics-page__btn-clear"
                onClick={() => {
                  handleSelectModalityTab(null);
                  handleSearchChange("");
                  setTypeFilter("ALL");
                }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Catálogo de presets de métricas por modalidade"
              className="metrics-page__table-wrapper"
            >
              <table className="metrics-page__table metrics-page__table--presets">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: "38%" }}>
                      PRESET SUGERIDO & APLICAÇÃO
                    </th>
                    <th scope="col" style={{ width: "20%" }}>
                      GRANDEZA / TIPO
                    </th>
                    <th scope="col" style={{ width: "16%" }}>
                      MODALIDADE ALVO
                    </th>
                    <th scope="col" style={{ width: "14%" }}>
                      INTEGRAÇÃO STRAVA
                    </th>
                    <th
                      scope="col"
                      style={{ width: "12%", textAlign: "right" }}
                      className="metrics-page__col-actions"
                    >
                      AÇÃO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPresets.items.map((preset) => {
                    const typeStyle = getMetricTypeBadgeStyle(preset.tipo);
                    const badgeStyle = getModalityBadgeStyle(preset.nomeModalidade);
                    const stravaLabel = getStravaFieldLabel(preset.campoStrava);
                    const hasStrava = preset.campoStrava !== "NENHUM";

                    return (
                      <tr key={preset.presetId}>
                        <td className="metrics-page__col-metric">
                          <div className="metrics-page__metric-head">
                            <h3>{preset.titulo}</h3>
                          </div>
                          <p className="metrics-page__preset-desc">{preset.descricao}</p>
                          <div className="metrics-page__meta-pills">
                            <span
                              className={`metrics-page__rule-tag ${
                                preset.obrigatoria
                                  ? "metrics-page__rule-tag--required"
                                  : "metrics-page__rule-tag--optional"
                              }`}
                            >
                              {preset.obrigatoria ? "Obrigatória" : "Opcional"}
                            </span>
                            <span className="metrics-page__rule-tag">
                              Preenche: {getPreenchimentoLabel(preset.quemPreenche)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="metrics-page__type-cell">
                            <span
                              className="metrics-page__type-badge"
                              style={{
                                backgroundColor: typeStyle.bg,
                                color: typeStyle.color,
                                borderColor: typeStyle.border,
                              }}
                            >
                              <span>{typeStyle.label}</span>
                            </span>
                            <span className="metrics-page__type-hint">
                              {typeStyle.unitHint}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className="metrics-page__modality-badge"
                            style={{
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.color,
                            }}
                          >
                            <img src={badgeStyle.icon} alt="" aria-hidden="true" />
                            <span>{preset.nomeModalidade}</span>
                          </span>
                        </td>

                        <td>
                          {hasStrava ? (
                            <span className="metrics-page__strava-tag">
                              ⚡ {stravaLabel}
                            </span>
                          ) : (
                            <span className="metrics-page__type-hint">
                              Preenchimento manual
                            </span>
                          )}
                        </td>

                        <td className="metrics-page__col-actions">
                          {preset.alreadyExists ? (
                            <span className="metrics-page__preset-added">
                              ✓ Já cadastrada
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="metrics-page__btn-use-preset"
                              onClick={() => handleUsePreset(preset)}
                            >
                              + Usar preset
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : visibleMetrics.length === 0 ? (
          <div className="metrics-page__empty">
            <div className="metrics-page__empty-icon" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3>
              {workspaceTab === "discontinued"
                ? "Nenhuma métrica descontinuada"
                : "Nenhuma métrica encontrada"}
            </h3>
            <p>
              {hasActiveFilters
                ? "Nenhuma métrica corresponde aos filtros selecionados."
                : workspaceTab === "discontinued"
                ? "As métricas que possuem histórico de alunos e forem descontinuadas ficarão arquivadas aqui."
                : "Você ainda não possui métricas personalizadas ativas cadastradas."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="metrics-page__btn-clear"
                onClick={() => {
                  handleSelectModalityTab(null);
                  handleSearchChange("");
                  setTypeFilter("ALL");
                }}
              >
                Limpar filtros
              </button>
            ) : (
              workspaceTab === "active" && (
                <div className="metrics-page__empty-actions">
                  <button
                    type="button"
                    className="metrics-page__btn-empty"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    + Criar métrica
                  </button>
                  <button
                    type="button"
                    className="metrics-page__btn-clear"
                    onClick={() => handleSelectWorkspaceTab("presets")}
                  >
                    Explorar presets de mercado
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela de métricas personalizadas"
            className="metrics-page__table-wrapper"
          >
            <table className="metrics-page__table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "32%" }}>
                    MÉTRICA & PREENCHIMENTO
                  </th>
                  <th scope="col" style={{ width: "18%" }}>
                    GRANDEZA / TIPO
                  </th>
                  <th scope="col" style={{ width: "14%" }}>
                    MODALIDADE
                  </th>
                  <th scope="col" style={{ width: "16%" }}>
                    HISTÓRICO & PROTEÇÃO
                  </th>
                  <th scope="col" style={{ width: "10%" }}>
                    STATUS
                  </th>
                  <th
                    scope="col"
                    style={{ width: "10%", textAlign: "right" }}
                    className="metrics-page__col-actions"
                  >
                    AÇÕES
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMetrics.items.map((metrica) => {
                  const studentCount = getMetricStudentCount(metrica);
                  const active = isMetricActive(metrica);
                  const normTipo = normalizeTipo(metrica.tipo);
                  const typeStyle = getMetricTypeBadgeStyle(metrica.tipo);
                  const modalityName =
                    metrica.nomeModalidade ||
                    modalidades.find((m) => m.id === metrica.modalidadeId)?.nome ||
                    "Modalidade";
                  const badgeStyle = getModalityBadgeStyle(modalityName);
                  const stravaActive = hasStravaSync(metrica);
                  const stravaLabel = getStravaFieldLabel(metrica.campoStrava);
                  const isMandatory = metrica.obrigatoria !== false;
                  const isMenuOpen = openMenuMetricId === metrica.id;

                  return (
                    <tr
                      key={metrica.id}
                      className={!active ? "metrics-page__row--discontinued" : ""}
                    >
                      {/* 1. MÉTRICA & PREENCHIMENTO */}
                      <td
                        className="metrics-page__col-metric metrics-page__col-metric--clickable"
                        onClick={() => setMetricToEdit(metrica)}
                        title="Clique para editar as configurações desta métrica"
                      >
                        <div className="metrics-page__metric-head">
                          <h3>{metrica.titulo}</h3>
                        </div>
                        <div className="metrics-page__meta-pills">
                          <span
                            className={`metrics-page__rule-tag ${
                              isMandatory
                                ? "metrics-page__rule-tag--required"
                                : "metrics-page__rule-tag--optional"
                            }`}
                          >
                            {isMandatory ? "Obrigatória" : "Opcional"}
                          </span>

                          <span className="metrics-page__rule-tag">
                            Preenche: {getPreenchimentoLabel(metrica.quemPreenche)}
                          </span>

                          {stravaActive && (
                            <span
                              className="metrics-page__strava-tag"
                              title={`Preenchimento automático via Strava: ${stravaLabel}`}
                            >
                              ⚡ Strava · {stravaLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. GRANDEZA / TIPO */}
                      <td>
                        <div className="metrics-page__type-cell">
                          <span
                            className="metrics-page__type-badge"
                            style={{
                              backgroundColor: typeStyle.bg,
                              color: typeStyle.color,
                              borderColor: typeStyle.border,
                            }}
                          >
                            {normTipo === "NUMERICO" ? (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <line x1="4" y1="9" x2="20" y2="9" />
                                <line x1="4" y1="15" x2="20" y2="15" />
                                <line x1="10" y1="3" x2="8" y2="21" />
                                <line x1="16" y1="3" x2="14" y2="21" />
                              </svg>
                            ) : normTipo === "TEMPO" ? (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                            ) : normTipo === "FREQUENCIA_CARDIACA" ? (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                            ) : (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <line x1="21" y1="10" x2="3" y2="10" />
                                <line x1="21" y1="6" x2="3" y2="6" />
                                <line x1="21" y1="14" x2="3" y2="14" />
                                <line x1="21" y1="18" x2="3" y2="18" />
                              </svg>
                            )}
                            <span>{typeStyle.label}</span>
                          </span>
                          <span className="metrics-page__type-hint">
                            {typeStyle.unitHint}
                          </span>
                        </div>
                      </td>

                      {/* 3. MODALIDADE */}
                      <td>
                        <span
                          className="metrics-page__modality-badge"
                          style={{
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                          }}
                        >
                          <img src={badgeStyle.icon} alt="" aria-hidden="true" />
                          <span>{modalityName}</span>
                        </span>
                      </td>

                      {/* 4. HISTÓRICO & PROTEÇÃO */}
                      <td>
                        <div className="metrics-page__history-cell">
                          <span className="metrics-page__students-cell">
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
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span>
                              {studentCount === 0
                                ? "Sem registros"
                                : `${studentCount} ${
                                    studentCount === 1 ? "aluno" : "alunos"
                                  }`}
                            </span>
                          </span>

                          {studentCount > 0 && (
                            <span
                              className="metrics-page__lock-hint"
                              title="Esta métrica já possui histórico de alunos: o tipo de grandeza é protegido e ela não pode ser apagada fisicamente."
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect
                                  x="3"
                                  y="11"
                                  width="18"
                                  height="11"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Tipo protegido
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. STATUS */}
                      <td>
                        <span
                          className={`metrics-page__status-badge ${
                            active ? "is-active" : "is-discontinued"
                          }`}
                        >
                          <span className="metrics-page__status-dot" />
                          <span>{active ? "Ativa" : "Descontinuada"}</span>
                        </span>
                      </td>

                      {/* 6. AÇÕES */}
                      <td className="metrics-page__col-actions">
                        <div className="metrics-page__actions-wrap">
                          <button
                            type="button"
                            className="metrics-page__btn-edit"
                            aria-label={`Editar ${metrica.titulo}`}
                            onClick={() => setMetricToEdit(metrica)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            <span>Editar</span>
                          </button>

                          {/* Menu Contextual (⋮) */}
                          <div className="metrics-page__menu-wrap">
                            <button
                              type="button"
                              className={`metrics-page__action-btn ${
                                isMenuOpen ? "is-open" : ""
                              }`}
                              title="Mais ações da métrica"
                              aria-label={`Mais ações da métrica ${metrica.titulo}`}
                              aria-expanded={isMenuOpen}
                              aria-haspopup="menu"
                              onClick={() =>
                                setOpenMenuMetricId(isMenuOpen ? null : metrica.id)
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
                                  className="metrics-page__menu-backdrop"
                                  onClick={() => setOpenMenuMetricId(null)}
                                />
                                <div
                                  className="metrics-page__dropdown"
                                  role="menu"
                                  aria-label={`Opções para ${metrica.titulo}`}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="metrics-page__dropdown-item"
                                    onClick={() => {
                                      setOpenMenuMetricId(null);
                                      setMetricToEdit(metrica);
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
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                    Editar configurações
                                  </button>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="metrics-page__dropdown-item"
                                    onClick={() => {
                                      setOpenMenuMetricId(null);
                                      setMetricToDuplicate(metrica);
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
                                      <rect
                                        x="9"
                                        y="9"
                                        width="13"
                                        height="13"
                                        rx="2"
                                        ry="2"
                                      />
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Copiar para outra modalidade
                                  </button>

                                  {active && (
                                    <>
                                      <div
                                        className="metrics-page__dropdown-divider"
                                        role="separator"
                                      />
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className={`metrics-page__dropdown-item ${
                                          studentCount > 0
                                            ? "metrics-page__dropdown-item--warning"
                                            : "metrics-page__dropdown-item--danger"
                                        }`}
                                        onClick={() => {
                                          setOpenMenuMetricId(null);
                                          setMetricToDelete(metrica);
                                        }}
                                      >
                                        {studentCount > 0 ? (
                                          <>
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
                                              <circle cx="12" cy="12" r="10" />
                                              <line
                                                x1="4.93"
                                                y1="4.93"
                                                x2="19.07"
                                                y2="19.07"
                                              />
                                            </svg>
                                            Descontinuar métrica
                                          </>
                                        ) : (
                                          <>
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
                                            Excluir métrica
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
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
        )}

        {/* Rodapé de Paginação */}
        {!loading && activePagination.totalItems > 0 && (
          <nav
            className="metrics-page__pagination"
            aria-label="Paginação de métricas"
          >
            <div className="metrics-page__pagination-info">
              <span>
                Mostrando <strong>{activePagination.startIndex}</strong>–
                <strong>{activePagination.endIndex}</strong> de{" "}
                <strong>{activePagination.totalItems}</strong>{" "}
                {workspaceTab === "presets"
                  ? activePagination.totalItems === 1
                    ? "preset sugerido"
                    : "presets sugeridos"
                  : activePagination.totalItems === 1
                  ? "métrica"
                  : "métricas"}
              </span>

              <label className="metrics-page__page-size-label">
                <span>Exibir:</span>
                <select
                  className="metrics-page__page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Quantidade de itens por página"
                >
                  <option value={5}>5 por página</option>
                  <option value={8}>8 por página</option>
                  <option value={15}>15 por página</option>
                  <option value={30}>30 por página</option>
                </select>
              </label>
            </div>

            <div className="metrics-page__pagination-controls">
              <button
                type="button"
                className="metrics-page__page-btn"
                disabled={activePagination.currentPage <= 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
                aria-label="Página anterior"
              >
                ← Anterior
              </button>

              <div className="metrics-page__page-numbers">
                {activePagination.pageNumbers.map((pageNum) => {
                  const isCurrent = pageNum === activePagination.currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`metrics-page__page-num ${
                        isCurrent ? "is-current" : ""
                      }`}
                      aria-current={isCurrent ? "page" : undefined}
                      aria-label={`Ir para a página ${pageNum}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="metrics-page__page-btn"
                disabled={
                  activePagination.currentPage >= activePagination.totalPages
                }
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(activePagination.totalPages, prev + 1)
                  )
                }
                aria-label="Próxima página"
              >
                Próxima →
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* Modal Criar ou Duplicar Métrica / Usar Preset */}
      <MetricFormModal
        mode="create"
        isOpen={isCreateOpen || Boolean(metricToDuplicate)}
        onClose={() => {
          setIsCreateOpen(false);
          setMetricToDuplicate(null);
          if (actionParam === "nova") {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("acao");
            setSearchParams(nextParams, { replace: true });
          }
        }}
        modalidades={modalidades}
        defaultModalidadeId={selectedModalidadeId}
        existingMetrics={allMetrics}
        templateMetric={metricToDuplicate}
        onSuccess={handleMetricCreated}
      />

      {/* Modal Editar Métrica */}
      {metricToEdit && (
        <MetricFormModal
          mode="edit"
          isOpen={Boolean(metricToEdit)}
          onClose={() => setMetricToEdit(null)}
          modalidades={modalidades}
          existingMetrics={allMetrics}
          metricToEdit={metricToEdit}
          onSuccess={handleMetricUpdated}
        />
      )}

      {/* Modal Excluir/Descontinuar Métrica */}
      {metricToDelete && (
        <MetricDeleteModal
          metric={metricToDelete}
          isOpen={Boolean(metricToDelete)}
          onClose={() => setMetricToDelete(null)}
          onSuccess={handleMetricDeleted}
        />
      )}
    </div>
  );
};

export default Metrics;
