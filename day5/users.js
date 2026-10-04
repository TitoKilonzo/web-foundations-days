// User Directory - Day 5

const USERS_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const usersList = document.getElementById("users-list");

// Every user we have downloaded. The filter works on this array,
// so typing in the box never triggers another request.
let users = [];

// Draw any array of users. An empty array means nothing matched.
function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.appendChild(message);
    return;
  }

  for (const user of list) {
    const item = document.createElement("li");
    item.className = "user-card";

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  }
}

// Show only users whose name contains the typed text (any case).
function applyFilter() {
  const term = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) => user.name.toLowerCase().includes(term));

  renderUsers(matches);
  statusEl.textContent = `Showing ${matches.length} of ${users.length} users.`;
}

async function loadUsers() {
  loadButton.disabled = true;
  statusEl.textContent = "Loading users...";

  try {
    const response = await fetch(USERS_URL);

    if (!response.ok) {
      throw new Error(`the server answered with status ${response.status}`);
    }

    users = await response.json();
    applyFilter();
    statusEl.textContent = `Loaded ${users.length} users successfully.`;
  } catch (error) {
    statusEl.textContent = `Sorry, we could not load the users: ${error.message}. Please try again.`;
  } finally {
    // Runs whether the request worked or failed.
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", applyFilter);
