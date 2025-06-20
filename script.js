// Supabase module import (gunakan ES Module via CDN)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase credentials
const supabaseUrl = "https://tvkoamtxxmmqpvsotjda.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2a29hbXR4eG1tcXB2c290amRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NTkwNjYsImV4cCI6MjA2MzEzNTA2Nn0.cr2MXxUXh0RgYnThkDY3Qfn2FofP4YwPKNkTovwruSo";
const supabase = createClient(supabaseUrl, supabaseKey);

let balance = 0;
let transactions = [];
let chart;

// DOM Elements
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const balanceDisplay = document.getElementById("balance");
const transactionList = document.getElementById("transactionList");
const filterCategory = document.getElementById("filterCategory");

// Fungsi utilitas
function formatRupiah(number) {
  return "Rp " + number.toLocaleString("id-ID");
}

function updateBalanceDisplay() {
  balanceDisplay.textContent = formatRupiah(balance);
}

async function showAlert(icon, title, text) {
  await Swal.fire({
    icon,
    title,
    text
  });
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

// Fungsi transaksi
async function addTransaction(e) {
  e.preventDefault();

  const desc = document.getElementById("desc").value.trim();
  const rawAmount = document.getElementById("amount").value.replace(/\./g, "");
  const amount = parseFloat(rawAmount);
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;

  if (!desc || isNaN(amount) || amount <= 0 || category === "Semua") {
    await showAlert('error', 'Error', 'Isi semua kolom dengan benar!');
    return;
  }

  // Dapatkan user ID dari sesi
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await showAlert('error', 'Error', 'Silakan login kembali');
    return;
  }

  const transaction = { 
    description: desc, 
    amount, 
    type, 
    category,
    user_id: user.id 
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select();

  if (error) {
    await showAlert('error', 'Error', 'Gagal menambahkan transaksi: ' + error.message);
    return;
  }

  transactions.unshift(data[0]);
  balance += type === "income" ? amount : -amount;

  document.getElementById("desc").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("type").value = "Jenis";
  document.getElementById("category").value = "Semua";
  document.getElementById("filterCategory").value = "kategori";

  updateBalanceDisplay();
  renderTransactions();
  updateChart();

  await Swal.fire({
    icon: 'success',
    title: 'Berhasil',
    text: 'Transaksi berhasil ditambahkan',
    timer: 1500,
    showConfirmButton: false
  });
}

async function loadTransactions() {
  // Dapatkan user ID dari sesi
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    await showAlert('error', 'Error', 'Gagal memuat transaksi: ' + error.message);
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
  
  const result = await Swal.fire({
    title: 'Apakah Anda yakin?',
    text: `Anda akan menghapus transaksi "${tx.description}"`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Ya, hapus!',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", tx.id);

  if (error) {
    await showAlert('error', 'Error', 'Gagal menghapus transaksi: ' + error.message);
    return;
  }

  balance += tx.type === "income" ? -tx.amount : tx.amount;
  transactions.splice(index, 1);
  updateBalanceDisplay();
  renderTransactions();
  updateChart();

  await Swal.fire({
    icon: 'success',
    title: 'Berhasil',
    text: 'Transaksi berhasil dihapus',
    timer: 1500,
    showConfirmButton: false
  });
}

// Fungsi autentikasi
async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    await showAlert('error', 'Error', 'Email dan password harus diisi');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    await showAlert('error', 'Login Gagal', 'akun tidak terdaftar di database!');
    return;
  }

  showApp();
}

async function handleRegister() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    await showAlert('error', 'Error', 'Email dan password harus diisi');
    return;
  }

  if (password.length < 6) {
    await showAlert('error', 'Error', 'Password minimal 6 karakter');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    await showAlert('error', 'Registrasi Gagal', error.message);
    return;
  }

  await Swal.fire({
    icon: 'success',
    title: 'Registrasi Berhasil!',
    html: 'Tolong cek email yang dimasukkan tadi dan silakan login',
    confirmButtonText: 'OK'
  });
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    await showAlert('error', 'Error', 'Gagal logout: ' + error.message);
    return;
  }

  showAuth();
}

function showApp() {
  authContainer.style.display = "none";
  appContainer.style.display = "block";
  loadTransactions();
}

function showAuth() {
  authContainer.style.display = "block";
  appContainer.style.display = "none";
  transactions = [];
  balance = 0;
  updateBalanceDisplay();
  renderTransactions();
}

// Cek sesi saat pertama kali load
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    showApp();
  } else {
    showAuth();
  }
}

// Format input jumlah otomatis dengan titik ribuan
const amountInput = document.getElementById("amount");
amountInput.addEventListener("input", (e) => {
  let value = e.target.value.replace(/\D/g, "");
  if (!value) {
    e.target.value = "";
    return;
  }
  e.target.value = parseInt(value).toLocaleString("id-ID");
});

// Event listener
checkSession();
document.getElementById("form").addEventListener("submit", addTransaction);
document.getElementById("filterCategory").addEventListener("change", filterTransactions);
loginBtn.addEventListener("click", handleLogin);
registerBtn.addEventListener("click", handleRegister);
logoutBtn.addEventListener("click", handleLogout);

// Fungsi global untuk delete
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
