// Fitur Gaji CV. Ranjau Darat
// - mulaiGajiBendahara({ wadah, saatData, bolehUbah })  -> input & kelola slip gaji
// - mulaiGajiAnggota({ wadah, anggotaId })             -> riwayat gaji milik sendiri

const fmtRp = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const escG = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const namaPeriode = (d) => { const [y, m] = String(d).split('-'); return BULAN[Number(m) - 1] + ' ' + y; };
const tglID = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const bulanIni = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); };
const angka = (s) => Number(String(s || '').replace(/\D/g, '')) || 0;

function htmlSlip(g) {
  const r = (k, v, cls = '') => '<div class="row ' + cls + '"><span>' + k + '</span><b>' + v + '</b></div>';
  return '<div class="slip">' +
    r('Gaji pokok', fmtRp(g.gaji_pokok)) +
    r('Lembur', fmtRp(g.lembur)) +
    r('Tunjangan', fmtRp(g.tunjangan)) +
    r('Potongan', '− ' + fmtRp(g.potongan), 'minus') +
    r('Total diterima', fmtRp(g.total), 'total') +
    (g.keterangan ? '<div class="row"><span>Keterangan</span><b>' + escG(g.keterangan) + '</b></div>' : '') +
  '</div>';
}

// =====================================================================
// BENDAHARA
// =====================================================================
function mulaiGajiBendahara({ wadah, saatData, bolehUbah = true }) {
  let satpam = [];      // anggota aktif
  let slip = [];        // slip periode terpilih
  let periode = bulanIni();
  let kataCari = '';
  let diedit = null;    // slip yang sedang diubah

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Gaji Anggota</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <label class="periode">Periode <input type="month" data-periode value="${periode}"></label>
        <label class="cari"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari nama</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari nama" data-cari>
        </label>
        ${bolehUbah ? '<button class="btn btn-gold" type="button" data-tambah>+ Input Gaji</button>' : ''}
      </div>
    </div>
    <div class="table-scroll">
      <table class="tbl">
        <thead><tr><th>No</th><th>Nama</th><th>Tgl Gajian</th><th class="rp">Gaji Pokok</th><th class="rp">Lembur</th><th class="rp">Tunjangan</th><th class="rp">Potongan</th><th class="rp">Total</th><th></th></tr></thead>
        <tbody data-isi><tr class="tidak-klik"><td colspan="9" class="empty">Memuat data...</td></tr></tbody>
      </table>
    </div>
    <div class="belum" data-belum hidden><h3></h3><ul></ul></div>`;

  const tbody = wadah.querySelector('[data-isi]');
  const boxBelum = wadah.querySelector('[data-belum]');

  // ---------- Dialog formulir ----------
  const dlg = document.createElement('dialog');
  dlg.className = 'detail';
  dlg.setAttribute('aria-labelledby', 'gJudul');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  async function muatSatpam() {
    const { data, error } = await sb.from('anggota')
      .select('id, nama, username, posisi').eq('jabatan', 'anggota').eq('status', 'diterima').order('nama');
    if (error) throw error;
    satpam = data;
  }

  async function muatSlip() {
    tbody.innerHTML = '<tr class="tidak-klik"><td colspan="9" class="empty">Memuat data...</td></tr>';
    const { data, error } = await sb.from('gaji')
      .select('id, anggota_id, periode, tanggal_gajian, gaji_pokok, lembur, tunjangan, potongan, total, keterangan')
      .eq('periode', periode + '-01').order('tanggal_gajian', { ascending: false });
    if (error) { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="9" class="empty">Gagal memuat. ' + escG(pesanError(error)) + '</td></tr>'; return; }
    slip = data;
    tampil();
  }

  const namaDari = (id) => (satpam.find((s) => s.id === id) || {}).nama || '(akun nonaktif)';

  function tampil() {
    const q = kataCari.trim().toLowerCase();
    const rows = slip.map((g) => ({ ...g, nama: namaDari(g.anggota_id) }))
      .filter((g) => !q || g.nama.toLowerCase().includes(q))
      .sort((a, b) => a.nama.localeCompare(b.nama));

    if (!rows.length) {
      tbody.innerHTML = '<tr class="tidak-klik"><td colspan="9" class="empty">' +
        (q ? 'Tidak ada yang cocok.' : 'Belum ada gaji yang dicatat untuk ' + namaPeriode(periode) + '.') + '</td></tr>';
    } else {
      tbody.innerHTML = rows.map((g, i) => `
        <tr class="tidak-klik">
          <td class="no">${i + 1}</td>
          <td class="nm"><b>${escG(g.nama)}</b>${g.keterangan ? '<small>' + escG(g.keterangan) + '</small>' : ''}</td>
          <td class="tgl">${new Date(g.tanggal_gajian + 'T00:00:00').toLocaleDateString('id-ID')}</td>
          <td class="rp">${fmtRp(g.gaji_pokok)}</td>
          <td class="rp">${fmtRp(g.lembur)}</td>
          <td class="rp">${fmtRp(g.tunjangan)}</td>
          <td class="rp${g.potongan ? ' min' : ''}">${g.potongan ? '− ' + fmtRp(g.potongan) : fmtRp(0)}</td>
          <td class="rp tot">${fmtRp(g.total)}</td>
          <td>${bolehUbah ? '<div class="aksi-sel"><button class="btn btn-line btn-sm" type="button" data-ubah="' + g.id + '">Ubah</button><button class="btn btn-bad btn-sm" type="button" data-hapus="' + g.id + '">Hapus</button></div>' : ''}</td>
        </tr>`).join('');
    }

    // Satpam yang belum digaji periode ini
    const sudah = new Set(slip.map((g) => g.anggota_id));
    const belum = satpam.filter((s) => !sudah.has(s.id));
    boxBelum.hidden = !belum.length || !bolehUbah;
    boxBelum.querySelector('h3').textContent = belum.length + ' anggota belum dicatat gajinya untuk ' + namaPeriode(periode) + ':';
    boxBelum.querySelector('ul').innerHTML = belum.map((s) => '<li><button type="button" data-input-untuk="' + s.id + '">' + escG(s.nama) + '</button></li>').join('');

    if (saatData) saatData({
      periode: namaPeriode(periode),
      totalDibayar: slip.reduce((a, g) => a + Number(g.total), 0),
      jumlahSlip: slip.length,
      jumlahSatpam: satpam.length,
      belum: belum.length
    });
  }

  // ---------- Formulir ----------
  function bukaForm(g = null, anggotaId = null) {
    diedit = g;
    const opsi = satpam.map((s) => '<option value="' + s.id + '"' + ((g ? g.anggota_id : anggotaId) === s.id ? ' selected' : '') + '>' + escG(s.nama) + ' (@' + escG(s.username) + ')</option>').join('');
    const n = new Date(); const hariIni = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    const uang = (id, label, val) => `
      <div class="f"><label for="${id}">${label}</label>
        <div class="uang"><span>Rp</span><input id="${id}" inputmode="numeric" autocomplete="off" value="${val ? Number(val).toLocaleString('id-ID') : ''}" placeholder="0"></div>
      </div>`;

    dlg.innerHTML = `
      <div class="d-head">
        <div><h2 id="gJudul">${g ? 'Ubah Slip Gaji' : 'Input Gaji'}</h2><p>${g ? escG(namaDari(g.anggota_id)) + ' · ' + namaPeriode(g.periode) : 'Isi rincian gaji satu anggota untuk satu bulan.'}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <form class="d-body slip-form" novalidate data-form>
        <div class="f"><label for="gAnggota">Nama anggota <i>*</i></label>
          <select id="gAnggota" ${g ? 'disabled' : ''} required><option value="" ${g || anggotaId ? '' : 'selected'} disabled>Pilih anggota</option>${opsi}</select>
          <small class="err"></small></div>
        <div class="grid">
          <div class="f"><label for="gPeriode">Gaji untuk bulan <i>*</i></label>
            <input id="gPeriode" type="month" value="${g ? g.periode.slice(0, 7) : periode}" ${g ? 'disabled' : ''} required>
            <small class="err"></small></div>
          <div class="f"><label for="gTanggal">Tanggal gajian <i>*</i></label>
            <input id="gTanggal" type="date" value="${g ? g.tanggal_gajian : hariIni}" required>
            <small class="hint">Tanggal uang dibayarkan</small><small class="err"></small></div>
        </div>
        <div class="grid">
          ${uang('gPokok', 'Gaji pokok <i>*</i>', g && g.gaji_pokok)}
          ${uang('gLembur', 'Lembur', g && g.lembur)}
          ${uang('gTunjangan', 'Tunjangan', g && g.tunjangan)}
          ${uang('gPotongan', 'Potongan', g && g.potongan)}
        </div>
        <div class="total-box" data-totalbox><span>Total diterima</span><b data-total>Rp0</b></div>
        <div class="f"><label for="gKet">Keterangan (opsional)</label>
          <input id="gKet" type="text" maxlength="120" placeholder="Contoh: lembur 6 shift, potongan kasbon" value="${g && g.keterangan ? escG(g.keterangan) : ''}"></div>
        <p class="form-alert" data-alert hidden></p>
      </form>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-tutup>Batal</button>
        <button class="btn btn-gold" type="button" data-simpan>${g ? 'Simpan Perubahan' : 'Simpan Gaji'}</button>
      </div></div>`;

    const q = (s) => dlg.querySelector(s);
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));

    // Format ribuan saat mengetik + hitung total
    const hitung = () => {
      const t = angka(q('#gPokok').value) + angka(q('#gLembur').value) + angka(q('#gTunjangan').value) - angka(q('#gPotongan').value);
      q('[data-total]').textContent = (t < 0 ? '− ' : '') + fmtRp(Math.abs(t));
      q('[data-totalbox]').classList.toggle('minus', t < 0);
      return t;
    };
    ['#gPokok', '#gLembur', '#gTunjangan', '#gPotongan'].forEach((s) => q(s).addEventListener('input', (e) => {
      const n = angka(e.target.value);
      e.target.value = n ? n.toLocaleString('id-ID') : '';
      hitung();
    }));
    hitung();

    q('[data-simpan]').onclick = (e) => simpan(e.currentTarget, hitung);
    q('[data-form]').addEventListener('submit', (e) => { e.preventDefault(); simpan(q('[data-simpan]'), hitung); });
    if (!dlg.open) dlg.showModal();
    (g ? q('#gPokok') : (anggotaId ? q('#gPokok') : q('#gAnggota'))).focus();
  }

  async function simpan(btn, hitung) {
    const q = (s) => dlg.querySelector(s);
    const alertEl = q('[data-alert]');
    alertEl.hidden = true;
    const setErr = (el, t) => { el.closest('.f').querySelector('.err').textContent = t || ''; el.setAttribute('aria-invalid', t ? 'true' : 'false'); return !t; };

    let ok = true;
    if (!diedit) {
      ok = setErr(q('#gAnggota'), q('#gAnggota').value ? '' : 'Pilih anggota.') && ok;
      ok = setErr(q('#gPeriode'), q('#gPeriode').value ? '' : 'Pilih bulan.') && ok;
    }
    ok = setErr(q('#gTanggal'), q('#gTanggal').value ? '' : 'Isi tanggal gajian.') && ok;
    if (!ok) return;
    if (!angka(q('#gPokok').value)) { alertEl.textContent = 'Gaji pokok belum diisi.'; alertEl.hidden = false; q('#gPokok').focus(); return; }
    if (hitung() < 0) { alertEl.textContent = 'Potongan lebih besar dari total gaji. Periksa lagi angkanya.'; alertEl.hidden = false; return; }

    const isi = {
      tanggal_gajian: q('#gTanggal').value,
      gaji_pokok: angka(q('#gPokok').value),
      lembur: angka(q('#gLembur').value),
      tunjangan: angka(q('#gTunjangan').value),
      potongan: angka(q('#gPotongan').value),
      keterangan: q('#gKet').value.trim() || null
    };

    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    let res;
    if (diedit) res = await sb.from('gaji').update(isi).eq('id', diedit.id).select('id');
    else res = await sb.from('gaji').insert({ ...isi, anggota_id: q('#gAnggota').value, periode: q('#gPeriode').value + '-01' }).select('id');
    btn.disabled = false; btn.textContent = awal;

    if (res.error || !res.data || !res.data.length) {
      const m = res.error && res.error.message || '';
      alertEl.textContent = /gaji_satu_per_periode|duplicate/i.test(m)
        ? 'Gaji anggota ini untuk bulan tersebut sudah dicatat. Gunakan tombol "Ubah" di tabel.'
        : 'Gagal menyimpan. ' + (res.error ? pesanError(res.error) : 'Anda tidak punya izin.');
      alertEl.hidden = false;
      return;
    }
    const nama = diedit ? namaDari(diedit.anggota_id) : namaDari(q('#gAnggota').value);
    const per = diedit ? diedit.periode.slice(0, 7) : q('#gPeriode').value;
    dlg.close();
    toast((diedit ? 'Slip gaji ' : 'Gaji ') + nama + ' ' + namaPeriode(per) + ' tersimpan.');
    if (per !== periode) { periode = per; wadah.querySelector('[data-periode]').value = per; }
    muatSlip();
  }

  function konfirmasiHapus(g) {
    dlg.innerHTML = `
      <div class="d-head"><div><h2 id="gJudul">Hapus slip gaji?</h2><p>${escG(namaDari(g.anggota_id))} · ${namaPeriode(g.periode)}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button></div>
      <div class="d-body">${htmlSlip(g)}<p style="margin:0;color:var(--bad);font-weight:600">Slip ini akan hilang dari riwayat gaji anggota. Tindakan ini tidak bisa dibatalkan.</p></div>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-tutup>Batal</button>
        <button class="btn btn-bad solid" type="button" data-ya>Ya, hapus</button></div></div>`;
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));
    dlg.querySelector('[data-ya]').onclick = async (e) => {
      e.currentTarget.disabled = true;
      const { data, error } = await sb.from('gaji').delete().eq('id', g.id).select('id');
      if (error || !data || !data.length) { toast('Gagal menghapus. ' + (error ? pesanError(error) : 'Anda tidak punya izin.'), true); e.currentTarget.disabled = false; return; }
      dlg.close(); toast('Slip gaji dihapus.'); muatSlip();
    };
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Interaksi ----------
  wadah.querySelector('[data-periode]').addEventListener('change', (e) => { if (e.target.value) { periode = e.target.value; muatSlip(); } });
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  const tTambah = wadah.querySelector('[data-tambah]');
  if (tTambah) tTambah.addEventListener('click', () => bukaForm());
  tbody.addEventListener('click', (e) => {
    const u = e.target.closest('[data-ubah]'); if (u) return bukaForm(slip.find((g) => g.id === u.dataset.ubah));
    const h = e.target.closest('[data-hapus]'); if (h) return konfirmasiHapus(slip.find((g) => g.id === h.dataset.hapus));
  });
  boxBelum.addEventListener('click', (e) => { const b = e.target.closest('[data-input-untuk]'); if (b) bukaForm(null, b.dataset.inputUntuk); });

  (async () => {
    try { await muatSatpam(); } catch (err) { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="9" class="empty">Gagal memuat daftar anggota. ' + escG(pesanError(err)) + '</td></tr>'; return; }
    muatSlip();
  })();
}

// =====================================================================
// ANGGOTA (lihat gaji sendiri)
// =====================================================================
async function mulaiGajiAnggota({ wadah, anggotaId }) {
  const kepala = '<div class="card-head"><h2>Slip Gaji Bulan Ini</h2><span style="color:var(--muted);font-size:.9rem">' + namaPeriode(bulanIni()) + '</span></div>';
  wadah.innerHTML = kepala + '<p class="kosong">Memuat data gaji...</p>';
  const { data, error } = await sb.from('gaji')
    .select('id, periode, tanggal_gajian, gaji_pokok, lembur, tunjangan, potongan, total, keterangan')
    .eq('anggota_id', anggotaId).order('periode', { ascending: false });
  if (error) { wadah.innerHTML = kepala + '<p class="kosong">Gagal memuat data gaji. ' + escG(pesanError(error)) + '</p>'; return; }

  // Slip bulan ini = gaji yang dibayarkan (tanggal gajian) pada bulan berjalan
  const bln = bulanIni();
  const ini = data.filter((g) => g.tanggal_gajian.slice(0, 7) === bln)
    .sort((a, b) => b.tanggal_gajian.localeCompare(a.tanggal_gajian));
  const lain = data.filter((g) => !ini.includes(g))
    .sort((a, b) => b.tanggal_gajian.localeCompare(a.tanggal_gajian));

  const slipBulanIni = ini.length ? ini.map((t) => `
    <div class="gaji-terbaru">
      <div class="gt-kartu">
        <small>Gaji ${namaPeriode(t.periode)}</small>
        <b>${fmtRp(t.total)}</b>
        <p>Dibayar ${tglID(t.tanggal_gajian)}</p>
      </div>
      ${htmlSlip(t)}
    </div>`).join('<hr style="border:0;border-top:1px dashed var(--line);margin:1.2rem 0">')
    : '<p class="kosong">Gaji bulan ini belum dibayarkan. Slip akan tampil di sini setelah Bendahara mencatatnya.</p>';

  wadah.innerHTML = kepala + slipBulanIni + `
    <h3 style="margin:1.6rem 0 0;font-size:1.05rem;color:var(--navy-900)">Riwayat Gajian</h3>
    ${lain.length ? '<ul class="riwayat">' + lain.map((g) => `
      <li><details>
        <summary><span class="per"><b>${tglID(g.tanggal_gajian)}</b><small>Gaji ${namaPeriode(g.periode)}</small></span><span class="nom">${fmtRp(g.total)}</span></summary>
        ${htmlSlip(g)}
      </details></li>`).join('') + '</ul>'
      : '<p class="kosong" style="padding-bottom:0">Belum ada riwayat gajian sebelumnya.</p>'}`;
}
