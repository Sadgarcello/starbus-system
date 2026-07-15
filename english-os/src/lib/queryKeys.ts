export const queryKeys = {
  attendance: {
    session: (date: string) => ['attendance', 'session', date] as const,
    marks: (sessionId: string) => ['attendance', 'marks', sessionId] as const,
    myMark: (sessionId: string, studentId: string) =>
      ['attendance', 'myMark', sessionId, studentId] as const,
    history: (studentId: string) => ['attendance', 'history', studentId] as const,
  },
};
