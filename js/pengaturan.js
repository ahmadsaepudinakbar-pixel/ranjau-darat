// Pengaturan keuangan CV. Ranjau Darat: kop laporan, saldo awal kas, daftar kategori.
// Memakai gaji.js (escG, fmtRp, angka) dan keuangan.js (muatPengaturanKas) — muat keduanya lebih dulu.
// mulaiPengaturan({ wadah, bolehUbah })

const PESAN_SQL_PENGATURAN = 'Pengaturan belum disiapkan di database. Jalankan file 03_laporan_pengaturan.sql di Supabase (SQL Editor) satu kali.';

async function mulaiPengaturan({ wadah, bolehUbah = true }) {
  wadah.innerHTML = '<p class="kosong">Memuat pengaturan...</p>';
  const p = await muatPengaturanKas();
  if (!p) { wadah.innerHTML = '<div class="card"><p class="kosong">' + escG(PESAN_SQL_PENGATURAN) + '</p></div>'; return; }

  const dis = bolehUbah ? '' : ' disabled';
  const teks = (id, label, nilai, maks, ket = '') => `
    <div class="f"><label for="${id}">${label}</label>
      <input id="${id}" type="text" maxlength="${maks}" value="${escG(nilai || '')}"${dis}>
      ${ket ? '<small class="hint">' + ket + '</small>' : ''}<small class="err"></small></div>`;

  wadah.innerHTML = `
    <form class="pengaturan" data-form novalidate>
      <section class="card">
        <h2>Data Organisasi</h2>
        <p class="sub">Tampil sebagai kop dan tanda tangan di Laporan Keuangan.</p>
        <div class="slip-form">
          ${teks('pNama', 'Nama organisasi <i>*</i>', p.nama_organisasi, 100)}
          ${teks('pAlamat', 'Alamat (opsional)', p.alamat, 200, 'Contoh: Jl. Raya Pamanukan No. 1, Subang')}
          <div class="dua">
            ${teks('pKetua', 'Nama Ketua', p.nama_ketua, 80)}
            ${teks('pBendahara', 'Nama Bendahara', p.nama_bendahara, 80)}
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Saldo Awal Kas</h2>
        <p class="sub">Uang kas yang sudah ada sebelum transaksi pertama dicatat di sistem ini. Dihitung sekali di saldo kas dan laporan.</p>
        <div class="slip-form"><div class="f"><label for="pSaldo">Saldo awal</label>
          <div class="uang"><span>Rp</span><input id="pSaldo" inputmode="numeric" autocomplete="off" placeholder="0" value="${p.saldo_awal ? Number(p.saldo_awal).toLocaleString('id-ID') : ''}"${dis}></div>
          <small class="err"></small></div></div>
      </section>

      <section class="card">
        <h2>Kategori Transaksi</h2>
        <p class="sub">Tulis satu kategori per baris. Mengubah daftar ini tidak mengubah transaksi yang sudah tercatat.</p>
        <div class="slip-form dua">
          <div class="f"><label for="pMasuk">Kategori pemasukan</label>
            <textarea id="pMasuk" spellcheck="false"${dis}>${escG((p.kategori_masuk || []).join('\n'))}</textarea><small class="err"></small></div>
          <div class="f"><label for="pKeluar">Kategori pengeluaran</label>
            <textarea id="pKeluar" spellcheck="false"${dis}>${escG((p.kategori_keluar || []).join('\n'))}</textarea><small class="err"></small></div>
        </div>
      </section>

      ${bolehUbah ? `
      <p class="form-alert" data-alert hidden></p>
      <div class="aksi"><button class="btn btn-gold" type="submit" data-simpan>Simpan Pengaturan</button></div>`
      : '<p class="catatan-gaji">Hanya Bendahara dan Admin yang dapat mengubah pengaturan.</p>'}
    </form>`;

  if (!bolehUbah) return;
  const q = (s) => wadah.querySelector(s);
  const alertEl = q('[data-alert]');
  q('#pSaldo').addEventListener('input', (e) => { const n = angka(e.target.value); e.target.value = n ? n.toLocaleString('id-ID') : ''; });

  // Satu kategori per baris -> daftar bersih (tanpa baris kosong / ganda)
  const daftar = (el) => {
    const hasil = [];
    el.value.split('\n').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean).forEach((s) => {
      if (!hasil.some((x) => x.toLowerCase() === s.toLowerCase())) hasil.push(s);
    });
    return hasil;
  };
  const setErr = (el, t) => { el.closest('.f').querySelector('.err').textContent = t || ''; el.setAttribute('aria-invalid', t ? 'true' : 'false'); return !t; };

  q('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.hidden = true;
    const masuk = daftar(q('#pMasuk'));
    const keluar = daftar(q('#pKeluar'));
    let ok = true;
    ok = setErr(q('#pNama'), q('#pNama').value.trim() ? '' : 'Nama organisasi wajib diisi.') && ok;
    const cekKat = (el, arr) => setErr(el, !arr.length ? 'Isi minimal satu kategori.' : arr.length > 20 ? 'Maksimal 20 kategori.' : arr.some((k) => k.length > 60) ? 'Satu kategori maksimal 60 huruf.' : '');
    ok = cekKat(q('#pMasuk'), masuk) && ok;
    ok = cekKat(q('#pKeluar'), keluar) && ok;
    if (!ok) return;

    const btn = q('[data-simpan]');
    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data, error } = await sb.from('pengaturan_kas').update({
      nama_organisasi: q('#pNama').value.trim(),
      alamat: q('#pAlamat').value.trim() || null,
      nama_ketua: q('#pKetua').value.trim() || null,
      nama_bendahara: q('#pBendahara').value.trim() || null,
      saldo_awal: angka(q('#pSaldo').value),
      kategori_masuk: masuk,
      kategori_keluar: keluar,
      diubah_pada: new Date().toISOString()
    }).eq('id', 1).select('id');
    btn.disabled = false; btn.textContent = awal;

    if (error || !data || !data.length) {
      alertEl.textContent = 'Gagal menyimpan. ' + (error ? pesanError(error) : 'Anda tidak punya izin.');
      alertEl.hidden = false;
      return;
    }
    // Rapikan isi kolom sesuai yang tersimpan
    q('#pMasuk').value = masuk.join('\n');
    q('#pKeluar').value = keluar.join('\n');
    toast('Pengaturan tersimpan.');
  });
}
