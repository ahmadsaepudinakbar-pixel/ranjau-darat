// Absensi CV. Ranjau Darat
// - mulaiAbsensiSatpam({ wadah, anggotaId })      -> absen masuk/pulang/izin + riwayat (dashboard anggota)
// - mulaiAbsensiPengurus({ wadah, saatData })      -> rekap & koreksi per tanggal (Admin, Ketua, Sekretaris)

const TZ = 'Asia/Jakarta';
const ST_LABEL = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha', belum: 'Belum absen' };
const escA = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tglJkt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const jamJkt = (ts) => ts ? new Date(ts).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':') : '–';
const jamInput = (ts) => ts ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts)) : '';
const tglPanjangA = (d) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const tglPendekA = (d) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const geserHari = (d, n) => tglJkt(new Date(new Date(d + 'T12:00:00+07:00').getTime() + n * 86400000));
const durasi = (a, b) => { if (!a || !b) return ''; const m = Math.round((new Date(b) - new Date(a)) / 60000); return Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt'; };
const pillA = (s) => '<span class="pill p-' + s + '">' + ST_LABEL[s] + '</span>';
const pesanRpc = (err) => { const m = (err && err.message) || ''; return /Anda|Pos jaga|Belum ada|Tuliskan|Pilih izin|belum aktif/.test(m) ? m : pesanError(err); };

// =====================================================================
// SATPAM
// =====================================================================
async function mulaiAbsensiSatpam({ wadah, anggotaId }) {
  let pos = [], riwayat = [], modeIzin = false;

  async function muat() {
    const dari = geserHari(tglJkt(), -40);
    const [p, r] = await Promise.all([
      sb.from('pos_jaga').select('id, nama').eq('aktif', true).order('urutan'),
      sb.from('absensi').select('id, tanggal, pos_id, status, jam_masuk, jam_pulang, keterangan')
        .eq('anggota_id', anggotaId).gte('tanggal', dari).order('tanggal', { ascending: false })
    ]);
    if (p.error || r.error) { wadah.innerHTML = '<div class="card-head"><h2>Absensi</h2></div><p class="kosong">Gagal memuat absensi. ' + escA(pesanError(p.error || r.error)) + '</p>'; return; }
    pos = p.data; riwayat = r.data;
    tampil();
  }

  const namaPos = (id) => (pos.find((x) => x.id === id) || {}).nama || '–';

  function tampil() {
    const hari = tglJkt(), kemarin = geserHari(hari, -1);
    const hariIni = riwayat.find((x) => x.tanggal === hari);
    const terbuka = riwayat.find((x) => x.status === 'hadir' && x.jam_masuk && !x.jam_pulang && (x.tanggal === hari || x.tanggal === kemarin));
    const sekarang = new Date().toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    let aksi;
    if (terbuka) {
      aksi = `
        <dl class="info"><dt>Masuk</dt><dd>${jamJkt(terbuka.jam_masuk)}${terbuka.tanggal !== hari ? ' (kemarin)' : ''}</dd><dt>Pos</dt><dd>${escA(namaPos(terbuka.pos_id))}</dd></dl>
        <button class="btn btn-gold" type="button" data-pulang>Absen Pulang</button>
        <p class="msg" data-msg hidden></p>`;
    } else if (hariIni && hariIni.status === 'hadir') {
      aksi = `
        <div class="selesai">✓ Absensi hari ini lengkap</div>
        <dl class="info"><dt>Masuk</dt><dd>${jamJkt(hariIni.jam_masuk)}</dd><dt>Pulang</dt><dd>${jamJkt(hariIni.jam_pulang)}</dd>
        <dt>Pos</dt><dd>${escA(namaPos(hariIni.pos_id))}</dd><dt>Lama jaga</dt><dd>${durasi(hariIni.jam_masuk, hariIni.jam_pulang) || '–'}</dd></dl>`;
    } else if (hariIni) {
      aksi = `<div>${pillA(hariIni.status)}</div><dl class="info"><dt>Keterangan</dt><dd>${escA(hariIni.keterangan || '–')}</dd></dl>
        <p style="margin:0;color:var(--muted);font-size:.9rem">Status ini dicatat untuk hari ini. Hubungi Sekretaris bila ada yang keliru.</p>`;
    } else if (modeIzin) {
      aksi = `
        <div class="pilih-izin" role="radiogroup" aria-label="Jenis">
          <label><input type="radio" name="jenisIzin" value="izin" checked> Izin</label>
          <label><input type="radio" name="jenisIzin" value="sakit"> Sakit</label>
        </div>
        <div class="f"><label for="alasanIzin" style="font-weight:600;font-size:.9rem">Alasan</label>
          <textarea id="alasanIzin" maxlength="200" placeholder="Contoh: demam, ada keperluan keluarga"></textarea></div>
        <p class="msg" data-msg hidden></p>
        <div style="display:flex;gap:.5rem"><button class="btn btn-line" type="button" data-batal-izin>Batal</button><button class="btn btn-gold" type="button" data-kirim-izin style="flex:1">Kirim</button></div>`;
    } else {
      aksi = `
        <div class="f"><label for="pilihPos" style="font-weight:600;font-size:.9rem">Pos jaga hari ini</label>
          <select id="pilihPos"><option value="" selected disabled>Pilih pos jaga</option>${pos.map((x) => '<option value="' + x.id + '">' + escA(x.nama) + '</option>').join('')}</select></div>
        <button class="btn btn-gold" type="button" data-masuk>Absen Masuk</button>
        <p class="msg" data-msg hidden></p>
        <button class="link" type="button" data-mode-izin>Tidak bisa masuk hari ini? Ajukan izin / sakit</button>`;
    }

    // Rekap bulan ini
    const bln = hari.slice(0, 7);
    const ini = riwayat.filter((x) => x.tanggal.startsWith(bln));
    const n = (s) => ini.filter((x) => x.status === s).length;

    wadah.innerHTML = `
      <div class="card-head"><h2>Absensi</h2><span style="color:var(--muted);font-size:.9rem">${tglPanjangA(hari)}</span></div>
      <div class="absen-hari">
        <div class="jam-besar"><small>Jam sekarang</small><b data-jam>${sekarang}</b><span>WIB</span></div>
        <div class="aksi-absen">${aksi}</div>
      </div>
      <div class="rekap-kecil"><h3>Rekap ${new Date(hari + 'T12:00:00+07:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
        <span class="p-hadir">Hadir ${n('hadir')}</span><span class="p-izin">Izin ${n('izin')}</span><span class="p-sakit">Sakit ${n('sakit')}</span><span class="p-alpha">Alpha ${n('alpha')}</span></div>
      <div class="table-scroll"><table class="tbl" style="min-width:560px">
        <thead><tr><th>Tanggal</th><th>Pos</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead>
        <tbody>${riwayat.length ? riwayat.slice(0, 31).map((x) => `<tr class="tidak-klik"><td>${tglPendekA(x.tanggal)}</td><td>${escA(x.pos_id ? namaPos(x.pos_id) : '–')}</td><td class="jam">${jamJkt(x.jam_masuk)}</td><td class="jam">${jamJkt(x.jam_pulang)}</td><td>${pillA(x.status)}</td></tr>`).join('')
          : '<tr class="tidak-klik"><td colspan="5" class="empty">Belum ada riwayat absensi.</td></tr>'}</tbody>
      </table></div>`;

    const q = (s) => wadah.querySelector(s);
    const pesan = (t) => { const m = q('[data-msg]'); if (m) { m.textContent = t; m.hidden = false; } };
    const sibuk = (btn, t) => { btn.disabled = true; btn.textContent = t; };

    if (q('[data-masuk]')) q('[data-masuk]').onclick = async (e) => {
      const p = q('#pilihPos').value;
      if (!p) return pesan('Pilih pos jaga dulu.');
      sibuk(e.currentTarget, 'Menyimpan...');
      const { error } = await sb.rpc('absen_masuk', { p_pos: p });
      if (error) { tampil(); return pesan(pesanRpc(error)); }
      toast('Absen masuk tercatat pukul ' + new Date().toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':') + '.');
      muat();
    };
    if (q('[data-pulang]')) q('[data-pulang]').onclick = async (e) => {
      sibuk(e.currentTarget, 'Menyimpan...');
      const { error } = await sb.rpc('absen_pulang');
      if (error) { tampil(); return pesan(pesanRpc(error)); }
      toast('Absen pulang tercatat. Terima kasih, hati-hati di jalan.');
      muat();
    };
    if (q('[data-mode-izin]')) q('[data-mode-izin]').onclick = () => { modeIzin = true; tampil(); q('#alasanIzin').focus(); };
    if (q('[data-batal-izin]')) q('[data-batal-izin]').onclick = () => { modeIzin = false; tampil(); };
    if (q('[data-kirim-izin]')) q('[data-kirim-izin]').onclick = async (e) => {
      const jenis = wadah.querySelector('input[name="jenisIzin"]:checked').value;
      const alasan = q('#alasanIzin').value.trim();
      if (!alasan) return pesan('Tuliskan alasannya.');
      sibuk(e.currentTarget, 'Mengirim...');
      const { error } = await sb.rpc('ajukan_izin', { p_status: jenis, p_keterangan: alasan });
      if (error) { e.currentTarget.disabled = false; e.currentTarget.textContent = 'Kirim'; return pesan(pesanRpc(error)); }
      modeIzin = false;
      toast((jenis === 'sakit' ? 'Sakit' : 'Izin') + ' tercatat untuk hari ini. Semoga lekas beres.');
      muat();
    };
  }

  // Jam berjalan
  setInterval(() => { const j = wadah.querySelector('[data-jam]'); if (j) j.textContent = new Date().toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':'); }, 15000);

  wadah.innerHTML = '<div class="card-head"><h2>Absensi</h2></div><p class="kosong">Memuat absensi...</p>';
  muat();
}

// =====================================================================
// PENGURUS (Admin, Ketua, Sekretaris)
// =====================================================================
function mulaiAbsensiPengurus({ wadah, saatData }) {
  let tanggal = tglJkt(), lokasi = '', kataCari = '';
  let pos = [], satpam = [], catatan = [], kemarinList = [];
  let diedit = null;

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Absensi Satpam</h2>
      <div class="toolbar" style="flex:1;justify-content:flex-end">
        <label class="periode">Tanggal <input type="date" data-tgl value="${tanggal}"></label>
        <select class="sel-lokasi" data-lokasi aria-label="Saring lokasi"><option value="">Semua lokasi</option></select>
        <label class="cari"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari nama</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" placeholder="Cari nama" data-cari></label>
        <button class="btn btn-gold" type="button" data-tambah>+ Catat Absensi</button>
      </div>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>No</th><th>Nama</th><th>Lokasi</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th><th></th></tr></thead>
      <tbody data-isi><tr class="tidak-klik"><td colspan="7" class="empty">Memuat data...</td></tr></tbody>
    </table></div>`;

  const tbody = wadah.querySelector('[data-isi]');
  const dlg = document.createElement('dialog');
  dlg.className = 'detail';
  dlg.setAttribute('aria-labelledby', 'aJudul');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const namaPos = (id) => (pos.find((x) => x.id === id) || {}).nama || '–';
  const namaSatpam = (id) => (satpam.find((x) => x.id === id) || {}).nama || '(akun nonaktif)';

  async function muatAwal() {
    const [p, s] = await Promise.all([
      sb.from('pos_jaga').select('id, nama').eq('aktif', true).order('urutan'),
      sb.from('anggota').select('id, nama, username').eq('jabatan', 'anggota').eq('status', 'diterima').order('nama')
    ]);
    if (p.error || s.error) throw (p.error || s.error);
    pos = p.data; satpam = s.data;
    wadah.querySelector('[data-lokasi]').insertAdjacentHTML('beforeend', pos.map((x) => '<option value="' + x.id + '">' + escA(x.nama) + '</option>').join(''));
  }

  async function muat() {
    tbody.innerHTML = '<tr class="tidak-klik"><td colspan="7" class="empty">Memuat data...</td></tr>';
    const kemarin = geserHari(tanggal, -1);
    const [hariIni, sebelum] = await Promise.all([
      sb.from('absensi').select('id, anggota_id, tanggal, pos_id, status, jam_masuk, jam_pulang, keterangan').eq('tanggal', tanggal),
      sb.from('absensi').select('anggota_id, status').eq('tanggal', kemarin)
    ]);
    if (hariIni.error) { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="7" class="empty">Gagal memuat. ' + escA(pesanError(hariIni.error)) + '</td></tr>'; return; }
    catatan = hariIni.data;
    kemarinList = sebelum.data || [];
    tampil();
  }

  function statusAkhir(list, tgl) {
    // satpam tanpa catatan: hari ini/masa depan = "belum absen", tanggal lalu = alpha
    const lalu = tgl < tglJkt();
    const ada = new Set(list.map((x) => x.anggota_id));
    const c = { hadir: 0, izin: 0, sakit: 0, alpha: 0, belum: 0 };
    list.forEach((x) => c[x.status]++);
    satpam.forEach((s) => { if (!ada.has(s.id)) c[lalu ? 'alpha' : 'belum']++; });
    return c;
  }

  function tampil() {
    const lalu = tanggal < tglJkt();
    const q = kataCari.trim().toLowerCase();
    const ada = new Map(catatan.map((x) => [x.anggota_id, x]));
    let rows = catatan.map((x) => ({ ...x, nama: namaSatpam(x.anggota_id) }));
    satpam.forEach((s) => { if (!ada.has(s.id)) rows.push({ id: null, anggota_id: s.id, nama: s.nama, status: lalu ? 'alpha' : 'belum', kosong: true }); });
    rows = rows.filter((r) => (!lokasi || r.pos_id === lokasi) && (!q || r.nama.toLowerCase().includes(q)))
      .sort((a, b) => (a.kosong - b.kosong) || a.nama.localeCompare(b.nama));

    tbody.innerHTML = rows.length ? rows.map((r, i) => `
      <tr class="tidak-klik">
        <td class="no">${i + 1}</td>
        <td class="nm ket"><b>${escA(r.nama)}</b>${r.keterangan ? '<small>' + escA(r.keterangan) + '</small>' : ''}</td>
        <td>${r.pos_id ? escA(namaPos(r.pos_id)) : '–'}</td>
        <td class="jam">${jamJkt(r.jam_masuk)}</td>
        <td class="jam">${jamJkt(r.jam_pulang)}</td>
        <td>${pillA(r.status)}${r.kosong && lalu ? ' <small style="color:var(--muted)">(tidak ada catatan)</small>' : ''}</td>
        <td><div class="aksi-sel">${r.kosong
          ? '<button class="btn btn-line btn-sm" type="button" data-catat="' + r.anggota_id + '">Catat</button>'
          : '<button class="btn btn-line btn-sm" type="button" data-ubah="' + r.id + '">Ubah</button><button class="btn btn-bad btn-sm" type="button" data-hapus="' + r.id + '">Hapus</button>'}</div></td>
      </tr>`).join('')
      : '<tr class="tidak-klik"><td colspan="7" class="empty">' + (satpam.length ? 'Tidak ada yang cocok.' : 'Belum ada anggota aktif.') + '</td></tr>';

    if (saatData) {
      const c = statusAkhir(catatan, tanggal);
      const k = statusAkhir(kemarinList, geserHari(tanggal, -1));
      saatData({ tanggal, lalu, hariIni: c, kemarin: k, totalSatpam: satpam.length });
    }
  }

  // ---------- Formulir catat / ubah ----------
  function bukaForm(rec = null, anggotaId = null) {
    diedit = rec;
    const st = rec ? rec.status : 'hadir';
    dlg.innerHTML = `
      <div class="d-head"><div><h2 id="aJudul">${rec ? 'Ubah Absensi' : 'Catat Absensi'}</h2><p>${tglPanjangA(tanggal)}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button></div>
      <div class="d-body slip-form">
        <div class="f"><label for="aAng">Nama satpam <i>*</i></label>
          <select id="aAng" ${rec ? 'disabled' : ''}><option value="" ${rec || anggotaId ? '' : 'selected'} disabled>Pilih satpam</option>
          ${satpam.map((s) => '<option value="' + s.id + '"' + ((rec ? rec.anggota_id : anggotaId) === s.id ? ' selected' : '') + '>' + escA(s.nama) + '</option>').join('')}</select></div>
        <div class="grid">
          <div class="f"><label for="aSt">Status <i>*</i></label>
            <select id="aSt">${['hadir', 'izin', 'sakit', 'alpha'].map((s) => '<option value="' + s + '"' + (s === st ? ' selected' : '') + '>' + ST_LABEL[s] + '</option>').join('')}</select></div>
          <div class="f" data-hadir><label for="aPos">Lokasi <i>*</i></label>
            <select id="aPos"><option value="">Pilih lokasi</option>${pos.map((x) => '<option value="' + x.id + '"' + (rec && rec.pos_id === x.id ? ' selected' : '') + '>' + escA(x.nama) + '</option>').join('')}</select></div>
          <div class="f" data-hadir><label for="aMasuk">Jam masuk <i>*</i></label><input id="aMasuk" type="time" value="${rec ? jamInput(rec.jam_masuk) : ''}"></div>
          <div class="f" data-hadir><label for="aPulang">Jam pulang</label><input id="aPulang" type="time" value="${rec ? jamInput(rec.jam_pulang) : ''}">
            <small class="hint">Lebih kecil dari jam masuk = pulang esok hari (shift malam)</small></div>
        </div>
        <div class="f"><label for="aKet">Keterangan</label><input id="aKet" type="text" maxlength="200" value="${rec && rec.keterangan ? escA(rec.keterangan) : ''}" placeholder="Opsional"></div>
        <p class="form-alert" data-alert hidden></p>
      </div>
      <div class="d-foot"><div class="row"><button class="btn btn-line" type="button" data-tutup>Batal</button>
        <button class="btn btn-gold" type="button" data-simpan>Simpan</button></div></div>`;
    const q = (s) => dlg.querySelector(s);
    const atur = () => dlg.querySelectorAll('[data-hadir]').forEach((el) => (el.hidden = q('#aSt').value !== 'hadir'));
    q('#aSt').addEventListener('change', atur); atur();
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));
    q('[data-simpan]').onclick = (e) => simpan(e.currentTarget);
    if (!dlg.open) dlg.showModal();
  }

  async function simpan(btn) {
    const q = (s) => dlg.querySelector(s);
    const al = q('[data-alert]'); al.hidden = true;
    const gagal = (t) => { al.textContent = t; al.hidden = false; };
    const ang = diedit ? diedit.anggota_id : q('#aAng').value;
    const st = q('#aSt').value;
    if (!ang) return gagal('Pilih nama satpam.');

    const isi = { status: st, keterangan: q('#aKet').value.trim() || null, pos_id: null, jam_masuk: null, jam_pulang: null };
    if (st === 'hadir') {
      if (!q('#aPos').value) return gagal('Pilih lokasi jaga.');
      if (!q('#aMasuk').value) return gagal('Isi jam masuk.');
      isi.pos_id = q('#aPos').value;
      isi.jam_masuk = new Date(tanggal + 'T' + q('#aMasuk').value + ':00+07:00').toISOString();
      if (q('#aPulang').value) {
        const tglPulang = q('#aPulang').value < q('#aMasuk').value ? geserHari(tanggal, 1) : tanggal;
        isi.jam_pulang = new Date(tglPulang + 'T' + q('#aPulang').value + ':00+07:00').toISOString();
      }
    }
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data: me } = await sb.auth.getSession();
    const res = diedit
      ? await sb.from('absensi').update(isi).eq('id', diedit.id).select('id')
      : await sb.from('absensi').insert({ ...isi, anggota_id: ang, tanggal, dicatat_oleh: me.session.user.id }).select('id');
    btn.disabled = false; btn.textContent = 'Simpan';
    if (res.error || !res.data || !res.data.length) {
      const m = res.error && res.error.message || '';
      return gagal(/absensi_satu_per_hari|duplicate/i.test(m) ? 'Satpam ini sudah punya catatan absensi di tanggal tersebut. Gunakan "Ubah".'
        : 'Gagal menyimpan. ' + (res.error ? pesanError(res.error) : 'Anda tidak punya izin.'));
    }
    dlg.close();
    toast('Absensi ' + namaSatpam(ang) + ' tersimpan.');
    muat();
  }

  function konfirmasiHapus(rec) {
    dlg.innerHTML = `
      <div class="d-head"><div><h2 id="aJudul">Hapus catatan absensi?</h2><p>${escA(namaSatpam(rec.anggota_id))} · ${tglPanjangA(tanggal)}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button></div>
      <div class="d-body"><p style="margin:0">Status <b>${ST_LABEL[rec.status]}</b>${rec.jam_masuk ? ', masuk ' + jamJkt(rec.jam_masuk) : ''}. Setelah dihapus, satpam ini dianggap <b>${tanggal < tglJkt() ? 'Alpha' : 'belum absen'}</b> pada tanggal ini.</p></div>
      <div class="d-foot"><div class="row"><button class="btn btn-line" type="button" data-tutup>Batal</button><button class="btn btn-bad solid" type="button" data-ya>Ya, hapus</button></div></div>`;
    dlg.querySelectorAll('[data-tutup]').forEach((b) => (b.onclick = () => dlg.close()));
    dlg.querySelector('[data-ya]').onclick = async (e) => {
      e.currentTarget.disabled = true;
      const { data, error } = await sb.from('absensi').delete().eq('id', rec.id).select('id');
      if (error || !data || !data.length) { e.currentTarget.disabled = false; return toast('Gagal menghapus. ' + (error ? pesanError(error) : 'Anda tidak punya izin.'), true); }
      dlg.close(); toast('Catatan absensi dihapus.'); muat();
    };
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Interaksi ----------
  wadah.querySelector('[data-tgl]').addEventListener('change', (e) => { if (e.target.value) { tanggal = e.target.value; muat(); } });
  wadah.querySelector('[data-lokasi]').addEventListener('change', (e) => { lokasi = e.target.value; tampil(); });
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  wadah.querySelector('[data-tambah]').addEventListener('click', () => bukaForm());
  tbody.addEventListener('click', (e) => {
    const c = e.target.closest('[data-catat]'); if (c) return bukaForm(null, c.dataset.catat);
    const u = e.target.closest('[data-ubah]'); if (u) return bukaForm(catatan.find((x) => x.id === u.dataset.ubah));
    const h = e.target.closest('[data-hapus]'); if (h) return konfirmasiHapus(catatan.find((x) => x.id === h.dataset.hapus));
  });

  (async () => {
    try { await muatAwal(); } catch (err) { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="7" class="empty">Gagal memuat. ' + escA(pesanError(err)) + '</td></tr>'; return; }
    muat();
  })();
}
