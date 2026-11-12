import type { KeyboardEvent } from "react";
import type { StudentActiveRoutineInfo } from "../../features/studentArea/StudentContext";
import "./StudentModalityTabs.css";

interface StudentModalityTabsProps {
  activeRoutines: StudentActiveRoutineInfo[];
  selectedFilter: number | "ALL";
  onSelect: (filter: number | "ALL") => void;
}

/**
 * Single-row horizontal tab bar allowing hybrid athletes (>1 active routine)
 * to switch between the unified civil calendar ("ALL") and individual sports.
 */
export default function StudentModalityTabs({
  activeRoutines,
  selectedFilter,
  onSelect,
}: StudentModalityTabsProps) {
  if (activeRoutines.length <= 1) return null;

  const filterValues: Array<number | "ALL"> = [
    "ALL",
    ...activeRoutines
      .map((r) => r.modalidadeId)
      .filter((id): id is number => id != null),
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % filterValues.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + filterValues.length) % filterValues.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filterValues.length - 1;
    }
    const nextValue = filterValues[nextIndex];
    if (nextValue !== undefined) {
      onSelect(nextValue);
      const tablist = event.currentTarget.parentElement;
      const buttons = tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      className="student-modality-bar"
      role="tablist"
      aria-label="Filtrar rotinas por modalidade"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedFilter === "ALL"}
        tabIndex={selectedFilter === "ALL" ? 0 : -1}
        className="student-modality-bar__tab"
        onClick={() => onSelect("ALL")}
        onKeyDown={(e) => handleKeyDown(e, 0)}
      >
        <span>Todas as modalidades</span>
        <small>{activeRoutines.length}</small>
      </button>
      {activeRoutines.map((rot, idx) => {
        if (rot.modalidadeId == null) return null;
        const isSelected = selectedFilter === rot.modalidadeId;
        const filterIdx = filterValues.indexOf(rot.modalidadeId);
        return (
          <button
            key={rot.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className="student-modality-bar__tab"
            onClick={() => onSelect(rot.modalidadeId!)}
            onKeyDown={(e) => handleKeyDown(e, filterIdx >= 0 ? filterIdx : idx + 1)}
          >
            <span>{rot.modalidade}</span>
            <small>{rot.frequenciaSemanal}x/sem</small>
          </button>
        );
      })}
    </div>
  );
}
