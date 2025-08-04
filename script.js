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
const forgotPasswordLink = document.getElementById("forgot-password-link");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const balanceDisplay = document.getElementById("balance");
const transactionList = document.getElementById("transactionList");
const filterCategory = document.getElementById("filterCategory");
const deleteAllBtn = document.getElementById("deleteAllBtn");

// ==============================================
// FUNGSI UTILITAS
// ==============================================

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

// ==============================================
// FUNGSI TRANSAKSI
// ==============================================

async function addTransaction(e) {
  e.preventDefault();

  const desc = document.getElementById("desc").value.trim();
  const rawAmount = document.getElementById("amount").value.replace(/\./g, "");
  const amount = parseFloat(rawAmount);
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;

  if (!desc || isNaN(amount) || amount <= 0 || type === "Jenis" || category === "Semua") {
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

  updateBalanceDisplay();
  filterTransactions();
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
  updateChart();
  
  // Reset filter dropdown
  filterCategory.value = "";
  deleteAllBtn.style.display = "none";
  transactionList.innerHTML = "";
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
  filterTransactions();
  updateChart();

  await Swal.fire({
    icon: 'success',
    title: 'Berhasil',
    text: 'Transaksi berhasil dihapus',
    timer: 1500,
    showConfirmButton: false
  });
}

async function deleteAllFilteredTransactions() {
  const selectedCategory = filterCategory.value;
  
  if (!selectedCategory) {
    await showAlert('error', 'Error', 'Pilih kategori terlebih dahulu');
    return;
  }

  const result = await Swal.fire({
    title: 'Apakah Anda yakin?',
    html: `Anda akan menghapus <strong>semua transaksi</strong> ${selectedCategory === 'Semua' ? '' : 'dengan kategori ' + selectedCategory}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Ya, hapus semua!',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  // Dapatkan user ID dari sesi
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await showAlert('error', 'Error', 'Silakan login kembali');
    return;
  }

  try {
    let query = supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id);

    // Jika bukan "Semua", tambahkan filter kategori
    if (selectedCategory !== 'Semua') {
      query = query.eq('category', selectedCategory);
    }

    const { error } = await query;

    if (error) throw error;

    // Perbarui tampilan
    await loadTransactions();
    updateChart();

    await Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: `Semua transaksi ${selectedCategory === 'Semua' ? '' : 'kategori ' + selectedCategory} berhasil dihapus`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (error) {
    await showAlert('error', 'Error', 'Gagal menghapus transaksi: ' + error.message);
  }
}

function toggleDeleteAllButton() {
  const selected = filterCategory.value;
  deleteAllBtn.style.display = selected ? 'block' : 'none';
}

// ==============================================
// FUNGSI AUTENTIKASI
// ==============================================

async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    await showAlert('error', 'Error', 'Email dan password harus diisi');
    return;
  }

  try {
    // Tampilkan loading
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    showApp();
  } catch (error) {
    await showAlert('error', 'Login Gagal', 'Akun tidak terdaftar atau password salah!');
  } finally {
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
  }
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

  try {
    // Tampilkan loading
    registerBtn.disabled = true;
    registerBtn.classList.add('loading');

    // Cek apakah email sudah terdaftar menggunakan RPC
    const { data: emailRegistered, error: checkError } = await supabase
      .rpc('is_email_registered', { email_text: email });

    if (checkError) throw checkError;
    
    if (emailRegistered) {
      await showAlert('error', 'Pendaftaran Gagal', 'Email sudah terdaftar! Silakan login atau gunakan email lain');
      return;
    }

    // Lanjutkan pendaftaran jika email belum terdaftar
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          email: email
        }
      }
    });

    if (error) throw error;

    await Swal.fire({
      icon: 'success',
      title: 'Registrasi Berhasil!',
      html: 'Tolong cek email Anda untuk verifikasi dan silakan login',
      confirmButtonText: 'OK'
    });
  } catch (error) {
    await showAlert('error', 'Registrasi Gagal', error.message || 'Terjadi kesalahan saat mendaftar');
  } finally {
    registerBtn.disabled = false;
    registerBtn.classList.remove('loading');
  }
}

async function handleForgotPassword() {
  const { value: email } = await Swal.fire({
    title: 'Reset Password',
    input: 'email',
    inputLabel: 'Masukkan email Anda yang terdaftar',
    inputPlaceholder: 'contoh@email.com',
    inputAttributes: {
      required: 'required'
    },
    showCancelButton: true,
    confirmButtonText: 'Kirim Link Reset',
    cancelButtonText: 'Batal',
    inputValidator: (value) => {
      if (!value) {
        return 'Harap masukkan email Anda!';
      }
      if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value)) {
        return 'Format email tidak valid!';
      }
    }
  });

  if (!email) return;

  try {
    // Tampilkan loading
    Swal.fire({
      title: 'Mengirim email...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href
    });

    if (error) throw error;

    await Swal.fire({
      icon: 'success',
      title: 'Email Terkirim!',
      html: `Kami telah mengirim link reset password ke <strong>${email}</strong>.<br><br>Silakan cek inbox email Anda.`,
      confirmButtonText: 'Mengerti'
    });
  } catch (error) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal Mengirim Email',
      text: error.message || 'Terjadi kesalahan saat mengirim email reset password',
      confirmButtonText: 'OK'
    });
  }
}

async function handlePasswordReset() {
  // Cek parameter URL untuk reset password
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const type = urlParams.get('type');

  // Jika ini adalah callback reset password
  if (type === 'recovery' && accessToken && refreshToken) {
    try {
      // Tampilkan form reset password
      const { value: formValues } = await Swal.fire({
        title: 'Atur Password Baru',
        html:
          '<input id="swal-input1" class="swal2-input" type="password" placeholder="Password Baru" required>' +
          '<input id="swal-input2" class="swal2-input" type="password" placeholder="Konfirmasi Password" required>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan Password',
        cancelButtonText: 'Batal',
        preConfirm: () => {
          const password = document.getElementById('swal-input1').value;
          const confirmPassword = document.getElementById('swal-input2').value;
          
          if (!password || !confirmPassword) {
            Swal.showValidationMessage('Harap isi kedua kolom password');
            return false;
          }
          
          if (password.length < 6) {
            Swal.showValidationMessage('Password minimal 6 karakter');
            return false;
          }
          
          if (password !== confirmPassword) {
            Swal.showValidationMessage('Password tidak cocok');
            return false;
          }
          
          return { password };
        }
      });

      if (!formValues) return;

      // Tampilkan loading
      Swal.fire({
        title: 'Menyimpan password...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // 1. Update password menggunakan token
      const { error: updateError } = await supabase.auth.updateUser({
        password: formValues.password
      }, {
        accessToken,
        refreshToken
      });

      if (updateError) throw updateError;

      // 2. Logout pengguna setelah reset password
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;

      // 3. Bersihkan URL dari parameter reset
      window.history.replaceState({}, document.title, window.location.pathname);

      // 4. Tampilkan pesan sukses
      await Swal.fire({
        icon: 'success',
        title: 'Password Berhasil Diubah!',
        html: 'Silakan login dengan password baru Anda',
        confirmButtonText: 'Ke Halaman Login'
      });

      // 5. Pastikan tampilkan halaman auth
      showAuth();

    } catch (error) {
      console.error('Error resetting password:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Gagal Reset Password',
        text: error.message || 'Terjadi kesalahan saat menyimpan password baru',
        confirmButtonText: 'OK'
      });
    }
  }
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    await showAlert('error', 'Error', 'Gagal logout: ' + error.message);
    return;
  }

  showAuth();
}

// ==============================================
// FUNGSI TAMPILAN
// ==============================================

function showApp() {
  authContainer.style.display = "none";
  appContainer.style.display = "block";
  loadTransactions();
}

function showAuth() {
  authContainer.style.display = "block";
  appContainer.style.display = "none";
  emailInput.value = "";
  passwordInput.value = "";
  transactions = [];
  balance = 0;
  updateBalanceDisplay();
  transactionList.innerHTML = "";
}

function filterTransactions() {
  const selected = filterCategory.value;
  if (!selected) {
    transactionList.innerHTML = "";
    return;
  }
  
  if (selected === "Semua") {
    renderTransactions();
  } else {
    const filtered = transactions.filter(t => t.category === selected);
    renderTransactions(filtered);
  }
}

function setupPasswordToggle() {
  const passwordInput = document.getElementById('auth-password');
  const togglePassword = document.querySelector('.toggle-password');
  
  if (passwordInput && togglePassword) {
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const icon = this.querySelector('i');
      icon.classList.toggle('fa-eye');
      icon.classList.toggle('fa-eye-slash');
    });
  }
}

// ==============================================
// EVENT LISTENERS
// ==============================================

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

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  setupPasswordToggle();
  
  // Event listeners untuk form
  document.getElementById("form").addEventListener("submit", addTransaction);
  filterCategory.addEventListener("change", () => {
    filterTransactions();
    toggleDeleteAllButton();
  });
  
  // Event listeners untuk autentikasi
  loginBtn.addEventListener("click", handleLogin);
  registerBtn.addEventListener("click", handleRegister);
  logoutBtn.addEventListener("click", handleLogout);
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    handleForgotPassword();
  });
  deleteAllBtn.addEventListener("click", deleteAllFilteredTransactions);
  
  // Cek reset password saat load
  handlePasswordReset();
});

// ==============================================
// FUNGSI GLOBAL & INISIALISASI
// ==============================================

// Fungsi global untuk delete
window.deleteTransaction = deleteTransaction;

// Cek sesi saat pertama kali load
async function checkSession() {
  // Cek dulu apakah ini callback reset password
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  
  if (type === 'recovery') {
    // Jangan tampilkan app jika dalam proses reset password
    showAuth();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    showApp();
  } else {
    showAuth();
  }
}
