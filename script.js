import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase credentials
const supabaseUrl = "https://tvkoamtxxmmqpvsotjda.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2a29hbXR4eG1tcXB2c290amRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTkwNjYsImV4cCI6MjA2MzEzNTA2Nn0.cr2MXxUXh0RgYnThkDY3Qfn2FofP4YwPKNkTovwruSo";
const supabase = createClient(supabaseUrl, supabaseKey);

// Element references
const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authMessage = document.getElementById("authMessage");
const authContainer = document.getElementById("authContainer");
const mainContainer = document.getElementById("mainContainer");

const form = document.getElementById("form");
const balanceDisplay = document.getElementById("balance");
const transactionList = document.getElementById("transactionList");
const filterCategory = document.getElementById("filterCategory");
const amountInput = document.getElementById("amount");

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
      data,
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

  if (!desc || isNaN(amount) || amount <= 0 || category === "Semua") {
    authMessage.textContent = "Isi semua kolom dengan benar!";
    return;
  }

  const transaction = { description: desc, amount, type, category, user_id: currentUser.id };
  const { data, error } = await supabase.from("transactions").insert([transaction]).select();

  if (error) {
    console.error("Insert error:", error.message);
    return;
  }

  transactions.unshift(data[0]);
  balance += type === "income" ? amount : -amount;

  form.reset();
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

  if (error) {
    console.error("Load error:", error.message);
    return;
  }

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
  const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
  if (error) {
    console.error("Delete error:", error.message);
    return;
  }

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

amountInput.addEventListener("input", (e) => {
  let value = e.target.value.replace(/\D/g, "");
  if (!value) {
    e.target.value = "";
    return;
  }
  e.target.value = parseInt(value).toLocaleString("id-ID");
});

// Auth form event
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Coba daftar jika login gagal
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      authMessage.textContent = "Gagal login atau daftar.";
      return;
    } else {
      currentUser = signUp.data.user;
      showMainApp();
      return;
    }
  }

  currentUser = data.user;
  showMainApp();
});

function showMainApp() {
  authContainer.style.display = "none";
  mainContainer.style.display = "block";
  loadTransactions();
}

// Cek session saat halaman dimuat
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    showMainApp();
  }
})();

// Form transaksi
form.addEventListener("submit", addTransaction);
filterCategory.addEventListener("change", filterTransactions);
