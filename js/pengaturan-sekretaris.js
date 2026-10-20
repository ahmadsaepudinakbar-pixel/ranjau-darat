// Pengaturan Sekretariat: kop & kontak, penandatangan, kode penomoran surat, ganti password.
// Memakai gaji.js (escG) — muat lebih dulu.
// mulaiPengaturanSekretaris({ wadah, bolehUbah, akun })

const PESAN_SQL_SEK = 'Pengaturan belum disiapkan di database. Jalankan file 05_sekretariat.sql di Supabase (SQL Editor) satu kali.';

async function mulaiPengaturanSekretaris({ wadah, bolehUbah = true, akun }) {
  wadah.innerHTML = '<p class="kosong">Memuat pengaturan...</p>';
  const { data: p, error } = await sb.from('pengaturan_sekretariat').select('*').eq('id', 1).maybeSingle();
  if (error || !p) {
    wadah.innerHTML = '<div class="card"><p class="kosong">' + escG(error && !/schema cache|does not exist|Could not find/i.test(error.message || '') ? 'Gagal memuat pengaturan. ' + pesanError(error) : PESAN_SQL_SEK) + '</p></div>';
    return;
  }

  const dis = bolehUbah ? '' : ' disabled';
  const teks = (id, label, nilai, maks, ket = '', tipe = 'text') => `
    <div class="f"><label for="${id}">${label}</label>
      <input id="${id}" type="${tipe}" maxlength="${maks}" value="${escG(nilai || '')}"${dis}>
      ${ket ? '<small class="hint">' + ket + '</small>' : ''}<small class="err"></small></div>`;

  wadah.innerHTML = `
    <form class="pengaturan" data-form novalidate>
      <section class="card">
        <h2>Data Organisasi</h2>
        <p class="sub">Tampil sebagai kop di Laporan Sekretariat.</p>
        <div class="slip-form">
          ${teks('pNama', 'Nama organisasi <i>*</i>', p.nama_organisasi, 100)}
          ${teks('pAlamat', 'Alamat (opsional)', p.alamat, 200, 'Contoh: Jl. Raya Pamanukan No. 1, Subang')}
          <div class="dua">
            ${teks('pTelepon', 'Telepon (opsional)', p.telepon, 40, '', 'tel')}
            ${teks('pEmail', 'Email (opsional)', p.email, 100, '', 'email')}
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Penandatangan</h2>
        <p class="sub">Nama yang tercetak di bagian tanda tangan laporan.</p>
        <div class="slip-form dua">
          ${teks('pKetua', 'Nama Ketua', p.nama_ketua, 80)}
          ${teks('pSekretaris', 'Nama Sekretaris', p.nama_sekretaris, 80)}
        </div>
      </section>

      <section class="card">
        <h2>Penomoran Surat Keluar</h2>
        <p class="sub">Kode ini dipakai untuk usulan nomor otomatis saat mencatat surat keluar.</p>
        <div class="slip-form">
          ${teks('pKode', 'Kode surat <i>*</i>', p.kode_surat, 12, 'Huruf, angka, titik, atau strip. Contoh: RD')}
          <p class="hint" style="margin:0;color:var(--muted);font-size:.88rem">Contoh nomor: <b data-contoh></b></p>
        </div>
      </section>

      ${bolehUbah ? `
      <p class="form-alert" data-alert hidden></p>
      <div class="aksi"><button class="btn btn-gold" type="submit" data-simpan>Simpan Pengaturan</button></div>`
      : '<p class="catatan-gaji">Hanya Sekretaris dan Admin yang dapat mengubah pengaturan.</p>'}
    </form>

    <form class="pengaturan" data-form-sandi novalidate>
      <section class="card">
        <h2>Keamanan Akun</h2>
        <p class="sub">Ganti password akun <b>@${escG(akun.username)}</b>. Gunakan minimal 8 karakter.</p>
        <div class="slip-form dua">
          <div class="f"><label for="sBaru">Password baru</label><input id="sBaru" type="password" autocomplete="new-password" minlength="8"><small class="err"></small></div>
          <div class="f"><label for="sUlang">Ulangi password baru</label><input id="sUlang" type="password" autocomplete="new-password"><small class="err"></small></div>
        </div>
        <p class="form-alert" data-alert-sandi hidden style="margin-top:.9rem"></p>
        <div class="aksi" style="margin-top:.9rem"><button class="btn btn-line" type="submit" data-simpan-sandi>Ganti Password</button></div>
      </section>
    </form>`;

  const q = (s) => wadah.querySelector(s);
  const setErr = (el, t) => { el.closest('.f').querySelector('.err').textContent = t || ''; el.setAttribute('aria-invalid', t ? 'true' : 'false'); return !t; };
  const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const contoh = () => {
    const n = new Date();
    q('[data-contoh]').textContent = '001/' + (q('#pKode').value.trim() || 'RD') + '/' + romawi[n.getMonth()] + '/' + n.getFullYear();
  };
  q('#pKode').addEventListener('input', contoh);
  contoh();

  // ---------- Simpan pengaturan ----------
  if (bolehUbah) {
    const alertEl = q('[data-alert]');
    q('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.hidden = true;
      const kode = q('#pKode').value.trim();
      const email = q('#pEmail').value.trim();
      let ok = true;
      ok = setErr(q('#pNama'), q('#pNama').value.trim() ? '' : 'Nama organisasi wajib diisi.') && ok;
      ok = setErr(q('#pKode'), /^[A-Za-z0-9.-]{1,12}$/.test(kode) ? '' : 'Kode 1-12 karakter: huruf, angka, titik, atau strip.') && ok;
      ok = setErr(q('#pEmail'), !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Format email tidak valid.') && ok;
      if (!ok) return;

      const btn = q('[data-simpan]');
      const awal = btn.textContent;
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      const { data, error: err } = await sb.from('pengaturan_sekretariat').update({
        nama_organisasi: q('#pNama').value.trim(),
        alamat: q('#pAlamat').value.trim() || null,
        telepon: q('#pTelepon').value.trim() || null,
        email: email || null,
        nama_ketua: q('#pKetua').value.trim() || null,
        nama_sekretaris: q('#pSekretaris').value.trim() || null,
        kode_surat: kode,
        diubah_pada: new Date().toISOString()
      }).eq('id', 1).select('id');
      btn.disabled = false; btn.textContent = awal;

      if (err || !data || !data.length) {
        alertEl.textContent = 'Gagal menyimpan. ' + (err ? pesanError(err) : 'Anda tidak punya izin.');
        alertEl.hidden = false;
        return;
      }
      toast('Pengaturan tersimpan.');
    });
  }

  // ---------- Ganti password ----------
  const alertSandi = q('[data-alert-sandi]');
  q('[data-form-sandi]').addEventListener('submit', async (e) => {
    e.preventDefault();
    alertSandi.hidden = true;
    const baru = q('#sBaru'), ulang = q('#sUlang');
    let ok = true;
    ok = setErr(baru, baru.value.length >= 8 ? '' : 'Password minimal 8 karakter.') && ok;
    ok = setErr(ulang, ulang.value === baru.value ? '' : 'Password tidak sama.') && ok;
    if (!ok) return;

    const btn = q('[data-simpan-sandi]');
    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { error: err } = await sb.auth.updateUser({ password: baru.value });
    btn.disabled = false; btn.textContent = awal;
    if (err) {
      alertSandi.textContent = /same|different from the old/i.test(err.message || '') ? 'Password baru harus berbeda dari yang lama.' : 'Gagal mengganti password. ' + pesanError(err);
      alertSandi.hidden = false;
      return;
    }
    baru.value = ''; ulang.value = '';
    toast('Password berhasil diganti.');
  });
}
