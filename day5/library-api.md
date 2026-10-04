# Library API Design: Books

A REST API for a library's books resource. All paths start with `/api`, and every request and response body uses JSON.

## The Book resource

A book looks like this:

```json
{
  "id": 7,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "978-0385474542",
  "year": 1958,
  "available": true
}
```

- `id` is created by the server, so clients never send it.
- `title` and `author` are required when creating a book.
- `available` is `true` when the book is on the shelf and `false` when it is on loan.

## Endpoints

### 1. List all books

- Method: `GET`
- Path: `/api/books`
- Description: Returns every book in the library.
- Request body: none
- Success status: `200 OK`

### 2. Get one book

- Method: `GET`
- Path: `/api/books/{id}` (for example `/api/books/7`)
- Description: Returns the single book with that id.
- Request body: none
- Success status: `200 OK`

### 3. Create a book

- Method: `POST`
- Path: `/api/books`
- Description: Adds a new book and returns it with its new `id`.
- Example request body:

```json
{
  "title": "Weep Not, Child",
  "author": "Ngũgĩ wa Thiong'o",
  "isbn": "978-0435908300",
  "year": 1964
}
```

- Success status: `201 Created`

### 4. Update a book

- Method: `PUT`
- Path: `/api/books/{id}`
- Description: Replaces the details of an existing book.
- Example request body:

```json
{
  "title": "Weep Not, Child",
  "author": "Ngũgĩ wa Thiong'o",
  "isbn": "978-0435908300",
  "year": 1964,
  "available": false
}
```

- Success status: `200 OK`

### 5. Delete a book

- Method: `DELETE`
- Path: `/api/books/{id}`
- Description: Removes a book from the library.
- Request body: none
- Success status: `204 No Content` (nothing is returned)

### 6. List books by an author

- Method: `GET`
- Path: `/api/books?author=Chinua%20Achebe`
- Description: Returns only the books written by the author given in the `author` query parameter.
- Request body: none
- Success status: `200 OK` (an empty list `[]` if the author has no books)

## Summary table

| # | Method | Path | Success status |
|---|--------|------|----------------|
| 1 | GET | `/api/books` | 200 |
| 2 | GET | `/api/books/{id}` | 200 |
| 3 | POST | `/api/books` | 201 |
| 4 | PUT | `/api/books/{id}` | 200 |
| 5 | DELETE | `/api/books/{id}` | 204 |
| 6 | GET | `/api/books?author=...` | 200 |

## Error codes

### 400 Bad Request

The request is badly formed or breaks a rule, so the server cannot process it.

- Example: A client sends `POST /api/books` with no `title`, or with `"year": "last year"` instead of a number.
- Example response body:

```json
{
  "error": "Bad Request",
  "message": "The field 'title' is required."
}
```

### 404 Not Found

The request is fine, but the book it points to does not exist.

- Example: A client sends `GET /api/books/9999`, but no book has the id 9999. The same happens for `PUT` or `DELETE` on a missing id.
- Example response body:

```json
{
  "error": "Not Found",
  "message": "No book found with id 9999."
}
```
