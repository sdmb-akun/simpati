// ============================================
// APP.JS
// SIMPATI - Sistem Informasi Pembayaran Terintegrasi
// SD Muhammadiyah Bekonang
// ============================================

// ==================== CONFIGURATION ====================
const CONFIG = {
    API_URL: "GOOGLE_APPS_SCRIPT_WEBAPP_URL" // Ganti dengan URL Google Apps Script Web App
};

// ==================== STATE MANAGEMENT ====================
const STATE = {
    token: null,
    user: null,
    currentPage: null,
    cache: {
        siswa: [],
        tagihanMaster: [],
        tagihanSiswa: [],
        transaksi: [],
        waTemplate: []
    }
};

// ==================== CACHE MODULE ====================
const CACHE_KEY = {
    SISWA: "simpatic_cache_siswa",
    TAGIHAN_MASTER: "simpatic_cache_tagihan_master",
    TAGIHAN_SISWA: "simpatic_cache_tagihan_siswa",
    TRANSAKSI: "simpatic_cache_transaksi",
    WA_TEMPLATE: "simpatic_cache_wa_template",
    DASHBOARD_ADMIN: "simpatic_cache_dashboard_admin",
    DASHBOARD_WALI: "simpatic_cache_dashboard_wali",
    PENGATURAN: "simpatic_cache_pengaturan",
    TIMESTAMPS: "simpatic_cache_timestamps"
};

const CACHE_DURATION = {
    SISWA: 30 * 60 * 1000,
    TAGIHAN_MASTER: 15 * 60 * 1000,
    TAGIHAN_SISWA: 10 * 60 * 1000,
    TRANSAKSI: 5 * 60 * 1000,
    WA_TEMPLATE: 30 * 60 * 1000,
    DASHBOARD: 3 * 60 * 1000,
    PENGATURAN: 30 * 60 * 1000
};

function cacheSet(key, data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (e) {
        clearExpiredCache();
    }
}

function cacheGet(key, duration) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        const now = Date.now();
        if (now - parsed.timestamp > duration) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch (e) {
        localStorage.removeItem(key);
        return null;
    }
}

function cacheClear(prefix) {
    if (prefix) {
        Object.keys(localStorage).forEach(function(key) {
            if (key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        });
    } else {
        Object.values(CACHE_KEY).forEach(function(key) {
            localStorage.removeItem(key);
        });
        Object.keys(localStorage).forEach(function(key) {
            if (key.startsWith("simpatic_cache_dashboard_wali_")) {
                localStorage.removeItem(key);
            }
        });
    }
}

function clearExpiredCache() {
    const now = Date.now();
    Object.values(CACHE_KEY).forEach(function(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return;
            const parsed = JSON.parse(cached);
            if (now - parsed.timestamp > 30 * 60 * 1000) {
                localStorage.removeItem(key);
            }
        } catch (e) {
            localStorage.removeItem(key);
        }
    });
}

function cacheInfo() {
    let totalSize = 0;
    let itemCount = 0;
    Object.values(CACHE_KEY).forEach(function(key) {
        const cached = localStorage.getItem(key);
        if (cached) {
            totalSize += cached.length;
            itemCount++;
        }
    });
    console.log("📦 SIMPATI Cache: " + itemCount + " items | " + (totalSize / 1024).toFixed(1) + " KB");
    return { itemCount: itemCount, sizeKB: (totalSize / 1024).toFixed(1) };
}

// ==================== DOM ELEMENTS ====================
const DOM = {
    splashScreen: null,
    app: null,
    loginScreen: null,
    loginForm: null,
    loginError: null,
    togglePassword: null,
    dashboardAdmin: null,
    sidebar: null,
    sidebarItems: null,
    pages: null,
    dashboardWali: null,
    modalOverlay: null,
    modals: {},
    toast: null,
    loadingOverlay: null
};

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function() {
    initDOM();
    initEventListeners();
    showSplash();
    console.log("📦 SIMPATI Cache Module loaded");
    cacheInfo();
});

function initDOM() {
    DOM.splashScreen = document.getElementById("splashScreen");
    DOM.app = document.getElementById("app");
    DOM.loginScreen = document.getElementById("loginScreen");
    DOM.loginForm = document.getElementById("loginForm");
    DOM.loginError = document.getElementById("loginError");
    DOM.togglePassword = document.getElementById("togglePassword");
    DOM.dashboardAdmin = document.getElementById("dashboardAdmin");
    DOM.sidebar = document.getElementById("sidebar");
    DOM.sidebarItems = document.querySelectorAll(".sidebar-item");
    DOM.pages = document.querySelectorAll(".page");
    DOM.dashboardWali = document.getElementById("dashboardWali");
    DOM.modalOverlay = document.getElementById("modalOverlay");
    DOM.modals = {
        siswa: document.getElementById("modalSiswa"),
        tagihanMaster: document.getElementById("modalTagihanMaster"),
        generateBilling: document.getElementById("modalGenerateBilling"),
        transaksi: document.getElementById("modalTransaksi"),
        uploadBukti: document.getElementById("modalUploadBukti"),
        gantiPassword: document.getElementById("modalGantiPassword"),
        lihatBukti: document.getElementById("modalLihatBukti"),
        waTemplate: document.getElementById("modalWATemplate")
    };
    DOM.toast = document.getElementById("toast");
    DOM.loadingOverlay = document.getElementById("loadingOverlay");
}

function initEventListeners() {
    DOM.loginForm.addEventListener("submit", handleLogin);
    DOM.togglePassword.addEventListener("click", togglePasswordVisibility);
    document.getElementById("role").addEventListener("change", onRoleChange);
    DOM.sidebarItems.forEach(function(item) {
        item.addEventListener("click", function() {
            navigateToAdminPage(this.dataset.page);
        });
    });
    document.getElementById("logoutAdmin").addEventListener("click", handleLogout);
    document.getElementById("logoutWali").addEventListener("click", handleLogout);
    document.getElementById("sidebarToggle").addEventListener("click", toggleSidebar);
    document.getElementById("btnTambahSiswa").addEventListener("click", function() { openModalSiswa(); });
    document.getElementById("btnTambahTagihanMaster").addEventListener("click", function() { openModalTagihanMaster(); });
    document.getElementById("btnGenerateBilling").addEventListener("click", function() { openModalGenerateBilling(); });
    document.getElementById("btnTambahTransaksi").addEventListener("click", function() { openModalTransaksi(); });
    document.getElementById("btnKirimReminder").addEventListener("click", handleKirimReminderMassal);
    document.getElementById("btnSimpanPengaturan").addEventListener("click", handleSimpanPengaturan);
    document.getElementById("btnFilterLaporan").addEventListener("click", loadLaporanPemasukan);
    document.getElementById("formSiswa").addEventListener("submit", handleSaveSiswa);
    document.getElementById("formTagihanMaster").addEventListener("submit", handleSaveTagihanMaster);
    document.getElementById("formGenerateBilling").addEventListener("submit", handleGenerateBilling);
    document.getElementById("formTransaksi").addEventListener("submit", handleSaveTransaksi);
    document.getElementById("formUploadBukti").addEventListener("submit", handleUploadBukti);
    document.getElementById("formGantiPassword").addEventListener("submit", handleGantiPassword);
    document.getElementById("formWATemplate").addEventListener("submit", handleSaveWATemplate);
    document.getElementById("genTargetJenis").addEventListener("change", onGenerateTargetChange);
    document.getElementById("trxMetode").addEventListener("change", onTrxMetodeChange);
    document.getElementById("trxNIS").addEventListener("change", onTrxNISChange);
    document.getElementById("btnBayarTransfer").addEventListener("click", openModalUploadBukti);
    document.getElementById("btnGantiPassword").addEventListener("click", openModalGantiPassword);
    document.querySelectorAll(".modal-close").forEach(function(btn) {
        btn.addEventListener("click", closeAllModals);
    });
    DOM.modalOverlay.addEventListener("click", closeAllModals);
    document.getElementById("searchSiswa").addEventListener("input", filterSiswa);
    document.getElementById("filterKelas").addEventListener("change", filterSiswa);
    document.getElementById("filterStatusSiswa").addEventListener("change", filterSiswa);
    document.getElementById("laporanBulan").addEventListener("change", loadLaporanPemasukan);
    document.getElementById("laporanTahun").addEventListener("change", loadLaporanPemasukan);
}

// ==================== SPLASH SCREEN ====================
function showSplash() {
    DOM.splashScreen.classList.remove("hidden");
    DOM.app.classList.add("hidden");
    setTimeout(function() {
        DOM.splashScreen.classList.add("hidden");
        DOM.app.classList.remove("hidden");
        checkSession();
    }, 2000);
}

// ==================== SESSION MANAGEMENT ====================
function checkSession() {
    const token = localStorage.getItem("simpatic_token");
    const user = JSON.parse(localStorage.getItem("simpatic_user") || "null");
    if (token && user) {
        STATE.token = token;
        STATE.user = user;
        if (user.role === "ADMIN") {
            showDashboardAdmin();
        } else if (user.role === "WALI_MURID") {
            showDashboardWali();
        }
    } else {
        showLogin();
    }
}

function saveSession(token, user) {
    STATE.token = token;
    STATE.user = user;
    localStorage.setItem("simpatic_token", token);
    localStorage.setItem("simpatic_user", JSON.stringify(user));
}

function clearSession() {
    STATE.token = null;
    STATE.user = null;
    localStorage.removeItem("simpatic_token");
    localStorage.removeItem("simpatic_user");
}

// ==================== SCREEN NAVIGATION ====================
function showLogin() {
    DOM.loginScreen.classList.remove("hidden");
    DOM.dashboardAdmin.classList.add("hidden");
    DOM.dashboardWali.classList.add("hidden");
}

function showDashboardAdmin() {
    DOM.loginScreen.classList.add("hidden");
    DOM.dashboardAdmin.classList.remove("hidden");
    DOM.dashboardWali.classList.add("hidden");
    document.getElementById("adminName").textContent = STATE.user.username;
    navigateToAdminPage("adminDashboard");
}

function showDashboardWali() {
    DOM.loginScreen.classList.add("hidden");
    DOM.dashboardAdmin.classList.add("hidden");
    DOM.dashboardWali.classList.remove("hidden");
    document.getElementById("waliName").textContent = STATE.user.siswa ? STATE.user.siswa.namaWali : STATE.user.username;
    loadDashboardWali();
}

function navigateToAdminPage(pageName) {
    DOM.sidebarItems.forEach(function(item) {
        item.classList.remove("active");
        if (item.dataset.page === pageName) item.classList.add("active");
    });
    DOM.pages.forEach(function(page) {
        page.classList.remove("active");
    });
    const targetPage = document.getElementById(pageName);
    if (targetPage) targetPage.classList.add("active");
    STATE.currentPage = pageName;
    switch (pageName) {
        case "adminDashboard": loadDashboardAdmin(); break;
        case "adminSiswa": loadSiswa(); break;
        case "adminTagihan": loadTagihan(); break;
        case "adminTransaksi": loadTransaksi(); break;
        case "adminVerifikasi": loadVerifikasi(); break;
        case "adminWhatsApp": loadWhatsApp(); break;
        case "adminLaporan": loadLaporan(); break;
        case "adminPengaturan": loadPengaturan(); break;
    }
    if (window.innerWidth < 768) DOM.sidebar.classList.remove("open");
}

function toggleSidebar() {
    DOM.sidebar.classList.toggle("open");
}

// ==================== API HELPER ====================
async function apiCall(action, params = {}, method = "POST") {
    try {
        const url = new URL(CONFIG.API_URL);
        if (method === "GET") {
            url.searchParams.append("action", action);
            Object.keys(params).forEach(function(key) {
                url.searchParams.append(key, params[key]);
            });
        }
        if (STATE.token) url.searchParams.append("token", STATE.token);
        let response;
        if (method === "GET") {
            response = await fetch(url.toString());
        } else {
            const formData = new URLSearchParams();
            formData.append("action", action);
            if (STATE.token) formData.append("token", STATE.token);
            Object.keys(params).forEach(function(key) {
                formData.append(key, params[key]);
            });
            response = await fetch(url.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData.toString()
            });
        }
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("API Error:", error);
        return { success: false, message: "Gagal terhubung ke server. Periksa koneksi internet." };
    }
}

// ==================== AUTH MODULE ====================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    if (!username || !password) {
        showLoginError("Username dan password wajib diisi");
        return;
    }
    showLoading(true);
    hideLoginError();
    const result = await apiCall("login", { username: username, password: password });
    showLoading(false);
    if (result.success) {
        if (result.data.user.role !== role) {
            showLoginError("Role tidak sesuai dengan akun ini");
            return;
        }
        saveSession(result.data.token, result.data.user);
        if (result.data.user.role === "ADMIN") {
            showDashboardAdmin();
        } else {
            showDashboardWali();
        }
        showToast("Login berhasil", "success");
    } else {
        showLoginError(result.message || "Login gagal");
    }
}

async function handleLogout() {
    await apiCall("logout");
    clearSession();
    cacheClear();
    showLogin();
    showToast("Logout berhasil", "success");
}

async function handleGantiPassword(e) {
    e.preventDefault();
    const oldPassword = document.getElementById("gantiOldPassword").value;
    const newPassword = document.getElementById("gantiNewPassword").value;
    const confirmPassword = document.getElementById("gantiConfirmPassword").value;
    if (!oldPassword || !newPassword || !confirmPassword) {
        showToast("Semua field wajib diisi", "error");
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast("Konfirmasi password tidak sama", "error");
        return;
    }
    if (newPassword.length < 6) {
        showToast("Password minimal 6 karakter", "error");
        return;
    }
    showLoading(true);
    const result = await apiCall("changePassword", { oldPassword: oldPassword, newPassword: newPassword });
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast("Password berhasil diubah", "success");
        document.getElementById("formGantiPassword").reset();
    } else {
        showToast(result.message, "error");
    }
}

function showLoginError(message) {
    DOM.loginError.textContent = message;
    DOM.loginError.classList.remove("hidden");
}

function hideLoginError() {
    DOM.loginError.classList.add("hidden");
    DOM.loginError.textContent = "";
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    const icon = DOM.togglePassword.querySelector("i");
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        passwordInput.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

function onRoleChange() {
    const role = document.getElementById("role").value;
    const passwordGroup = document.getElementById("password").closest(".form-group");
    if (role === "WALI_MURID") {
        passwordGroup.querySelector(".form-label").innerHTML = '<i class="fas fa-lock"></i> Password (6 digit terakhir No WA)';
    } else {
        passwordGroup.querySelector(".form-label").innerHTML = '<i class="fas fa-lock"></i> Password';
    }
}

// ==================== STUDENT MODULE ====================
async function loadSiswa() {
    const cached = cacheGet(CACHE_KEY.SISWA, CACHE_DURATION.SISWA);
    if (cached && cached.length > 0) {
        STATE.cache.siswa = cached;
        populateFilterKelas(cached);
        renderSiswaTable(cached);
        console.log("📦 Siswa loaded from cache (" + cached.length + " items)");
        return;
    }
    showLoading(true);
    const result = await apiCall("getStudents", {}, "GET");
    if (result.success) {
        STATE.cache.siswa = result.data;
        cacheSet(CACHE_KEY.SISWA, result.data);
        populateFilterKelas(result.data);
        renderSiswaTable(result.data);
        console.log("🌐 Siswa loaded from server (" + result.data.length + " items)");
    } else {
        showToast(result.message, "error");
    }
    showLoading(false);
}

function populateFilterKelas(siswaList) {
    const kelasSet = new Set();
    const filterKelas = document.getElementById("filterKelas");
    siswaList.forEach(function(s) { if (s.kelas) kelasSet.add(s.kelas); });
    filterKelas.innerHTML = '<option value="">Semua Kelas</option>';
    kelasSet.forEach(function(kelas) {
        filterKelas.innerHTML += '<option value="' + kelas + '">' + kelas + '</option>';
    });
}

function renderSiswaTable(siswaList) {
    const tbody = document.getElementById("tbodySiswa");
    if (siswaList.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada data</td></tr>';
        return;
    }
    tbody.innerHTML = siswaList.map(function(s) {
        const statusBadge = getStatusBadge(s.status);
        return `
            <tr>
                <td data-label="NIS">${s.nis}</td>
                <td data-label="Nama">${s.nama}</td>
                <td data-label="Kelas">${s.kelas}</td>
                <td data-label="Nama Wali">${s.namaWali}</td>
                <td data-label="WhatsApp"><a href="https://wa.me/${s.wa}" target="_blank" class="wa-link">${s.wa}</a></td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Aksi" class="action-cell">
                    <button class="btn-icon btn-sm" onclick="editSiswa('${s.nis}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-sm btn-danger" onclick="confirmDeleteSiswa('${s.nis}', '${s.nama}')" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterSiswa() {
    const search = document.getElementById("searchSiswa").value.toLowerCase();
    const kelas = document.getElementById("filterKelas").value;
    const status = document.getElementById("filterStatusSiswa").value;
    let filtered = STATE.cache.siswa;
    if (search) {
        filtered = filtered.filter(function(s) {
            return s.nis.toLowerCase().includes(search) || s.nama.toLowerCase().includes(search) || s.namaWali.toLowerCase().includes(search);
        });
    }
    if (kelas) filtered = filtered.filter(function(s) { return s.kelas === kelas; });
    if (status) filtered = filtered.filter(function(s) { return s.status === status; });
    renderSiswaTable(filtered);
}

function openModalSiswa(nisData = null) {
    const modal = DOM.modals.siswa;
    const title = document.getElementById("modalSiswaTitle");
    const form = document.getElementById("formSiswa");
    form.reset();
    document.getElementById("siswaNISOld").value = "";
    if (nisData) {
        title.textContent = "Edit Siswa";
        document.getElementById("siswaNISOld").value = nisData.nis;
        document.getElementById("siswaNIS").value = nisData.nis;
        document.getElementById("siswaNIS").readOnly = true;
        document.getElementById("siswaNama").value = nisData.nama;
        document.getElementById("siswaKelas").value = nisData.kelas;
        document.getElementById("siswaTahunAjaran").value = nisData.tahunAjaran || "";
        document.getElementById("siswaNamaWali").value = nisData.namaWali;
        document.getElementById("siswaWA").value = nisData.wa;
        document.getElementById("siswaStatus").value = nisData.status;
    } else {
        title.textContent = "Tambah Siswa";
        document.getElementById("siswaNIS").readOnly = false;
    }
    openModal("siswa");
}

async function editSiswa(nis) {
    showLoading(true);
    const result = await apiCall("getStudentByNIS", { nis: nis }, "GET");
    showLoading(false);
    if (result.success) {
        openModalSiswa(result.data);
    } else {
        showToast(result.message, "error");
    }
}

async function handleSaveSiswa(e) {
    e.preventDefault();
    const nisOld = document.getElementById("siswaNISOld").value;
    const nis = document.getElementById("siswaNIS").value.trim();
    const nama = document.getElementById("siswaNama").value.trim();
    const kelas = document.getElementById("siswaKelas").value.trim();
    const tahunAjaran = document.getElementById("siswaTahunAjaran").value.trim();
    const namaWali = document.getElementById("siswaNamaWali").value.trim();
    const wa = document.getElementById("siswaWA").value.trim();
    const status = document.getElementById("siswaStatus").value;
    if (!nis || !nama || !kelas || !namaWali || !wa) {
        showToast("Field bertanda * wajib diisi", "error");
        return;
    }
    showLoading(true);
    let result;
    if (nisOld) {
        result = await apiCall("updateStudent", { nis: nisOld, nama: nama, kelas: kelas, tahunAjaran: tahunAjaran, namaWali: namaWali, wa: wa, status: status });
    } else {
        result = await apiCall("saveStudent", { nis: nis, nama: nama, kelas: kelas, tahunAjaran: tahunAjaran, namaWali: namaWali, wa: wa, status: status });
    }
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast(result.message, "success");
        cacheClear("simpatic_cache_siswa");
        cacheClear("simpatic_cache_dashboard");
        loadSiswa();
    } else {
        showToast(result.message, "error");
    }
}

async function confirmDeleteSiswa(nis, nama) {
    if (!confirm("Yakin ingin menghapus siswa " + nama + " (" + nis + ")?")) return;
    showLoading(true);
    const result = await apiCall("deleteStudent", { nis: nis });
    showLoading(false);
    if (result.success) {
        showToast(result.message, "success");
        cacheClear("simpatic_cache_siswa");
        cacheClear("simpatic_cache_dashboard");
        loadSiswa();
    } else {
        showToast(result.message, "error");
    }
}

// ==================== BILLING MODULE ====================
async function loadTagihan() {
    const cachedMaster = cacheGet(CACHE_KEY.TAGIHAN_MASTER, CACHE_DURATION.TAGIHAN_MASTER);
    const cachedSiswa = cacheGet(CACHE_KEY.TAGIHAN_SISWA, CACHE_DURATION.TAGIHAN_SISWA);
    if (cachedMaster && cachedSiswa) {
        STATE.cache.tagihanMaster = cachedMaster;
        STATE.cache.tagihanSiswa = cachedSiswa;
        renderTagihanMasterTable(cachedMaster);
        renderTagihanSiswaTable(cachedSiswa);
        console.log("📦 Tagihan loaded from cache");
        return;
    }
    showLoading(true);
    const [masterResult, siswaResult] = await Promise.all([
        apiCall("getTagihanMaster", {}, "GET"),
        apiCall("getTagihanSiswa", {}, "GET")
    ]);
    if (masterResult.success) {
        STATE.cache.tagihanMaster = masterResult.data;
        cacheSet(CACHE_KEY.TAGIHAN_MASTER, masterResult.data);
        renderTagihanMasterTable(masterResult.data);
    }
    if (siswaResult.success) {
        STATE.cache.tagihanSiswa = siswaResult.data;
        cacheSet(CACHE_KEY.TAGIHAN_SISWA, siswaResult.data);
        renderTagihanSiswaTable(siswaResult.data);
    }
    if (!masterResult.success && !siswaResult.success) {
        showToast("Gagal memuat data tagihan", "error");
    }
    showLoading(false);
    console.log("🌐 Tagihan loaded from server");
}

function renderTagihanMasterTable(data) {
    const tbody = document.getElementById("tbodyTagihanMaster");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Tidak ada data</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(t) {
        return `
            <tr>
                <td data-label="Nama Tagihan">${t.nama}</td>
                <td data-label="Jenis"><span class="badge">${t.jenis}</span></td>
                <td data-label="Nominal">${formatCurrency(t.nominal)}</td>
                <td data-label="Status">${t.aktif === "TRUE" ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Nonaktif</span>'}</td>
                <td data-label="Aksi" class="action-cell">
                    <button class="btn-icon btn-sm" onclick="editTagihanMaster('${t.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-sm btn-danger" onclick="confirmDeleteTagihanMaster('${t.id}', '${t.nama}')" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderTagihanSiswaTable(data) {
    const tbody = document.getElementById("tbodyTagihanSiswa");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada data</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(t) {
        return `
            <tr>
                <td data-label="NIS">${t.nis}</td>
                <td data-label="Nama Siswa">${t.namaSiswa || "-"}</td>
                <td data-label="Tagihan">${t.namaTagihan}</td>
                <td data-label="Total">${formatCurrency(t.total)}</td>
                <td data-label="Terbayar">${formatCurrency(t.terbayar)}</td>
                <td data-label="Sisa">${formatCurrency(t.sisa)}</td>
                <td data-label="Status">${getTagihanStatusBadge(t.status)}</td>
            </tr>
        `;
    }).join("");
}

function openModalTagihanMaster(id = null) {
    const modal = DOM.modals.tagihanMaster;
    const title = document.getElementById("modalTagihanMasterTitle");
    const form = document.getElementById("formTagihanMaster");
    form.reset();
    document.getElementById("tagihanMasterId").value = "";
    if (id) {
        const data = STATE.cache.tagihanMaster.find(function(t) { return t.id === id; });
        if (data) {
            title.textContent = "Edit Tagihan";
            document.getElementById("tagihanMasterId").value = data.id;
            document.getElementById("tagihanMasterNama").value = data.nama;
            document.getElementById("tagihanMasterJenis").value = data.jenis;
            document.getElementById("tagihanMasterNominal").value = data.nominal;
            document.getElementById("tagihanMasterAktif").value = data.aktif;
        }
    } else {
        title.textContent = "Tambah Tagihan";
    }
    openModal("tagihanMaster");
}

async function editTagihanMaster(id) {
    openModalTagihanMaster(id);
}

async function handleSaveTagihanMaster(e) {
    e.preventDefault();
    const id = document.getElementById("tagihanMasterId").value;
    const nama = document.getElementById("tagihanMasterNama").value.trim();
    const jenis = document.getElementById("tagihanMasterJenis").value;
    const nominal = document.getElementById("tagihanMasterNominal").value;
    const aktif = document.getElementById("tagihanMasterAktif").value;
    if (!nama || !nominal) {
        showToast("Nama dan Nominal wajib diisi", "error");
        return;
    }
    showLoading(true);
    let result;
    if (id) {
        result = await apiCall("updateTagihanMaster", { id: id, nama: nama, jenis: jenis, nominal: nominal, aktif: aktif });
    } else {
        result = await apiCall("saveTagihanMaster", { nama: nama, jenis: jenis, nominal: nominal, aktif: aktif });
    }
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast(result.message, "success");
        cacheClear("simpatic_cache_tagihan");
        loadTagihan();
    } else {
        showToast(result.message, "error");
    }
}

async function confirmDeleteTagihanMaster(id, nama) {
    if (!confirm("Yakin ingin menghapus tagihan " + nama + "?")) return;
    showLoading(true);
    const result = await apiCall("deleteTagihanMaster", { id: id });
    showLoading(false);
    if (result.success) {
        showToast(result.message, "success");
        cacheClear("simpatic_cache_tagihan");
        loadTagihan();
    } else {
        showToast(result.message, "error");
    }
}

function openModalGenerateBilling() {
    const select = document.getElementById("genTagihanId");
    select.innerHTML = '<option value="">Pilih Tagihan</option>';
    STATE.cache.tagihanMaster.forEach(function(t) {
        select.innerHTML += '<option value="' + t.id + '">' + t.nama + ' - ' + formatCurrency(t.nominal) + '</option>';
    });
    document.getElementById("genTargetJenis").value = "all";
    document.getElementById("genKelasGroup").style.display = "none";
    document.getElementById("genNISGroup").style.display = "none";
    document.getElementById("formGenerateBilling").reset();
    openModal("generateBilling");
}

function onGenerateTargetChange() {
    const jenis = document.getElementById("genTargetJenis").value;
    document.getElementById("genKelasGroup").style.display = jenis === "kelas" ? "block" : "none";
    document.getElementById("genNISGroup").style.display = jenis === "nis" ? "block" : "none";
}

async function handleGenerateBilling(e) {
    e.preventDefault();
    const tagihanId = document.getElementById("genTagihanId").value;
    const targetJenis = document.getElementById("genTargetJenis").value;
    const kelas = document.getElementById("genKelas").value;
    const nis = document.getElementById("genNIS").value;
    if (!tagihanId) {
        showToast("Pilih tagihan terlebih dahulu", "error");
        return;
    }
    const params = { tagihanId: tagihanId };
    if (targetJenis === "kelas") params.kelas = kelas;
    if (targetJenis === "nis") params.nis = nis;
    showLoading(true);
    const result = await apiCall("generateBilling", params);
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast(result.message, "success");
        cacheClear("simpatic_cache_tagihan");
        loadTagihan();
    } else {
        showToast(result.message, "error");
    }
}

// ==================== PAYMENT MODULE ====================
async function loadTransaksi() {
    const cached = cacheGet(CACHE_KEY.TRANSAKSI, CACHE_DURATION.TRANSAKSI);
    if (cached && cached.length > 0) {
        STATE.cache.transaksi = cached;
        renderTransaksiTable(cached);
        console.log("📦 Transaksi loaded from cache");
        return;
    }
    showLoading(true);
    const result = await apiCall("getTransaksi", {}, "GET");
    showLoading(false);
    if (result.success) {
        STATE.cache.transaksi = result.data;
        cacheSet(CACHE_KEY.TRANSAKSI, result.data);
        renderTransaksiTable(result.data);
        console.log("🌐 Transaksi loaded from server");
    } else {
        showToast(result.message, "error");
    }
}

function renderTransaksiTable(data) {
    const tbody = document.getElementById("tbodyTransaksi");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Tidak ada data</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(t) {
        return `
            <tr>
                <td data-label="ID"><small>${t.id}</small></td>
                <td data-label="Tanggal">${t.tanggal}</td>
                <td data-label="NIS">${t.nis}</td>
                <td data-label="Nama">${t.namaSiswa || "-"}</td>
                <td data-label="Metode"><span class="badge">${t.metode}</span></td>
                <td data-label="Total">${formatCurrency(t.total)}</td>
                <td data-label="Status">${getTransaksiStatusBadge(t.status)}</td>
                <td data-label="Aksi" class="action-cell">
                    ${t.buktiUrl ? '<button class="btn-icon btn-sm" onclick="lihatBukti(\'' + t.buktiUrl + '\')" title="Lihat Bukti"><i class="fas fa-image"></i></button>' : ''}
                    ${t.status === 'LUNAS' ? '<button class="btn-icon btn-sm" onclick="cetakKwitansi(\'' + t.id + '\')" title="Cetak Kwitansi"><i class="fas fa-print"></i></button>' : ''}
                    ${t.status === 'LUNAS' ? '<button class="btn-icon btn-sm btn-danger" onclick="confirmVoidTransaksi(\'' + t.id + '\')" title="Void"><i class="fas fa-ban"></i></button>' : ''}
                </td>
            </tr>
        `;
    }).join("");
}

async function openModalTransaksi() {
    if (STATE.cache.siswa.length === 0) {
        const result = await apiCall("getStudents", {}, "GET");
        if (result.success) STATE.cache.siswa = result.data;
    }
    const select = document.getElementById("trxNIS");
    select.innerHTML = '<option value="">Pilih Siswa</option>';
    STATE.cache.siswa.filter(function(s) { return s.status === "AKTIF"; }).forEach(function(s) {
        select.innerHTML += '<option value="' + s.nis + '">' + s.nama + ' (' + s.nis + ') - ' + s.kelas + '</option>';
    });
    document.getElementById("trxMetode").value = "TUNAI";
    document.getElementById("trxTotal").value = "";
    document.getElementById("trxBuktiGroup").style.display = "none";
    document.getElementById("trxTagihanList").innerHTML = '<p class="text-muted">Pilih siswa terlebih dahulu</p>';
    document.getElementById("formTransaksi").reset();
    openModal("transaksi");
}

function onTrxMetodeChange() {
    const metode = document.getElementById("trxMetode").value;
    document.getElementById("trxBuktiGroup").style.display = metode !== "TUNAI" ? "block" : "none";
}

async function onTrxNISChange() {
    const nis = document.getElementById("trxNIS").value;
    const listContainer = document.getElementById("trxTagihanList");
    if (!nis) {
        listContainer.innerHTML = '<p class="text-muted">Pilih siswa terlebih dahulu</p>';
        return;
    }
    showLoading(true);
    const result = await apiCall("getTagihanByNIS", { nis: nis }, "GET");
    showLoading(false);
    if (result.success) {
        const aktif = result.data.filter(function(t) { return t.status !== "LUNAS"; });
        if (aktif.length === 0) {
            listContainer.innerHTML = '<p class="text-success">Tidak ada tagihan</p>';
            return;
        }
        listContainer.innerHTML = aktif.map(function(t) {
            return `
                <label class="checkbox-item">
                    <input type="checkbox" name="trxTagihan" value="${t.id}" data-max="${t.sisa}" onchange="hitungTotalTransaksi()">
                    <span>${t.namaTagihan} - Sisa: ${formatCurrency(t.sisa)}</span>
                </label>
            `;
        }).join("");
    }
}

function hitungTotalTransaksi() {
    const checkboxes = document.querySelectorAll('input[name="trxTagihan"]:checked');
    let total = 0;
    checkboxes.forEach(function(cb) { total += parseInt(cb.dataset.max); });
    document.getElementById("trxTotal").value = total;
}

async function handleSaveTransaksi(e) {
    e.preventDefault();
    const nis = document.getElementById("trxNIS").value;
    const metode = document.getElementById("trxMetode").value;
    const total = parseInt(document.getElementById("trxTotal").value);
    const buktiUrl = document.getElementById("trxBuktiUrl") ? document.getElementById("trxBuktiUrl").value : "";
    if (!nis || !total) {
        showToast("Pilih siswa dan masukkan total", "error");
        return;
    }
    const checkboxes = document.querySelectorAll('input[name="trxTagihan"]:checked');
    if (checkboxes.length === 0) {
        showToast("Pilih minimal satu tagihan", "error");
        return;
    }
    const tagihanList = [];
    checkboxes.forEach(function(cb) {
        tagihanList.push({ tagihanSiswaId: cb.value, nominal: parseInt(cb.dataset.max) });
    });
    showLoading(true);
    const result = await apiCall("savePayment", {
        nis: nis,
        metode: metode,
        total: total,
        tagihanList: JSON.stringify(tagihanList),
        buktiUrl: buktiUrl
    });
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast("Transaksi berhasil disimpan", "success");
        cacheClear("simpatic_cache_transaksi");
        cacheClear("simpatic_cache_tagihan");
        cacheClear("simpatic_cache_dashboard");
        loadTransaksi();
    } else {
        showToast(result.message, "error");
    }
}

async function confirmVoidTransaksi(id) {
    const keterangan = prompt("Alasan void transaksi?");
    if (!keterangan) return;
    showLoading(true);
    const result = await apiCall("voidTransaction", { transaksiId: id, keterangan: keterangan });
    showLoading(false);
    if (result.success) {
        showToast("Transaksi berhasil di-void", "success");
        cacheClear("simpatic_cache_transaksi");
        cacheClear("simpatic_cache_tagihan");
        loadTransaksi();
    } else {
        showToast(result.message, "error");
    }
}

async function cetakKwitansi(id) {
    showLoading(true);
    const result = await apiCall("generatePdfReceipt", { transaksiId: id });
    showLoading(false);
    if (result.success) {
        window.open(result.data.url, "_blank");
    } else {
        showToast(result.message, "error");
    }
}

function lihatBukti(url) {
    document.getElementById("imgBukti").src = url;
    openModal("lihatBukti");
}

// ==================== VERIFICATION MODULE ====================
async function loadVerifikasi() {
    showLoading(true);
    const result = await apiCall("getTransaksi", { status: "PENDING" }, "GET");
    showLoading(false);
    if (result.success) {
        renderVerifikasiTable(result.data);
    } else {
        showToast(result.message, "error");
    }
}

function renderVerifikasiTable(data) {
    const tbody = document.getElementById("tbodyVerifikasi");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada transaksi menunggu verifikasi</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(t) {
        return `
            <tr>
                <td data-label="ID"><small>${t.id}</small></td>
                <td data-label="Tanggal">${t.tanggal}</td>
                <td data-label="NIS">${t.nis}</td>
                <td data-label="Nama">${t.namaSiswa || "-"}</td>
                <td data-label="Total">${formatCurrency(t.total)}</td>
                <td data-label="Bukti">
                    ${t.buktiUrl ? '<button class="btn-icon btn-sm" onclick="lihatBukti(\'' + t.buktiUrl + '\')"><i class="fas fa-image"></i> Lihat</button>' : '-'}
                </td>
                <td data-label="Aksi" class="action-cell">
                    <button class="btn btn-sm btn-success" onclick="verifikasiPembayaran('${t.id}')"><i class="fas fa-check"></i> Verifikasi</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmVoidTransaksi('${t.id}')"><i class="fas fa-times"></i> Tolak</button>
                </td>
            </tr>
        `;
    }).join("");
}

async function verifikasiPembayaran(id) {
    if (!confirm("Verifikasi pembayaran ini?")) return;
    showLoading(true);
    const result = await apiCall("verifyTransfer", { transaksiId: id });
    showLoading(false);
    if (result.success) {
        showToast("Pembayaran berhasil diverifikasi", "success");
        cacheClear("simpatic_cache_transaksi");
        cacheClear("simpatic_cache_tagihan");
        loadVerifikasi();
        loadTransaksi();
    } else {
        showToast(result.message, "error");
    }
}

// ==================== WHATSAPP MODULE ====================
async function loadWhatsApp() {
    const cachedTemplate = cacheGet(CACHE_KEY.WA_TEMPLATE, CACHE_DURATION.WA_TEMPLATE);
    if (cachedTemplate) {
        STATE.cache.waTemplate = cachedTemplate;
        renderWATemplateTable(cachedTemplate);
        console.log("📦 WA template loaded from cache");
    } else {
        const templateResult = await apiCall("getWATemplate", {}, "GET");
        if (templateResult.success) {
            STATE.cache.waTemplate = templateResult.data;
            cacheSet(CACHE_KEY.WA_TEMPLATE, templateResult.data);
            renderWATemplateTable(templateResult.data);
            console.log("🌐 WA template loaded from server");
        }
    }
    const logResult = await apiCall("getWALog", {}, "GET");
    if (logResult.success) {
        renderWALogTable(logResult.data);
    }
}

function renderWATemplateTable(data) {
    const tbody = document.getElementById("tbodyWATemplate");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Tidak ada template</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(function(t) {
        return `
            <tr>
                <td data-label="Nama Template">${t.nama}</td>
                <td data-label="Status">${t.aktif === "TRUE" ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Nonaktif</span>'}</td>
                <td data-label="Aksi" class="action-cell">
                    <button class="btn-icon btn-sm" onclick="editWATemplate('${t.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderWALogTable(data) {
    const tbody = document.getElementById("tbodyWALog");
    if (data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada log pengiriman</td></tr>';
        return;
    }
    tbody.innerHTML = data.slice(0, 50).map(function(l) {
        return `
            <tr>
                <td data-label="Tanggal">${l.tanggal}</td>
                <td data-label="NIS">${l.nis}</td>
                <td data-label="No WA">${l.noWa}</td>
                <td data-label="Jenis">${l.jenis}</td>
                <td data-label="Status">${l.status === "SUKSES" ? '<span class="badge badge-success">Sukses</span>' : '<span class="badge badge-danger">Gagal</span>'}</td>
            </tr>
        `;
    }).join("");
}

function editWATemplate(id) {
    const data = STATE.cache.waTemplate.find(function(t) { return t.id === id; });
    if (!data) return;
    document.getElementById("waTemplateId").value = data.id;
    document.getElementById("waTemplateNama").value = data.nama;
    document.getElementById("waTemplateIsi").value = data.isi;
    document.getElementById("modalWATemplateTitle").textContent = "Edit Template";
    openModal("waTemplate");
}

async function handleSaveWATemplate(e) {
    e.preventDefault();
    const id = document.getElementById("waTemplateId").value;
    const nama = document.getElementById("waTemplateNama").value.trim();
    const isi = document.getElementById("waTemplateIsi").value.trim();
    if (!nama || !isi) {
        showToast("Nama dan isi template wajib diisi", "error");
        return;
    }
    showLoading(true);
    const result = await apiCall("saveWATemplate", { id: id || undefined, nama: nama, isi: isi });
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast("Template berhasil disimpan", "success");
        cacheClear("simpatic_cache_wa_template");
        loadWhatsApp();
    } else {
        showToast(result.message, "error");
    }
}

async function handleKirimReminderMassal() {
    if (!confirm("Kirim reminder ke semua wali murid?")) return;
    showLoading(true);
    showToast("Mengirim reminder... tunggu sebentar", "success");
    const siswaAktif = STATE.cache.siswa.filter(function(s) { return s.status === "AKTIF"; });
    if (siswaAktif.length === 0) {
        const result = await apiCall("getStudents", {}, "GET");
        if (result.success) STATE.cache.siswa = result.data;
    }
    const aktif = STATE.cache.siswa.filter(function(s) { return s.status === "AKTIF"; });
    for (let i = 0; i < aktif.length; i++) {
        const s = aktif[i];
        await apiCall("sendWhatsapp", { nis: s.nis, templateId: STATE.cache.waTemplate[0]?.id || "" });
    }
    showLoading(false);
    showToast("Reminder selesai dikirim", "success");
    loadWhatsApp();
}

// ==================== UPLOAD BUKTI (WALI MURID) ====================
async function openModalUploadBukti() {
    const nis = STATE.user.siswa?.nis;
    if (!nis) {
        showToast("Data siswa tidak ditemukan", "error");
        return;
    }
    showLoading(true);
    const result = await apiCall("getTagihanByNIS", { nis: nis }, "GET");
    showLoading(false);
    if (result.success) {
        const aktif = result.data.filter(function(t) { return t.status !== "LUNAS"; });
        const listContainer = document.getElementById("uploadTagihanList");
        if (aktif.length === 0) {
            listContainer.innerHTML = '<p class="text-success">Tidak ada tagihan</p>';
        } else {
            listContainer.innerHTML = aktif.map(function(t) {
                return `
                    <label class="checkbox-item">
                        <input type="checkbox" name="uploadTagihan" value="${t.id}" data-max="${t.sisa}" onchange="hitungTotalUpload()">
                        <span>${t.namaTagihan} - Sisa: ${formatCurrency(t.sisa)}</span>
                    </label>
                `;
            }).join("");
        }
    }
    document.getElementById("uploadMetode").value = "TRANSFER";
    document.getElementById("uploadTotal").value = "";
    document.getElementById("uploadBuktiUrl").value = "";
    document.getElementById("formUploadBukti").reset();
    openModal("uploadBukti");
}

function hitungTotalUpload() {
    const checkboxes = document.querySelectorAll('input[name="uploadTagihan"]:checked');
    let total = 0;
    checkboxes.forEach(function(cb) { total += parseInt(cb.dataset.max); });
    document.getElementById("uploadTotal").value = total;
}

async function handleUploadBukti(e) {
    e.preventDefault();
    const nis = STATE.user.siswa?.nis;
    const metode = document.getElementById("uploadMetode").value;
    const total = parseInt(document.getElementById("uploadTotal").value);
    const buktiUrl = document.getElementById("uploadBuktiUrl").value.trim();
    if (!nis) {
        showToast("Data siswa tidak ditemukan", "error");
        return;
    }
    if (!total || !buktiUrl) {
        showToast("Total dan URL bukti wajib diisi", "error");
        return;
    }
    const checkboxes = document.querySelectorAll('input[name="uploadTagihan"]:checked');
    if (checkboxes.length === 0) {
        showToast("Pilih minimal satu tagihan", "error");
        return;
    }
    const tagihanList = [];
    checkboxes.forEach(function(cb) {
        tagihanList.push({ tagihanSiswaId: cb.value, nominal: parseInt(cb.dataset.max) });
    });
    showLoading(true);
    const result = await apiCall("savePayment", {
        nis: nis,
        metode: metode,
        total: total,
        tagihanList: JSON.stringify(tagihanList),
        buktiUrl: buktiUrl
    });
    showLoading(false);
    if (result.success) {
        closeAllModals();
        showToast("Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin.", "success");
        const nisWali = STATE.user.siswa?.nis;
        if (nisWali) cacheClear("simpatic_cache_dashboard_wali_" + nisWali);
        loadDashboardWali();
    } else {
        showToast(result.message, "error");
    }
}

// ==================== DASHBOARD ====================
async function loadDashboardAdmin() {
    const cached = cacheGet(CACHE_KEY.DASHBOARD_ADMIN, CACHE_DURATION.DASHBOARD);
    if (cached) {
        renderDashboardAdminData(cached);
        console.log("📦 Dashboard admin loaded from cache");
        return;
    }
    showLoading(true);
    const result = await apiCall("getDashboardAdmin", {}, "GET");
    showLoading(false);
    if (result.success) {
        cacheSet(CACHE_KEY.DASHBOARD_ADMIN, result.data);
        renderDashboardAdminData(result.data);
        console.log("🌐 Dashboard admin loaded from server");
    }
}

function renderDashboardAdminData(d) {
    document.getElementById("statTotalSiswa").textContent = d.totalSiswa;
    document.getElementById("statSiswaAktif").textContent = d.totalSiswaAktif;
    document.getElementById("statTunggakan").textContent = d.tunggakan;
    document.getElementById("statPemasukan").textContent = formatCurrency(d.pemasukanBulanIni);
    document.getElementById("summaryTotalTagihan").textContent = formatCurrency(d.totalTagihan);
    document.getElementById("summaryTotalTerbayar").textContent = formatCurrency(d.totalTerbayar);
    document.getElementById("summaryTotalSisa").textContent = formatCurrency(d.totalSisa);
}

async function loadDashboardWali() {
    const nis = STATE.user.siswa?.nis;
    if (!nis) return;
    const cacheKey = CACHE_KEY.DASHBOARD_WALI + "_" + nis;
    const cached = cacheGet(cacheKey, CACHE_DURATION.DASHBOARD);
    if (cached) {
        renderDashboardWaliData(cached);
        console.log("📦 Dashboard wali loaded from cache");
        return;
    }
    showLoading(true);
    const result = await apiCall("getDashboardWali", { nis: nis }, "GET");
    showLoading(false);
    if (result.success) {
        cacheSet(cacheKey, result.data);
        renderDashboardWaliData(result.data);
        console.log("🌐 Dashboard wali loaded from server");
    }
}

function renderDashboardWaliData(d) {
    document.getElementById("infoNamaSiswa").textContent = d.siswa.nama;
    document.getElementById("infoNIS").textContent = d.siswa.nis;
    document.getElementById("infoKelas").textContent = d.siswa.kelas;
    document.getElementById("indicatorIcon").textContent = d.indikator;
    if (d.indikator === "🟢") {
        document.getElementById("indicatorText").textContent = "Tidak Ada Tagihan";
        document.getElementById("statusIndicator").className = "status-indicator status-ok";
    } else if (d.indikator === "🟡") {
        document.getElementById("indicatorText").textContent = "Ada Tagihan Aktif";
        document.getElementById("statusIndicator").className = "status-indicator status-warning";
    } else {
        document.getElementById("indicatorText").textContent = "Ada Tunggakan";
        document.getElementById("statusIndicator").className = "status-indicator status-danger";
    }
    document.getElementById("waliTotalTagihan").textContent = formatCurrency(d.totalTagihan);
    document.getElementById("waliTotalTerbayar").textContent = formatCurrency(d.totalTerbayar);
    document.getElementById("waliTotalSisa").textContent = formatCurrency(d.totalSisa);
    const tagihanList = document.getElementById("tagihanAktifList");
    if (d.tagihanAktif.length === 0) {
        tagihanList.innerHTML = '<p class="empty-text">Tidak ada tagihan aktif</p>';
    } else {
        tagihanList.innerHTML = d.tagihanAktif.map(function(t) {
            return `
                <div class="tagihan-item">
                    <div class="tagihan-info">
                        <strong>${t.namaTagihan}</strong>
                        <span>Total: ${formatCurrency(t.total)} | Terbayar: ${formatCurrency(t.terbayar)} | Sisa: ${formatCurrency(t.sisa)}</span>
                        <span class="text-muted">Jatuh Tempo: ${t.jatuhTempo || "-"}</span>
                    </div>
                    <span class="tagihan-status">${getTagihanStatusBadge(t.status)}</span>
                </div>
            `;
        }).join("");
    }
    loadRiwayatWali(d.siswa.nis);
}

async function loadRiwayatWali(nis) {
    const result = await apiCall("getTransaksiByNIS", { nis: nis }, "GET");
    const tbody = document.getElementById("tbodyRiwayatWali");
    if (result.success && result.data.length > 0) {
        tbody.innerHTML = result.data.map(function(t) {
            return `
                <tr>
                    <td data-label="Tanggal">${t.tanggal}</td>
                    <td data-label="Metode"><span class="badge">${t.metode}</span></td>
                    <td data-label="Total">${formatCurrency(t.total)}</td>
                    <td data-label="Status">${getTransaksiStatusBadge(t.status)}</td>
                </tr>
            `;
        }).join("");
    } else {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Tidak ada transaksi</td></tr>';
    }
}

// ==================== LAPORAN ====================
function loadLaporan() {
    const tahunSelect = document.getElementById("laporanTahun");
    const currentYear = new Date().getFullYear();
    tahunSelect.innerHTML = '<option value="">Semua Tahun</option>';
    for (let y = currentYear; y >= currentYear - 5; y--) {
        tahunSelect.innerHTML += '<option value="' + y + '">' + y + '</option>';
    }
    loadLaporanPemasukan();
    loadLaporanTunggakan();
}

async function loadLaporanPemasukan() {
    const bulan = document.getElementById("laporanBulan").value;
    const tahun = document.getElementById("laporanTahun").value;
    const params = {};
    if (bulan) params.bulan = bulan;
    if (tahun) params.tahun = tahun;
    showLoading(true);
    const result = await apiCall("getReportPemasukan", params, "GET");
    showLoading(false);
    if (result.success) {
        document.getElementById("laporanTotalPemasukan").textContent = formatCurrency(result.data.totalPemasukan);
        const tbody = document.getElementById("tbodyLaporan");
        if (result.data.pemasukan.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Tidak ada data</td></tr>';
        } else {
            tbody.innerHTML = result.data.pemasukan.map(function(p) {
                return `
                    <tr>
                        <td data-label="ID"><small>${p.id}</small></td>
                        <td data-label="Tanggal">${p.tanggal}</td>
                        <td data-label="NIS">${p.nis}</td>
                        <td data-label="Nama">${p.namaSiswa || "-"}</td>
                        <td data-label="Metode"><span class="badge">${p.metode}</span></td>
                        <td data-label="Total">${formatCurrency(p.total)}</td>
                    </tr>
                `;
            }).join("");
        }
    }
}

async function loadLaporanTunggakan() {
    showLoading(true);
    const result = await apiCall("getReportTunggakan", {}, "GET");
    showLoading(false);
    if (result.success) {
        document.getElementById("laporanTotalTunggakan").textContent = formatCurrency(result.data.totalTunggakan);
        const tbody = document.getElementById("tbodyTunggakan");
        if (result.data.tunggakan.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada tunggakan</td></tr>';
        } else {
            tbody.innerHTML = result.data.tunggakan.map(function(t) {
                return `
                    <tr>
                        <td data-label="NIS">${t.nis}</td>
                        <td data-label="Nama">${t.namaSiswa}</td>
                        <td data-label="Kelas">${t.kelas}</td>
                        <td data-label="Wali">${t.namaWali} <br><a href="https://wa.me/${t.wa}" target="_blank" class="wa-link">${t.wa}</a></td>
                        <td data-label="Tagihan">${t.namaTagihan}</td>
                        <td data-label="Sisa" class="text-danger">${formatCurrency(t.sisa)}</td>
                        <td data-label="Jatuh Tempo">${t.jatuhTempo}</td>
                    </tr>
                `;
            }).join("");
        }
    }
}

// ==================== PENGATURAN ====================
async function loadPengaturan() {
    showLoading(true);
    const result = await apiCall("getSettings", {}, "GET");
    showLoading(false);
    if (result.success) {
        const s = result.data;
        document.getElementById("setNamaSekolah").value = s.NAMA_SEKOLAH || "";
        document.getElementById("setLogoUrl").value = s.LOGO_URL || "";
        document.getElementById("setWAProvider").value = s.WA_PROVIDER || "FONNTE";
        document.getElementById("setWAToken").value = s.WA_TOKEN || "";
        document.getElementById("setReminderDay").value = s.REMINDER_DAY || "10";
        document.getElementById("setReminderHour").value = s.REMINDER_HOUR || "8";
        document.getElementById("setBankName").value = s.BANK_NAME || "";
        document.getElementById("setBankAccount").value = s.BANK_ACCOUNT || "";
        document.getElementById("setBankHolder").value = s.BANK_HOLDER || "";
        document.getElementById("setQRISUrl").value = s.QRIS_IMAGE_URL || "";
    }
}

async function handleSimpanPengaturan() {
    const settings = {
        NAMA_SEKOLAH: document.getElementById("setNamaSekolah").value,
        LOGO_URL: document.getElementById("setLogoUrl").value,
        WA_TOKEN: document.getElementById("setWAToken").value,
        REMINDER_DAY: document.getElementById("setReminderDay").value,
        REMINDER_HOUR: document.getElementById("setReminderHour").value,
        BANK_NAME: document.getElementById("setBankName").value,
        BANK_ACCOUNT: document.getElementById("setBankAccount").value,
        BANK_HOLDER: document.getElementById("setBankHolder").value,
        QRIS_IMAGE_URL: document.getElementById("setQRISUrl").value
    };
    showLoading(true);
    let successCount = 0;
    for (const [key, value] of Object.entries(settings)) {
        const result = await apiCall("updateSetting", { key: key, value: value });
        if (result.success) successCount++;
    }
    showLoading(false);
    cacheClear("simpatic_cache_pengaturan");
    showToast(successCount + " pengaturan berhasil disimpan", "success");
}

// ==================== MODAL HELPERS ====================
function openModal(modalName) {
    DOM.modalOverlay.classList.remove("hidden");
    if (DOM.modals[modalName]) DOM.modals[modalName].classList.remove("hidden");
}

function closeAllModals() {
    DOM.modalOverlay.classList.add("hidden");
    Object.values(DOM.modals).forEach(function(modal) {
        modal.classList.add("hidden");
    });
}

function openModalGantiPassword() {
    document.getElementById("formGantiPassword").reset();
    openModal("gantiPassword");
}

// ==================== TOAST & LOADING ====================
function showToast(message, type = "success") {
    const toast = DOM.toast;
    const icon = document.getElementById("toastIcon");
    const msg = document.getElementById("toastMessage");
    toast.className = "toast toast-" + type;
    icon.innerHTML = type === "success" ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
    msg.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    setTimeout(function() {
        toast.classList.remove("show");
        toast.classList.add("hidden");
    }, 3000);
}

function showLoading(show) {
    if (show) {
        DOM.loadingOverlay.classList.remove("hidden");
    } else {
        DOM.loadingOverlay.classList.add("hidden");
    }
}

// ==================== UTILITY FUNCTIONS ====================
function formatCurrency(amount) {
    if (!amount) return "Rp 0";
    return "Rp " + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getStatusBadge(status) {
    const badges = {
        "AKTIF": '<span class="badge badge-success">Aktif</span>',
        "NONAKTIF": '<span class="badge badge-warning">Nonaktif</span>',
        "LULUS": '<span class="badge badge-info">Lulus</span>',
        "PINDAH": '<span class="badge badge-danger">Pindah</span>'
    };
    return badges[status] || status;
}

function getTagihanStatusBadge(status) {
    const badges = {
        "LUNAS": '<span class="badge badge-success">Lunas</span>',
        "SEBAGIAN": '<span class="badge badge-warning">Sebagian</span>',
        "BELUM_LUNAS": '<span class="badge badge-danger">Belum Lunas</span>'
    };
    return badges[status] || status;
}

function getTransaksiStatusBadge(status) {
    const badges = {
        "LUNAS": '<span class="badge badge-success">Lunas</span>',
        "PENDING": '<span class="badge badge-warning">Pending</span>',
        "VOID": '<span class="badge badge-danger">Void</span>'
    };
    return badges[status] || status;
}

// ==================== KEYBOARD SHORTCUT ====================
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeAllModals();
});

// ==================== EXPORT TO GLOBAL ====================
window.editSiswa = editSiswa;
window.confirmDeleteSiswa = confirmDeleteSiswa;
window.editTagihanMaster = editTagihanMaster;
window.confirmDeleteTagihanMaster = confirmDeleteTagihanMaster;
window.editWATemplate = editWATemplate;
window.lihatBukti = lihatBukti;
window.cetakKwitansi = cetakKwitansi;
window.verifikasiPembayaran = verifikasiPembayaran;
window.confirmVoidTransaksi = confirmVoidTransaksi;
window.hitungTotalTransaksi = hitungTotalTransaksi;
window.hitungTotalUpload = hitungTotalUpload;
