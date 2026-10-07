# School Database Design

This database keeps track of which students are taking which courses, and the grade each student earned. It has three tables: `students`, `courses` and `enrolments`.

## The tables

### `students`

One row per student.

- `student_id` is the primary key. SQLite numbers it automatically.
- `name` is required (`NOT NULL`).
- `email` is required and `UNIQUE`, so two students can never share an email address.

### `courses`

One row per course.

- `course_id` is the primary key.
- `title` is required.
- `credits` is required and must be greater than zero.

### `enrolments`

One row each time a student signs up for a course. This is the join table.

- `enrolment_id` is the primary key.
- `student_id` is a foreign key pointing to `students`.
- `course_id` is a foreign key pointing to `courses`.
- `grade` is optional. It stays empty (`NULL`) until the course has been marked.
- A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **One-to-many: students to enrolments.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **One-to-many: courses to enrolments.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **Many-to-many: students to courses.** Put the two one-to-many links together and a student can take many courses, while a course can have many students.

### Why a join table is needed

A relational table cannot hold a list in one cell. If `students` had a `courses` column, we would have to cram "Web Development, Database Systems" into a single value. That makes searching, counting and updating messy. If `courses` had a `student_id` column, each course could only have one student.

The `enrolments` table solves this by turning the many-to-many relationship into two simple one-to-many ones. It also has a natural home for information that belongs to the *pair* rather than to either side, which is the grade. A grade is not a fact about a student or about a course. It is a fact about one student on one course.

## An index I would add

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

**Reason:** the `UNIQUE (student_id, course_id)` rule already creates an index that makes it fast to find all courses for a student. But finding all students on a course, or counting students per course, searches by `course_id` alone, and that index cannot help with it. Without a separate index, the database would have to read every row of `enrolments`. With a few rows that does not matter, but with a school's worth of enrolments it would slow down those queries.

## SQL or NoSQL?

I would choose SQL for this system. School data is made of clearly connected records (students, courses and enrolments) and the connections matter: a grade must belong to a real student and a real course, an email must be unique, and nobody should be enrolled twice. A relational database enforces these rules itself through foreign keys, `UNIQUE` and `NOT NULL`, so mistakes are rejected before they reach the data. Questions like "how many students are on each course?" or "who has no enrolments?" are also exactly what SQL joins and `GROUP BY` are made for. The structure is stable and well understood, so we do not need the flexible, schema-free documents that NoSQL is best at. NoSQL would make more sense for something like a huge stream of activity logs or a feed of posts with very different shapes, where the data does not fit neatly into tables.
