import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExamIconRow, ExamShell, ExamStepCard } from '@/components/readingExam/ExamStepParts';
import { MicLevelMeter } from '@/components/readingExam/MicLevelMeter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { MIC_SAMPLE_PARAGRAPH, useMicLevelMeter } from '@/hooks/useMicLevelMeter';
import { useTestAudio } from '@/hooks/useTestAudio';
import { patchExamPrep } from '@/lib/readingExam/examPrepStorage';
import { paths } from '@/routes/paths';

type Step = 'hardware' | 'volume' | 'volume_play' | 'mic_explain' | 'mic_record';

const STEPS: Step[] = ['hardware', 'volume', 'volume_play', 'mic_explain', 'mic_record'];

export default function ReadingExamCheckPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'ADAPTIVE';
  const length = params.get('length') ?? '10';

  const [step, setStep] = useState<Step>('hardware');
  const [countdown, setCountdown] = useState<number | null>(null);
  const { play, playing, played } = useTestAudio();
  const mic = useMicLevelMeter();

  const query = `mode=${encodeURIComponent(mode)}&length=${encodeURIComponent(length)}`;

  useEffect(() => {
    if (student?.exam_track !== 'toefl') return;
    patchExamPrep({
      hardwareAck: false,
      volumeOk: false,
      micExplainOk: false,
      micOk: false,
      introSeen: false,
    });
  }, [student?.exam_track]);

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void mic.start();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c != null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown, mic]);

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="mx-auto max-w-lg p-6 text-sm">
        TOEFL Reading Practice only.{' '}
        <Link to={paths.settings} className="underline">
          Choose TOEFL
        </Link>
      </Card>
    );
  }

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]!);
      return;
    }
    patchExamPrep({ micOk: true });
    navigate(`${paths.readingPracticeIntro}?${query}`);
  }

  function handleContinue() {
    if (step === 'hardware') {
      patchExamPrep({ hardwareAck: true });
      goNext();
      return;
    }
    if (step === 'volume') {
      goNext();
      return;
    }
    if (step === 'volume_play') {
      if (!played) return;
      patchExamPrep({ volumeOk: true });
      goNext();
      return;
    }
    if (step === 'mic_explain') {
      patchExamPrep({ micExplainOk: true });
      goNext();
      return;
    }
    if (step === 'mic_record') {
      mic.stop();
      patchExamPrep({ micOk: mic.micPassed });
      navigate(`${paths.readingPracticeIntro}?${query}`);
    }
  }

  const continueDisabled =
    (step === 'volume_play' && !played) ||
    (step === 'mic_record' && !mic.micPassed && countdown == null && !mic.active);

  return (
    <ExamShell
      onContinue={handleContinue}
      continueDisabled={continueDisabled}
      showContinue
      continueLabel="Continue"
    >
      {step === 'hardware' && (
        <ExamStepCard title="Hardware Check">
          <ExamIconRow />
          <p>
            Before the test begins, we will check the microphone and headset volume.
          </p>
          <p>
            Please make sure your headset is on. Follow the instructions on each screen. Be sure that
            your microphone is properly positioned and adjusted to allow for the best possible
            recording. Speak directly into the microphone and in your normal speaking voice.
          </p>
        </ExamStepCard>
      )}

      {step === 'volume' && (
        <ExamStepCard title="Adjusting the Volume">
          <p>
            To adjust the volume, use your system volume or headset controls until you can hear test
            audio clearly.
          </p>
          <p>You will be able to change the volume during the test if you need to.</p>
          <div className="flex items-center gap-3 rounded-md border border-club/30 bg-club-soft/60 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-club/40 bg-club-soft text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.05a4.48 4.48 0 0 0 2.5-4.02z" />
              </svg>
            </div>
            <p className="text-sm text-ink">On the next screen you will play test audio.</p>
          </div>
        </ExamStepCard>
      )}

      {step === 'volume_play' && (
        <ExamStepCard title="Adjusting the Volume">
          <p>Play the test audio and confirm you can hear it clearly through your headset or speakers.</p>
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              size="lg"
              variant="primary"
              className="min-w-[220px]"
              disabled={playing}
              onClick={() => void play()}
            >
              {playing ? 'Playing…' : played ? '▶ Play Test Audio Again' : '▶ Play Test Audio'}
            </Button>
          </div>
          {played && (
            <p className="text-center text-sm font-medium text-success">
              ✓ Test audio played — select Continue when volume is comfortable.
            </p>
          )}
        </ExamStepCard>
      )}

      {step === 'mic_explain' && (
        <ExamStepCard title="Adjusting the Microphone">
          <p>
            In order to check your <strong className="text-ink">microphone volume</strong>, you will
            speak into the microphone using your normal tone and volume. For best recording results,
            your voice level should remain generally within the Good range.
          </p>
          <p className="font-semibold text-ink">Example:</p>
          <div className="space-y-6 rounded-md border border-paper-line bg-paper-soft p-4">
            <MicLevelMeter bars={8} barCount={24} label="good" variant="example-good" />
            <MicLevelMeter bars={18} barCount={24} label="too_loud" variant="example-loud" />
          </div>
        </ExamStepCard>
      )}

      {step === 'mic_record' && (
        <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-club bg-club text-ink shadow-md transition hover:bg-club-hover disabled:opacity-60"
              disabled={mic.active || countdown != null}
              onClick={() => setCountdown(3)}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
              </svg>
              <span className="mt-2 text-lg font-bold tracking-wide">RECORD</span>
            </button>
            {countdown != null && (
              <p className="text-lg font-semibold text-ink">Starting in {countdown}…</p>
            )}
          </div>

          <ExamStepCard title="Microphone Check">
            <p>
              Select the <strong className="text-ink">Record</strong> button. A timer will count down
              until the system is ready to record.
            </p>
            <p>
              To check your microphone level, read the following paragraph using your normal tone and
              volume.
            </p>
            <div className="rounded-md border border-paper-line bg-paper-soft p-4 text-ink">
              {MIC_SAMPLE_PARAGRAPH}
            </div>
            {mic.error && <p className="text-danger">{mic.error}</p>}
            <MicLevelMeter
              bars={mic.bars}
              barCount={mic.barCount}
              label={mic.label}
              variant="live"
            />
            {mic.micPassed && (
              <p className="font-medium text-success">✓ Microphone level is good — select Continue.</p>
            )}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  mic.stop();
                  patchExamPrep({ micOk: true });
                  navigate(`${paths.readingPracticeIntro}?${query}`);
                }}
              >
                Skip microphone check
              </Button>
            </div>
          </ExamStepCard>
        </div>
      )}
    </ExamShell>
  );
}
