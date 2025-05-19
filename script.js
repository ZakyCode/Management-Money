import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://tvkoamtxxmmqpvsotjda.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2a29hbXR4eG1tcXB2c290amRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTkwNjYsImV4cCI6MjA2MzEzNTA2Nn0.cr2MXxUXh0RgYnThkDY3Qfn2FofP4YwPKNkTovwruSo"; // Ganti dengan key asli Anda
const supabase = createClient(supabaseUrl, supabaseKey);

const authContainer = document.getElementById("authContainer");
const mainContainer = document.getElementById("mainContainer");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");

const balanceDisplay = document.getElementById("balance");
const transactionList = document.getElementById("transactionList");
const filterCategory = document.getElementById("filterCategory");

let balance = 0;
let transactions = [];
let chart;
let currentUser = null;

function formatRupiah(number) {
  return "Rp " + number.toLocaleString("id-ID");
}

function updateBalanceDisplay() {
  balanceDisplay.textContent = formatRupiah(balance);
}

function updateChart() {
  const incomeTotal = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);

  const data = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      label: "Jumlah",
      data: [incomeTotal, expenseTotal],
      backgroundColor: ["green", "red"]
    }]
  };

  if (chart) {
    chart.data = data;
    chart.update();
  } else {
    const ctx = document.getElementById("myChart").getContext("2d");
    chart = new Chart(ctx, {
      type: "bar",
      data: data,
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function renderTransactions(filteredList = transactions) {
  transactionList.innerHTML = "";
  filteredList.forEach((tx, index) => {
    const li = document.createElement("li");
    li.classList.add(tx.type);
    li.innerHTML = `
      ${tx.description} - ${tx.category} - ${formatRupiah(tx.amount)}
      <button onclick="deleteTransaction(${index})">Hapus</button>
    `;
    transactionList.appendChild(li);
  });
}

async function addTransaction(e) {
  e.preventDefault();

  const desc = document.getElementById("desc").value.trim();
  const rawAmount = document.getElementById("amount").value.replace(/\./g, "");
  const amount = parseFloat(rawAmount);
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;

  if (!desc || isNaN(amount) || amount <= 0 || category === "Semua") return;

  const transaction = {
    description: desc,
    amount,
    type,
    category,
    user_id: currentUser.id
  };

  const { data, error } = await supabase.from("transactions").insert([transaction]).select();
  if (error) return;

  transactions.unshift(data[0]);
  balance += type === "income" ? amount : -amount;

  document.getElementById("form").reset();
  updateBalanceDisplay();
  renderTransactions();
  updateChart();
}

async function loadTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) return;

  transactions = data;
  balance = 0;
  transactions.forEach(t => {
    balance += t.type === "income" ? t.amount : -t.amount;
  });

  updateBalanceDisplay();
  renderTransactions();
  updateChart();
}

async function deleteTransaction(index) {
  const tx = transactions[index];
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", tx.id)
    .eq("user_id", currentUser.id);

  if (error) return;

  balance += tx.type === "income" ? -tx.amount : tx.amount;
  transactions.splice(index, 1);
  updateBalanceDisplay();
  renderTransactions();
  updateChart();
}

window.deleteTransaction = deleteTransaction;

function filterTransactions() {
  const selected = filterCategory.value;
  if (selected === "Semua") {
    renderTransactions();
  } else {
    const filtered = transactions.filter(t => t.category === selected);
    renderTransactions(filtered);
  }
}

// Format input jumlah otomatis
const amountInput = document.getElementById("amount");
amountInput.addEventListener("input", (e) => {
  let value = e.target.value.replace(/\D/g, "");
  e.target.value = value ? parseInt(value).toLocaleString("id-ID") : "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    // Jika gagal login, coba daftar
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signupError) {
      authMessage.textContent = "Gagal login/daftar: " + signupError.message;
    } else {
      authMessage.textContent = "Berhasil daftar. Silakan periksa email Anda untuk verifikasi.";
    }
    return;
  }

  // Berhasil login
  currentUser = data.user;
  authContainer.style.display = "none";
  mainContainer.style.display = "block";
  await loadTransactions();
});

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    authContainer.style.display = "none";
    mainContainer.style.display = "block";
    await loadTransactions();
  }
})();

// Event
document.getElementById("form")?.addEventListener("submit", addTransaction);
filterCategory?.addEventListener("change", filterTransactions);
