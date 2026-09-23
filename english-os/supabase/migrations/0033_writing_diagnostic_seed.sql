-- Optional bootstrap content for Writing diagnostic (original Khawaja content)

insert into public.writing_build_sentence_items (prompt, target_sentence, word_bank, difficulty, cefr_level, order_hint, active)
select * from (values
  ('Arrange the words into a statement about study habits.', 'Students should review their notes every day.', '["Students","should","review","their","notes","every","day"]'::jsonb, 2::numeric, 'A2', 1, true),
  ('Form a question about a past event.', 'Where did you find your phone?', '["Where","did","you","find","your","phone","?"]'::jsonb, 3::numeric, 'A2', 2, true),
  ('Use a negative form.', 'She does not agree with the proposal.', '["She","does","not","agree","with","the","proposal","."]'::jsonb, 3::numeric, 'A2', 3, true),
  ('Include a prepositional phrase.', 'The meeting is in the main hall.', '["The","meeting","is","in","the","main","hall","."]'::jsonb, 3::numeric, 'B1', 4, true),
  ('Use because to show reason.', 'We stayed home because it was raining.', '["We","stayed","home","because","it","was","raining","."]'::jsonb, 4::numeric, 'B1', 5, true),
  ('Form a compound sentence.', 'I finished the report and I sent it to my professor.', '["I","finished","the","report","and","I","sent","it","to","my","professor","."]'::jsonb, 5::numeric, 'B1', 6, true),
  ('Use although for contrast.', 'Although the lecture was long the students remained attentive.', '["Although","the","lecture","was","long","the","students","remained","attentive","."]'::jsonb, 6::numeric, 'B1', 7, true),
  ('Use a relative clause.', 'The student who answered first received extra credit.', '["The","student","who","answered","first","received","extra","credit","."]'::jsonb, 7::numeric, 'B2', 8, true),
  ('Use present perfect.', 'Researchers have discovered a new method.', '["Researchers","have","discovered","a","new","method","."]'::jsonb, 7::numeric, 'B2', 9, true),
  ('Use a conditional.', 'If the results are positive we will publish the study.', '["If","the","results","are","positive","we","will","publish","the","study","."]'::jsonb, 8::numeric, 'B2', 10, true)
) as v(prompt, target_sentence, word_bank, difficulty, cefr_level, order_hint, active)
where (select count(*) from public.writing_build_sentence_items) = 0;

insert into public.writing_email_tasks (scenario, audience, purpose, instructions, required_components, difficulty, cefr_level, active)
select
  'Assignment extension',
  'Course professor',
  'Request an extension politely',
  'Write an email to your professor. Your email should: 1) Explain the problem. 2) Explain how it affects you. 3) Request a solution.',
  '[{"id":"requirement_1","label":"Explain the problem"},{"id":"requirement_2","label":"Explain impact"},{"id":"requirement_3","label":"Request a solution"}]'::jsonb,
  5,
  'B1',
  true
where not exists (select 1 from public.writing_email_tasks where active = true limit 1);

insert into public.writing_academic_discussions (
  professor_prompt, discussion_question, participant_one_name, participant_one_response,
  participant_two_name, participant_two_response, task_instruction, difficulty, cefr_level, active
)
select
  'Let us discuss whether public universities should limit class sizes.',
  'Do you think smaller classes improve learning outcomes?',
  'Morgan',
  'Smaller classes help shy students participate, but they are expensive to maintain.',
  'Riley',
  'Large classes can offer diverse perspectives, yet individual feedback becomes harder.',
  'Write a response that states your opinion and adds something new to the discussion.',
  5,
  'B1',
  true
where not exists (select 1 from public.writing_academic_discussions where active = true limit 1);
