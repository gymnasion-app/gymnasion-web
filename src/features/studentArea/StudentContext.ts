import { createContext, useContext } from "react";
import type {
  StudentExecutionMetricDTO,
  StudentFeedbackItem,
  StudentHistoricalRoutine,
  StudentRoutineWeek,
  StudentSessionMetricResult,
  StudentWeekDaySummary,
  StudentWorkoutSession,
} from "../../types/studentArea";

export interface StudentIdentityInfo {
  name: string;
  firstName: string;
  initials: string;
  roleLabel: string;
  personal: {
    name: string;
    initials: string;
    cref: string;
  };
}

export interface StudentActiveRoutineInfo {
  id: string;
  titulo: string;
  modalidade: string;
  modalidadeId?: number;
  frequenciaSemanal: number;
  objetivos: string;
  totalSemanas: number;
  semanaAtual: number;
  metricas?: StudentExecutionMetricDTO[];
}

export interface StudentExecutionConfirmDetails {
  dataReal?: string;
  duracao?: number | null;
  resultados?: StudentSessionMetricResult[];
  alreadySavedOnBackend?: boolean;
}

export interface StudentContextValue {
  student: StudentIdentityInfo;
  activeRoutine: StudentActiveRoutineInfo | null;
  activeRoutines: StudentActiveRoutineInfo[];
  selectedModalityFilter: number | "ALL";
  setSelectedModalityFilter: (filter: number | "ALL") => void;
  loading: boolean;
  selectedWeekNum: number;
  setSelectedWeekNum: (num: number) => void;
  weeks: StudentRoutineWeek[];
  weekDays: StudentWeekDaySummary[];
  historicalRoutines: StudentHistoricalRoutine[];
  feedbacks: StudentFeedbackItem[];
  completedCount: number;
  totalSessionsCount: number;
  monthlySessionsCount: number;
  averageRpe: string;
  unreadNotifications: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  rpeModalSessionId: string | null;
  rpeBusy: boolean;
  openRpeModal: (sessionId?: string) => void;
  closeRpeModal: () => void;
  confirmRpeExecution: (rpe: number | null, details?: StudentExecutionConfirmDetails) => Promise<void>;
  inspectedSession: StudentWorkoutSession | null;
  setInspectedSession: (session: StudentWorkoutSession | null) => void;
  inspectedRoutine: StudentHistoricalRoutine | null;
  setInspectedRoutine: (routine: StudentHistoricalRoutine | null) => void;
  messageModalOpen: boolean;
  setMessageModalOpen: (open: boolean) => void;
  stravaModalOpen?: boolean;
  setStravaModalOpen?: (open: boolean) => void;
  sendObservationToPersonal: (text: string) => Promise<void>;
  markFeedbacksRead: () => void;
  notifications?: {
    data: import("../../types/personalDashboard").PersonalNotification[];
    loading?: boolean;
    error?: string;
  };
  readNotification?: (id?: string) => Promise<void>;
  refreshData?: () => Promise<void>;
}

export const StudentContext = createContext<StudentContextValue | null>(null);

export function useStudentArea(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) {
    throw new Error("useStudentArea must be used within a StudentProvider");
  }
  return ctx;
}
