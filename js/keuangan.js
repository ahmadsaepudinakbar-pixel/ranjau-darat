// Fitur Keuangan (kas) CV. Ranjau Darat
// Memakai fungsi bantu dari gaji.js (fmtRp, escG, namaPeriode, bulanIni, angka, tglID) — muat gaji.js lebih dulu.
// - muatRingkasanKas(periode)                     -> { ok, masuk, keluar, gaji, saldo } | { ok:false, error }
// - mulaiKeuangan({ wadah, bolehUbah, saatData })  -> tabel & formulir transaksi kas

const KATEGORI_KAS = {
  masuk: ['Iuran Anggota', 'Pembayaran Jasa Pengamanan', 'Donasi', 'Lainnya'],
  keluar: ['Operasional', 'Seragam & Perlengkapan', 'Transportasi', 'Alat Tulis & Cetak', 'Lainnya']
};

const hariIniISO = () => {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
};

// Awal bulan ini dan awal bulan berikutnya, untuk filter tanggal. periode = 'YYYY-MM'
function rentangBulan(periode) {
  const [y, m] = periode.split('-').map(Number);
  const berikut = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0');
  return [periode + '-01', berikut + '-01'];
}

async function muatRingkasanKas(periode) {
  const { data, error } = await sb.rpc('ringkasan_kas', { p_bulan: periode + '-01' });
  if (error || !data || !data.length) return { ok: false, error: error || new Error('Data ringkasan kosong') };
  const r = data[0];
  return { ok: true, masuk: Number(r.masuk_bulan), keluar: Number(r.keluar_bulan), gaji: Number(r.gaji_bulan), saldo: Number(r.saldo) };
}

const adaTabelKas = (err) => err && /ringkasan_kas|relation .*kas|does not exist|schema cache|Could not find/i.test(err.message || '');
const PESAN_SQL = 'Fitur keuangan belum disiapkan di database. Jalankan file 02_keuangan.sql di Supabase (SQL Editor) satu kali.';

function mulaiKeuangan({ wadah, bolehUbah = true, saatData }) {
  let rows = [];
  let periode = bulanIni();
  let filter = 'semua';       // semua | masuk | keluar
  let kataCari = '';
  let diedit = null;

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Transaksi Kas</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <label class="periode">Periode <input type="month" data-periode value="${periode}"></label>
        <label class="cari"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari transaksi</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari kategori / ket." data-cari>
        </label>
        ${bolehUbah ? '<button class="btn btn-gold" type="button" data-tambah>+ Catat Transaksi</button>' : ''}
      </div>
    </div>
    <div class="tabs" data-tabs role="group" aria-label="Filter jenis transaksi">
      <button type="button" data-f="semua" aria-pressed="true">Semua<span class="n" data-n="semua"></span></button>
      <button type="button" data-f="masuk" aria-pressed="false">Pemasukan<span class="n" data-n="masuk"></span></button>
      <button type="button" data-f="keluar" aria-pressed="false">Pengeluaran<span class="n" data-n="keluar"></span></button>
    </div>
    <div class="table-scroll">
      <table class="tbl">
        <thead><tr><th>No</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="rp">Pemasukan</th><th class="rp">Pengeluaran</th><th></th></tr></thead>
        <tbody data-isi><tr class="tidak-klik"><td colspan="7" class="empty">Memuat data...</td></tr></tbody>
      </table>
    </div>
    <div class="kas-total" data-total hidden></div>
    <p class="catatan-gaji" data-gaji hidden></p>`;

  const tbody = wadah.querySelector('[data-isi]');
  const boxTotal = wadah.querySelector('[data-total]');
  const boxGaji = wadah.querySelector('[data-gaji]');
  const kosong = (teks) => { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="7" class="empty">' + teks + '</td></tr>'; };

  const dlg = document.createElement('dialog');
  dlg.className = 'detail';
  dlg.setAttribute('aria-labelledby', 'kJudul');
  dlg.style.width = 'min(560px, calc(100% - 24px))';
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  async function muat() {
    kosong('Memuat data...');
    const [awal, akhir] = rentangBulan(periode);
    const { data, error } = await sb.from('kas')
      .select('id, tanggal, jenis, kategori, jumlah, keterangan')
      .gte('tanggal', awal).lt('tanggal', akhir)
      .order('tanggal', { ascending: false }).order('dibuat_pada', { ascending: false });
    if (error) { kosong('Gagal memuat. ' + escG(adaTabelKas(error) ? PESAN_SQL : pesanError(error))); if (saatData) saatData({ error }); return; }
    rows = data;
    tampil();
    const r = await muatRingkasanKas(periode);
    if (r.ok) {
      const g = r.gaji;
      boxGaji.hidden = !g;
      boxGaji.textContent = g ? 'Gaji anggota yang dibayarkan di ' + namaPeriode(periode) + ' (' + fmtRp(g) + ') sudah otomatis dihitung sebagai pengeluaran. Tidak perlu dicatat lagi di sini.' : '';
    }
    if (saatData) saatData(r.ok ? { ...r, periode: namaPeriode(periode), jumlah: rows.length } : { error: r.error, periode: namaPeriode(periode) });
  }

  function tampil() {
    const q = kataCari.trim().toLowerCase();
    const cocokCari = (t) => !q || (t.kategori + ' ' + (t.keterangan || '')).toLowerCase().includes(q);
    const cari = rows.filter(cocokCari);
    wadah.querySelector('[data-n="semua"]').textContent = cari.length;
    wadah.querySelector('[data-n="masuk"]').textContent = cari.filter((t) => t.jenis === 'masuk').length;
    wadah.querySelector('[data-n="keluar"]').textContent = cari.filter((t) => t.jenis === 'keluar').length;
    const tampilRows = cari.filter((t) => filter === 'semua' || t.jenis === filter);

    if (!tampilRows.length) {
      kosong(q || filter !== 'semua' ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi kas untuk ' + namaPeriode(periode) + '.');
      boxTotal.hidden = true;
      return;
    }
    tbody.innerHTML = tampilRows.map((t, i) => `
      <tr class="tidak-klik">
        <td class="no">${i + 1}</td>
        <td class="tgl">${tglID(t.tanggal)}</td>
        <td><span class="kat">${escG(t.kategori)}</span></td>
        <td class="ket">${t.keterangan ? escG(t.keterangan) : '–'}</td>
        <td class="rp masuk">${t.jenis === 'masuk' ? fmtRp(t.jumlah) : ''}</td>
        <td class="rp keluar">${t.jenis === 'keluar' ? fmtRp(t.jumlah) : ''}</td>
        <td>${bolehUbah ? '<div class="aksi-sel"><button class="btn btn-line btn-sm" type="button" data-ubah="' + t.id + '">Ubah</button><button class="btn btn-bad btn-sm" type="button" data-hapus="' + t.id + '">Hapus</button></div>' : ''}</td>
      </tr>`).join('');

    const masuk = tampilRows.filter((t) => t.jenis === 'masuk').reduce((a, t) => a + Number(t.jumlah), 0);
    const keluar = tampilRows.filter((t) => t.jenis === 'keluar').reduce((a, t) => a + Number(t.jumlah), 0);
    boxTotal.hidden = false;
    boxTotal.innerHTML = '<span>Pemasukan: <b class="m">' + fmtRp(masuk) + '</b></span><span>Pengeluaran: <b class="k">' + fmtRp(keluar) + '</b></span>';
  }

  // ---------- Formulir ----------
  function bukaForm(t = null) {
    diedit = t;
    const jenisAwal = t ? t.jenis : 'masuk';
    const tglAwal = t ? t.tanggal : (hariIniISO().slice(0, 7) === periode ? hariIniISO() : periode + '-01');
    dlg.innerHTML = `
      <div class="d-head">
        <div><h2 id="kJudul">${t ? 'Ubah Transaksi' : 'Catat Transaksi'}</h2><p>Pemasukan atau pengeluaran kas CV. Ranjau Darat.</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <form class="d-body slip-form" novalidate data-form>
        <div class="f"><label id="kJenisLbl">Jenis transaksi <i>*</i></label>
          <div class="jenis" role="radiogroup" aria-labelledby="kJenisLbl">
            <label><input type="radio" name="kJenis" value="masuk" ${jenisAwal === 'masuk' ? 'checked' : ''}><span>Pemasukan</span></label>
            <label><input type="radio" name="kJenis" value="keluar" ${jenisAwal === 'keluar' ? 'checked' : ''}><span>Pengeluaran</span></label>
          </div></div>
        <div class="grid">
          <div class="f"><label for="kTanggal">Tanggal <i>*</i></label>
            <input id="kTanggal" type="date" value="${tglAwal}" required><small class="err"></small></div>
          <div class="f"><label for="kKategori">Kategori <i>*</i></label>
            <select id="kKategori" required></select><small class="err"></small></div>
        </div>
        <div class="f"><label for="kJumlah">Jumlah <i>*</i></label>
          <div class="uang"><span>Rp</span><input id="kJumlah" inputmode="numeric" autocomplete="off" placeholder="0" value="${t ? Number(t.jumlah).toLocaleString('id-ID') : ''}"></div>
          <small class="err"></small></div>
        <div class="f"><label for="kKet">Keterangan (opsional)</label>
          <input id="kKet" type="text" maxlength="200" placeholder="Contoh: iuran Oktober, beli seragam 5 stel" value="${t && t.keterangan ? escG(t.keterangan) : ''}"></div>
        <p class="form-alert" data-alert hidden></p>
      </form>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-tutup>Batal</button>
        <button class="btn btn-gold" type="button" data-simpan>${t ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
      </div></div>`;

    const q = (s) => dlg.querySelector(s);
    const jenisDipilih = () => dlg.querySelector('input[name="kJenis"]:checked').value;
    const isiKategori = (pilih) => {
      const daftar = KATEGORI_KAS[jenisDipilih()];
      q('#kKategori').innerHTML = '<option value="" disabled' + (pilih && daftar.includes(pilih) ? '' : ' selected') + '>Pilih kategori</option>' +
        daftar.map((k) => '<option' + (k === pilih ? ' selected' : '') + '>' + escG(k) + '</option>').join('');
    };
    isiKategori(t && t.kategori);
    // Kategori lama yang sudah tidak ada di daftar tetap bisa dipilih saat mengubah
    if (t && !KATEGORI_KAS[t.jenis].includes(t.kategori)) {
      q('#kKategori').insertAdjacentHTML('beforeend', '<option selected>' + escG(t.kategori) + '</option>');
    }
    dlg.querySelectorAll('input[name="kJenis"]').forEach((r) => r.addEventListener('change', () => isiKategori(null)));
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));
    q('#kJumlah').addEventListener('input', (e) => { const n = angka(e.target.value); e.target.value = n ? n.toLocaleString('id-ID') : ''; });
    q('[data-simpan]').onclick = (e) => simpan(e.currentTarget, jenisDipilih);
    q('[data-form]').addEventListener('submit', (e) => { e.preventDefault(); simpan(q('[data-simpan]'), jenisDipilih); });
    if (!dlg.open) dlg.showModal();
    q('#kJumlah').focus();
  }

  async function simpan(btn, jenisDipilih) {
    const q = (s) => dlg.querySelector(s);
    const alertEl = q('[data-alert]');
    alertEl.hidden = true;
    const setErr = (el, teks) => { el.closest('.f').querySelector('.err').textContent = teks || ''; el.setAttribute('aria-invalid', teks ? 'true' : 'false'); return !teks; };

    let ok = true;
    ok = setErr(q('#kTanggal'), q('#kTanggal').value ? '' : 'Isi tanggal.') && ok;
    ok = setErr(q('#kKategori'), q('#kKategori').value ? '' : 'Pilih kategori.') && ok;
    ok = setErr(q('#kJumlah'), angka(q('#kJumlah').value) > 0 ? '' : 'Isi jumlah lebih dari Rp0.') && ok;
    if (!ok) return;

    const isi = {
      tanggal: q('#kTanggal').value,
      jenis: jenisDipilih(),
      kategori: q('#kKategori').value,
      jumlah: angka(q('#kJumlah').value),
      keterangan: q('#kKet').value.trim() || null
    };

    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const res = diedit
      ? await sb.from('kas').update(isi).eq('id', diedit.id).select('id')
      : await sb.from('kas').insert(isi).select('id');
    btn.disabled = false; btn.textContent = awal;

    if (res.error || !res.data || !res.data.length) {
      alertEl.textContent = res.error
        ? (adaTabelKas(res.error) ? PESAN_SQL : 'Gagal menyimpan. ' + pesanError(res.error))
        : 'Gagal menyimpan. Anda tidak punya izin.';
      alertEl.hidden = false;
      return;
    }
    const per = isi.tanggal.slice(0, 7);
    dlg.close();
    toast((diedit ? 'Transaksi diperbarui: ' : 'Transaksi tersimpan: ') + (isi.jenis === 'masuk' ? '+' : '−') + fmtRp(isi.jumlah) + '.');
    if (per !== periode) { periode = per; wadah.querySelector('[data-periode]').value = per; }
    muat();
  }

  function konfirmasiHapus(t) {
    dlg.innerHTML = `
      <div class="d-head"><div><h2 id="kJudul">Hapus transaksi?</h2><p>${tglID(t.tanggal)} · ${escG(t.kategori)}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button></div>
      <div class="d-body">
        <div class="slip">
          <div class="row"><span>Jenis</span><b>${t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</b></div>
          <div class="row"><span>Jumlah</span><b>${fmtRp(t.jumlah)}</b></div>
          ${t.keterangan ? '<div class="row"><span>Keterangan</span><b>' + escG(t.keterangan) + '</b></div>' : ''}
        </div>
        <p style="margin:0;color:var(--bad);font-weight:600">Transaksi ini akan hilang dan saldo kas ikut berubah. Tindakan ini tidak bisa dibatalkan.</p>
      </div>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-tutup>Batal</button>
        <button class="btn btn-bad solid" type="button" data-ya>Ya, hapus</button></div></div>`;
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));
    dlg.querySelector('[data-ya]').onclick = async (e) => {
      e.currentTarget.disabled = true;
      const { data, error } = await sb.from('kas').delete().eq('id', t.id).select('id');
      if (error || !data || !data.length) { toast('Gagal menghapus. ' + (error ? pesanError(error) : 'Anda tidak punya izin.'), true); e.currentTarget.disabled = false; return; }
      dlg.close(); toast('Transaksi dihapus.'); muat();
    };
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Interaksi ----------
  wadah.querySelector('[data-periode]').addEventListener('change', (e) => { if (e.target.value) { periode = e.target.value; muat(); } });
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  wadah.querySelector('[data-tabs]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f;
    wadah.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    tampil();
  });
  const tTambah = wadah.querySelector('[data-tambah]');
  if (tTambah) tTambah.addEventListener('click', () => bukaForm());
  tbody.addEventListener('click', (e) => {
    const u = e.target.closest('[data-ubah]'); if (u) return bukaForm(rows.find((t) => t.id === u.dataset.ubah));
    const h = e.target.closest('[data-hapus]'); if (h) return konfirmasiHapus(rows.find((t) => t.id === h.dataset.hapus));
  });

  muat();
}
