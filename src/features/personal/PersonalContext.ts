import { createContext, useContext } from "react";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import type { TurmaResponse } from "../../types/turma";
import type { StudentMutation } from "./studentModel";
import type { PersonalNotification, StudentHistory } from "../../types/personalDashboard";

export type Resource<T> = { data: T[]; loading: boolean; error: string };
export type Activity = { id: string; title: string; message: string; studentId: string; time: number; kind: StudentMutation };
export type PersonalState = {
  students: Resource<AlunoResponse>; routines: Resource<RotinaResponse>; groups: Resource<TurmaResponse>;
  activities: Activity[]; busyId: string | null;
  notifications: Resource<PersonalNotification>;
  histories: Resource<StudentHistory>;
  notificationBusy: boolean;
  actionError: string;
  readNotification: (id?: string) => Promise<boolean>;
  linkRoutine: (student: AlunoResponse, routineId: string) => Promise<boolean>;
  syncRoutine: (routine: RotinaResponse) => void;
  syncStudent: (student: AlunoResponse) => void;
  refresh: () => Promise<void>;
  mutate: (student: AlunoResponse, action: StudentMutation) => Promise<boolean>;
};
export const PersonalContext = createContext<PersonalState | null>(null);
export function usePersonal() {
  const context = useContext(PersonalContext);
  if (!context) throw new Error("PersonalProvider ausente");
  return context;
}
