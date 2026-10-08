# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from the people they follow. This plan works out how much traffic and storage the app needs to handle, then designs a system that can cope with it.

## 1. Assumptions

These come from the starting facts. Everything else is worked out from them.

- 10 million registered users.
- 10% of them are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB.
- Each photo also gets a 50 KB thumbnail.
- A day has 86,400 seconds.
- Peak traffic is 5× the average, because most people use the app in the evening rather than evenly through the day.
- To keep the maths simple, 1 MB = 1,000 KB and 1 TB = 1,000,000 MB.

**Daily active users (DAU):** 10,000,000 × 10% = **1,000,000 users per day**.

## 2. Estimates

### Uploads per second

- Uploads per day: 1,000,000 users × 1 photo = 1,000,000 photos.
- Average: 1,000,000 ÷ 86,400 ≈ **12 uploads per second**.
- Peak (5×): ≈ **58 uploads per second**.

### Feed views per second

- Feed views per day: 1,000,000 users × 50 pages = 50,000,000 views.
- Average: 50,000,000 ÷ 86,400 ≈ **580 views per second**.
- Peak (5×): ≈ **2,900 views per second**.

### Storage per year

| Item | Per photo | Per day (1M photos) | Per year (× 365) |
|---|---|---|---|
| Original photo | 2 MB | 2 TB | 730 TB |
| Thumbnail | 50 KB | 0.05 TB (50 GB) | 18.25 TB |
| **Total** | 2.05 MB | **2.05 TB** | **≈ 748 TB (about 0.75 PB)** |

The thumbnails add only about 2.5% on top of the originals, so the originals decide the storage bill. This does not yet count backups or extra copies for safety, which could double or triple the real figure.

### Summary

| What | Average | Peak (5×) |
|---|---|---|
| Uploads | 12 per second | 58 per second |
| Feed views | 580 per second | 2,900 per second |
| New storage | 2.05 TB per day | n/a |
| Storage per year | ≈ 748 TB | n/a |

## 3. Read-heavy or write-heavy?

**SnapShare is read-heavy.** For every upload there are 50 feed views, so reads outnumber writes by about **50 to 1**. In the estimates, that is 580 views per second against 12 uploads per second.

What this means for the design:

- **Make reads fast and cheap first.** Most of the work is serving feeds and photos, so that is where the money and effort should go.
- **Serve repeated requests without touching the database.** A cache and a CDN answer the most popular requests before they reach the database.
- **Spread the reads out.** A read replica of the database takes the feed queries off the main database.
- **Writes can be slower.** 12 uploads per second is a small load, so uploads can pass through a queue and be finished in the background without the user waiting.

## 4. Why photos should not live in the database

Photos should go into **object storage**, not the database, for these reasons:

- **They are huge.** At 748 TB per year, a database would grow enormous, and its backups, restores and replicas would become slow and expensive.
- **Databases are built for small, structured rows.** A photo is a big blob of bytes. It cannot be searched or joined, so there is nothing the database can do with it that a simple file store cannot.
- **They would clog the database.** Sending 2 MB photos through the database would use up its connections and memory, and slow down the small, important queries like "who does this user follow?".
- **Object storage is cheaper and scales almost without limit.** It is made for storing billions of files, keeps several copies automatically, and works directly with a CDN.

So the photo files go into object storage, and the database keeps only a small record for each photo: its id, owner, caption, upload time and the **URL** where the file lives.

## 5. Architecture diagram

```text
                           +-----------------+
                           |  Users (phones, |
                           |  browsers)      |
                           +--------+--------+
                                    |
                 +------------------+------------------+
                 |                                     |
                 | photo and thumbnail files           | API calls (feed, upload,
                 | (images)                            | follow, like)
                 v                                     v
        +-----------------+                   +-----------------+
        |       CDN       |                   |  LOAD BALANCER  |
        +--------+--------+                   +--------+--------+
                 |                                     |
                 | cache miss only                     +-----------+-----------+
                 |                                     |           |           |
                 |                                     v           v           v
                 |                              +-----------+ +-----------+ +-----------+
                 |                              | App       | | App       | | App       |
                 |                              | server 1  | | server 2  | | server N  |
                 |                              +-----+-----+ +-----+-----+ +-----+-----+
                 |                                    |             |             |
                 |             +----------------------+------+------+-------------+
                 |             |                      |             |
                 |             v                      v             v
                 |      +-------------+      +----------------+  +-----------------+
                 |      |    CACHE    |      |    DATABASE    |  |  MESSAGE QUEUE  |
                 |      | (hot feeds, |      |   (primary:    |  | "make thumbnail"|
                 |      |  sessions)  |      |    writes)     |  |      jobs       |
                 |      +-------------+      +-------+--------+  +--------+--------+
                 |                                   |                    |
                 |                         copies    |                    v
                 |                         changes   v           +-----------------+
                 |                           +----------------+  | THUMBNAIL       |
                 |                           |  READ REPLICA  |  | WORKER(S)       |
                 |                           |   (feed reads) |  +--------+--------+
                 |                           +----------------+           |
                 |                                                        | read original,
                 |                                                        | write thumbnail
                 v                                                        v
        +--------------------------------------------------------------------------+
        |                        OBJECT STORAGE (photo files)                      |
        |                originals (2 MB)   and   thumbnails (50 KB)               |
        +--------------------------------------------------------------------------+
```

How to read it: the **left path** carries image files from the CDN (and, on a miss, from object storage). The **right path** carries API requests through the load balancer to the app servers, which talk to the cache, the database and the queue.

## 6. What each component does

- **CDN:** it keeps copies of popular photos and thumbnails in servers close to users, so images load quickly and most of the heavy image traffic never reaches our own servers.
- **Load balancer:** it spreads incoming requests evenly across the app servers and stops sending traffic to any server that is down, so no single server is overwhelmed.
- **App servers:** they run the SnapShare code (building feeds, handling uploads and follows), and because they keep no data of their own, we can add more of them whenever traffic grows.
- **Cache:** it holds frequently needed results, such as a user's recent feed, in fast memory, so the database does not have to rebuild the same answer 580 times a second.
- **Database (primary):** it is the reliable home for users, follows and photo records, and it is the only place that accepts writes, which keeps the data consistent.
- **Read replica:** it is a live copy of the database that handles feed queries, so the heavy read traffic does not slow down the primary that takes the writes.
- **Object storage:** it stores the photo and thumbnail files cheaply and safely at huge scale, so the database stays small and fast.
- **Message queue:** it holds "make a thumbnail" jobs in order, so an upload can finish immediately even when many photos arrive at once.
- **Thumbnail worker:** it picks jobs off the queue and creates the small 50 KB version of each photo in the background, so users never wait for the resizing.

## 7. Upload flow, step by step

1. The user picks a photo and taps **Upload**. The app sends the file and a caption to SnapShare through the load balancer.
2. The **load balancer** passes the request to a healthy app server.
3. The **app server** checks that the user is logged in and that the file is a valid image of a sensible size.
4. The app server saves the original photo into **object storage** and gets back its file location.
5. The app server writes a new photo record (id, owner, caption, time and file URL) to the **primary database**, marking the thumbnail as "pending".
6. The app server puts a "create thumbnail for photo X" job on the **message queue**.
7. The app server replies to the user: **"Upload successful."** The user is done in a moment and does not wait for the thumbnail.
8. A **thumbnail worker** takes the job from the queue, downloads the original from object storage, and shrinks it to a 50 KB thumbnail.
9. The worker saves the thumbnail into **object storage** and updates the photo's record in the database from "pending" to "ready".
10. If the worker fails, the job goes back on the queue and is tried again, so the thumbnail is never lost.
11. The cached feeds of the user's followers are refreshed (or expire shortly), so the new photo appears in their feeds. Their apps load the thumbnail through the **CDN**, which copies it from object storage the first time and serves it from the edge after that.

## 8. Trade-offs

### Trade-off 1: Fast feeds vs fresh feeds (cache)

Caching feeds makes the app far quicker and protects the database, but a cached feed can be a little out of date. A follower might not see a new photo for a few seconds or minutes, until the cache is refreshed or expires. We accept this because nobody notices a delay of a few seconds on a photo feed, while a slow feed would drive users away. A short cache lifetime is a middle path: the shorter it is, the fresher the feed but the more work for the database.

### Trade-off 2: Read replica speed vs up-to-date data

The read replica copies changes from the primary with a small delay (replication lag). So a feed read from the replica may briefly miss something that was only just written. In return, the replica takes most of the read load, which protects the primary. For a photo feed this is fine. For things that must be exactly right, like checking a password change or a block, the app should read from the primary instead.

### Trade-off 3: Instant upload vs instant thumbnail (queue)

Because thumbnails are made by a background worker, the upload finishes very quickly, but the thumbnail is not ready for a second or two. During that time the feed may show a placeholder or the full photo. We accept this because a quick upload is a much better experience than making users wait for resizing, and the queue lets us handle bursts of 58 uploads per second without overloading anything.

### Trade-off 4: CDN cost vs speed

A CDN makes images load faster and removes most of the image traffic from our servers, but we pay for the data it delivers, and photos that were changed or deleted may stay visible at the edge until their cached copy expires. Given that images are the biggest part of our traffic, the speed and savings on our own servers are worth the cost.

## Quick recap

- About **1 million** daily users, **12 uploads per second** (58 at peak) and **580 feed views per second** (2,900 at peak).
- About **748 TB** of new photos and thumbnails every year.
- The system is **read-heavy** (about 50 reads for every write), so the design leans on a **CDN, a cache and a read replica**.
- Photo files go in **object storage**, and the database keeps only small records and URLs.
- A **queue and worker** handle thumbnails in the background so uploads stay quick.
