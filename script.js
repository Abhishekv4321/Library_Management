const API_BASE = "http://localhost:3000/api";

let currentUser = null;
let currentRole = null;
let selectedBook = null;
let lastLoanId = null;

// ===== Helpers =====
function show(id) {
    document.querySelectorAll(".page").forEach(p => p.style.display = "none");
    document.getElementById(id).style.display = "block";
}

function switchPage(id) {
    show(id);
}

function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.innerText = msg || "";
}

function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
}

// ===== Login / Logout =====
function login() {
    const name = document.getElementById("loginName").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const role = document.getElementById("loginRole").value;

    let ok = true;
    if (!name) { setError("errLoginName", "Name required"); ok = false; } else setError("errLoginName", "");
    if (!pass) { setError("errLoginPass", "Password required"); ok = false; } else setError("errLoginPass", "");
    if (!ok) return;

    // simple frontend login
    currentUser = name;
    currentRole = role;

    document.getElementById("welcomeTitle").innerText =
        `Welcome ${name} (${role.toUpperCase()})`;

    document.getElementById("adminOnly").style.display = role === "admin" ? "block" : "none";

    show("menuPage");
}

function logout() {
    currentUser = null;
    currentRole = null;
    location.reload();
}

// ===== Book Search =====
async function searchBooks() {
    const name = document.getElementById("searchName").value.trim();
    const category = document.getElementById("searchCategory").value;

    if (!name && !category) {
        setError("errSearchMain", "Enter book name or select category");
        return;
    }
    setError("errSearchMain", "");

    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (category) params.append("category", category);

    const res = await fetch(`${API_BASE}/books?` + params.toString());
    const data = await res.json();

    const table = document.getElementById("searchResults");
    table.innerHTML = "";
    const header = `<tr>
      <th>Name</th><th>Author</th><th>Serial</th><th>Select</th>
    </tr>`;
    table.insertAdjacentHTML("beforeend", header);

    if (!data.length) {
        table.insertAdjacentHTML("beforeend",
            `<tr><td colspan="4">No books found</td></tr>`);
        return;
    }

    data.forEach(b => {
        const row = `<tr>
          <td>${b.name}</td>
          <td>${b.author}</td>
          <td>${b.serial_no}</td>
          <td><input type="radio" name="bookSelect" value="${b.id}"
               onchange='selectBook(${JSON.stringify(b.id)})'></td>
        </tr>`;
        table.insertAdjacentHTML("beforeend", row);
    });
}

async function selectBook(id) {
    // API se already aaye data list me, simple approach:
    // re-fetch by id (for simplicity) ya search result se dhoondh sakte ho.
    // Yaha hum search results se hi object nikal lenge:
    const rows = Array.from(document.querySelectorAll("#searchResults tr"))
        .slice(1); // skip header
    let chosen = null;
    rows.forEach(r => {
        const radio = r.querySelector("input[type=radio]");
        if (radio && Number(radio.value) === id) {
            const cells = r.querySelectorAll("td");
            chosen = {
                id,
                name: cells[0].innerText,
                author: cells[1].innerText,
                serial_no: cells[2].innerText
            };
        }
    });
    selectedBook = chosen;

    if (selectedBook) {
        document.getElementById("issueBookName").value = selectedBook.name;
        document.getElementById("issueAuthor").value = selectedBook.author;

        const today = new Date();
        const issueStr = today.toISOString().split("T")[0];
        document.getElementById("issueDate").value = issueStr;

        const due = new Date();
        due.setDate(due.getDate() + 15);
        document.getElementById("issueReturnDate").value = due.toISOString().split("T")[0];
    }
}

// ===== Issue Book =====
async function confirmIssue() {
    setError("errIssueBook", "");
    setError("errIssueDate", "");
    setError("errReturnDate", "");
    document.getElementById("msgIssue").innerText = "";

    if (!selectedBook) {
        setError("errIssueBook", "Select a book first in Book Available");
        return;
    }

    const bookName = document.getElementById("issueBookName").value.trim();
    const issueDateStr = document.getElementById("issueDate").value;
    const returnDateStr = document.getElementById("issueReturnDate").value;

    let ok = true;

    if (!bookName) {
        setError("errIssueBook", "Book name required");
        ok = false;
    }

    if (!issueDateStr) {
        setError("errIssueDate", "Issue date required");
        ok = false;
    } else {
        const todayStr = new Date().toISOString().split("T")[0];
        if (issueDateStr < todayStr) {
            setError("errIssueDate", "Issue date cannot be before today");
            ok = false;
        }
    }

    if (!returnDateStr) {
        setError("errReturnDate", "Return date required");
        ok = false;
    } else if (issueDateStr) {
        const issueDate = new Date(issueDateStr);
        const retDate = new Date(returnDateStr);
        const maxDate = new Date(issueDateStr);
        maxDate.setDate(maxDate.getDate() + 15);

        if (retDate < issueDate || retDate > maxDate) {
            setError("errReturnDate",
                "Return date must be between issue date and 15 days ahead");
            ok = false;
        }
    }

    if (!ok) return;

    // send to backend
    const res = await fetch(`${API_BASE}/loans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            book_id: selectedBook.id,
            member_name: null,
            issued_by: currentUser,
            issue_date: issueDateStr,
            due_date: returnDateStr
        })
    });
    const data = await res.json();
    if (data.error) {
        alert("Issue failed: " + data.error);
        return;
    }

    lastLoanId = data.id;
    alert("Book issued. Loan ID = " + data.id);
    document.getElementById("msgIssue").innerText = "Book issued successfully.";
}

// ===== Return Book =====
async function processReturn() {
    setError("errRetActual", "");
    document.getElementById("msgReturn").innerText = "";
    document.getElementById("msgFine").innerText = "";
    setError("errFine", "");

    const loanId = Number(document.getElementById("retLoanId").value);
    const actualDateStr = document.getElementById("retActualDate").value;

    if (!loanId) {
        alert("Loan ID required (use id from issue popup)");
        return;
    }
    if (!actualDateStr) {
        setError("errRetActual", "Actual return date required");
        return;
    }

    const res = await fetch(`${API_BASE}/loans/${loanId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_return_date: actualDateStr })
    });
    const data = await res.json();
    if (data.error) {
        alert("Return failed: " + data.error);
        return;
    }

    lastLoanId = loanId;

    document.getElementById("fineLoanId").value = loanId;
    document.getElementById("fineBookName").value = data.book ? data.book.name : "";
    document.getElementById("fineAmount").value = data.fine || 0;
    document.getElementById("bookPrice").value = 0;
    document.getElementById("totalAmount").value = data.fine || 0;
    document.getElementById("finePaidChk").checked = false;

    document.getElementById("msgReturn").innerText =
        "Return processed. Go to Fine Pay.";

    show("finePay");
}

// ===== Fine / Payment =====
async function confirmFine() {
    setError("errFine", "");
    document.getElementById("msgFine").innerText = "";

    const loanId = Number(document.getElementById("fineLoanId").value || lastLoanId);
    const fine = Number(document.getElementById("fineAmount").value) || 0;
    const price = Number(document.getElementById("bookPrice").value) || 0;
    const total = fine + price;
    document.getElementById("totalAmount").value = total;

    const paid = document.getElementById("finePaidChk").checked;
    if (total > 0 && !paid) {
        setError("errFine", "Payment pending, tick 'Payment Received'");
        return;
    }

    const res = await fetch(`${API_BASE}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            loan_id: loanId,
            fine_amount: fine,
            price_amount: price,
            paid_by: currentUser
        })
    });
    const data = await res.json();
    if (data.error) {
        alert("Payment failed: " + data.error);
        return;
    }

    document.getElementById("msgFine").innerText =
        "Payment successful. Total: ₹" + data.total;

    await loadTransactions(); // admin report
}

// ===== Transactions admin =====
async function loadTransactions() {
    const res = await fetch(`${API_BASE}/payments`);
    const data = await res.json();

    const table = document.getElementById("txTable");
    table.innerHTML = "";
    const header = `<tr>
      <th>#</th><th>Date</th><th>Book</th><th>Fine</th>
      <th>Price</th><th>Total</th><th>User</th>
    </tr>`;
    table.insertAdjacentHTML("beforeend", header);

    if (!data.length) {
        table.insertAdjacentHTML("beforeend",
          `<tr><td colspan="7">No transactions</td></tr>`);
        return;
    }

    data.forEach((t, i) => {
        const row = `<tr>
          <td>${i + 1}</td>
          <td>${new Date(t.paid_on).toLocaleString()}</td>
          <td>${t.book_name}</td>
          <td>${t.fine_amount}</td>
          <td>${t.price_amount}</td>
          <td>${t.amount}</td>
          <td>${t.paid_by || ""}</td>
        </tr>`;
        table.insertAdjacentHTML("beforeend", row);
    });
}

async function openTransactions() {
    await loadTransactions();
    show("transactions");
}

// ===== Membership =====
async function addMembership() {
    setError("errMemName", "");
    setError("errMemStart", "");
    setError("errMemDur", "");
    document.getElementById("msgMemAdd").innerText = "";

    const name = document.getElementById("memName").value.trim();
    const start = document.getElementById("memStartDate").value;
    const dur = getRadioValue("memDur");

    let ok = true;
    if (!name) { setError("errMemName", "Name required"); ok = false; }
    if (!start) { setError("errMemStart", "Start date required"); ok = false; }
    if (!dur) { setError("errMemDur", "Duration required"); ok = false; }

    if (!ok) return;

    const res = await fetch(`${API_BASE}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            member_name: name,
            start_date: start,
            duration_months: dur
        })
    });
    const data = await res.json();
    if (data.error) {
        alert("Membership failed: " + data.error);
        return;
    }

    document.getElementById("msgMemAdd").innerText =
        "Membership created. Number: " + data.membership_no;
}

async function updateMembership() {
    setError("errUpdMemNo", "");
    setError("errUpdAction", "");
    document.getElementById("msgMemUpd").innerText = "";

    const no = document.getElementById("updMemNo").value.trim();
    const action = getRadioValue("updAction");

    let ok = true;
    if (!no) { setError("errUpdMemNo", "Membership no required"); ok = false; }
    if (!action) { setError("errUpdAction", "Action required"); ok = false; }

    if (!ok) return;

    const res = await fetch(`${API_BASE}/memberships/${no}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.error) {
        alert("Update failed: " + data.error);
        return;
    }

    document.getElementById("msgMemUpd").innerText = "Membership updated.";
}

// ===== Add / Update Book =====
async function addBook() {
    setError("errAddBookName", "");
    setError("errAddBookAuthor", "");
    setError("errAddBookSerial", "");
    document.getElementById("msgAddBook").innerText = "";

    const name = document.getElementById("addBookName").value.trim();
    const author = document.getElementById("addBookAuthor").value.trim();
    const serial = document.getElementById("addBookSerial").value.trim();
    const category = document.getElementById("addBookCategory").value.trim();
    const price = Number(document.getElementById("addBookPrice").value) || 0;

    let ok = true;
    if (!name) { setError("errAddBookName", "Name required"); ok = false; }
    if (!author) { setError("errAddBookAuthor", "Author required"); ok = false; }
    if (!serial) { setError("errAddBookSerial", "Serial required"); ok = false; }

    if (!ok) return;

    const res = await fetch(`${API_BASE}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, author, serial_no: serial, category, price })
    });
    const data = await res.json();
    if (data.error) {
        alert("Add book failed: " + data.error);
        return;
    }

    document.getElementById("msgAddBook").innerText = "Book saved.";
}

async function updateBook() {
    setError("errUpdBookSerial", "");
    setError("errUpdBookName", "");
    setError("errUpdBookAuthor", "");
    document.getElementById("msgUpdBook").innerText = "";

    const serial = document.getElementById("updBookSerial").value.trim();
    const name = document.getElementById("updBookName").value.trim();
    const author = document.getElementById("updBookAuthor").value.trim();
    const category = document.getElementById("updBookCategory").value.trim();
    const price = Number(document.getElementById("updBookPrice").value) || 0;

    let ok = true;
    if (!serial) { setError("errUpdBookSerial", "Serial required"); ok = false; }
    if (!name) { setError("errUpdBookName", "Name required"); ok = false; }
    if (!author) { setError("errUpdBookAuthor", "Author required"); ok = false; }

    if (!ok) return;

    const res = await fetch(`${API_BASE}/books/serial/${encodeURIComponent(serial)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, author, category, price })
    });
    const data = await res.json();
    if (data.error) {
        alert("Update book failed: " + data.error);
        return;
    }

    document.getElementById("msgUpdBook").innerText = "Book updated.";
}

// ===== User Management =====
async function saveUser() {
    setError("errUserName", "");
    setError("errUserPass", "");
    document.getElementById("msgUserMgmt").innerText = "";

    const name = document.getElementById("userMgmtName").value.trim();
    const pass = document.getElementById("userMgmtPass").value.trim();
    const role = document.getElementById("userMgmtRole").value;

    let ok = true;
    if (!name) { setError("errUserName", "Name required"); ok = false; }
    if (!pass) { setError("errUserPass", "Password required"); ok = false; }

    if (!ok) return;

    const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: pass, role })
    });
    const data = await res.json();
    if (data.error) {
        alert("User save failed: " + data.error);
        return;
    }

    document.getElementById("msgUserMgmt").innerText = data.message || "User saved.";
}
