const STORAGE_KEY = 'khawaja-toefl-reading-exam-prep';

export type ExamPrepState = {
  hardwareAck: boolean;
  volumeOk: boolean;
  micExplainOk: boolean;
  micOk: boolean;
  introSeen: boolean;
  checkedAt: number;
};

const DEFAULT: ExamPrepState = {
  hardwareAck: false,
  volumeOk: false,
  micExplainOk: false,
  micOk: false,
  introSeen: false,
  checkedAt: 0,
};

/** Prep valid for 4 hours in the same browser tab session. */
const MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function getExamPrep(): ExamPrepState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as ExamPrepState;
    if (Date.now() - parsed.checkedAt > MAX_AGE_MS) return { ...DEFAULT };
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function patchExamPrep(patch: Partial<ExamPrepState>): ExamPrepState {
  const next = { ...getExamPrep(), ...patch, checkedAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isHardwareCheckComplete(): boolean {
  const s = getExamPrep();
  return s.hardwareAck && s.volumeOk && s.micExplainOk && s.micOk;
}

export function isExamPrepComplete(): boolean {
  const s = getExamPrep();
  return isHardwareCheckComplete() && s.introSeen;
}

export function clearExamPrep(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function markIntroSeen(): void {
  patchExamPrep({ introSeen: true });
}
