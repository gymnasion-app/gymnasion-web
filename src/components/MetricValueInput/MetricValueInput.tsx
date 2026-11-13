import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Heart, Plus } from "lucide-react";
import type { CampoStrava, TipoMetrica } from "../../types/metric";
import {
  formatSecondsToTime,
  isUnidadeRitmo,
  normalizeTipo,
  parseTimeSegments,
} from "../../utils/metricValueFormat";
import "./MetricValueInput.css";

export interface MetricValueInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onBlur?: () => void;
  tipo: TipoMetrica | string;
  unidade?: string | null;
  campoStrava?: CampoStrava | string | null;
  disabled?: boolean;
  error?: string;
  fromStrava?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

interface TimeBoxState {
  hh: string;
  mm: string;
  ss: string;
}

function padTwo(segment: string): string {
  const digits = segment.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(2, "0").slice(-2);
}

function deriveInitialTimeState(
  rawValue: string,
  paceMode: boolean,
  unidade?: string | null
): { boxes: TimeBoxState; showHours: boolean } {
  const forceHoursUnit = !paceMode && unidade === "hh:mm:ss";
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    return { boxes: { hh: "", mm: "", ss: "" }, showHours: forceHoursUnit };
  }

  const parsed = parseTimeSegments(trimmed);
  if (parsed) {
    if (!paceMode && (parsed.segments === 3 || parsed.minutes >= 60 || forceHoursUnit)) {
      const normalized = formatSecondsToTime(parsed.totalSeconds, true).split(":");
      return {
        boxes: {
          hh: normalized[0] || "00",
          mm: normalized[1] || "00",
          ss: normalized[2] || "00",
        },
        showHours: true,
      };
    }
    return {
      boxes: {
        hh: "",
        mm: String(parsed.minutes).padStart(2, "0"),
        ss: String(parsed.seconds).padStart(2, "0"),
      },
      showHours: forceHoursUnit,
    };
  }

  // Preserva entrada parcial exata enquanto edita/sincroniza se contiver separador ':'
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => p.replace(/\D/g, "").slice(0, 2));
    if (!paceMode && (parts.length >= 3 || forceHoursUnit)) {
      return {
        boxes: {
          hh: parts.length >= 3 ? parts[0] || "" : "",
          mm: parts.length >= 3 ? parts[1] || "" : parts[0] || "",
          ss: parts.length >= 3 ? parts[2] || "" : parts[1] || "",
        },
        showHours: true,
      };
    }
    return {
      boxes: { hh: "", mm: parts[0] || "", ss: parts[1] || "" },
      showHours: forceHoursUnit,
    };
  }

  return { boxes: { hh: "", mm: "", ss: "" }, showHours: forceHoursUnit };
}

function composeTimeValue(boxes: TimeBoxState, showHours: boolean): string {
  if (showHours) {
    if (!boxes.hh && !boxes.mm && !boxes.ss) return "";
    return `${boxes.hh}:${boxes.mm}:${boxes.ss}`;
  }
  if (!boxes.mm && !boxes.ss) return "";
  return `${boxes.mm}:${boxes.ss}`;
}

export default function MetricValueInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  tipo,
  unidade,
  campoStrava,
  disabled = false,
  error,
  fromStrava = false,
  placeholder,
  ariaLabel,
}: MetricValueInputProps) {
  const autoId = useId();
  const baseId = id || `metric-input-${autoId}`;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;

  const normTipo = normalizeTipo(tipo);
  const isPace = normTipo === "TEMPO" && (isUnidadeRitmo(unidade) || campoStrava === "RITMO_MEDIO");

  const initial = deriveInitialTimeState(value, isPace, unidade);
  const [boxes, setBoxes] = useState<TimeBoxState>(initial.boxes);
  const [showHours, setShowHours] = useState<boolean>(initial.showHours);
  const [segmentNote, setSegmentNote] = useState<string>("");

  const lastEmittedRef = useRef<string>(value);
  const groupRef = useRef<HTMLDivElement>(null);
  const hhRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);

  // Sincroniza quando o valor ou formato externo muda (importacao Strava, reversao, troca de sessao)
  useEffect(() => {
    if (normTipo !== "TEMPO") {
      lastEmittedRef.current = value;
      return;
    }
    if (value !== lastEmittedRef.current) {
      const synced = deriveInitialTimeState(value, isPace, unidade);
      setBoxes(synced.boxes);
      setShowHours(synced.showHours);
      setSegmentNote("");
      lastEmittedRef.current = value;
    } else if (!isPace && unidade === "hh:mm:ss" && !showHours) {
      setShowHours(true);
    }
  }, [value, normTipo, isPace, unidade, showHours]);

  function emitTimeChange(nextBoxes: TimeBoxState, nextShowHours: boolean) {
    const composed = composeTimeValue(nextBoxes, nextShowHours);
    lastEmittedRef.current = composed;
    onChange(composed);
  }

  function handleSegmentChange(field: "hh" | "mm" | "ss", rawText: string) {
    const digits = rawText.replace(/\D/g, "").slice(0, 2);
    setSegmentNote("");

    if (digits.length === 2) {
      const numeric = Number(digits);
      if (field === "ss" && numeric > 59) {
        setSegmentNote("Segundos devem estar entre 00 e 59.");
        return;
      }
      if (field === "mm" && !isPace && numeric > 59) {
        if (!showHours) {
          setSegmentNote("Para 60 minutos ou mais, clique em “+ horas”.");
        } else {
          setSegmentNote("Minutos devem estar entre 00 e 59.");
        }
        return;
      }
    }

    const nextBoxes = { ...boxes, [field]: digits };
    setBoxes(nextBoxes);
    emitTimeChange(nextBoxes, showHours);

    if (digits.length === 2) {
      if (field === "hh") {
        mmRef.current?.focus();
      } else if (field === "mm") {
        ssRef.current?.focus();
      }
    }
  }

  function handleSegmentKeyDown(
    field: "hh" | "mm" | "ss",
    e: KeyboardEvent<HTMLInputElement>
  ) {
    if (disabled) return;
    if (e.key === ":" || e.key === ";") {
      e.preventDefault();
      if (field === "hh") {
        const padded = boxes.hh ? padTwo(boxes.hh) : "00";
        const next = { ...boxes, hh: padded };
        setBoxes(next);
        emitTimeChange(next, showHours);
        mmRef.current?.focus();
      } else if (field === "mm") {
        const padded = boxes.mm ? padTwo(boxes.mm) : "00";
        const next = { ...boxes, mm: padded };
        setBoxes(next);
        emitTimeChange(next, showHours);
        ssRef.current?.focus();
      }
      return;
    }

    const target = e.currentTarget;
    if (e.key === "Backspace" && target.value === "") {
      if (field === "ss") {
        e.preventDefault();
        mmRef.current?.focus();
      } else if (field === "mm" && showHours) {
        e.preventDefault();
        hhRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowLeft" && target.selectionStart === 0 && target.selectionEnd === 0) {
      if (field === "ss") {
        e.preventDefault();
        mmRef.current?.focus();
      } else if (field === "mm" && showHours) {
        e.preventDefault();
        hhRef.current?.focus();
      }
      return;
    }

    if (
      e.key === "ArrowRight" &&
      target.selectionStart === target.value.length &&
      target.selectionEnd === target.value.length
    ) {
      if (field === "hh") {
        e.preventDefault();
        mmRef.current?.focus();
      } else if (field === "mm") {
        e.preventDefault();
        ssRef.current?.focus();
      }
    }
  }

  function handleTimePaste(e: ClipboardEvent<HTMLInputElement>) {
    if (disabled) return;
    const raw = e.clipboardData.getData("text").trim();
    if (!raw) return;

    const multiMatch = /^(\d{1,3}(?:[\s:]+\d{1,2}){1,2})$/.exec(raw);
    if (!multiMatch) return;

    e.preventDefault();
    setSegmentNote("");
    const parts = raw.split(/[\s:]+/).map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return;

    if (parts.length === 3 && !isPace) {
      const [h, m, s] = parts;
      if (m > 59 || s > 59) return;
      const nextBoxes = {
        hh: String(Math.min(99, h)).padStart(2, "0"),
        mm: String(m).padStart(2, "0"),
        ss: String(s).padStart(2, "0"),
      };
      setShowHours(true);
      setBoxes(nextBoxes);
      emitTimeChange(nextBoxes, true);
      ssRef.current?.focus();
      return;
    }

    if (parts.length === 2) {
      const [m, s] = parts;
      if (s > 59) return;
      if (!isPace && m >= 60) {
        const formatted = formatSecondsToTime(m * 60 + s, true).split(":");
        const nextBoxes = {
          hh: formatted[0] || "01",
          mm: formatted[1] || "00",
          ss: formatted[2] || "00",
        };
        setShowHours(true);
        setBoxes(nextBoxes);
        emitTimeChange(nextBoxes, true);
        ssRef.current?.focus();
        return;
      }

      if (m > 99 || (!isPace && m > 59)) return;
      const useHours = showHours && !isPace;
      const nextBoxes = {
        hh: useHours ? boxes.hh || "00" : "",
        mm: String(m).padStart(2, "0"),
        ss: String(s).padStart(2, "0"),
      };
      setBoxes(nextBoxes);
      emitTimeChange(nextBoxes, useHours);
      ssRef.current?.focus();
    }
  }

  function handleSegmentBlur(field: "hh" | "mm" | "ss") {
    const current = boxes[field];
    if (current && current.length === 1) {
      const next = { ...boxes, [field]: padTwo(current) };
      setBoxes(next);
      emitTimeChange(next, showHours);
    }
  }

  function handleTimeGroupBlur(e: FocusEvent<HTMLDivElement>) {
    const nextFocused = e.relatedTarget as Node | null;
    if (nextFocused && groupRef.current?.contains(nextFocused)) {
      return;
    }
    const nextBoxes: TimeBoxState = {
      hh: showHours && boxes.hh ? padTwo(boxes.hh) : showHours && (boxes.mm || boxes.ss) ? "00" : "",
      mm: boxes.mm ? padTwo(boxes.mm) : (boxes.hh || boxes.ss) ? "00" : "",
      ss: boxes.ss ? padTwo(boxes.ss) : (boxes.hh || boxes.mm) ? "00" : "",
    };
    setBoxes(nextBoxes);
    emitTimeChange(nextBoxes, showHours);
    onBlur?.();
  }

  function handleExpandHours() {
    if (disabled || isPace) return;
    setSegmentNote("");
    setShowHours(true);
    const hasExisting = Boolean(boxes.mm || boxes.ss);
    const nextBoxes: TimeBoxState = {
      hh: hasExisting ? boxes.hh || "00" : "",
      mm: boxes.mm,
      ss: boxes.ss,
    };
    setBoxes(nextBoxes);
    if (hasExisting) {
      emitTimeChange(nextBoxes, true);
    }
    requestAnimationFrame(() => {
      hhRef.current?.focus();
    });
  }

  const stravaBadge = fromStrava ? (
    <span className="mvi-strava-badge" title="Valor preenchido automaticamente pelo Strava">
      Strava
    </span>
  ) : null;

  const displayedError = error || "";
  const describedByIds = [
    segmentNote ? hintId : null,
    displayedError ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  if (normTipo === "TEMPO") {
    return (
      <div className="mvi-root">
        <div
          ref={groupRef}
          className={`mvi-time-row ${displayedError ? "is-invalid" : ""} ${
            disabled ? "is-disabled" : ""
          } ${fromStrava ? "is-strava" : ""}`}
          role="group"
          aria-label={ariaLabel || label || (isPace ? "Ritmo" : "Tempo")}
          aria-describedby={describedByIds}
          onBlur={handleTimeGroupBlur}
        >
          {showHours && !isPace && (
            <>
              <input
                ref={hhRef}
                id={`${baseId}-hh`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mvi-time-box"
                placeholder="hh"
                aria-label="Horas"
                aria-invalid={Boolean(displayedError)}
                aria-describedby={describedByIds}
                maxLength={2}
                value={boxes.hh}
                disabled={disabled}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => handleSegmentChange("hh", e.target.value)}
                onKeyDown={(e) => handleSegmentKeyDown("hh", e)}
                onPaste={handleTimePaste}
                onBlur={() => handleSegmentBlur("hh")}
              />
              <span className="mvi-time-sep" aria-hidden="true">
                :
              </span>
            </>
          )}

          <input
            ref={mmRef}
            id={id || `${baseId}-mm`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mvi-time-box"
            placeholder="mm"
            aria-label="Minutos"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={describedByIds}
            maxLength={2}
            value={boxes.mm}
            disabled={disabled}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => handleSegmentChange("mm", e.target.value)}
            onKeyDown={(e) => handleSegmentKeyDown("mm", e)}
            onPaste={handleTimePaste}
            onBlur={() => handleSegmentBlur("mm")}
          />

          <span className="mvi-time-sep" aria-hidden="true">
            :
          </span>

          <input
            ref={ssRef}
            id={`${baseId}-ss`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mvi-time-box"
            placeholder="ss"
            aria-label="Segundos"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={describedByIds}
            maxLength={2}
            value={boxes.ss}
            disabled={disabled}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => handleSegmentChange("ss", e.target.value)}
            onKeyDown={(e) => handleSegmentKeyDown("ss", e)}
            onPaste={handleTimePaste}
            onBlur={() => handleSegmentBlur("ss")}
          />

          {isPace && unidade && (
            <span className="mvi-unit-pill" aria-hidden="true">
              {unidade}
            </span>
          )}

          {!isPace && !showHours && !disabled && (
            <button
              type="button"
              className="mvi-hours-btn"
              onClick={handleExpandHours}
              title="Adicionar campo de horas (hh:mm:ss)"
            >
              <Plus size={13} aria-hidden="true" />
              <span>horas</span>
            </button>
          )}

          {stravaBadge}
        </div>

        {segmentNote && (
          <p id={hintId} className="mvi-hint">
            {segmentNote}
          </p>
        )}
        {displayedError && (
          <p id={errorId} className="mvi-error">
            {displayedError}
          </p>
        )}
      </div>
    );
  }

  if (normTipo === "FREQUENCIA_CARDIACA") {
    return (
      <div className="mvi-root">
        <div
          className={`mvi-single-wrap ${displayedError ? "is-invalid" : ""} ${
            disabled ? "is-disabled" : ""
          } ${fromStrava ? "is-strava" : ""}`}
        >
          <span className="mvi-leading-icon" aria-hidden="true">
            <Heart size={15} />
          </span>
          <input
            id={baseId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mvi-single-input mvi-single-input--fc"
            placeholder={placeholder || "145"}
            aria-label={ariaLabel || label || "Frequência cardíaca em bpm"}
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? errorId : undefined}
            maxLength={3}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onBlur={onBlur}
          />
          <span className="mvi-unit-pill" aria-hidden="true">
            bpm
          </span>
          {stravaBadge}
        </div>
        {displayedError && (
          <p id={errorId} className="mvi-error">
            {displayedError}
          </p>
        )}
      </div>
    );
  }

  if (normTipo === "TEXTO") {
    return (
      <div className="mvi-root">
        <div
          className={`mvi-text-wrap ${displayedError ? "is-invalid" : ""} ${
            disabled ? "is-disabled" : ""
          }`}
        >
          <textarea
            id={baseId}
            rows={2}
            maxLength={255}
            className="mvi-textarea"
            placeholder={placeholder || "Anotações ou percepção..."}
            aria-label={ariaLabel || label || "Texto da métrica"}
            aria-invalid={Boolean(displayedError)}
            aria-describedby={`${hintId}${displayedError ? ` ${errorId}` : ""}`}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.slice(0, 255))}
            onBlur={onBlur}
          />
          <div className="mvi-text-footer">
            <span id={hintId} className="mvi-char-counter">
              {value.length}/255
            </span>
            {stravaBadge}
          </div>
        </div>
        {displayedError && (
          <p id={errorId} className="mvi-error">
            {displayedError}
          </p>
        )}
      </div>
    );
  }

  // NUMERICO
  const cleanUnit = unidade?.trim() || "";
  return (
    <div className="mvi-root">
      <div
        className={`mvi-single-wrap ${displayedError ? "is-invalid" : ""} ${
          disabled ? "is-disabled" : ""
        } ${fromStrava ? "is-strava" : ""}`}
      >
        <input
          id={baseId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="mvi-single-input"
          placeholder={placeholder || "0"}
          aria-label={
            ariaLabel || label || (cleanUnit ? `Valor em ${cleanUnit}` : "Valor numérico")
          }
          aria-invalid={Boolean(displayedError)}
          aria-describedby={displayedError ? errorId : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {cleanUnit && (
          <span className="mvi-unit-pill" aria-hidden="true">
            {cleanUnit}
          </span>
        )}
        {stravaBadge}
      </div>
      {displayedError && (
        <p id={errorId} className="mvi-error">
          {displayedError}
        </p>
      )}
    </div>
  );
}
