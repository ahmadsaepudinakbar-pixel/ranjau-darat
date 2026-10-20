// Modul persetujuan pendaftaran Satpam (dipakai di dashboard Sekretaris, Ketua, dan bisa dibuka Admin)
// Pakai: mulaiPendaftaran({ wadah: elemenKartu, saatData: (ringkasan) => {...} })

const STATUS_LABEL = { menunggu: 'Menunggu', diterima: 'Diterima', ditolak: 'Ditolak' };
const POSISI_LABEL = { satpam: 'Satpam', anggota: 'Anggota' };

function mulaiPendaftaran({ wadah, saatData }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tglPendek = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const tglPanjang = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const jamTgl = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  let semua = [];          // semua pendaftar
  let namaPengurus = {};   // id -> nama (untuk "disetujui oleh")
  let tab = 'menunggu';
  let kataCari = '';
  let dipilih = null;

  // ---------- Kerangka kartu ----------
  wadah.innerHTML = `
    <div class="card-head">
      <h2>Data Pendaftaran</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <div class="tabs" role="group" aria-label="Saring status">
          <button type="button" data-tab="menunggu" aria-pressed="true">Menunggu<span class="n"></span></button>
          <button type="button" data-tab="diterima" aria-pressed="false">Diterima<span class="n"></span></button>
          <button type="button" data-tab="ditolak" aria-pressed="false">Ditolak<span class="n"></span></button>
          <button type="button" data-tab="semua" aria-pressed="false">Semua<span class="n"></span></button>
        </div>
        <label class="cari"><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari pendaftar</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari nama, NIK, atau username" data-cari>
        </label>
      </div>
    </div>
    <div class="table-scroll">
      <table class="tbl">
        <thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>No. WhatsApp</th><th>Tanggal Daftar</th><th>Status</th><th></th></tr></thead>
        <tbody data-isi><tr><td colspan="7" class="empty">Memuat data...</td></tr></tbody>
      </table>
    </div>`;

  const tbody = wadah.querySelector('[data-isi]');

  // ---------- Dialog detail ----------
  const dlg = document.createElement('dialog');
  dlg.className = 'detail';
  dlg.setAttribute('aria-labelledby', 'dJudul');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // ---------- Muat data ----------
  async function muat() {
    const { data, error } = await sb.from('anggota')
      .select('id, username, nama, nik, tempat_lahir, tanggal_lahir, jenis_kelamin, posisi, no_wa, alamat, rt, rw, desa, kecamatan, kabupaten, provinsi, foto_path, ktp_path, jabatan, status, catatan, dibuat_pada, disetujui_oleh, disetujui_pada')
      .order('dibuat_pada', { ascending: false });

    if (error) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Gagal memuat data. ' + esc(pesanError(error)) + '</td></tr>';
      return;
    }
    namaPengurus = {};
    data.forEach((r) => { if (r.jabatan !== 'anggota') namaPengurus[r.id] = r.nama + ' (' + (r.jabatan.charAt(0).toUpperCase() + r.jabatan.slice(1)) + ')'; });
    semua = data.filter((r) => r.jabatan === 'anggota');

    const hitung = { menunggu: 0, diterima: 0, ditolak: 0, semua: semua.length };
    semua.forEach((r) => hitung[r.status]++);
    wadah.querySelectorAll('[data-tab]').forEach((b) => (b.querySelector('.n').textContent = hitung[b.dataset.tab]));

    if (saatData) saatData({
      menunggu: hitung.menunggu,
      diterima: hitung.diterima,
      ditolak: hitung.ditolak,
      satpamAktif: semua.filter((r) => r.status === 'diterima' && r.posisi === 'satpam').length,
      baruBulanIni: semua.filter((r) => { const d = new Date(r.dibuat_pada), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length
    });
    tampil();
  }

  function tampil() {
    const q = kataCari.trim().toLowerCase();
    const rows = semua.filter((r) => (tab === 'semua' || r.status === tab) &&
      (!q || r.nama.toLowerCase().includes(q) || r.nik.includes(q) || r.username.includes(q)));

    if (!rows.length) {
      const kosong = q ? 'Tidak ada yang cocok dengan "' + esc(kataCari) + '".'
        : tab === 'menunggu' ? 'Tidak ada pendaftaran yang menunggu persetujuan. 👍'
        : 'Belum ada data.';
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + kosong + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r, i) => `
      <tr data-id="${r.id}" tabindex="0">
        <td class="no">${i + 1}</td>
        <td class="nm"><b>${esc(r.nama)}</b><small>@${esc(r.username)}</small></td>
        <td>${POSISI_LABEL[r.posisi] || esc(r.posisi)}</td>
        <td>${esc(r.no_wa)}</td>
        <td class="tgl">${tglPendek(r.dibuat_pada)}</td>
        <td><span class="pill p-${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td><button class="btn btn-line btn-sm" type="button">Lihat</button></td>
      </tr>`).join('');
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

  // ---------- Detail ----------
  async function buka(id) {
    const r = semua.find((x) => x.id === id);
    if (!r) return;
    dipilih = r;
    const baris = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    const info = r.status === 'menunggu'
      ? 'Mendaftar pada <b>' + jamTgl(r.dibuat_pada) + '</b>. Periksa data dan foto KTP sebelum menyetujui.'
      : (r.status === 'diterima' ? 'Disetujui' : 'Ditolak') + ' oleh <b>' + esc(namaPengurus[r.disetujui_oleh] || 'pengurus') + '</b> pada <b>' + jamTgl(r.disetujui_pada) + '</b>.' +
        (r.catatan ? '<br>Catatan: <b>' + esc(r.catatan) + '</b>' : '');

    dlg.innerHTML = `
      <div class="d-head">
        <div>
          <h2 id="dJudul">${esc(r.nama)}</h2>
          <p>@${esc(r.username)} · ${POSISI_LABEL[r.posisi] || esc(r.posisi)} · <span class="pill p-${r.status}">${STATUS_LABEL[r.status]}</span></p>
        </div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button>
      </div>
      <div class="d-body">
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
          ${baris('Tanggal daftar', jamTgl(r.dibuat_pada))}
        </dl>
        <p class="d-info" style="margin:0">${info}</p>
      </div>
      <div class="d-foot" data-foot></div>`;

    dlg.querySelector('[data-tutup]').addEventListener('click', () => dlg.close());
    tombolAksi('awal');
    if (!dlg.open) dlg.showModal();
    tampilGambar('foto', r.foto_path);
    tampilGambar('ktp', r.ktp_path);
  }

  async function tampilGambar(jenis, path) {
    const kotak = dlg.querySelector('[data-img="' + jenis + '"]');
    if (!path) { kotak.textContent = 'Tidak ada file'; return; }
    const { data, error } = await sb.storage.from('dokumen').createSignedUrl(path, 600);
    if (error || !data) { kotak.textContent = 'Gagal memuat gambar'; return; }
    kotak.innerHTML = '<img alt="' + (jenis === 'ktp' ? 'Foto KTP' : 'Pas foto') + '">';
    kotak.querySelector('img').src = data.signedUrl;
    kotak.insertAdjacentHTML('afterend', '<a href="' + data.signedUrl + '" target="_blank" rel="noopener">Buka ukuran penuh ↗</a>');
  }

  function tombolAksi(mode) {
    const foot = dlg.querySelector('[data-foot]');
    const r = dipilih;
    if (mode === 'tolak') {
      foot.innerHTML = `
        <p class="tanya">Tolak pendaftaran ${esc(r.nama)}?</p>
        <label for="alasan">Alasan penolakan (opsional, terlihat oleh pengurus)</label>
        <textarea id="alasan" placeholder="Contoh: foto KTP tidak terbaca, silakan daftar ulang"></textarea>
        <div class="row">
          <button class="btn btn-line" type="button" data-batal>Batal</button>
          <button class="btn btn-bad solid" type="button" data-ya-tolak>Ya, tolak pendaftaran</button>
        </div>`;
      foot.querySelector('[data-batal]').onclick = () => tombolAksi('awal');
      foot.querySelector('[data-ya-tolak]').onclick = (e) => ubahStatus('ditolak', foot.querySelector('#alasan').value.trim(), e.currentTarget);
      foot.querySelector('#alasan').focus();
      return;
    }
    let tombol = '<button class="btn btn-line" type="button" data-tutup2>Tutup</button>';
    if (r.status === 'menunggu') tombol += '<button class="btn btn-bad" type="button" data-tolak>Tolak</button><button class="btn btn-ok" type="button" data-terima>✓ Terima</button>';
    if (r.status === 'ditolak') tombol += '<button class="btn btn-ok" type="button" data-terima>✓ Terima pendaftaran ini</button>';
    if (r.status === 'diterima') tombol += '<button class="btn btn-bad" type="button" data-tolak>Batalkan & tolak</button>';
    foot.innerHTML = '<div class="row">' + tombol + '</div>';
    foot.querySelector('[data-tutup2]').onclick = () => dlg.close();
    const t = foot.querySelector('[data-terima]'); if (t) t.onclick = (e) => ubahStatus('diterima', null, e.currentTarget);
    const k = foot.querySelector('[data-tolak]'); if (k) k.onclick = () => tombolAksi('tolak');
  }

  async function ubahStatus(status, catatan, btn) {
    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data, error } = await sb.from('anggota').update({ status, catatan: catatan || null }).eq('id', dipilih.id).select('id');
    if (error || !data || !data.length) {
      btn.disabled = false; btn.textContent = awal;
      toast('Gagal menyimpan. ' + (error ? pesanError(error) : 'Anda tidak punya izin untuk ini.'), true);
      return;
    }
    toast(status === 'diterima'
      ? dipilih.nama + ' diterima. Sekarang ia bisa login.'
      : 'Pendaftaran ' + dipilih.nama + ' ditolak.');
    dlg.close();
    muat();
  }

  muat();
  return { muat };
}
