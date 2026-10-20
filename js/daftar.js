// Halaman Daftar Anggota CV. Ranjau Darat
// Tahap tampilan: pemeriksaan isian sudah aktif, pengiriman ke Supabase belum (lihat TODO di bawah).

const MAX_FILE = 2 * 1024 * 1024; // 2 MB
const TIPE_GAMBAR = ['image/jpeg', 'image/png'];

const $ = (id) => document.getElementById(id);
const form = $('daftarForm');
const alertBox = $('alert');
const kirim = $('kirim');

// ---------- Bantuan tampilan pesan ----------
function setErr(el, text) {
  const box = el.closest('.f');
  const err = box ? box.querySelector('.err') : null;
  if (err) err.textContent = text || '';
  el.setAttribute('aria-invalid', text ? 'true' : 'false');
  const drop = box ? box.querySelector('.drop') : null;
  if (drop) drop.classList.toggle('bad', !!text);
  return !text;
}

function showAlert(text, bad = false) {
  alertBox.textContent = text;
  alertBox.className = 'alert' + (bad ? ' bad' : '');
  alertBox.hidden = false;
}

// ---------- Hanya angka untuk NIK, RT, RW ----------
['nik', 'rt', 'rw'].forEach((id) => {
  $(id).addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
    if (id === 'nik') $('nikCount').textContent = e.target.value.length + ' / 16 digit';
  });
});
$('wa').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d+]/g, ''); });
$('username').addEventListener('input', (e) => { e.target.value = e.target.value.toLowerCase().replace(/\s/g, ''); });

// ---------- Aturan tiap kolom ----------
const RULES = {
  nama: (v) => v.trim().length < 3 ? 'Nama lengkap wajib diisi.' : '',
  nik: (v) => v.length !== 16 ? 'NIK harus 16 digit angka.' : '',
  tempat: (v) => !v.trim() ? 'Tempat lahir wajib diisi.' : '',
  tgl: (v) => {
    if (!v) return 'Tanggal lahir wajib diisi.';
    const lahir = new Date(v), now = new Date();
    let umur = now.getFullYear() - lahir.getFullYear();
    if (now < new Date(now.getFullYear(), lahir.getMonth(), lahir.getDate())) umur--;
    if (lahir > now) return 'Tanggal lahir tidak boleh di masa depan.';
    if (umur < 18) return 'Usia minimal 18 tahun.';
    return '';
  },
  jk: (v) => !v ? 'Pilih jenis kelamin.' : '',
  jabatan: (v) => !v ? 'Pilih jabatan.' : '',
  wa: (v) => !/^(\+62|62|0)8\d{7,12}$/.test(v) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890' : '',
  alamat: (v) => v.trim().length < 5 ? 'Alamat lengkap wajib diisi.' : '',
  rt: (v) => !v ? 'RT wajib diisi.' : '',
  rw: (v) => !v ? 'RW wajib diisi.' : '',
  desa: (v) => !v.trim() ? 'Kelurahan/desa wajib diisi.' : '',
  kec: (v) => !v.trim() ? 'Kecamatan wajib diisi.' : '',
  kab: (v) => !v.trim() ? 'Kabupaten/kota wajib diisi.' : '',
  username: (v) => !/^[a-z0-9._]{4,20}$/.test(v) ? 'Username 4–20 karakter: huruf kecil, angka, titik, atau garis bawah.' : '',
  pass: (v) => v.length < 8 ? 'Password minimal 8 karakter.' : '',
  pass2: (v) => !v ? 'Ulangi password.' : (v !== $('pass').value ? 'Password tidak sama.' : '')
};

function cekKolom(id) {
  const el = $(id);
  return setErr(el, RULES[id](el.value));
}

Object.keys(RULES).forEach((id) => {
  const el = $(id);
  el.addEventListener('blur', () => { if (el.value) cekKolom(id); });
  el.addEventListener('change', () => cekKolom(id));
  el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') cekKolom(id); });
});
$('pass').addEventListener('input', () => { if ($('pass2').value) cekKolom('pass2'); });

// ---------- Upload foto & KTP dengan pratinjau ----------
function cekFile(id) {
  const input = $(id);
  const f = input.files[0];
  const label = id === 'foto' ? 'Pas foto' : 'Foto KTP';
  if (!f) return setErr(input, label + ' wajib diunggah.');
  if (!TIPE_GAMBAR.includes(f.type)) return setErr(input, label + ' harus berformat JPG atau PNG.');
  if (f.size > MAX_FILE) return setErr(input, label + ' terlalu besar (' + (f.size / 1048576).toFixed(1) + ' MB). Maksimal 2 MB.');
  return setErr(input, '');
}

['foto', 'ktp'].forEach((id) => {
  const input = $(id), prev = $(id + 'Prev'), ph = $(id + 'Ph'), name = $(id + 'Name');
  const drop = input.closest('.f').querySelector('.drop');
  input.addEventListener('change', () => {
    const f = input.files[0];
    const ok = cekFile(id);
    if (prev.src) URL.revokeObjectURL(prev.src);
    if (f && ok) {
      prev.src = URL.createObjectURL(f);
      prev.hidden = false; ph.hidden = true;
      drop.classList.add('has');
      name.textContent = f.name + ' · ' + (f.size / 1024).toFixed(0) + ' KB · klik gambar untuk mengganti';
    } else {
      prev.removeAttribute('src');
      prev.hidden = true; ph.hidden = false;
      drop.classList.remove('has');
      name.textContent = '';
    }
  });
});

// ---------- Lihat / tutup password ----------
document.querySelectorAll('.peek').forEach((btn) => {
  btn.addEventListener('click', () => {
    const inp = $(btn.dataset.for);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Tutup' : 'Lihat';
  });
});

$('setuju').addEventListener('change', (e) => { if (e.target.checked) $('setujuErr').textContent = ''; });

// ---------- Kirim ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.hidden = true;

  let ok = true;
  Object.keys(RULES).forEach((id) => { if (!cekKolom(id)) ok = false; });
  if (!cekFile('foto')) ok = false;
  if (!cekFile('ktp')) ok = false;
  if (!$('setuju').checked) { $('setujuErr').textContent = 'Centang pernyataan ini untuk melanjutkan.'; ok = false; }

  if (!ok) {
    showAlert('Masih ada isian yang belum benar. Periksa kolom yang ditandai merah.', true);
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) {
      first.closest('.f').scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (first.type !== 'file') first.focus({ preventScroll: true });
    }
    return;
  }

  kirim.disabled = true;
  kirim.textContent = 'Mengirim...';

  // TODO (Supabase):
  // 1. Cek username belum dipakai (tabel profil)
  // 2. supabase.auth.signUp({ email: username + '@ranjaudarat.local', password })
  // 3. Upload foto & KTP ke Storage bucket PRIVAT 'dokumen-anggota/<user_id>/'
  // 4. Simpan data ke tabel 'anggota' dengan status 'menunggu'
  // 5. Jika berhasil -> tampilkanSelesai(); jika gagal -> showAlert(pesan, true)
  await new Promise((r) => setTimeout(r, 700));

  kirim.disabled = false;
  kirim.textContent = 'Kirim Pendaftaran';
  showAlert('Semua isian sudah benar. Pengiriman pendaftaran belum aktif karena sistem sedang disiapkan.');
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Dipanggil setelah pendaftaran benar-benar tersimpan
function tampilkanSelesai() {
  $('doneNama').textContent = $('nama').value.trim();
  $('doneUser').textContent = $('username').value;
  form.hidden = true;
  $('done').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
