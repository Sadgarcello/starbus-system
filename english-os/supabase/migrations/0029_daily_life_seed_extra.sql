-- 0029_daily_life_seed_extra.sql
-- Extra Daily Life content so 10-question sessions can rotate without exhausting the pool.

insert into public.daily_life_questions (
  title, content, content_type, cefr_level, difficulty, skill, question,
  option_a, option_b, option_c, option_d, correct_option, explanation, active
)
select v.title, v.content, v.content_type, v.cefr_level, v.difficulty, v.skill::reading_skill, v.question,
  v.option_a, v.option_b, v.option_c, v.option_d, v.correct_option, v.explanation, v.active
from (values
  (
    'Gym Hours',
    'The fitness center opens at 7:00 AM on weekdays and closes at 9:00 PM. Weekend hours are 9:00 AM to 6:00 PM.',
    'NOTICE', 'A2', 3::numeric, 'DETAIL',
    'When does the gym close on weekdays?',
    '6:00 PM', '7:00 PM', '9:00 PM', '10:00 PM',
    'C', 'Weekday closing time is 9:00 PM.', true
  ),
  (
    'Bus Route Change',
    'Route 12 will skip Oak Street until March due to road work. Use Pine Avenue stop instead.',
    'NOTICE', 'B1', 4::numeric, 'INFERENCE',
    'What should riders do during the road work?',
    'Stop using Route 12', 'Use the Pine Avenue stop', 'Wait on Oak Street', 'Travel only on weekends',
    'B', 'The notice directs riders to Pine Avenue.', true
  ),
  (
    'Office Hours Email',
    'Professor Lee will hold office hours on Tuesday from 2:00 to 4:00 PM in Room 305. No appointment is needed.',
    'EMAIL', 'B1', 4::numeric, 'DETAIL',
    'When can students visit Professor Lee without an appointment?',
    'Monday morning', 'Tuesday afternoon', 'Wednesday evening', 'Friday at noon',
    'B', 'Office hours are Tuesday 2:00–4:00 PM.', true
  ),
  (
    'Parking Reminder',
    'Visitor parking is limited to two hours. Vehicles without a permit may be ticketed after that time.',
    'NOTICE', 'B1', 5::numeric, 'MAIN_IDEA',
    'What is the main point of this notice?',
    'Permits are free for visitors', 'Visitor parking has a time limit', 'Tickets are never issued', 'Parking is unlimited',
    'B', 'The notice warns that visitor parking is limited to two hours.', true
  ),
  (
    'Store Receipt',
    'Thank you for your purchase. Items may be returned within 14 days with receipt. Sale items are final.',
    'DOCUMENT', 'B1', 4::numeric, 'DETAIL',
    'Which items cannot be returned?',
    'All items', 'Items bought with a receipt', 'Sale items', 'Items returned within 14 days',
    'C', 'The receipt states sale items are final.', true
  ),
  (
    'Weather Alert',
    'Heavy rain is expected this afternoon. Outdoor activities may be moved indoors. Check your email for updates.',
    'NOTICE', 'A2', 3::numeric, 'INFERENCE',
    'What might happen to outdoor activities?',
    'They will be canceled permanently', 'They may move indoors', 'They will start earlier', 'They require payment',
    'B', 'The alert says activities may move indoors.', true
  ),
  (
    'Apartment Notice',
    'Water will be shut off on Saturday from 8:00 AM to 12:00 PM for pipe repairs. Please store water if needed.',
    'NOTICE', 'B1', 4::numeric, 'DETAIL',
    'How long will the water be off?',
    'Two hours', 'Four hours', 'Six hours', 'All day',
    'B', 'Shutoff runs from 8:00 AM to 12:00 PM (four hours).', true
  ),
  (
    'Job Posting',
    'Campus bookstore seeks part-time help. Shifts are evenings and weekends. Apply in person with a resume.',
    'DOCUMENT', 'B1', 5::numeric, 'DETAIL',
    'How should applicants apply?',
    'By phone only', 'In person with a resume', 'Through social media', 'By mailing a form',
    'B', 'Applicants should apply in person with a resume.', true
  ),
  (
    'Train Schedule',
    'The 8:15 express to Central Station is delayed 20 minutes because of signal repairs.',
    'NOTICE', 'A2', 3::numeric, 'DETAIL',
    'Why is the train delayed?',
    'Weather', 'Signal repairs', 'Staff shortage', 'Holiday schedule',
    'B', 'The notice cites signal repairs.', true
  ),
  (
    'Club Meeting Email',
    'Photography club meets Thursday at 5:30 PM in the art building. New members are welcome.',
    'EMAIL', 'A2', 3::numeric, 'DETAIL',
    'Where does the club meet?',
    'Library basement', 'Art building', 'Student center', 'Gym',
    'B', 'Meetings are in the art building.', true
  )
) as v(title, content, content_type, cefr_level, difficulty, skill, question, option_a, option_b, option_c, option_d, correct_option, explanation, active)
where not exists (
  select 1 from public.daily_life_questions d where d.title = v.title and d.question = v.question
);
