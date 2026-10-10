# TicketHub: System Design

TicketHub is a website that sells tickets for concerts and events. On most days it is quiet. A few times a year a very popular concert goes on sale and the whole country shows up in the same ten minutes. This document designs a system for both situations, and it explains exactly how two people can never end up holding the same seat.

The design follows the six-part framework: requirements, estimates, API, data model, architecture and trade-offs.

---

## 1. Requirements

### Functional requirements

- Users can register, log in and see their profile.
- Users can browse and search events by name, date, city and category.
- Users can open an event and see its seat map, with each seat shown as available, held or sold.
- Users can **hold** one or more seats for a short time while they pay.
- Users can pay for their held seats and receive their tickets.
- Users can see all the tickets they have bought.
- If a user does not pay in time, their seats are released for others.
- Staff can create events and set their seats and prices.

### Non-functional requirements

- **Correctness (the most important one):** a seat must never be sold twice, and a person who is charged must always get a ticket. Being slightly slow is acceptable. Being wrong is not.
- **Speed:** browsing pages should load in under 1 second, and holding a seat should answer in under 500 ms, even during a big sale.
- **Fairness:** during a big sale, people should get a fair chance, so first come, first served, with limits on bots and on how many tickets one person can buy (for example 4).
- **Availability:** the site must stay up during a big sale, because a crash on sale day is the worst possible outcome. We aim for 99.9% availability overall.
- **Scalability:** the system must handle a sudden jump of hundreds of times the normal traffic without a redesign.
- **Durability:** a completed order must never be lost, even if a server dies.
- **Security:** passwords are hashed, all traffic uses HTTPS, and card details are handled by a payment provider so we never store them.

---

## 2. Estimates

### Assumptions

- 2,000,000 registered users.
- **Normal day:** 50,000 people visit, each viewing 10 pages, and 5,000 tickets are sold.
- **Big sale:** 200,000 people try to buy 20,000 seats within the first 10 minutes (600 seconds).
- Peak traffic on a normal day is 5× the average.
- In the big sale, each person makes about 20 requests in the 10 minutes (opening the event, refreshing the seat map, trying to hold seats, checking out), and about 3 hold attempts, because the first seats they click are often taken already.
- A day has 86,400 seconds.

### Normal traffic

| What | Calculation | Result |
|------|-------------|--------|
| Page views per day | 50,000 × 10 | 500,000 |
| Average page views per second | 500,000 ÷ 86,400 | about 6 |
| Peak page views per second (5×) | 6 × 5 | about 29 |
| Tickets sold per second (average) | 5,000 ÷ 86,400 | about 0.06 |
| Tickets sold per second (peak) | 0.06 × 5 | about 0.3 |
| Order data per year | 5,000 × 365 × about 1 KB | about 2 GB |

The normal load is tiny. One small server and a database could handle it.

### Big sale

| What | Calculation | Result |
|------|-------------|--------|
| People arriving per second | 200,000 ÷ 600 | about 333 |
| Total requests | 200,000 × 20 | 4,000,000 |
| Requests per second | 4,000,000 ÷ 600 | **about 6,700** |
| Hold attempts | 200,000 × 3 | 600,000 |
| Hold attempts per second (average) | 600,000 ÷ 600 | about 1,000 |
| Hold attempts per second (first 2 minutes, if 60% arrive then) | 360,000 ÷ 120 | **about 3,000** |
| Seats actually sold | all of them | 20,000 |
| Sales per second (average) | 20,000 ÷ 600 | about 33 |
| Sales per second (if 80% sell in the first 3 minutes) | 16,000 ÷ 180 | **about 90** |

### Comparison

- Requests per second in the big sale (about 6,700) are roughly **1,150×** the normal average and **230×** the normal peak.
- Sales per second (about 33, up to 90) are roughly **600×** the normal average.
- There are **10 buyers for every seat** (200,000 people for 20,000 seats), so about 90% of the people who try will fail. The system has to tell them "sold out" quickly and politely.
- The big sale is read-heavy and write-heavy at the same time, but the dangerous part is the writes: thousands of people fighting over a small set of rows at the same moment.

**Conclusion:** we cannot size the system for a normal day, and we should not run a huge system all year just for the few big sales. The design must therefore **absorb the spike** (by caching and queueing), **scale up for the event**, and **protect the database** with the most important code path being the seat hold.

---

## 3. API

All paths start with `/api/v1`. Bodies are JSON. Logged-in requests send `Authorization: Bearer <token>`.

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | GET | `/events` | Browse events (filters: `q`, `city`, `category`, `from`, `page`) | 200 OK |
| 2 | GET | `/events/{id}` | Details of one event | 200 OK |
| 3 | GET | `/events/{id}/seats` | The seat map with each seat's status | 200 OK |
| 4 | POST | `/events/{id}/holds` | Hold seats for a short time | 201 Created |
| 5 | DELETE | `/holds/{hold_id}` | Give up a hold and release the seats | 204 No Content |
| 6 | POST | `/orders` | Pay for a hold and create the order | 201 Created |
| 7 | GET | `/me/tickets` | List the logged-in user's tickets | 200 OK |
| 8 | POST | `/auth/login` | Log in and receive a token | 200 OK |

### Browse events: `GET /events?city=Nairobi&page=1`

```json
{
  "data": [
    {
      "id": 301,
      "name": "Sauti Sol Live",
      "venue": "Kasarani Stadium",
      "city": "Nairobi",
      "starts_at": "2026-12-12T17:00:00Z",
      "from_price": 1500,
      "sold_out": false
    }
  ],
  "page": 1,
  "total": 1
}
```

### View seats: `GET /events/301/seats?section=A`

```json
{
  "event_id": 301,
  "as_of": "2026-10-10T08:00:02Z",
  "seats": [
    { "id": 9001, "section": "A", "row": "1", "number": 1, "price": 5000, "status": "available" },
    { "id": 9002, "section": "A", "row": "1", "number": 2, "price": 5000, "status": "held" },
    { "id": 9003, "section": "A", "row": "1", "number": 3, "price": 5000, "status": "sold" }
  ]
}
```

This list can be a second or two old, because it is served from the cache. It is only a guide. The real decision is made when the user tries to hold the seat.

### Hold seats: `POST /events/301/holds`

Request (a user may hold up to 4 seats):

```json
{ "seat_ids": [9001, 9004] }
```

Response (`201 Created`):

```json
{
  "hold_id": "h_7f3a9c",
  "event_id": 301,
  "seat_ids": [9001, 9004],
  "expires_at": "2026-10-10T08:10:05Z",
  "total": 10000
}
```

If any seat was taken by someone else first, **nothing** is held and the answer is `409 Conflict` (see the error codes below).

### Pay: `POST /orders`

The header `Idempotency-Key: 5b1f...` is required, so that a double click or a retry can never charge the user twice.

```json
{
  "hold_id": "h_7f3a9c",
  "payment_method": "mpesa",
  "phone": "+254700000000"
}
```

Response (`201 Created`):

```json
{
  "order_id": 88001,
  "status": "paid",
  "total": 10000,
  "tickets": [
    { "ticket_id": 55001, "seat_id": 9001, "code": "TH-9F2K-71" },
    { "ticket_id": 55002, "seat_id": 9004, "code": "TH-9F2K-72" }
  ]
}
```

### My tickets: `GET /me/tickets`

```json
{
  "data": [
    {
      "ticket_id": 55001,
      "event": "Sauti Sol Live",
      "starts_at": "2026-12-12T17:00:00Z",
      "section": "A",
      "row": "1",
      "seat": 1,
      "code": "TH-9F2K-71"
    }
  ]
}
```

### Error codes

| Status | When it happens | Example body |
|--------|-----------------|--------------|
| 400 Bad Request | Bad input, such as no seats or more than 4. | `{"error": {"code": "TOO_MANY_SEATS", "message": "You can hold up to 4 seats."}}` |
| 401 Unauthorized | Not logged in, or the token expired. | `{"error": {"code": "UNAUTHENTICATED", "message": "Please log in."}}` |
| 404 Not Found | The event or hold does not exist. | `{"error": {"code": "NOT_FOUND", "message": "Event 999 not found."}}` |
| 409 Conflict | One of the seats was taken by someone else. | `{"error": {"code": "SEAT_TAKEN", "message": "Seat A-1-1 was just taken.", "seat_ids": [9001]}}` |
| 410 Gone | The hold ran out before payment. | `{"error": {"code": "HOLD_EXPIRED", "message": "Your 10 minutes are up. Please pick your seats again."}}` |
| 402 Payment Required | The payment failed. The hold stays until it expires. | `{"error": {"code": "PAYMENT_FAILED", "message": "The payment was not completed."}}` |
| 429 Too Many Requests | Too many requests, or the user is not yet allowed in from the waiting room. | `{"error": {"code": "WAIT_IN_LINE", "message": "You are in line.", "position": 4120}}` |
| 500 Internal Server Error | A fault on our side. | `{"error": {"code": "SERVER_ERROR", "message": "Please try again."}}` |

---

## 4. Data model

### Tables

**`users`**

| Column | Type | Rules |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |

**`events`**

| Column | Type | Rules |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | TEXT | NOT NULL |
| venue | TEXT | NOT NULL |
| city | TEXT | NOT NULL |
| starts_at | TEXT | NOT NULL |
| on_sale_at | TEXT | NOT NULL |

**`seats`** (one row per seat, per event)

| Column | Type | Rules |
|--------|------|-------|
| id | INTEGER | Primary key |
| event_id | INTEGER | Foreign key to `events(id)`, NOT NULL |
| section, row_label, seat_number | TEXT / TEXT / INTEGER | NOT NULL, and the three together with `event_id` are UNIQUE |
| price | INTEGER | NOT NULL |
| status | TEXT | `available`, `held` or `sold` |
| held_by | INTEGER | Foreign key to `users(id)`, empty unless held |
| held_until | TEXT | When the hold ends, empty unless held |

**`orders`**

| Column | Type | Rules |
|--------|------|-------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users(id)`, NOT NULL |
| event_id | INTEGER | Foreign key to `events(id)`, NOT NULL |
| total | INTEGER | NOT NULL |
| status | TEXT | `paid`, `failed` or `refunded` |
| idempotency_key | TEXT | NOT NULL, UNIQUE |
| payment_ref | TEXT | The payment provider's reference |
| created_at | TEXT | NOT NULL |

**`tickets`** (one row per seat sold)

| Column | Type | Rules |
|--------|------|-------|
| id | INTEGER | Primary key |
| order_id | INTEGER | Foreign key to `orders(id)`, NOT NULL |
| seat_id | INTEGER | Foreign key to `seats(id)`, NOT NULL, **UNIQUE** |
| code | TEXT | NOT NULL, UNIQUE, the code scanned at the gate |

### Relationships

- **users to orders: one-to-many.** A user can place many orders, and each order has one user.
- **events to seats: one-to-many.** An event has thousands of seats, and each seat belongs to one event.
- **orders to tickets: one-to-many.** An order can contain up to 4 tickets, and each ticket belongs to one order.
- **seats to tickets: one-to-one.** A seat can have **at most one** ticket (this is enforced by the `UNIQUE` on `tickets.seat_id`, and it is the final safety net against double-booking).
- **users to seats (a hold): one-to-many.** A user can hold several seats at once, through `seats.held_by`.
- **users to events: many-to-many**, through orders and tickets. A user can attend many events, and an event has many buyers.

### CREATE TABLE statements (SQLite, runs as it is)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  city       TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  on_sale_at TEXT NOT NULL
);

CREATE TABLE seats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES events (id),
  section     TEXT NOT NULL,
  row_label   TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  price       INTEGER NOT NULL CHECK (price >= 0),
  status      TEXT NOT NULL DEFAULT 'available'
              CHECK (status IN ('available', 'held', 'sold')),
  held_by     INTEGER REFERENCES users (id),
  held_until  TEXT,
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users (id),
  event_id        INTEGER NOT NULL REFERENCES events (id),
  total           INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payment_ref     TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders (id),
  seat_id  INTEGER NOT NULL UNIQUE REFERENCES seats (id),
  code     TEXT NOT NULL UNIQUE
);

-- Speeds up the seat map for one event, and the "release expired holds" job.
CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_orders_user ON orders (user_id);
```

---

## 5. How the design prevents two people buying the same seat

This is the most important part of the design. Two people clicking the same seat at the same moment is not a rare accident during a big sale, it is the normal case: with 10 buyers per seat it happens thousands of times. The design protects against it with **three layers**, so that even a bug in one layer cannot cause a double sale.

### Layer 1: one atomic "hold" statement (the gate)

A hold is **one SQL statement** that checks and changes the seat at the same time:

```sql
UPDATE seats
SET status = 'held', held_by = :user_id, held_until = :now_plus_10_minutes
WHERE id = :seat_id
  AND event_id = :event_id
  AND (status = 'available'
       OR (status = 'held' AND held_until < :now));
```

The app then looks at the **number of rows changed**:

- **1 row changed:** you got the seat.
- **0 rows changed:** someone else got there first, so the app answers `409 SEAT_TAKEN`.

The key is that the check ("is it free?") and the change ("make it mine") happen in a single step. We never do the unsafe version, which is to read the seat, see "available", and then write "held" in a separate step. With the unsafe version, two people could both read "available" before either writes. With the single `UPDATE`, the database locks the seat's row while it works, so the second person's statement waits for the first to finish and then sees `status = 'held'`, and changes nothing.

When a user holds several seats, all the `UPDATE`s run inside **one transaction**. If any seat fails, the transaction is rolled back and none of the seats are held, so nobody is left with half an order.

### Layer 2: a transaction when paying

When the payment succeeds, one transaction does all of this together:

1. Check that every seat is still `held` by **this user** and the hold has not expired.
2. Set the seats to `sold`.
3. Insert the order.
4. Insert one ticket per seat.
5. Commit.

If any step fails, everything is rolled back, so we never end up with a paid order and no ticket, or a ticket with no order. A user who pays after their hold expired and whose seat was taken by someone else gets an automatic refund, rather than a seat that is sold twice.

### Layer 3: a database constraint (the safety net)

`tickets.seat_id` is **UNIQUE**. Even if there were a bug in the code above, or two servers made a mistake at the same time, the database would **refuse** to create a second ticket for the same seat, and the second transaction would fail and roll back. This is the last line of defence, and it does not depend on our code being perfect.

### What stops it going wrong in other ways

- **Holds expire.** A hold lasts 10 minutes. A background worker also releases expired holds every minute, and the hold statement itself can take an expired hold, so abandoned seats do not stay stuck.
- **Retries are safe.** `POST /orders` needs an `Idempotency-Key`, which is stored with a `UNIQUE` rule, so a double click or a network retry cannot create two orders or charge twice.
- **The cache is only a guide.** The seat map shown to users may be a second old. It is never used to decide a sale. Only the atomic statements above, running on the primary database, decide.
- **Fairness limits.** At most 4 seats per user per event, rate limits per user and per IP, and a waiting room (below) stop bots from grabbing everything.

### Proof that it works

I tested this in SQLite. 50 separate connections tried to hold the same seat at the same moment, and exactly **one** succeeded and 49 got zero rows changed. A deliberate attempt to insert a second ticket for the same seat was rejected by the `UNIQUE` constraint.

---

## 6. Architecture

### Diagram

```text
                       +-----------------------------+
                       |  CLIENT (browser / app)     |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |  DNS                        |
                       +--------------+--------------+
                                      |
                                      v
   static pages, images,    +-----------------------------+
   event details,       <-- |  CDN                        |
   waiting-room page        |  (+ bot / rate protection)  |
                            +--------------+--------------+
                                           | only requests the CDN cannot answer
                                           v
                       +-----------------------------+
                       |  WAITING ROOM (virtual      |  lets in only as many
                       |  queue, first come first    |  shoppers as the system
                       |  served)                    |  can handle
                       +--------------+--------------+
                                      | admitted shoppers
                                      v
                       +-----------------------------+
                       |  LOAD BALANCER (2, health   |
                       |  checks)                    |
                       +------+-------------+--------+
                              |             |
                 +------------+             +------------+
                 v                                       v
       +------------------+                    +------------------+
       | APP SERVER 1     |      ...           | APP SERVER N     |  autoscaled
       | (stateless)      |                    | (stateless)      |  before big sales
       +---+----+----+----+                    +---+----+----+----+
           |    |    |                             |    |    |
     +-----+    |    +------+                +-----+    |    +------+
     |          |           |                |          |           |
     v          v           v                v          v           v
+---------+ +-----------------+ +---------------+
| CACHE   | | PRIMARY DB      | | MESSAGE QUEUE |
| (seat   | | (seats, holds,  | | (emails,      |
|  map,   | |  orders: ALL    | |  expired      |
|  events)| |  writes)        | |  holds,       |
+---------+ +-------+---------+ |  payments)    |
                    |           +-------+-------+
          copies    |                   |
          changes   v                   v
            +----------------+   +--------------+     +-------------------+
            | READ REPLICAS  |   | WORKERS      | --> | PAYMENT PROVIDER  |
            | (browsing,     |   | (tickets by  |     | (M-Pesa / cards)  |
            |  my tickets)   |   |  email, etc.)|     +-------------------+
            +----------------+   +--------------+
```

### What each component does

- **Client:** the browser or phone app where people browse events, pick seats and pay.
- **DNS:** it turns `tickethub.example` into the address of our servers, and can send people to a healthy region if one fails.
- **CDN:** it serves the event pages, images and the waiting-room page from servers near the user, so most of the 200,000 people never touch our own servers at all.
- **Bot and rate protection:** it blocks obvious bots and limits requests per person, so real fans get a fair chance and the sale is not swallowed by scripts.
- **Waiting room:** it lets people into the buying pages only as fast as the system can safely handle (for example 2,000 shoppers at a time), in the order they arrived, so the database is never hit by 200,000 people at once.
- **Load balancer:** it spreads the admitted shoppers evenly across the app servers and removes any server that fails its health check.
- **App servers:** they run the TicketHub logic (browsing, holds, orders), and because they are stateless we can add many more of them before a big sale and remove them afterwards.
- **Cache:** it holds event details and the seat map for a second or two, so thousands of people refreshing the seat map do not each cause a database query.
- **Primary database:** it is the single source of truth, and the only place where seats are held and sold, so the atomic statements and constraints in section 5 work in one place.
- **Read replicas:** they answer the non-critical reads (browsing events, "my tickets"), which keeps the primary free for the hold and purchase writes.
- **Message queue:** it takes slow jobs (sending tickets by email, releasing expired holds, confirming payments) so that buying a ticket does not have to wait for them.
- **Workers:** they do the queued jobs in the background, and a failed job is retried, so nobody loses their ticket email.
- **Payment provider:** it takes the money, so card and phone-payment details never touch our servers, and it tells us the result so we can finish the order.

### How it survives the big sale

1. **Before the sale:** the event page and seat layout are already in the CDN, we add extra app servers, the cache is warmed, and the waiting room opens early so people can join the line before the sale starts.
2. **At the start:** 200,000 people arrive in 10 minutes (about 333 a second). The CDN and waiting room absorb them with no database work, and the app servers see only the admitted shoppers (a few thousand requests per second at most, instead of the whole crowd).
3. **While shopping:** the seat map comes from the cache, so refreshing is cheap. Only the hold and pay actions reach the primary database, and those are small, quick, single-row operations (about 90 sales per second at most).
4. **If something is slow:** the queue means emails and clean-up never block a sale, and the rate limits keep one user from taking too much.
5. **When seats run out:** the system returns "sold out" straight from the cache and the waiting room, so the 180,000 people who did not get a ticket do not keep hammering the database. Released holds (from people who did not pay in time) put a few seats back on sale.
6. **If a server dies:** the load balancer stops sending it traffic, and the others carry on. If the primary database dies, a replica is promoted to take its place.
7. **After the sale:** we scale back down to save money.

---

## 7. Trade-offs

### Trade-off 1: Waiting room (fairness and safety) vs convenience

A waiting room protects the system and gives everyone an orderly place in line, but it makes the experience slower, because fans who are used to clicking "buy" now have to wait, and an admitted person could still lose to someone further ahead. We accept this because the alternative is a crash for everyone, and a clear queue position feels fairer than a website that simply fails. The line also stops being a race of who has the fastest connection.

### Trade-off 2: A stale seat map (speed) vs showing every seat exactly right

The cached seat map can be a second or two old, so a user may click a seat that has just gone, and get a "seat taken" message. In return, thousands of people can refresh the map without overloading the database. This is safe because the seat map never decides a sale: the atomic hold statement does. The cost is only a small annoyance, so the app shows a friendly message and highlights the seats that are still free.

### Trade-off 3: Length of the hold (fairness to buyers vs fairness to others)

A 10-minute hold gives people time to pay with M-Pesa or a card, but while the seat is held nobody else can buy it, and bots or slow payers can block seats they never buy. A shorter hold frees seats faster but rushes real customers and causes failed payments. We choose 10 minutes, limit each person to 4 seats and let expired holds be taken straight away.

### Trade-off 4: One primary database (correctness) vs unlimited write scaling

Keeping all seat changes in one primary database makes the "one seat, one buyer" rules simple and reliable, because the locks and constraints all live in one place. The cost is that writes cannot be spread over many machines. At about 90 successful sales and a few thousand hold attempts per second, a single well-sized primary can cope. If a much bigger event ever needed more, we would split data by event (sharding), so each event's seats live on one database and the rules still hold within it.

### Trade-off 5: Strong correctness vs speed on the buying path

Doing the hold and the purchase as database transactions is slower than only using a fast in-memory counter. We accept the extra milliseconds on those two steps, because the whole reputation of the business depends on never selling the same seat twice and never charging someone without giving them a ticket. All the speed tricks (CDN, cache, waiting room, queue) are applied *around* the buying path, not inside it.

---

## Summary

- **Normal day:** about 6 page views per second, a trivial load.
- **Big sale:** about 6,700 requests per second, 1,000 to 3,000 hold attempts per second and up to 90 sales per second, which is hundreds of times more.
- **Double-booking is prevented by three layers:** an atomic conditional `UPDATE` for holds, a single transaction for purchases, and a `UNIQUE` constraint on `tickets.seat_id` as the final safety net.
- **The big sale is survived** by a CDN, a waiting room, a cache, autoscaled stateless app servers, a protected primary database, and a queue with workers for slow jobs.
