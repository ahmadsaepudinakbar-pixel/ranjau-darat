// Arsip Surat & Dokumen (surat masuk/keluar + lampiran scan).
// Pakai: mulaiSurat({ wadah, bolehUbah, saatData: (ringkasan) => {...} })

function mulaiSurat({ wadah, bolehUbah, saatData }) {
  const ARAH = { masuk: 'Surat Masuk', keluar: 'Surat Keluar' };
  const MAKS_BYTE = 5 * 1024 * 1024;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tglPendek = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const tglPanjang = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const hariIni = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
  const IKON_KLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.3 3.3 0 014.7 4.7L10.2 18.7a1.7 1.7 0 01-2.4-2.4L15.5 8.6"/></svg>';

  let semua = [];
  let tab = 'semua';
  let kataCari = '';
  let dipilih = null;
  let kodeSurat = null;   // dari pengaturan_sekretariat (opsional)

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Arsip Surat</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <div class="tabs" role="group" aria-label="Saring jenis surat">
          <button type="button" data-tab="semua" aria-pressed="true">Semua<span class="n"></span></button>
          <button type="button" data-tab="masuk" aria-pressed="false">Masuk<span class="n"></span></button>
          <button type="button" data-tab="keluar" aria-pressed="false">Keluar<span class="n"></span></button>
        </div>
        <label class="cari"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari surat</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari nomor, perihal, atau pihak" data-cari>
        </label>
        ${bolehUbah ? '<button class="btn btn-gold" type="button" data-tambah>+ Catat surat</button>' : ''}
      </div>
    </div>
    <div class="table-scroll">
      <table class="tbl surat">
        <thead><tr><th>No</th><th>Nomor Surat</th><th>Jenis</th><th>Perihal</th><th>Tanggal</th><th>Lampiran</th><th></th></tr></thead>
        <tbody data-isi><tr><td colspan="7" class="empty">Memuat data...</td></tr></tbody>
      </table>
    </div>
    <p class="ringkas" data-ringkas></p>`;

  const tbody = wadah.querySelector('[data-isi]');
  const ringkas = wadah.querySelector('[data-ringkas]');

  const dlg = document.createElement('dialog');
  dlg.className = 'detail';
  dlg.setAttribute('aria-labelledby', 'dJudul');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // ---------- Muat data ----------
  async function muat() {
    sb.from('pengaturan_sekretariat').select('kode_surat').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data && data.kode_surat) kodeSurat = data.kode_surat; });
    const { data, error } = await sb.from('surat')
      .select('id, arah, nomor_surat, tanggal, pihak, perihal, keterangan, file_path, file_nama, dibuat_pada')
      .order('tanggal', { ascending: false })
      .order('dibuat_pada', { ascending: false });

    if (error) {
      const belum = /relation .*surat.* does not exist|schema cache|could not find the table/i.test(error.message || '');
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + (belum
        ? 'Tabel surat belum dibuat. Jalankan file <b>04_surat.sql</b> di Supabase (SQL Editor) terlebih dulu.'
        : 'Gagal memuat data. ' + esc(pesanError(error))) + '</td></tr>';
      return;
    }
    semua = data;

    const hitung = { semua: semua.length, masuk: 0, keluar: 0 };
    semua.forEach((r) => hitung[r.arah]++);
    wadah.querySelectorAll('[data-tab]').forEach((b) => (b.querySelector('.n').textContent = hitung[b.dataset.tab]));

    const n = new Date();
    const bulanIni = (r) => { const d = new Date(r.tanggal + 'T00:00:00'); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); };
    if (saatData) saatData({
      total: semua.length,
      masuk: semua.filter((r) => r.arah === 'masuk' && bulanIni(r)).length,
      keluar: semua.filter((r) => r.arah === 'keluar' && bulanIni(r)).length,
      tanpa: semua.filter((r) => !r.file_path).length
    });
    tampil();
  }

  function tampil() {
    const q = kataCari.trim().toLowerCase();
    const rows = semua.filter((r) => (tab === 'semua' || r.arah === tab) &&
      (!q || r.nomor_surat.toLowerCase().includes(q) || r.perihal.toLowerCase().includes(q) || r.pihak.toLowerCase().includes(q)));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + (q ? 'Tidak ada yang cocok dengan "' + esc(kataCari) + '".' : 'Belum ada surat tercatat.') + '</td></tr>';
      ringkas.textContent = '';
      return;
    }
    tbody.innerHTML = rows.map((r, i) => `
      <tr data-id="${r.id}" tabindex="0">
        <td class="no">${i + 1}</td>
        <td class="nomor">${esc(r.nomor_surat)}</td>
        <td><span class="pill a-${r.arah}">${ARAH[r.arah]}</span></td>
        <td class="perihal"><b title="${esc(r.perihal)}">${esc(r.perihal)}</b><small>${r.arah === 'masuk' ? 'Dari' : 'Kepada'}: ${esc(r.pihak)}</small></td>
        <td class="tgl">${tglPendek(r.tanggal)}</td>
        <td>${r.file_path ? '<span class="lampir">' + IKON_KLIP + 'Ada</span>' : '<span class="tdk">-</span>'}</td>
        <td class="aksi"><button class="btn btn-line btn-sm" type="button">Lihat</button></td>
      </tr>`).join('');
    ringkas.textContent = 'Menampilkan ' + rows.length + ' dari ' + semua.length + ' surat.';
  }

  // ---------- Interaksi daftar ----------
  wadah.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    wadah.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    tampil();
  }));
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) buka(tr.dataset.id); });
  tbody.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); buka(tr.dataset.id); } });
  const tbTambah = wadah.querySelector('[data-tambah]');
  if (tbTambah) tbTambah.addEventListener('click', () => form(null));

  // ---------- Detail ----------
  function buka(id) {
    const r = semua.find((x) => x.id === id);
    if (!r) return;
    dipilih = r;
    const baris = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    dlg.innerHTML = `
      <div class="d-head">
        <div>
          <h2 id="dJudul">${esc(r.perihal)}</h2>
          <p>${esc(r.nomor_surat)} · <span class="pill a-${r.arah}">${ARAH[r.arah]}</span></p>
        </div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <div class="d-body">
        <dl class="d-data" style="margin:0">
          ${baris('Nomor surat', esc(r.nomor_surat))}
          ${baris('Tanggal surat', tglPanjang(r.tanggal))}
          ${baris(r.arah === 'masuk' ? 'Pengirim' : 'Tujuan', esc(r.pihak))}
          ${baris('Jenis', ARAH[r.arah])}
          ${baris('Perihal', esc(r.perihal))}
          ${baris('Keterangan', r.keterangan ? esc(r.keterangan) : '-')}
        </dl>
        <div data-lampiran>${r.file_path ? '<div class="pratinjau"><div class="lamp-info">Memuat lampiran...</div></div>' : '<p class="d-info" style="margin:0">Tidak ada lampiran.</p>'}</div>
      </div>
      <div class="d-foot" data-foot></div>`;

    dlg.querySelector('[data-tutup]').onclick = () => dlg.close();
    tombolDetail('awal');
    if (!dlg.open) dlg.showModal();
    if (r.file_path) tampilLampiran(r);
  }

  async function tampilLampiran(r) {
    const kotak = dlg.querySelector('[data-lampiran] .pratinjau');
    if (!kotak) return;
    const { data, error } = await sb.storage.from('surat').createSignedUrl(r.file_path, 600, { download: false });
    if (error || !data) { kotak.innerHTML = '<div class="lamp-info">Gagal memuat lampiran.</div>'; return; }
    const url = data.signedUrl;
    const gambar = /\.(jpe?g|png)$/i.test(r.file_path);
    kotak.innerHTML = (gambar ? '<img alt="Lampiran surat">' : '') +
      '<div class="lamp-info"><span class="lampir">' + IKON_KLIP + '</span><b>' + esc(r.file_nama || 'Lampiran') + '</b>' +
      '<a class="btn btn-line btn-sm" href="' + url + '" target="_blank" rel="noopener">Buka</a></div>';
    if (gambar) kotak.querySelector('img').src = url;
  }

  function tombolDetail(mode) {
    const foot = dlg.querySelector('[data-foot]');
    const r = dipilih;
    if (mode === 'hapus') {
      foot.innerHTML = `
        <p class="tanya">Hapus surat ${esc(r.nomor_surat)} dari arsip?</p>
        <p style="margin:0;color:var(--muted);font-size:.9rem">Data dan lampirannya akan dihapus permanen.</p>
        <div class="row">
          <button class="btn btn-line" type="button" data-batal>Batal</button>
          <button class="btn btn-bad solid" type="button" data-ya-hapus>Ya, hapus</button>
        </div>`;
      foot.querySelector('[data-batal]').onclick = () => tombolDetail('awal');
      foot.querySelector('[data-ya-hapus]').onclick = (e) => hapus(e.currentTarget);
      return;
    }
    foot.innerHTML = '<div class="row"><button class="btn btn-line" type="button" data-tutup2>Tutup</button>' +
      (bolehUbah ? '<button class="btn btn-bad" type="button" data-hapus>Hapus</button><button class="btn btn-gold" type="button" data-ubah>Ubah</button>' : '') + '</div>';
    foot.querySelector('[data-tutup2]').onclick = () => dlg.close();
    const u = foot.querySelector('[data-ubah]'); if (u) u.onclick = () => form(r);
    const h = foot.querySelector('[data-hapus]'); if (h) h.onclick = () => tombolDetail('hapus');
  }

  async function hapus(btn) {
    const r = dipilih;
    btn.disabled = true; btn.textContent = 'Menghapus...';
    const { data, error } = await sb.from('surat').delete().eq('id', r.id).select('id');
    if (error || !data || !data.length) {
      btn.disabled = false; btn.textContent = 'Ya, hapus';
      toast('Gagal menghapus. ' + (error ? pesanError(error) : 'Anda tidak punya izin untuk ini.'), true);
      return;
    }
    if (r.file_path) await sb.storage.from('surat').remove([r.file_path]);
    toast('Surat ' + r.nomor_surat + ' dihapus.');
    dlg.close();
    muat();
  }

  // Usulan nomor surat keluar: urut/KODE/bulan-romawi/tahun (urut = jumlah surat keluar tahun itu + 1)
  function usulanNomor(tanggal) {
    if (!kodeSurat) return '';
    const d = new Date((tanggal || hariIni()) + 'T00:00:00');
    const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const urut = semua.filter((x) => x.arah === 'keluar' && new Date(x.tanggal + 'T00:00:00').getFullYear() === d.getFullYear()).length + 1;
    return String(urut).padStart(3, '0') + '/' + kodeSurat + '/' + romawi[d.getMonth()] + '/' + d.getFullYear();
  }

  // ---------- Formulir catat / ubah ----------
  function form(r) {
    const baru = !r;
    const v = r || { arah: 'masuk', nomor_surat: '', tanggal: hariIni(), pihak: '', perihal: '', keterangan: '', file_path: null, file_nama: null };
    dipilih = r;
    dlg.innerHTML = `
      <div class="d-head">
        <div><h2 id="dJudul">${baru ? 'Catat Surat Baru' : 'Ubah Surat'}</h2><p>${baru ? 'Isi data surat dan lampirkan hasil scan bila ada.' : esc(r.nomor_surat)}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <div class="d-body">
        <form class="form-surat" id="formSurat" novalidate>
          <label>Jenis surat
            <select name="arah"><option value="masuk"${v.arah === 'masuk' ? ' selected' : ''}>Surat Masuk</option><option value="keluar"${v.arah === 'keluar' ? ' selected' : ''}>Surat Keluar</option></select>
          </label>
          <label>Tanggal surat<input type="date" name="tanggal" value="${esc(v.tanggal)}" required></label>
          <label class="penuh">Nomor surat<input name="nomor_surat" value="${esc(v.nomor_surat)}" required maxlength="80" placeholder="Contoh: 012/RD/X/2026"></label>
          <label class="penuh"><span data-lbl-pihak>${v.arah === 'masuk' ? 'Pengirim' : 'Tujuan'}</span><input name="pihak" value="${esc(v.pihak)}" required maxlength="120" placeholder="Nama instansi / perusahaan / orang"></label>
          <label class="penuh">Perihal<input name="perihal" value="${esc(v.perihal)}" required maxlength="200"></label>
          <label class="penuh">Keterangan (opsional)<textarea name="keterangan" maxlength="500">${esc(v.keterangan)}</textarea></label>
          ${!baru && v.file_path ? `<div class="file-lama"><span class="lampir">${IKON_KLIP}</span><b>${esc(v.file_nama || 'Lampiran')}</b><label><input type="checkbox" name="buang_file"> Hapus lampiran ini</label></div>` : ''}
          <label class="penuh">${!baru && v.file_path ? 'Ganti lampiran' : 'Lampiran'} (opsional)
            <input type="file" name="berkas" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
            <small>PDF, JPG, atau PNG. Maksimal 5 MB.</small>
          </label>
          <p class="galat" data-galat hidden></p>
        </form>
      </div>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-batal>Batal</button>
        <button class="btn btn-ok" type="button" data-simpan>${baru ? 'Simpan surat' : 'Simpan perubahan'}</button>
      </div></div>`;

    dlg.querySelector('[data-tutup]').onclick = () => dlg.close();
    dlg.querySelector('[data-batal]').onclick = () => (baru ? dlg.close() : buka(r.id));
    const fArah = dlg.querySelector('[name="arah"]');
    const fNomor = dlg.querySelector('[name="nomor_surat"]');
    const fTgl = dlg.querySelector('[name="tanggal"]');
    let terakhirUsulan = '';
    const isiUsulan = () => {
      if (!baru || fArah.value !== 'keluar') return;
      if (fNomor.value.trim() && fNomor.value !== terakhirUsulan) return; // jangan timpa ketikan sendiri
      terakhirUsulan = usulanNomor(fTgl.value);
      if (terakhirUsulan) fNomor.value = terakhirUsulan;
    };
    fArah.addEventListener('change', (e) => {
      dlg.querySelector('[data-lbl-pihak]').textContent = e.target.value === 'masuk' ? 'Pengirim' : 'Tujuan';
      if (e.target.value === 'masuk' && fNomor.value === terakhirUsulan) { fNomor.value = ''; terakhirUsulan = ''; }
      isiUsulan();
    });
    fTgl.addEventListener('change', isiUsulan);
    isiUsulan();
    dlg.querySelector('[data-simpan]').onclick = (e) => simpan(e.currentTarget, baru);
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('[name="nomor_surat"]').focus();
  }

  async function simpan(btn, baru) {
    const f = dlg.querySelector('#formSurat');
    const galat = dlg.querySelector('[data-galat]');
    const fd = new FormData(f);
    const v = {};
    ['arah', 'tanggal', 'nomor_surat', 'pihak', 'perihal', 'keterangan'].forEach((k) => (v[k] = String(fd.get(k) || '').trim()));
    const berkas = fd.get('berkas');
    const adaBerkas = berkas && berkas.size > 0;
    const buang = !!fd.get('buang_file');

    let pesan = '';
    if (!v.nomor_surat || !v.tanggal || !v.pihak || !v.perihal) pesan = 'Nomor, tanggal, ' + (v.arah === 'masuk' ? 'pengirim' : 'tujuan') + ', dan perihal wajib diisi.';
    else if (adaBerkas && berkas.size > MAKS_BYTE) pesan = 'Ukuran file terlalu besar. Maksimal 5 MB.';
    else if (adaBerkas && !/\.(pdf|jpe?g|png)$/i.test(berkas.name)) pesan = 'Format file harus PDF, JPG, atau PNG.';
    if (pesan) { galat.textContent = pesan; galat.hidden = false; return; }
    galat.hidden = true;

    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const gagal = (teks) => { btn.disabled = false; btn.textContent = awal; toast(teks, true); };

    const isi = { ...v, keterangan: v.keterangan || null };
    let pathBaru = null;
    if (adaBerkas) {
      const { data: { session } } = await sb.auth.getSession();
      const aman = berkas.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'berkas';
      pathBaru = (session ? session.user.id : 'umum') + '/' + Date.now() + '-' + aman;
      const { error: eu } = await sb.storage.from('surat').upload(pathBaru, berkas, { contentType: berkas.type || undefined });
      if (eu) return gagal('Gagal mengunggah lampiran. ' + pesanError(eu));
      isi.file_path = pathBaru;
      isi.file_nama = berkas.name;
    } else if (!baru && buang) {
      isi.file_path = null;
      isi.file_nama = null;
    }

    const q = baru ? sb.from('surat').insert(isi).select('id') : sb.from('surat').update(isi).eq('id', dipilih.id).select('id');
    const { data, error } = await q;
    if (error || !data || !data.length) {
      if (pathBaru) await sb.storage.from('surat').remove([pathBaru]);
      return gagal('Gagal menyimpan. ' + (error ? pesanError(error) : 'Anda tidak punya izin untuk ini.'));
    }
    // Hapus file lama bila diganti / dibuang
    if (!baru && dipilih.file_path && (pathBaru || buang)) await sb.storage.from('surat').remove([dipilih.file_path]);

    toast(baru ? 'Surat ' + v.nomor_surat + ' tersimpan.' : 'Perubahan tersimpan.');
    dlg.close();
    muat();
  }

  muat();
  return { muat };
}
