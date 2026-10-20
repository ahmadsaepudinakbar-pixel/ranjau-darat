// Halaman Login CV. Ranjau Darat
// Login cukup username + password; jabatan dibaca otomatis dari akun.
// Tahap tampilan: belum tersambung ke Supabase. Bagian bertanda TODO diganti saat Supabase siap.

const ROLES = {
  ketua: {
    label: 'Ketua', dashboard: 'ketua.html',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z"/><rect x="5" y="19" width="14" height="2" rx="1"/></svg>'
  },
  sekretaris: {
    label: 'Sekretaris', dashboard: 'sekretaris.html',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'
  },
  bendahara: {
    label: 'Bendahara', dashboard: 'bendahara.html',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/></svg>'
  },
  anggota: {
    label: 'Anggota', dashboard: 'anggota.html',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3.2"/><circle cx="5.5" cy="10" r="2.3"/><circle cx="18.5" cy="10" r="2.3"/><path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6zM1 19c0-2.5 1.8-4.2 4.3-4.2 1 0 1.8.3 2.4.7C6.4 16.5 5.6 17.8 5.4 19zM23 19c0-2.5-1.8-4.2-4.3-4.2-1 0-1.8.3-2.4.7 1.3 1 2.1 2.3 2.3 3.5z"/></svg>'
  }
};

const $ = (id) => document.getElementById(id);
const form = $('loginForm'), user = $('username'), pass = $('password');
const msg = $('msg'), submitBtn = $('submitBtn');

// Tahun otomatis
document.querySelectorAll('.yr').forEach((e) => (e.textContent = new Date().getFullYear()));

// Jika dibuka dari kartu jabatan di beranda (login.html?role=ketua), tampilkan ikon & judulnya.
// Ini hanya tampilan; jabatan sebenarnya tetap dibaca dari akun.
const hint = new URLSearchParams(location.search).get('role');
if (ROLES[hint]) {
  const r = ROLES[hint];
  $('title').textContent = 'Login ' + r.label;
  $('sub').hidden = true;
  const icon = $('roleIcon');
  icon.className = 'role-icon ' + hint;
  icon.innerHTML = r.icon;
  icon.hidden = false;
  document.title = 'Login ' + r.label + ' - CV. Ranjau Darat';
}

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.className = 'msg' + (ok ? ' ok' : '');
  msg.hidden = false;
}

// Tampilkan / sembunyikan password
$('peek').addEventListener('click', (e) => {
  const show = pass.type === 'password';
  pass.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Tutup' : 'Lihat';
  e.currentTarget.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
});

[user, pass].forEach((el) => el.addEventListener('input', () => el.removeAttribute('aria-invalid')));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.hidden = true;

  const u = user.value.trim();
  const p = pass.value;
  if (!u) { user.setAttribute('aria-invalid', 'true'); showMsg('Username wajib diisi.'); user.focus(); return; }
  if (!p) { pass.setAttribute('aria-invalid', 'true'); showMsg('Password wajib diisi.'); pass.focus(); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memeriksa...';

  // TODO (Supabase):
  // 1. Cari email dari username di tabel profil, lalu supabase.auth.signInWithPassword({ email, password })
  // 2. Ambil jabatan & status akun dari tabel profil
  // 3. status 'menunggu' -> showMsg('Akun Anda masih menunggu persetujuan Ketua atau Sekretaris.')
  //    status 'ditolak'  -> showMsg('Pendaftaran Anda ditolak. Hubungi Sekretaris.')
  //    status 'diterima' -> location.href = ROLES[jabatan].dashboard   (otomatis sesuai jabatan di akun)
  await new Promise((r) => setTimeout(r, 600));

  submitBtn.disabled = false;
  submitBtn.textContent = 'Login';
  showMsg('Login belum aktif. Sistem sedang disiapkan, coba lagi nanti.');
});
