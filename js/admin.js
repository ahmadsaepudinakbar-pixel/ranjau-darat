// Panel Admin CV. Ranjau Darat: daftar pengurus + tambah pengurus (akun langsung aktif)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { admin: 'Admin', ketua: 'Ketua', sekretaris: 'Sekretaris', bendahara: 'Bendahara', anggota: 'Anggota' };
const URUT = { admin: 0, ketua: 1, sekretaris: 2, bendahara: 3 };
const PROVINSI = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Kepulauan Bangka Belitung','Bengkulu','Lampung','Jakarta','Jawa Barat','Banten','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Tengah','Papua Pegunungan','Papua Selatan'];

let saya = null;

document.querySelectorAll('.yr').forEach((e) => (e.textContent = new Date().getFullYear()));
$('p_prov').insertAdjacentHTML('beforeend', PROVINSI.map((p) => '<option>' + p + '</option>').join(''));

// ---------- Mulai ----------
wajibLogin(['admin']).then((akun) => {
  if (!akun) return;
  saya = akun;
  $('nama').textContent = akun.nama;
  $('uname').textContent = akun.username;
  $('loading').hidden = true;
  $('isi').hidden = false;
  muatPengurus();
});

// ---------- Daftar pengurus ----------
async function muatPengurus() {
  const tbody = $('tbody');
  const { data, error } = await sb.from('anggota')
    .select('id, nama, username, no_wa, jabatan')
    .in('jabatan', ['admin', 'ketua', 'sekretaris', 'bendahara'])
    .eq('status', 'diterima');

  if (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Gagal memuat data. ' + esc(pesanError(error)) + '</td></tr>';
    return;
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada pengurus. Klik "+ Tambah Pengurus".</td></tr>';
    return;
  }

  data.sort((a, b) => (URUT[a.jabatan] - URUT[b.jabatan]) || a.nama.localeCompare(b.nama));
  tbody.innerHTML = data.map((p) => {
    const aksi = p.jabatan === 'admin'
      ? '<span class="muted">' + (p.id === saya.id ? 'Akun Anda' : '—') + '</span>'
      : '<div class="ubah"><select data-id="' + p.id + '" data-awal="' + p.jabatan + '" aria-label="Jabatan ' + esc(p.nama) + '">' +
          ['ketua', 'sekretaris', 'bendahara', 'anggota'].map((j) =>
            '<option value="' + j + '"' + (j === p.jabatan ? ' selected' : '') + '>' +
            (j === 'anggota' ? 'Turunkan jadi anggota' : LABEL[j]) + '</option>').join('') +
        '</select><button class="btn btn-gold" type="button" data-simpan="' + p.id + '" hidden>Simpan</button></div>';
    return '<tr><td><b>' + esc(p.nama) + '</b></td><td>' + esc(p.username) + '</td><td>' + esc(p.no_wa) + '</td>' +
      '<td><span class="badge b-' + p.jabatan + '">' + LABEL[p.jabatan] + '</span></td><td class="aksi">' + aksi + '</td></tr>';
  }).join('');
}

// Ubah jabatan: tombol Simpan muncul setelah pilihan diganti
$('tbody').addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-id]');
  if (!sel) return;
  const btn = $('tbody').querySelector('[data-simpan="' + sel.dataset.id + '"]');
  btn.hidden = sel.value === sel.dataset.awal;
});

$('tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-simpan]');
  if (!btn) return;
  const id = btn.dataset.simpan;
  const sel = $('tbody').querySelector('select[data-id="' + id + '"]');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const { data, error } = await sb.from('anggota').update({ jabatan: sel.value }).eq('id', id).select('id');
  if (error || !data || !data.length) {
    tampilPesan($('listMsg'), 'Jabatan gagal diubah. ' + (error ? pesanError(error) : 'Anda tidak punya izin.'), true);
    btn.disabled = false; btn.textContent = 'Simpan';
    return;
  }
  tampilPesan($('listMsg'), sel.value === 'anggota'
    ? 'Jabatan diubah. Orang ini sekarang anggota biasa dan tidak lagi tampil di daftar pengurus.'
    : 'Jabatan berhasil diubah menjadi ' + LABEL[sel.value] + '.', false);
  muatPengurus();
});

function tampilPesan(el, teks, buruk) {
  el.textContent = teks;
  el.className = 'alert ' + (buruk ? 'bad' : 'ok');
  el.hidden = false;
}

// ---------- Buka / tutup formulir ----------
$('btnTambah').addEventListener('click', () => {
  $('hasil').hidden = true;
  $('formPanel').hidden = false;
  $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('p_jabatan').focus({ preventScroll: true });
});
$('btnTutup').addEventListener('click', () => { $('formPanel').hidden = true; });
$('btnReset').addEventListener('click', () => {
  $('formPengurus').querySelectorAll('.err').forEach((e) => (e.textContent = ''));
  $('formPengurus').querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  $('formMsg').hidden = true;
});

// Password acak 10 karakter (tanpa huruf/angka yang mirip seperti l, 1, O, 0)
$('btnAcak').addEventListener('click', () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  $('p_pass').value = Array.from(r, (n) => abc[n % abc.length]).join('');
  cek('p_pass');
});

// ---------- Validasi ----------
['p_nik', 'p_rt', 'p_rw'].forEach((id) => $(id).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); }));
$('p_wa').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d+]/g, ''); });
$('p_username').addEventListener('input', (e) => { e.target.value = e.target.value.toLowerCase().replace(/\s/g, ''); });

const RULES = {
  p_jabatan: (v) => !v ? 'Pilih jabatan.' : '',
  p_username: (v) => !/^[a-z0-9._]{4,20}$/.test(v) ? 'Username 4–20 karakter: huruf kecil, angka, titik, atau garis bawah.' : '',
  p_pass: (v) => v.length < 8 ? 'Password minimal 8 karakter.' : '',
  p_nama: (v) => v.trim().length < 3 ? 'Nama lengkap wajib diisi.' : '',
  p_nik: (v) => v.length !== 16 ? 'NIK harus 16 digit angka.' : '',
  p_tempat: (v) => !v.trim() ? 'Wajib diisi.' : '',
  p_tgl: (v) => !v ? 'Wajib diisi.' : (new Date(v) > new Date() ? 'Tanggal tidak boleh di masa depan.' : ''),
  p_jk: (v) => !v ? 'Pilih jenis kelamin.' : '',
  p_wa: (v) => !/^(\+62|62|0)8\d{7,12}$/.test(v) ? 'Nomor WhatsApp tidak valid.' : '',
  p_alamat: (v) => v.trim().length < 3 ? 'Wajib diisi.' : '',
  p_rt: (v) => !v ? 'Wajib.' : '',
  p_rw: (v) => !v ? 'Wajib.' : '',
  p_desa: (v) => !v.trim() ? 'Wajib diisi.' : '',
  p_kec: (v) => !v.trim() ? 'Wajib diisi.' : '',
  p_kab: (v) => !v.trim() ? 'Wajib diisi.' : '',
  p_prov: (v) => !v ? 'Pilih provinsi.' : ''
};

function setErr(el, teks) {
  const err = el.closest('.f').querySelector('.err');
  err.textContent = teks || '';
  el.setAttribute('aria-invalid', teks ? 'true' : 'false');
  return !teks;
}
function cek(id) { return setErr($(id), RULES[id]($(id).value)); }

Object.keys(RULES).forEach((id) => {
  $(id).addEventListener('change', () => cek(id));
  $(id).addEventListener('input', () => { if ($(id).getAttribute('aria-invalid') === 'true') cek(id); });
});

// ---------- Simpan pengurus baru ----------
$('formPengurus').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('formMsg').hidden = true;

  let ok = true;
  Object.keys(RULES).forEach((id) => { if (!cek(id)) ok = false; });
  if (!ok) {
    tampilPesan($('formMsg'), 'Masih ada isian yang belum benar. Periksa kolom yang ditandai merah.', true);
    const first = $('formPengurus').querySelector('[aria-invalid="true"]');
    if (first) first.focus();
    return;
  }

  const btn = $('btnSimpan');
  btn.disabled = true;
  try {
    const hasil = await buatPengurus((t) => (btn.textContent = t));
    tunjukkanHasil(hasil);
  } catch (err) {
    console.error(err);
    tampilPesan($('formMsg'), err.pesan || pesanError(err), true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan & Aktifkan Akun';
  }
});

function gagal(pesan) { const e = new Error(pesan); e.pesan = pesan; return e; }

async function buatPengurus(status) {
  const username = $('p_username').value;
  const password = $('p_pass').value;
  const jabatan = $('p_jabatan').value;
  const nik = $('p_nik').value;

  status('Memeriksa...');
  const [u, n] = await Promise.all([
    sb.rpc('username_tersedia', { u: username }),
    sb.rpc('nik_terdaftar', { n: nik })
  ]);
  if (u.error) throw u.error;
  if (n.error) throw n.error;
  if (u.data === false) { setErr($('p_username'), 'Username sudah dipakai.'); throw gagal('Username ini sudah dipakai. Pilih username lain.'); }
  if (n.data === true) { setErr($('p_nik'), 'NIK sudah terdaftar.'); throw gagal('NIK ini sudah terdaftar. Jika orangnya sudah punya akun, ubah jabatannya dari daftar pengurus atau dashboard Sekretaris.'); }

  // Akun baru dibuat lewat koneksi terpisah, supaya Admin tetap login
  status('Membuat akun...');
  const tmp = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rd-akun-baru' }
  });
  const { data, error } = await tmp.auth.signUp({ email: usernameKeEmail(username), password });
  if (error) throw error;
  if (!data.session) throw gagal('Akun dibuat tetapi belum aktif. Pastikan "Confirm email" di Supabase dimatikan.');
  const id = data.user.id;

  status('Menyimpan data...');
  const { error: errIns } = await tmp.from('anggota').insert({
    id, username,
    nama: $('p_nama').value.trim(),
    nik,
    tempat_lahir: $('p_tempat').value.trim(),
    tanggal_lahir: $('p_tgl').value,
    jenis_kelamin: $('p_jk').value,
    posisi: 'anggota',
    no_wa: $('p_wa').value.trim(),
    alamat: $('p_alamat').value.trim(),
    rt: $('p_rt').value, rw: $('p_rw').value,
    desa: $('p_desa').value.trim(),
    kecamatan: $('p_kec').value.trim(),
    kabupaten: $('p_kab').value.trim(),
    provinsi: $('p_prov').value
  });
  await tmp.auth.signOut({ scope: 'local' });
  if (errIns) throw errIns;

  // Admin mengangkat jabatan & langsung menyetujui
  status('Mengaktifkan...');
  const { data: upd, error: errUpd } = await sb.from('anggota')
    .update({ jabatan, status: 'diterima' }).eq('id', id).select('id');
  if (errUpd) throw errUpd;
  if (!upd || !upd.length) throw gagal('Akun dibuat, tetapi jabatan belum bisa diatur. Muat ulang halaman lalu ubah jabatannya dari daftar.');

  return { nama: $('p_nama').value.trim(), jabatan, username, password };
}

function tunjukkanHasil(h) {
  $('h_nama').textContent = h.nama;
  $('h_jabatan').textContent = LABEL[h.jabatan];
  $('h_user').textContent = h.username;
  $('h_pass').textContent = h.password;
  $('formPengurus').reset();
  $('formPanel').hidden = true;
  $('hasil').hidden = false;
  $('hasil').scrollIntoView({ behavior: 'smooth', block: 'center' });
  muatPengurus();
}

$('btnSalin').addEventListener('click', async () => {
  const teks = 'Login Sistem CV. Ranjau Darat\nJabatan: ' + $('h_jabatan').textContent +
    '\nUsername: ' + $('h_user').textContent + '\nPassword: ' + $('h_pass').textContent +
    '\nAlamat: ' + location.href.replace(/admin\.html.*$/, 'login.html');
  try {
    await navigator.clipboard.writeText(teks);
    $('btnSalin').textContent = 'Tersalin ✓';
  } catch {
    $('btnSalin').textContent = 'Salin manual';
  }
  setTimeout(() => ($('btnSalin').textContent = 'Salin data login'), 2000);
});

$('btnSelesai').addEventListener('click', () => {
  $('h_pass').textContent = '';
  $('hasil').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
