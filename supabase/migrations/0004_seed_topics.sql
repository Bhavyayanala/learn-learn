-- LearnNest — Stage 2: seed subjects + topic catalog
-- Grade 3 & Grade 4: Mathematics, Science, English
-- This is starter data so the lesson planner has something real to
-- distribute across a teacher's classes. A teacher can add more via the
-- app later (or an AI material-analysis step, once wired up in a future
-- stage, can propose additions here).

insert into public.subjects (name) values
  ('Mathematics'), ('Science'), ('English')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- MATHEMATICS — Grade 4
-- ---------------------------------------------------------------------
insert into public.topics (subject_id, grade, sequence_order, name, learning_objective, is_foundational, suggested_activities)
select s.id, 'Class 4', t.seq, t.name, t.objective, t.foundational, t.activities
from public.subjects s
cross join (values
  (1, 'Numbers and Place Value', 'Understand place value up to 6 digits', true, 'Place value chart, expanded-form practice'),
  (2, 'Addition', 'Solve multi-digit addition with carrying', true, 'Warm-up drill, whiteboard walkthrough, practice sheet'),
  (3, 'Subtraction', 'Solve subtraction with borrowing', true, 'Number-line game, paired practice'),
  (4, 'Multiplication', 'Understand multiplication and solve 2-digit problems', true, 'Times-table race, multiplication grid'),
  (5, 'Division', 'Solve simple division with remainders', true, 'Sharing/grouping activity, quiz'),
  (6, 'Fractions', 'Identify and compare simple fractions', false, 'Fraction pizza game, visual fraction strips'),
  (7, 'Measurement', 'Measure length, weight, and capacity in standard units', false, 'Hands-on measuring station'),
  (8, 'Time', 'Read analog and digital clocks; calculate elapsed time', false, 'Clock-face practice, story problems'),
  (9, 'Shapes and Geometry', 'Identify 2D/3D shapes and their properties', false, 'Shape hunt, geometry match game'),
  (10, 'Data Handling', 'Read and interpret simple bar graphs and tables', false, 'Class survey + graph building'),
  (11, 'Word Problems', 'Apply the four operations to real-world word problems', false, 'Mixed word-problem set'),
  (12, 'Revision and Assessment', 'Consolidate the month''s topics and assess understanding', false, 'Full revision + monthly test')
) as t(seq, name, objective, foundational, activities)
where s.name = 'Mathematics'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- MATHEMATICS — Grade 3 (lighter version of the same progression)
-- ---------------------------------------------------------------------
insert into public.topics (subject_id, grade, sequence_order, name, learning_objective, is_foundational, suggested_activities)
select s.id, 'Class 3', t.seq, t.name, t.objective, t.foundational, t.activities
from public.subjects s
cross join (values
  (1, 'Numbers up to 1000', 'Understand place value up to 4 digits', true, 'Place value blocks'),
  (2, 'Addition without Carrying', 'Add 2-digit and 3-digit numbers', true, 'Practice sheet, whiteboard demo'),
  (3, 'Addition with Carrying', 'Add numbers requiring carrying', true, 'Carrying trick game'),
  (4, 'Subtraction', 'Subtract 2-digit and 3-digit numbers', true, 'Number-line subtraction'),
  (5, 'Introduction to Multiplication', 'Understand multiplication as repeated addition', true, 'Grouping objects, times-table intro'),
  (6, 'Introduction to Division', 'Understand division as equal sharing', true, 'Sharing activity'),
  (7, 'Shapes', 'Identify basic 2D shapes and their properties', false, 'Shape sorting game'),
  (8, 'Measurement Basics', 'Measure length and weight informally and in standard units', false, 'Measuring station'),
  (9, 'Time Basics', 'Read time to the hour and half-hour', false, 'Clock practice'),
  (10, 'Money', 'Identify coins/notes and solve simple money problems', false, 'Play-money shop game'),
  (11, 'Patterns', 'Identify and extend simple number and shape patterns', false, 'Pattern-block activity'),
  (12, 'Revision and Assessment', 'Consolidate the month''s topics and assess understanding', false, 'Full revision + monthly test')
) as t(seq, name, objective, foundational, activities)
where s.name = 'Mathematics'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- SCIENCE — Grade 4
-- ---------------------------------------------------------------------
insert into public.topics (subject_id, grade, sequence_order, name, learning_objective, is_foundational, suggested_activities)
select s.id, 'Class 4', t.seq, t.name, t.objective, t.foundational, t.activities
from public.subjects s
cross join (values
  (1, 'Living and Non-Living Things', 'Classify things as living or non-living with reasons', true, 'Living vs Non-Living sorting game'),
  (2, 'Plant Life', 'Understand parts of a plant and their functions', true, 'Plant Doctor game, labeling diagram'),
  (3, 'Animal Habitats', 'Match animals to their natural habitats', false, 'Animal Habitat Match game'),
  (4, 'Human Body', 'Identify major organs and their basic functions', true, 'Human Body Puzzle'),
  (5, 'Food and Nutrition', 'Understand food groups and a balanced diet', false, 'Food chain activity'),
  (6, 'Food Chains', 'Construct simple food chains', false, 'Food Chain Game'),
  (7, 'Water Cycle', 'Explain the stages of the water cycle', false, 'Water cycle diagram activity'),
  (8, 'Weather and Seasons', 'Describe weather patterns and seasonal changes', false, 'Weather journal activity'),
  (9, 'Matter and Materials', 'Classify materials by properties (solid/liquid/gas)', false, 'Material sorting station'),
  (10, 'Simple Machines', 'Identify simple machines and their everyday uses', false, 'Simple machines scavenger hunt'),
  (11, 'The Solar System', 'Name and order the planets in the solar system', false, 'Solar System Explorer game'),
  (12, 'Revision and Assessment', 'Consolidate the month''s topics and assess understanding', false, 'Full revision + monthly test')
) as t(seq, name, objective, foundational, activities)
where s.name = 'Science'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- ENGLISH — Grade 4
-- ---------------------------------------------------------------------
insert into public.topics (subject_id, grade, sequence_order, name, learning_objective, is_foundational, suggested_activities)
select s.id, 'Class 4', t.seq, t.name, t.objective, t.foundational, t.activities
from public.subjects s
cross join (values
  (1, 'Reading Comprehension Basics', 'Read a short passage and answer questions', true, 'Story Adventure reading activity'),
  (2, 'Nouns and Pronouns', 'Identify and use nouns and pronouns correctly', true, 'Grammar Detective game'),
  (3, 'Verbs and Tenses', 'Use present, past, and future tense correctly', true, 'Sentence Builder game'),
  (4, 'Adjectives', 'Identify and use descriptive adjectives', false, 'Word Builder game'),
  (5, 'Sentence Structure', 'Construct grammatically correct simple sentences', true, 'Sentence Builder practice'),
  (6, 'Punctuation', 'Apply capitalization and basic punctuation correctly', false, 'Punctuation fix-it worksheet'),
  (7, 'Vocabulary Building', 'Learn and use new grade-level vocabulary', false, 'Vocabulary Match game'),
  (8, 'Spelling', 'Spell grade-level words correctly', false, 'Spelling Challenge game'),
  (9, 'Story Writing', 'Write a short story with a beginning, middle, and end', false, 'Guided story-writing activity'),
  (10, 'Letter Writing', 'Write a simple informal letter', false, 'Letter-writing template activity'),
  (11, 'Poetry Appreciation', 'Read and understand a simple poem', false, 'Poem reading + discussion'),
  (12, 'Revision and Assessment', 'Consolidate the month''s topics and assess understanding', false, 'Full revision + monthly test')
) as t(seq, name, objective, foundational, activities)
where s.name = 'English'
on conflict do nothing;
