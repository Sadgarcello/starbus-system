-- 0022_reading_practice_seed.sql
-- Starter TOEFL reading practice content (run after 0021)
-- Safe to re-run — skips rows that already exist.

insert into public.complete_words_questions (sentence, target_word, cefr_level, difficulty, category, explanation, active)
select v.sentence, v.target_word, v.cefr_level, v.difficulty, v.category, v.explanation, v.active
from (values
  ('The rapid development of technology has changed modern communication.', 'development', 'B2', 6::numeric, 'academic', 'Development means growth or advancement over time.', true),
  ('Scientists observed significant resistance to the new treatment.', 'resistance', 'B2', 7::numeric, 'academic', 'Resistance here means opposition or failure to respond.', true),
  ('The implementation of the policy required careful planning.', 'implementation', 'B2', 6::numeric, 'academic', 'Implementation is the process of putting a plan into action.', true),
  ('Environmental changes can affect wildlife distribution.', 'distribution', 'B1', 5::numeric, 'science', 'Distribution refers to how something is spread across an area.', true),
  ('The university announced a schedule change for final exams.', 'schedule', 'A2', 3::numeric, 'daily', 'Schedule means a planned list of times for events.', true)
) as v(sentence, target_word, cefr_level, difficulty, category, explanation, active)
where not exists (
  select 1 from public.complete_words_questions c
  where c.sentence = v.sentence and c.target_word = v.target_word
);

insert into public.daily_life_questions (
  title, content, content_type, cefr_level, difficulty, skill, question,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select v.title, v.content, v.content_type, v.cefr_level, v.difficulty, v.skill::reading_skill, v.question,
  v.option_a, v.option_b, v.option_c, v.option_d, v.correct_option, v.explanation, v.active
from (values
  (
    'Library Notice',
    'The library will close at 6:00 PM on Friday due to maintenance. Students who need to borrow books should do so before 5:30 PM.',
    'NOTICE', 'B1', 4::numeric, 'DETAIL',
    'Why will the library close early?',
    'Staff training', 'Maintenance', 'Public holiday', 'Student event',
    'B', 'The notice states the library is closing because of maintenance.', true
  ),
  (
    'Campus Email',
    'Room 204 is unavailable tomorrow. Please move your study group to Room 118 on the second floor.',
    'EMAIL', 'B1', 4::numeric, 'INFERENCE',
    'What should the reader do?',
    'Cancel the study group', 'Go to Room 118', 'Contact maintenance', 'Wait in Room 204',
    'B', 'The email instructs students to use Room 118 instead.', true
  ),
  (
    'Cafeteria Menu',
    'Lunch special today: vegetable soup and bread. Served until 2:00 PM or while supplies last.',
    'MENU', 'A2', 3::numeric, 'DETAIL',
    'When does the lunch special end?',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
    'C', 'The menu says the special is served until 2:00 PM.', true
  )
) as v(title, content, content_type, cefr_level, difficulty, skill, question, option_a, option_b, option_c, option_d, correct_option, explanation, active)
where not exists (
  select 1 from public.daily_life_questions d where d.title = v.title and d.question = v.question
);

insert into public.academic_passages (title, passage_text, cefr_level, difficulty, topic, word_count, active)
select v.title, v.passage_text, v.cefr_level, v.difficulty, v.topic, v.word_count, v.active
from (values
  (
    'Urban Development',
    'Cities around the world are expanding rapidly as more people move from rural areas in search of employment and education. This urban growth creates economic opportunities, but it also places pressure on housing, transportation, and public services. Planners attempt to balance development with environmental protection by designing efficient public transit systems and preserving green spaces. When cities fail to manage growth carefully, residents may face congestion, rising costs, and reduced quality of life.',
    'B2', 6::numeric, 'society', 78, true
  ),
  (
    'Plant Adaptation',
    'Plants living in dry environments have evolved several strategies to conserve water. Some species develop thick leaves that store moisture, while others grow deep root systems to reach underground water sources. Many desert plants also reduce water loss by opening their pores only at night when temperatures are cooler. These adaptations allow plants to survive in conditions that would be fatal to species from wetter climates.',
    'B1', 5::numeric, 'biology', 72, true
  )
) as v(title, passage_text, cefr_level, difficulty, topic, word_count, active)
where not exists (
  select 1 from public.academic_passages a where a.title = v.title
);

insert into public.academic_questions (
  passage_id, question, question_type, skill, difficulty,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select p.id,
  'What is the main idea of the passage?',
  'MAIN_IDEA', 'MAIN_IDEA'::reading_skill, 6,
  'Urban growth has no negative effects',
  'City expansion brings both opportunities and challenges',
  'Public transit is unnecessary in modern cities',
  'Environmental protection prevents all development',
  'B', 'The passage discusses benefits and problems of urban growth.', true
from public.academic_passages p
where p.title = 'Urban Development'
  and not exists (
    select 1 from public.academic_questions q
    where q.passage_id = p.id and q.question = 'What is the main idea of the passage?'
  );

insert into public.academic_questions (
  passage_id, question, question_type, skill, difficulty,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select p.id,
  'According to the passage, what happens when cities fail to manage growth?',
  'DETAIL', 'DETAIL'::reading_skill, 5,
  'Housing becomes free',
  'Residents may face congestion and rising costs',
  'Public services improve automatically',
  'Green spaces expand rapidly',
  'B', 'The passage lists congestion, rising costs, and reduced quality of life.', true
from public.academic_passages p
where p.title = 'Urban Development'
  and not exists (
    select 1 from public.academic_questions q
    where q.passage_id = p.id and q.question = 'According to the passage, what happens when cities fail to manage growth?'
  );

insert into public.academic_questions (
  passage_id, question, question_type, skill, difficulty,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select p.id,
  'What can be inferred about desert plants?',
  'INFERENCE', 'INFERENCE'::reading_skill, 5,
  'They require daily rainfall',
  'They are adapted to survive with limited water',
  'They cannot grow deep roots',
  'They lose more water than other plants',
  'B', 'The passage describes multiple water-saving adaptations.', true
from public.academic_passages p
where p.title = 'Plant Adaptation'
  and not exists (
    select 1 from public.academic_questions q
    where q.passage_id = p.id and q.question = 'What can be inferred about desert plants?'
  );

-- Verify (should show at least 5 / 3 / 3 active questions)
-- select (select count(*) from complete_words_questions where active) as complete_words,
--        (select count(*) from daily_life_questions where active) as daily_life,
--        (select count(*) from academic_questions where active) as academic;
