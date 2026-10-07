-- =====================================================================
-- School Database - Day 6
-- Runs in SQLite (for example on sqliteonline.com).
-- =====================================================================

-- Turn on foreign key checking (SQLite leaves it off by default).
PRAGMA foreign_keys = ON;

-- Start clean so the script can be run again and again.
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title     TEXT NOT NULL,
  credits   INTEGER NOT NULL CHECK (credits > 0)
);

-- The join table: one row = one student enrolled on one course.
CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL,
  course_id    INTEGER NOT NULL,
  grade        TEXT,  -- stays NULL until the course is marked
  FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses (course_id)  ON DELETE CASCADE,
  -- A student cannot enrol on the same course twice.
  UNIQUE (student_id, course_id)
);

-- ---------------------------------------------------------------------
-- 2. Sample data
-- ---------------------------------------------------------------------

INSERT INTO students (name, email) VALUES
  ('Amina Wanjiru', 'amina.wanjiru@example.com'),
  ('Brian Otieno',  'brian.otieno@example.com'),
  ('Grace Mutua',   'grace.mutua@example.com'),
  ('David Kamau',   'david.kamau@example.com');   -- will have no enrolments

INSERT INTO courses (title, credits) VALUES
  ('Web Development',       4),
  ('Database Systems',      3),
  ('Introduction to Python', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B'),
  (2, 1, 'B'),
  (2, 3, NULL),
  (3, 2, 'A'),
  (3, 3, 'C');

-- ---------------------------------------------------------------------
-- 3. Queries
-- ---------------------------------------------------------------------

-- Query 1: All courses for one student (by name)
SELECT s.name AS student, c.title AS course, e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.student_id
JOIN courses c    ON c.course_id  = e.course_id
WHERE s.name = 'Amina Wanjiru';

-- Query 2: All students on one course
SELECT c.title AS course, s.name AS student, s.email
FROM courses c
JOIN enrolments e ON e.course_id  = c.course_id
JOIN students s   ON s.student_id = e.student_id
WHERE c.title = 'Web Development';

-- Query 3: The number of students per course
-- (LEFT JOIN so a course with no students still shows up, with 0)
SELECT c.title AS course, COUNT(e.enrolment_id) AS number_of_students
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.course_id
GROUP BY c.course_id, c.title
ORDER BY number_of_students DESC, c.title;

-- Query 4: Students who have no enrolments
SELECT s.student_id, s.name, s.email
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: Update one enrolment's grade
-- (Brian Otieno's Introduction to Python grade was still empty)
UPDATE enrolments
SET grade = 'B'
WHERE student_id = (SELECT student_id FROM students WHERE name = 'Brian Otieno')
  AND course_id  = (SELECT course_id FROM courses WHERE title = 'Introduction to Python');

-- Check the update worked
SELECT s.name AS student, c.title AS course, e.grade
FROM enrolments e
JOIN students s ON s.student_id = e.student_id
JOIN courses c  ON c.course_id  = e.course_id
WHERE s.name = 'Brian Otieno';
