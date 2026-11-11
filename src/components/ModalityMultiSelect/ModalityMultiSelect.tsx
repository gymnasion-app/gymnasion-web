import { useMemo, useState } from "react";
import { Lock, Search, X } from "lucide-react";
import { filterModalities } from "../../features/personal/studentModel";
import type { Modalidade } from "../../types/modalidade";
import "./ModalityMultiSelect.css";

export interface ModalityOptionItem {
  modalidade: Modalidade;
  checked: boolean;
  disabled: boolean;
  badgeText?: string;
  badgeTone?: "lock" | "neutral";
  tooltip?: string;
}

export interface SelectedModalityChip {
  id: number;
  nome: string;
  lockedReason?: string;
}

interface ModalityMultiSelectProps {
  label: string;
  searchId: string;
  options: ModalityOptionItem[];
  selectedModalities: SelectedModalityChip[];
  maxCount: number;
  loading: boolean;
  loadingText?: string;
  emptyText?: string;
  disabled?: boolean;
  onToggle: (id: number) => void;
  onRetry?: () => void;
  scrollMaxHeight?: string;
}

/**
 * Shared accessible multi-modality picker (1..3 sports) with accent-insensitive
 * search, pinned selection chips, and a dedicated vertical scroll container.
 */
export default function ModalityMultiSelect({
  label,
  searchId,
  options,
  selectedModalities,
  maxCount,
  loading,
  loadingText = "Carregando modalidades...",
  emptyText = "Nenhuma modalidade disponível.",
  disabled = false,
  onToggle,
  onRetry,
  scrollMaxHeight,
}: ModalityMultiSelectProps) {
  const [query, setQuery] = useState("");
  const labelId = `${searchId}-legend`;

  const visibleOptions = useMemo(() => {
    const matching = filterModalities(
      options.map((opt) => opt.modalidade),
      query
    );
    const byId = new Map(options.map((opt) => [opt.modalidade.id, opt]));
    return matching.map((mod) => byId.get(mod.id)!).filter(Boolean);
  }, [options, query]);

  const count = selectedModalities.length;

  return (
    <div className="modality-picker">
      <div className="modality-picker__header">
        <label htmlFor={searchId} id={labelId} className="modality-picker__label">
          {label}
        </label>
        <span
          className={`modality-picker__counter${
            count >= maxCount ? " is-full" : count > 0 ? " is-active" : ""
          }`}
        >
          {count}/{maxCount} selecionadas
        </span>
      </div>

      <search className="modality-picker__search">
        <Search size={16} className="modality-picker__search-icon" aria-hidden="true" />
        <input
          id={searchId}
          name={searchId}
          type="search"
          placeholder="Procurar modalidade (ex.: Natação, Academia)..."
          value={query}
          disabled={loading || disabled}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="modality-picker__search-clear"
            aria-label="Limpar busca de modalidades"
            onClick={() => setQuery("")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </search>

      {selectedModalities.length > 0 && (
        <div className="modality-picker__chips" aria-label="Modalidades escolhidas">
          {selectedModalities.map((chip) =>
            chip.lockedReason ? (
              <span
                key={chip.id}
                className="modality-picker__chip is-locked"
                title={chip.lockedReason}
              >
                <Lock size={11} aria-hidden="true" />
                <span>{chip.nome}</span>
              </span>
            ) : (
              <button
                key={chip.id}
                type="button"
                className="modality-picker__chip"
                disabled={disabled}
                aria-label={`Remover ${chip.nome}`}
                onClick={() => onToggle(chip.id)}
              >
                <span>{chip.nome}</span>
                <X size={12} aria-hidden="true" />
              </button>
            )
          )}
        </div>
      )}

      {loading ? (
        <p className="modality-picker__status" role="status">
          {loadingText}
        </p>
      ) : options.length === 0 ? (
        <p className="modality-picker__status">
          {emptyText}{" "}
          {onRetry && (
            <button type="button" className="modality-picker__link-btn" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </p>
      ) : visibleOptions.length === 0 ? (
        <div className="modality-picker__scroll modality-picker__scroll--empty">
          <p className="modality-picker__status">
            Nenhuma modalidade encontrada para &ldquo;{query.trim()}&rdquo;.{" "}
            <button
              type="button"
              className="modality-picker__link-btn"
              onClick={() => setQuery("")}
            >
              Limpar busca
            </button>
          </p>
        </div>
      ) : (
        <div
          className="modality-picker__scroll"
          style={scrollMaxHeight ? { maxBlockSize: scrollMaxHeight } : undefined}
          role="group"
          aria-labelledby={labelId}
        >
          <div className="modality-picker__grid">
            {visibleOptions.map((opt) => (
              <label
                key={opt.modalidade.id}
                className={`modality-picker__option${opt.checked ? " is-selected" : ""}${
                  opt.disabled ? " is-disabled" : ""
                }`}
                title={opt.tooltip}
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  disabled={opt.disabled}
                  onChange={() => onToggle(opt.modalidade.id)}
                />
                <span className="modality-picker__content">
                  <span className="modality-picker__name">{opt.modalidade.nome}</span>
                  {opt.badgeText && (
                    <span
                      className={`modality-picker__badge${
                        opt.badgeTone === "lock" ? " modality-picker__badge--lock" : ""
                      }`}
                    >
                      {opt.badgeText}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
