# Reflection

## The most difficult concept

The hardest idea for me was asynchronous JavaScript: `fetch`, `async / await` and `try / catch / finally`. Code that does not run top to bottom in order was confusing, and my first attempts either showed nothing or left the button disabled forever after an error. I overcame it by following the advice from the course: I predicted what would happen before each run, read the error messages slowly, and broke things on purpose, such as using a wrong URL to see the error path. Once I put the cleanup in `finally`, and showed a loading, success and error message for every request, the order of events finally made sense.

## What I would improve in my capstone

The part I would improve most is the architecture document for QuickNotes. Feedback made me realise that my diagram showed the components well, but I explained too little about what happens when something fails, such as the cache going down or a replica falling behind. I would add more detail on security (rate limiting and token expiry) and on monitoring, so that the team would know when the system is in trouble. In TicketHub I tried to apply this lesson by writing down the failure cases and the safety nets, such as the database constraint that stops a seat being sold twice.

## What I will learn next

Next I want to build a real backend, not only a client. I will learn Node.js and Express, then connect them to a SQL database so I can turn my API and data model designs into working code. After that I want to learn authentication properly, and how to test and deploy an application so that others can use it.
