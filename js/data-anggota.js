// Halaman Data Anggota: daftar anggota yang sudah disetujui (Ketua & Sekretaris).
// Pakai: mulaiDataAnggota({ wadah: elemenKartu, saatData: (ringkasan) => {...} })

function mulaiDataAnggota({ wadah, saatData }) {
  const JABATAN = { ketua: 'Ketua', sekretaris: 'Sekretaris', bendahara: 'Bendahara', anggota: 'Anggota' };
  const POSISI = { satpam: 'Satpam', anggota: 'Anggota' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tglPendek = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const tglPanjang = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const jamTgl = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  let semua = [];
  let kataCari = '';
  let filterJab = 'semua';
  let tampilDiDaftar = [];
  let dipilih = null;

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Daftar Anggota</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <select class="filter-jab" data-jab aria-label="Saring jabatan">
          <option value="semua">Semua jabatan</option>
          <option value="anggota">Anggota</option>
          <option value="ketua">Ketua</option>
          <option value="sekretaris">Sekretaris</option>
          <option value="bendahara">Bendahara</option>
        </select>
        <label class="cari"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari anggota</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari nama, NIK, atau username" data-cari>
        </label>
        <button class="btn btn-line" type="button" data-unduh>Unduh CSV</button>
      </div>
    </div>
    <div class="table-scroll">
      <table class="tbl anggota">
        <thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>Jabatan</th><th>No. WhatsApp</th><th>Kecamatan</th><th>Bergabung</th><th></th></tr></thead>
        <tbody data-isi><tr><td colspan="8" class="empty">Memuat data...</td></tr></tbody>
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
    const { data, error } = await sb.from('anggota')
      .select('id, username, nama, nik, tempat_lahir, tanggal_lahir, jenis_kelamin, posisi, no_wa, alamat, rt, rw, desa, kecamatan, kabupaten, provinsi, foto_path, ktp_path, jabatan, status, dibuat_pada, disetujui_pada')
      .eq('status', 'diterima')
      .order('nama', { ascending: true });

    if (error) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Gagal memuat data. ' + esc(pesanError(error)) + '</td></tr>';
      return;
    }
    semua = data;

    const n = new Date();
    const bulanIni = (r) => { const d = new Date(r.disetujui_pada || r.dibuat_pada); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); };
    const satpam = semua.filter((r) => r.posisi === 'satpam');
    if (saatData) saatData({
      total: semua.length,
      satpam: satpam.length,
      pengurus: semua.filter((r) => r.jabatan !== 'anggota').length,
      baru: semua.filter(bulanIni).length,
      laki: satpam.filter((r) => r.jenis_kelamin === 'L').length,
      perempuan: satpam.filter((r) => r.jenis_kelamin === 'P').length
    });
    tampil();
  }

  function tampil() {
    const q = kataCari.trim().toLowerCase();
    tampilDiDaftar = semua.filter((r) => (filterJab === 'semua' || r.jabatan === filterJab) &&
      (!q || r.nama.toLowerCase().includes(q) || r.nik.includes(q) || r.username.includes(q)));

    if (!tampilDiDaftar.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">' + (q ? 'Tidak ada yang cocok dengan "' + esc(kataCari) + '".' : 'Belum ada anggota yang disetujui.') + '</td></tr>';
      ringkas.textContent = '';
      return;
    }
    tbody.innerHTML = tampilDiDaftar.map((r, i) => `
      <tr data-id="${r.id}" tabindex="0">
        <td class="no">${i + 1}</td>
        <td class="nm"><b>${esc(r.nama)}</b><small>@${esc(r.username)}</small></td>
        <td class="nik">${esc(r.nik)}</td>
        <td><span class="pill j-${r.jabatan}">${JABATAN[r.jabatan] || esc(r.jabatan)}</span></td>
        <td>${esc(r.no_wa)}</td>
        <td>${esc(r.kecamatan)}</td>
        <td class="tgl">${tglPendek(r.disetujui_pada || r.dibuat_pada)}</td>
        <td class="aksi"><button class="btn btn-line btn-sm" type="button">Lihat</button></td>
      </tr>`).join('');
    ringkas.textContent = 'Menampilkan ' + tampilDiDaftar.length + ' dari ' + semua.length + ' anggota.';
  }

  // ---------- Interaksi daftar ----------
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  wadah.querySelector('[data-jab]').addEventListener('change', (e) => { filterJab = e.target.value; tampil(); });
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) buka(tr.dataset.id); });
  tbody.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); buka(tr.dataset.id); } });
  wadah.querySelector('[data-unduh]').addEventListener('click', unduhCSV);

  // ---------- Unduh CSV (sesuai saringan yang sedang tampil) ----------
  function unduhCSV() {
    if (!tampilDiDaftar.length) { toast('Tidak ada data untuk diunduh.', true); return; }
    const kolom = [
      ['Nama', (r) => r.nama], ['Username', (r) => r.username], ['NIK', (r) => "'" + r.nik],
      ['Jabatan', (r) => JABATAN[r.jabatan] || r.jabatan], ['Posisi', (r) => POSISI[r.posisi] || r.posisi],
      ['Jenis Kelamin', (r) => (r.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan')],
      ['Tempat Lahir', (r) => r.tempat_lahir], ['Tanggal Lahir', (r) => r.tanggal_lahir],
      ['No. WhatsApp', (r) => "'" + r.no_wa], ['Alamat', (r) => r.alamat], ['RT', (r) => r.rt], ['RW', (r) => r.rw],
      ['Desa/Kelurahan', (r) => r.desa], ['Kecamatan', (r) => r.kecamatan], ['Kabupaten/Kota', (r) => r.kabupaten], ['Provinsi', (r) => r.provinsi],
      ['Bergabung', (r) => (r.disetujui_pada || r.dibuat_pada || '').slice(0, 10)]
    ];
    const sel = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [kolom.map((k) => sel(k[0])).join(',')]
      .concat(tampilDiDaftar.map((r) => kolom.map((k) => sel(k[1](r))).join(','))).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'data-anggota-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Detail ----------
  function buka(id) {
    const r = semua.find((x) => x.id === id);
    if (!r) return;
    dipilih = r;
    const baris = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    dlg.innerHTML = `
      <div class="d-head">
        <div>
          <h2 id="dJudul">${esc(r.nama)}</h2>
          <p>@${esc(r.username)} · ${POSISI[r.posisi] || esc(r.posisi)} · <span class="pill j-${r.jabatan}">${JABATAN[r.jabatan] || esc(r.jabatan)}</span></p>
        </div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <div class="d-body" data-badan>
        <div class="d-foto">
          <figure><figcaption>Pas Foto</figcaption><div class="img" data-img="foto">Memuat...</div></figure>
          <figure><figcaption>Foto KTP</figcaption><div class="img wide" data-img="ktp">Memuat...</div></figure>
        </div>
        <dl class="d-data" style="margin:0">
          ${baris('NIK', esc(r.nik))}
          ${baris('No. WhatsApp', esc(r.no_wa))}
          ${baris('Tempat, tgl lahir', esc(r.tempat_lahir) + ', ' + tglPanjang(r.tanggal_lahir))}
          ${baris('Jenis kelamin', r.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan')}
          ${baris('Alamat', esc(r.alamat) + ', RT ' + esc(r.rt) + '/RW ' + esc(r.rw))}
          ${baris('Kelurahan/Desa', esc(r.desa))}
          ${baris('Kecamatan', esc(r.kecamatan))}
          ${baris('Kabupaten/Kota', esc(r.kabupaten))}
          ${baris('Provinsi', esc(r.provinsi || '-'))}
          ${baris('Bergabung', jamTgl(r.disetujui_pada || r.dibuat_pada))}
        </dl>
      </div>
      <div class="d-foot"><div class="row">
        <button class="btn btn-line" type="button" data-tutup2>Tutup</button>
        <a class="btn btn-line" data-wa target="_blank" rel="noopener">Chat WhatsApp</a>
        <button class="btn btn-gold" type="button" data-ubah>Ubah data</button>
      </div></div>`;

    dlg.querySelector('[data-tutup]').onclick = () => dlg.close();
    dlg.querySelector('[data-tutup2]').onclick = () => dlg.close();
    dlg.querySelector('[data-ubah]').onclick = () => formUbah();
    dlg.querySelector('[data-wa]').href = linkWA(r.no_wa);
    if (!dlg.open) dlg.showModal();
    tampilGambar('foto', r.foto_path);
    tampilGambar('ktp', r.ktp_path);
  }

  function linkWA(no) {
    let n = String(no || '').replace(/[^0-9]/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return 'https://wa.me/' + n;
  }

  async function tampilGambar(jenis, path) {
    const kotak = dlg.querySelector('[data-img="' + jenis + '"]');
    if (!kotak) return;
    if (!path) { kotak.textContent = 'Tidak ada file'; return; }
    const { data, error } = await sb.storage.from('dokumen').createSignedUrl(path, 600);
    if (error || !data) { kotak.textContent = 'Gagal memuat gambar'; return; }
    kotak.innerHTML = '<img alt="' + (jenis === 'ktp' ? 'Foto KTP' : 'Pas foto') + '">';
    kotak.querySelector('img').src = data.signedUrl;
    kotak.insertAdjacentHTML('afterend', '<a href="' + data.signedUrl + '" target="_blank" rel="noopener">Buka ukuran penuh ↗</a>');
  }

  // ---------- Ubah data ----------
  function formUbah() {
    const r = dipilih;
    const f = (nama, label, nilai, extra = '') => `<label>${label}<input name="${nama}" value="${esc(nilai)}" ${extra}></label>`;
    dlg.querySelector('[data-badan]').innerHTML = `
      <form class="form-ubah" id="formUbah" novalidate>
        <label class="penuh">Nama lengkap<input name="nama" value="${esc(r.nama)}" required maxlength="100"></label>
        <label>NIK (tidak bisa diubah)<input value="${esc(r.nik)}" readonly></label>
        ${f('no_wa', 'No. WhatsApp', r.no_wa, 'required inputmode="tel" maxlength="20"')}
        ${f('tempat_lahir', 'Tempat lahir', r.tempat_lahir, 'required')}
        <label>Tanggal lahir<input type="date" name="tanggal_lahir" value="${esc(r.tanggal_lahir)}" required></label>
        <label>Jenis kelamin
          <select name="jenis_kelamin"><option value="L"${r.jenis_kelamin === 'L' ? ' selected' : ''}>Laki-laki</option><option value="P"${r.jenis_kelamin === 'P' ? ' selected' : ''}>Perempuan</option></select>
        </label>
        <label>Posisi
          <select name="posisi"><option value="satpam"${r.posisi === 'satpam' ? ' selected' : ''}>Satpam</option><option value="anggota"${r.posisi === 'anggota' ? ' selected' : ''}>Anggota</option></select>
        </label>
        <label class="penuh">Alamat<input name="alamat" value="${esc(r.alamat)}" required></label>
        <div class="rtrw">
          ${f('rt', 'RT', r.rt, 'required inputmode="numeric" maxlength="3"')}
          ${f('rw', 'RW', r.rw, 'required inputmode="numeric" maxlength="3"')}
        </div>
        ${f('desa', 'Kelurahan/Desa', r.desa, 'required')}
        ${f('kecamatan', 'Kecamatan', r.kecamatan, 'required')}
        ${f('kabupaten', 'Kabupaten/Kota', r.kabupaten, 'required')}
        ${f('provinsi', 'Provinsi', r.provinsi, 'required')}
        <p class="galat" data-galat hidden></p>
      </form>`;
    dlg.querySelector('.d-foot').innerHTML = `<div class="row">
      <button class="btn btn-line" type="button" data-batal>Batal</button>
      <button class="btn btn-ok" type="button" data-simpan>Simpan perubahan</button></div>`;
    dlg.querySelector('[data-batal]').onclick = () => buka(r.id);
    dlg.querySelector('[data-simpan]').onclick = (e) => simpan(e.currentTarget);
    dlg.querySelector('[name="nama"]').focus();
  }

  async function simpan(btn) {
    const form = dlg.querySelector('#formUbah');
    const galat = dlg.querySelector('[data-galat]');
    const v = Object.fromEntries(new FormData(form).entries());
    Object.keys(v).forEach((k) => (v[k] = String(v[k]).trim()));

    const kosong = ['nama', 'no_wa', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'rt', 'rw', 'desa', 'kecamatan', 'kabupaten', 'provinsi'].find((k) => !v[k]);
    let pesan = '';
    if (kosong) pesan = 'Semua kolom wajib diisi.';
    else if (!/^[0-9+\-\s]{9,20}$/.test(v.no_wa)) pesan = 'Nomor WhatsApp tidak valid.';
    else if (!/^[0-9]{1,3}$/.test(v.rt) || !/^[0-9]{1,3}$/.test(v.rw)) pesan = 'RT dan RW harus berupa angka.';
    if (pesan) { galat.textContent = pesan; galat.hidden = false; return; }
    galat.hidden = true;

    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data, error } = await sb.from('anggota').update(v).eq('id', dipilih.id).select('id');
    if (error || !data || !data.length) {
      btn.disabled = false; btn.textContent = awal;
      toast('Gagal menyimpan. ' + (error ? pesanError(error) : 'Anda tidak punya izin untuk ini.'), true);
      return;
    }
    toast('Data ' + v.nama + ' berhasil diperbarui.');
    const id = dipilih.id;
    await muat();
    buka(id);
  }

  muat();
  return { muat };
}
