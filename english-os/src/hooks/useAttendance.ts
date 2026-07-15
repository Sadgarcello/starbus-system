import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendanceService';
import { queryKeys } from '@/lib/queryKeys';

export function useAttendanceSession(sessionDate: string) {
  return useQuery({
    queryKey: queryKeys.attendance.session(sessionDate),
    queryFn: () => attendanceService.getSessionByDate(sessionDate),
    enabled: Boolean(sessionDate),
  });
}

export function useSessionMarks(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attendance.marks(sessionId ?? ''),
    queryFn: () => attendanceService.listMarksForSession(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useMyAttendanceMark(sessionId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attendance.myMark(sessionId ?? '', studentId ?? ''),
    queryFn: () => attendanceService.getMyMark(sessionId!, studentId!),
    enabled: Boolean(sessionId && studentId),
  });
}

export function useStudentAttendanceHistory(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attendance.history(studentId ?? ''),
    queryFn: () => attendanceService.listMarksForStudent(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useOpenAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionDate, teacherId }: { sessionDate: string; teacherId: string }) =>
      attendanceService.openSession(sessionDate, teacherId),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.session(session.session_date) });
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.marks(session.id) });
    },
  });
}

export function useCloseAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => attendanceService.closeSession(sessionId),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.session(session.session_date) });
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.marks(session.id) });
    },
  });
}

export function useMarkPresent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: string; studentId: string }) =>
      attendanceService.markPresent(sessionId, studentId),
    onSuccess: (mark) => {
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.marks(mark.session_id) });
      void qc.invalidateQueries({
        queryKey: queryKeys.attendance.myMark(mark.session_id, mark.student_id),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.history(mark.student_id) });
    },
  });
}
