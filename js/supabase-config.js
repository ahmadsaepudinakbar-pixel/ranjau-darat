// Koneksi Supabase CV. Ranjau Darat
// Publishable key AMAN ditaruh di sini (data dilindungi aturan RLS di database).
// JANGAN PERNAH menaruh service_role / secret key di file ini.

const SUPABASE_URL = 'https://omsnrpewdzeeluvobrvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JHShg64sI6wUjpbSsrHBZQ_omWWhyfI';

// Login memakai username. Di balik layar username diubah jadi "email" internal
// (tidak ada email yang dikirim, karena konfirmasi email dimatikan).
const EMAIL_DOMAIN = 'ranjau-darat.id';
const usernameKeEmail = (u) => u.trim().toLowerCase() + '@' + EMAIL_DOMAIN;

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// Halaman dashboard per jabatan
const DASHBOARD = {
  ketua: 'ketua.html',
  sekretaris: 'sekretaris.html',
  bendahara: 'bendahara.html',
  anggota: 'anggota.html'
};

// Terjemahan pesan error Supabase yang umum
function pesanError(err) {
  const m = (err && (err.message || err.error_description || String(err))) || '';
  if (/Invalid login credentials/i.test(m)) return 'Username atau password salah.';
  if (/already registered|already exists/i.test(m)) return 'Username ini sudah dipakai. Pilih username lain.';
  if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (/Password should be/i.test(m)) return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.';
  if (/duplicate key.*nik/i.test(m)) return 'NIK ini sudah terdaftar.';
  if (/duplicate key.*username/i.test(m)) return 'Username ini sudah dipakai. Pilih username lain.';
  if (/maximum allowed size|too large/i.test(m)) return 'Ukuran file terlalu besar. Maksimal 2 MB.';
  return 'Terjadi kesalahan: ' + m;
}
