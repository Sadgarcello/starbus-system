import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Disable browser/OS autofill, autocorrect, autocapitalize, spellcheck, and common writing assistants. */
export const examInputAssistProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
  'data-ms-editor': 'false',
  'data-form-type': 'other',
} as const;

/** Single-letter reading blanks: strongest anti-capitalize settings for mobile keyboards. */
export const examLetterInputProps: InputHTMLAttributes<HTMLInputElement> = {
  ...examInputAssistProps,
  autoCapitalize: 'none',
  autoCorrect: 'off',
  inputMode: 'text',
};

export const examTextInputProps: InputHTMLAttributes<HTMLInputElement> = {
  ...examInputAssistProps,
};

export const examTextareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {
  ...examInputAssistProps,
};

export const examAnswerInputClassName = 'exam-answer-input';

export const examLetterInputClassName = 'exam-letter-input';
