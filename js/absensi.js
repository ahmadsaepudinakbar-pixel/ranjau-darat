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
const pesanRpc = (err) => { const m = (err && err.message) || ''; return /Anda|Pos jaga|Belum ada|Tuliskan|Pilih izin|belum aktif|Lokasi|Foto|tanggal|Tanggal|Pengajuan|pengajuan|hari ini/.test(m) && !/row-level|violates|JWT|fetch/i.test(m) ? m : pesanError(err); };

// =====================================================================
// SATPAM
// =====================================================================
const selisihHari = (a, b) => Math.round((new Date(a + 'T12:00:00+07:00') - new Date(b + 'T12:00:00+07:00')) / 86400000);
const rentangTeks = (a, b) => a === b ? tglPendekA(a) : tglPendekA(a) + ' – ' + tglPendekA(b) + ' (' + (selisihHari(b, a) + 1) + ' hari)';
const PJ_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };

async function mulaiAbsensiSatpam({ wadah, anggotaId }) {
  let pos = [], riwayat = [], pengajuan = [], mode = null, bukti = null, minJam = 8, tungguPulang = null;

  async function muat() {
    const hari = tglJkt();
    const [p, r, a, s] = await Promise.all([
      sb.from('pos_jaga').select('id, nama').eq('aktif', true).order('urutan'),
      sb.from('absensi').select('id, tanggal, pos_id, status, jam_masuk, jam_pulang, keterangan')
        .eq('anggota_id', anggotaId).gte('tanggal', geserHari(hari, -40)).order('tanggal', { ascending: false }),
      sb.from('pengajuan_izin').select('id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, catatan, otomatis, dibuat_pada')
        .eq('anggota_id', anggotaId).gte('tanggal_selesai', geserHari(hari, -30)).order('dibuat_pada', { ascending: false }),
      sb.from('pengaturan').select('nilai').eq('kunci', 'min_jam_jaga').maybeSingle()
    ]);
    if (!s.error && s.data) minJam = Number(s.data.nilai) || 0;
    const err = p.error || r.error || a.error;
    if (err) { wadah.innerHTML = '<div class="card-head"><h2>Absensi</h2></div><p class="kosong">Gagal memuat absensi. ' + escA(pesanError(err)) + '</p>'; return; }
    pos = p.data; riwayat = r.data; pengajuan = a.data;
    tampil();
  }

  const namaPos = (id) => (pos.find((x) => x.id === id) || {}).nama || '–';
  const jamKini = () => new Date().toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':');

  function htmlFormPengajuan(hari) {
    const sakit = mode === 'sakit';
    const mulaiAwal = sakit ? hari : geserHari(hari, 3);
    return `
      <div class="form-izin">
        <b style="font-size:1.05rem">${sakit ? 'Pengajuan Sakit' : 'Pengajuan Izin'}</b>
        <div class="row2">
          <div class="f"><label for="pjMulai">Tanggal mulai</label><input id="pjMulai" type="date" value="${mulaiAwal}" min="${hari}" ${sakit ? 'disabled' : ''}></div>
          <div class="f"><label for="pjSelesai">Tanggal selesai</label><input id="pjSelesai" type="date" value="${mulaiAwal}" min="${mulaiAwal}" max="${geserHari(mulaiAwal, 13)}"></div>
        </div>
        <p class="aturan" data-aturan></p>
        <div class="f"><label for="pjAlasan">Alasan</label>
          <textarea id="pjAlasan" maxlength="200" placeholder="${sakit ? 'Contoh: demam dan pusing' : 'Contoh: menghadiri pernikahan saudara'}"></textarea></div>
        ${sakit ? '<div class="f"><label>Bukti (wajib)</label><div data-bukti></div></div>' : ''}
        <p class="msg" data-msg hidden></p>
        <div style="display:flex;gap:.5rem"><button class="btn btn-line" type="button" data-batal-pj>Batal</button><button class="btn btn-gold" type="button" data-kirim-pj style="flex:1">Kirim Pengajuan</button></div>
      </div>`;
  }

  function aturAturan(hari) {
    const el = wadah.querySelector('[data-aturan]');
    const mulai = wadah.querySelector('#pjMulai').value;
    const selesaiEl = wadah.querySelector('#pjSelesai');
    if (mulai) { selesaiEl.min = mulai; selesaiEl.max = geserHari(mulai, 13); if (selesaiEl.value < mulai) selesaiEl.value = mulai; }
    if (mode === 'sakit') {
      el.className = 'aturan';
      el.textContent = 'Sakit boleh diajukan hari ini. Wajib ambil lokasi dan foto kamera depan & belakang. Pengajuan akan diperiksa Ketua atau Sekretaris.';
      return;
    }
    const h = mulai ? selisihHari(mulai, hari) : 0;
    if (h < 3) {
      el.className = 'aturan bahaya';
      el.textContent = 'Pengajuan ini akan OTOMATIS DITOLAK. Izin harus diajukan paling lambat 3 hari sebelumnya' +
        (mulai ? ' (untuk izin ' + tglPendekA(mulai) + ', paling lambat ' + tglPendekA(geserHari(mulai, -3)) + ').' : '.');
    } else {
      el.className = 'aturan';
      el.textContent = 'Diajukan ' + h + ' hari sebelumnya. Pengajuan akan diperiksa Ketua atau Sekretaris.';
    }
  }

  function tampil() {
    const hari = tglJkt(), kemarin = geserHari(hari, -1);
    const hariIni = riwayat.find((x) => x.tanggal === hari);
    const terbuka = riwayat.find((x) => x.status === 'hadir' && x.jam_masuk && !x.jam_pulang && (x.tanggal === hari || x.tanggal === kemarin));
    const tungguHariIni = pengajuan.find((x) => x.status === 'menunggu' && x.tanggal_mulai <= hari && x.tanggal_selesai >= hari);

    let aksi;
    tungguPulang = null;
    if (terbuka) {
      const boleh = new Date(new Date(terbuka.jam_masuk).getTime() + minJam * 3600000);
      const belum = Date.now() < boleh.getTime();
      if (belum) tungguPulang = boleh;
      aksi = `
        <dl class="info"><dt>Masuk</dt><dd>${jamJkt(terbuka.jam_masuk)}${terbuka.tanggal !== hari ? ' (kemarin)' : ''}</dd><dt>Pos</dt><dd>${escA(namaPos(terbuka.pos_id))}</dd></dl>
        ${belum
          ? `<p class="aturan">Absen pulang bisa mulai pukul <b>${jamJkt(boleh.toISOString())} WIB</b> (minimal ${String(minJam).replace('.', ',')} jam jaga). <span data-sisa></span></p>
             <button class="btn btn-gold" type="button" disabled>Absen Pulang</button>`
          : `<div data-bukti></div>
             <button class="btn btn-gold" type="button" data-pulang>Absen Pulang</button>
             <p class="msg" data-msg hidden></p>`}`;
    } else if (hariIni && hariIni.status === 'hadir') {
      aksi = `
        <div class="selesai">✓ Absensi hari ini lengkap</div>
        <dl class="info"><dt>Masuk</dt><dd>${jamJkt(hariIni.jam_masuk)}</dd><dt>Pulang</dt><dd>${jamJkt(hariIni.jam_pulang)}</dd>
        <dt>Pos</dt><dd>${escA(namaPos(hariIni.pos_id))}</dd><dt>Lama jaga</dt><dd>${durasi(hariIni.jam_masuk, hariIni.jam_pulang) || '–'}</dd></dl>`;
    } else if (hariIni) {
      aksi = `<div>${pillA(hariIni.status)}</div><dl class="info"><dt>Keterangan</dt><dd>${escA(hariIni.keterangan || '–')}</dd></dl>
        <p style="margin:0;color:var(--muted);font-size:.9rem">Status ini tercatat untuk hari ini. Hubungi Sekretaris bila ada yang keliru.</p>`;
    } else if (mode) {
      aksi = htmlFormPengajuan(hari);
    } else {
      aksi = `
        ${tungguHariIni ? '<p class="aturan">Pengajuan ' + tungguHariIni.jenis + ' Anda untuk hari ini masih menunggu persetujuan.</p>' : ''}
        <div class="f"><label for="pilihPos" style="font-weight:600;font-size:.9rem">Pos jaga hari ini</label>
          <select id="pilihPos"><option value="" selected disabled>Pilih pos jaga</option>${pos.map((x) => '<option value="' + x.id + '">' + escA(x.nama) + '</option>').join('')}</select></div>
        <div data-bukti></div>
        <button class="btn btn-gold" type="button" data-masuk>Absen Masuk</button>
        <p class="msg" data-msg hidden></p>
        <div style="display:flex;gap:1.2rem;flex-wrap:wrap"><button class="link" type="button" data-mode="izin">Ajukan izin (min. H-3)</button><button class="link" type="button" data-mode="sakit">Sakit hari ini</button></div>`;
    }

    const bln = hari.slice(0, 7);
    const ini = riwayat.filter((x) => x.tanggal.startsWith(bln));
    const n = (s) => ini.filter((x) => x.status === s).length;

    wadah.innerHTML = `
      <div class="card-head"><h2>Absensi</h2><span style="color:var(--muted);font-size:.9rem">${tglPanjangA(hari)}</span></div>
      <div class="absen-hari">
        <div class="jam-besar"><small>Jam sekarang</small><b data-jam>${jamKini()}</b><span>WIB</span></div>
        <div class="aksi-absen">${aksi}</div>
      </div>
      ${pengajuan.length ? '<h3 style="margin:1.3rem 0 0;font-size:1rem;color:var(--navy-900)">Pengajuan izin & sakit</h3><ul class="pengajuan-saya">' + pengajuan.map((x) => `
        <li><div class="top"><span><span class="pill p-${x.jenis === 'sakit' ? 'sakit' : 'izin'}">${x.jenis === 'sakit' ? 'Sakit' : 'Izin'}</span> <b>${rentangTeks(x.tanggal_mulai, x.tanggal_selesai)}</b></span><span class="pill p-${x.status}">${PJ_LABEL[x.status]}</span></div>
          <small>${escA(x.alasan)}</small>
          ${x.catatan ? '<span class="cat">' + escA(x.catatan) + '</span>' : ''}
          ${x.status === 'menunggu' ? '<button type="button" data-batal-ajuan="' + x.id + '">Batalkan pengajuan</button>' : ''}</li>`).join('') + '</ul>' : ''}
      <div class="rekap-kecil"><h3>Rekap ${new Date(hari + 'T12:00:00+07:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
        <span class="p-hadir">Hadir ${n('hadir')}</span><span class="p-izin">Izin ${n('izin')}</span><span class="p-sakit">Sakit ${n('sakit')}</span><span class="p-alpha">Alpha ${n('alpha')}</span></div>
      <div class="table-scroll"><table class="tbl" style="min-width:560px">
        <thead><tr><th>Tanggal</th><th>Pos</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead>
        <tbody>${riwayat.length ? riwayat.slice(0, 31).map((x) => `<tr class="tidak-klik"><td>${tglPendekA(x.tanggal)}</td><td>${escA(x.pos_id ? namaPos(x.pos_id) : '–')}</td><td class="jam">${jamJkt(x.jam_masuk)}</td><td class="jam">${jamJkt(x.jam_pulang)}</td><td>${pillA(x.status)}</td></tr>`).join('')
          : '<tr class="tidak-klik"><td colspan="5" class="empty">Belum ada riwayat absensi.</td></tr>'}</tbody>
      </table></div>`;

    if (tungguPulang && wadah.querySelector('[data-sisa]')) wadah.querySelector('[data-sisa]').textContent = sisaTeks(tungguPulang);
    const q = (s) => wadah.querySelector(s);
    const pesan = (t) => { const m = q('[data-msg]'); if (m) { m.textContent = t; m.hidden = false; } };
    const sibuk = (btn, t) => { btn.disabled = true; btn.textContent = t; };
    const pulih = (btn, t) => { btn.disabled = false; btn.textContent = t; };
    bukti = q('[data-bukti]') ? pasangBukti(q('[data-bukti]'), () => { const m = q('[data-msg]'); if (m) m.hidden = true; }) : null;
    const cekBukti = () => { if (bukti.lengkap()) return true; pesan('Lengkapi dulu: ' + bukti.kurang().join(', ') + '.'); return false; };

    if (q('[data-masuk]')) q('[data-masuk]').onclick = async (e) => {
      const p = q('#pilihPos').value;
      if (!p) return pesan('Pilih pos jaga dulu.');
      if (!cekBukti()) return;
      const btn = e.currentTarget;
      try {
        sibuk(btn, 'Mengunggah foto...');
        const b = await bukti.unggah('masuk');
        sibuk(btn, 'Menyimpan...');
        const { error } = await sb.rpc('absen_masuk', { p_pos: p, p_lat: b.lat, p_lng: b.lng, p_akurasi: b.akurasi, p_foto_depan: b.depan, p_foto_belakang: b.belakang });
        if (error) throw error;
        toast('Absen masuk tercatat pukul ' + jamKini() + '.');
        muat();
      } catch (err) { pulih(btn, 'Absen Masuk'); pesan(pesanRpc(err)); }
    };
    if (q('[data-pulang]')) q('[data-pulang]').onclick = async (e) => {
      if (!cekBukti()) return;
      const btn = e.currentTarget;
      try {
        sibuk(btn, 'Mengunggah foto...');
        const b = await bukti.unggah('pulang');
        sibuk(btn, 'Menyimpan...');
        const { error } = await sb.rpc('absen_pulang', { p_lat: b.lat, p_lng: b.lng, p_akurasi: b.akurasi, p_foto_depan: b.depan, p_foto_belakang: b.belakang });
        if (error) throw error;
        toast('Absen pulang tercatat. Terima kasih, hati-hati di jalan.');
        muat();
      } catch (err) { pulih(btn, 'Absen Pulang'); pesan(pesanRpc(err)); }
    };

    wadah.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; tampil(); q('#pjAlasan').focus(); }));
    if (q('[data-batal-pj]')) {
      q('[data-batal-pj]').onclick = () => { mode = null; tampil(); };
      q('#pjMulai').addEventListener('change', () => aturAturan(hari));
      aturAturan(hari);
      q('[data-kirim-pj]').onclick = async (e) => {
        const mulai = q('#pjMulai').value, selesai = q('#pjSelesai').value, alasan = q('#pjAlasan').value.trim();
        if (!mulai || !selesai) return pesan('Isi tanggal mulai dan selesai.');
        if (selesai < mulai) return pesan('Tanggal selesai tidak boleh sebelum tanggal mulai.');
        if (selisihHari(selesai, mulai) > 13) return pesan('Pengajuan paling lama 14 hari.');
        if (!alasan) return pesan('Tuliskan alasannya.');
        if (mode === 'sakit' && !cekBukti()) return;
        const btn = e.currentTarget;
        try {
          const arg = { p_jenis: mode, p_mulai: mulai, p_selesai: selesai, p_alasan: alasan };
          if (mode === 'sakit') {
            sibuk(btn, 'Mengunggah foto...');
            const b = await bukti.unggah('sakit');
            Object.assign(arg, { p_lat: b.lat, p_lng: b.lng, p_akurasi: b.akurasi, p_foto_depan: b.depan, p_foto_belakang: b.belakang });
          }
          sibuk(btn, 'Mengirim...');
          const { data, error } = await sb.rpc('ajukan_izin', arg);
          if (error) throw error;
          mode = null;
          if (data && data.status === 'ditolak') toast('Pengajuan izin otomatis ditolak karena kurang dari 3 hari sebelumnya.', true);
          else toast('Pengajuan terkirim. Menunggu persetujuan Ketua atau Sekretaris.');
          muat();
        } catch (err) { pulih(btn, 'Kirim Pengajuan'); pesan(pesanRpc(err)); }
      };
    }

    wadah.querySelectorAll('[data-batal-ajuan]').forEach((b) => (b.onclick = async () => {
      b.disabled = true; b.textContent = 'Membatalkan...';
      const { data, error } = await sb.from('pengajuan_izin').delete().eq('id', b.dataset.batalAjuan).select('id');
      if (error || !data || !data.length) { b.disabled = false; b.textContent = 'Batalkan pengajuan'; return toast('Gagal membatalkan. Mungkin sudah diproses pengurus.', true); }
      toast('Pengajuan dibatalkan.'); muat();
    }));
  }

  const sisaTeks = (t) => { const m = Math.max(0, Math.ceil((t - Date.now()) / 60000)); return 'Sisa ' + (m >= 60 ? Math.floor(m / 60) + ' jam ' : '') + (m % 60) + ' menit.'; };
  setInterval(() => {
    const j = wadah.querySelector('[data-jam]'); if (j) j.textContent = jamKini();
    if (tungguPulang) {
      if (Date.now() >= tungguPulang.getTime()) { tampil(); return; }
      const s = wadah.querySelector('[data-sisa]'); if (s) s.textContent = sisaTeks(tungguPulang);
    }
  }, 15000);
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
      <thead><tr><th>No</th><th>Nama</th><th>Lokasi</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th><th>Bukti</th><th></th></tr></thead>
      <tbody data-isi><tr class="tidak-klik"><td colspan="8" class="empty">Memuat data...</td></tr></tbody>
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
    tbody.innerHTML = '<tr class="tidak-klik"><td colspan="8" class="empty">Memuat data...</td></tr>';
    const kemarin = geserHari(tanggal, -1);
    const [hariIni, sebelum] = await Promise.all([
      sb.from('absensi').select('id, anggota_id, tanggal, pos_id, status, jam_masuk, jam_pulang, keterangan, lat_masuk, lng_masuk, akurasi_masuk, foto_masuk_depan, foto_masuk_belakang, lat_pulang, lng_pulang, akurasi_pulang, foto_pulang_depan, foto_pulang_belakang').eq('tanggal', tanggal),
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
        <td>${r.foto_masuk_depan || r.lat_masuk ? '<button class="btn-bukti" type="button" data-bukti-id="' + r.id + '">📍 Lihat</button>' : '<span style="color:var(--muted)">–</span>'}</td>
        <td><div class="aksi-sel">${r.kosong
          ? '<button class="btn btn-line btn-sm" type="button" data-catat="' + r.anggota_id + '">Catat</button>'
          : '<button class="btn btn-line btn-sm" type="button" data-ubah="' + r.id + '">Ubah</button><button class="btn btn-bad btn-sm" type="button" data-hapus="' + r.id + '">Hapus</button>'}</div></td>
      </tr>`).join('')
      : '<tr class="tidak-klik"><td colspan="8" class="empty">' + (satpam.length ? 'Tidak ada yang cocok.' : 'Belum ada anggota aktif.') + '</td></tr>';

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

  function lihatBukti(r) {
    const blok = (judul, lat, lng, akr, jam, d, b) => `
      <section style="display:grid;gap:.6rem">
        <h3 style="margin:0;font-size:1.05rem;color:var(--navy-900)">${judul} · ${jamJkt(jam)}</h3>
        <div class="lok-baris">${lat != null ? '📍 ' + lat + ', ' + lng + (akr ? ' (±' + Math.round(akr) + ' m)' : '') + ' <a href="' + linkPeta(lat, lng) + '" target="_blank" rel="noopener">Buka di Google Maps ↗</a>' : '<span style="color:var(--muted)">Tidak ada data lokasi</span>'}</div>
        <div class="bukti-grid">
          <figure><figcaption>Kamera depan</figcaption><div class="img" data-foto="${escA(d || '')}">${d ? 'Memuat...' : 'Tidak ada'}</div></figure>
          <figure><figcaption>Kamera belakang</figcaption><div class="img" data-foto="${escA(b || '')}">${b ? 'Memuat...' : 'Tidak ada'}</div></figure>
        </div>
      </section>`;
    dlg.innerHTML = `
      <div class="d-head"><div><h2 id="aJudul">Bukti Absensi</h2><p>${escA(namaSatpam(r.anggota_id))} · ${tglPanjangA(r.tanggal)} · ${escA(namaPos(r.pos_id))}</p></div>
        <button class="d-close" type="button" aria-label="Tutup" data-tutup>×</button></div>
      <div class="d-body">
        ${blok('Absen masuk', r.lat_masuk, r.lng_masuk, r.akurasi_masuk, r.jam_masuk, r.foto_masuk_depan, r.foto_masuk_belakang)}
        ${r.jam_pulang ? blok('Absen pulang', r.lat_pulang, r.lng_pulang, r.akurasi_pulang, r.jam_pulang, r.foto_pulang_depan, r.foto_pulang_belakang) : '<p style="margin:0;color:var(--muted)">Belum absen pulang.</p>'}
      </div>`;
    dlg.querySelector('[data-tutup]').onclick = () => dlg.close();
    if (!dlg.open) dlg.showModal();
    muatFoto(dlg);
  }

  // ---------- Interaksi ----------
  wadah.querySelector('[data-tgl]').addEventListener('change', (e) => { if (e.target.value) { tanggal = e.target.value; muat(); } });
  wadah.querySelector('[data-lokasi]').addEventListener('change', (e) => { lokasi = e.target.value; tampil(); });
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });
  wadah.querySelector('[data-tambah]').addEventListener('click', () => bukaForm());
  tbody.addEventListener('click', (e) => {
    const v = e.target.closest('[data-bukti-id]'); if (v) return lihatBukti(catatan.find((x) => x.id === v.dataset.buktiId));
    const c = e.target.closest('[data-catat]'); if (c) return bukaForm(null, c.dataset.catat);
    const u = e.target.closest('[data-ubah]'); if (u) return bukaForm(catatan.find((x) => x.id === u.dataset.ubah));
    const h = e.target.closest('[data-hapus]'); if (h) return konfirmasiHapus(catatan.find((x) => x.id === h.dataset.hapus));
  });

  window.muatUlangAbsensi = () => muat();
  (async () => {
    try { await muatAwal(); } catch (err) { tbody.innerHTML = '<tr class="tidak-klik"><td colspan="7" class="empty">Gagal memuat. ' + escA(pesanError(err)) + '</td></tr>'; return; }
    muat();
  })();
}

// Muat foto privat (link sementara 10 menit) ke semua [data-foto] dalam elemen
async function muatFoto(el) {
  const kotak = [...el.querySelectorAll('[data-foto]')].filter((k) => k.dataset.foto);
  await Promise.all(kotak.map(async (k) => {
    const { data, error } = await sb.storage.from('dokumen').createSignedUrl(k.dataset.foto, 600);
    if (error || !data) { k.textContent = 'Gagal memuat'; return; }
    k.innerHTML = '<a href="' + data.signedUrl + '" target="_blank" rel="noopener" title="Buka ukuran penuh"><img alt="Foto bukti"></a>';
    k.querySelector('img').src = data.signedUrl;
  }));
}

// =====================================================================
// PENGURUS: persetujuan pengajuan izin & sakit
// =====================================================================
function mulaiPengajuanPengurus({ wadah, saatJumlah }) {
  let tab = 'menunggu', semua = [], nama = {};

  wadah.innerHTML = `
    <div class="card-head">
      <h2>Pengajuan Izin &amp; Sakit</h2>
      <div class="tabs" role="group" aria-label="Saring status">
        <button type="button" data-tab="menunggu" aria-pressed="true">Menunggu<span class="n"></span></button>
        <button type="button" data-tab="disetujui" aria-pressed="false">Disetujui<span class="n"></span></button>
        <button type="button" data-tab="ditolak" aria-pressed="false">Ditolak<span class="n"></span></button>
      </div>
    </div>
    <div data-list><p class="kosong">Memuat pengajuan...</p></div>`;
  const list = wadah.querySelector('[data-list]');

  async function muat() {
    const dari = geserHari(tglJkt(), -60);
    const [a, p] = await Promise.all([
      sb.from('pengajuan_izin').select('id, anggota_id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, catatan, otomatis, lat, lng, akurasi, foto_depan, foto_belakang, diproses_oleh, diproses_pada, dibuat_pada')
        .gte('tanggal_selesai', dari).order('dibuat_pada', { ascending: false }),
      sb.from('anggota').select('id, nama, jabatan')
    ]);
    if (a.error || p.error) { list.innerHTML = '<p class="kosong">Gagal memuat. ' + escA(pesanError(a.error || p.error)) + '</p>'; return; }
    nama = Object.fromEntries(p.data.map((x) => [x.id, x.nama]));
    semua = a.data;
    const n = { menunggu: 0, disetujui: 0, ditolak: 0 };
    semua.forEach((x) => n[x.status]++);
    wadah.querySelectorAll('[data-tab]').forEach((b) => (b.querySelector('.n').textContent = ' ' + n[b.dataset.tab]));
    if (saatJumlah) saatJumlah(n.menunggu);
    tampil();
  }

  function tampil() {
    const rows = semua.filter((x) => x.status === tab);
    if (!rows.length) { list.innerHTML = '<p class="kosong">' + (tab === 'menunggu' ? 'Tidak ada pengajuan yang menunggu. 👍' : 'Belum ada data.') + '</p>'; return; }
    list.innerHTML = rows.map((x) => {
      const hMin = selisihHari(x.tanggal_mulai, tglJkt(new Date(x.dibuat_pada)));
      return `
      <article class="ajuan" data-id="${x.id}">
        <div>
          <h3>${escA(nama[x.anggota_id] || '(akun nonaktif)')} <span class="pill p-${x.jenis === 'sakit' ? 'sakit' : 'izin'}">${x.jenis === 'sakit' ? 'Sakit' : 'Izin'}</span></h3>
          <p class="meta">${rentangTeks(x.tanggal_mulai, x.tanggal_selesai)} · diajukan ${new Date(x.dibuat_pada).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${x.jenis === 'izin' ? ' (H-' + hMin + ')' : ''}</p>
          <p class="alasan">${escA(x.alasan)}</p>
          ${x.jenis === 'sakit' ? `<div class="bukti-lihat">
              <div class="img-kecil" data-foto="${escA(x.foto_depan || '')}">${x.foto_depan ? 'Memuat' : 'Tanpa foto'}</div>
              <div class="img-kecil" data-foto="${escA(x.foto_belakang || '')}">${x.foto_belakang ? 'Memuat' : 'Tanpa foto'}</div>
              ${x.lat != null ? '<a href="' + linkPeta(x.lat, x.lng) + '" target="_blank" rel="noopener">📍 Lihat lokasi (±' + Math.round(x.akurasi || 0) + ' m) ↗</a>' : ''}
            </div>` : ''}
          ${x.status !== 'menunggu' ? '<p class="catatan">' + (x.otomatis ? 'Sistem' : escA(nama[x.diproses_oleh] || 'Pengurus')) + ' · ' + PJ_LABEL[x.status].toLowerCase() + (x.catatan ? ' — ' + escA(x.catatan) : '') + '</p>' : ''}
        </div>
        <div class="tombol">${x.status === 'menunggu'
          ? '<button class="btn btn-bad" type="button" data-tolak="' + x.id + '">Tolak</button><button class="btn btn-ok" type="button" data-setujui="' + x.id + '">✓ Setujui</button>'
          : '<span class="pill p-' + x.status + '">' + PJ_LABEL[x.status] + '</span>'}</div>
      </article>`;
    }).join('');
    // foto bukti sakit
    muatFoto(list).then(() => list.querySelectorAll('.bukti-lihat img').forEach((i) => (i.alt = 'Foto bukti sakit')));
  }

  async function proses(id, setujui, catatanTeks, btn) {
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { error } = await sb.rpc('proses_izin', { p_id: id, p_setujui: setujui, p_catatan: catatanTeks || null });
    if (error) { btn.disabled = false; btn.textContent = setujui ? '✓ Setujui' : 'Ya, tolak'; return toast('Gagal: ' + pesanRpc(error), true); }
    const x = semua.find((y) => y.id === id);
    toast((setujui ? 'Disetujui: ' : 'Ditolak: ') + (nama[x.anggota_id] || '') + ' — ' + (x.jenis === 'sakit' ? 'sakit' : 'izin') + ' ' + rentangTeks(x.tanggal_mulai, x.tanggal_selesai));
    muat();
    if (window.muatUlangAbsensi) window.muatUlangAbsensi();
  }

  wadah.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    wadah.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    tampil();
  }));
  list.addEventListener('click', (e) => {
    const s = e.target.closest('[data-setujui]'); if (s) return proses(s.dataset.setujui, true, null, s);
    const t = e.target.closest('[data-tolak]');
    if (t) {
      const art = t.closest('.ajuan');
      if (art.querySelector('.tolak-box')) return;
      art.insertAdjacentHTML('beforeend', '<div class="tolak-box"><label style="font-weight:600;font-size:.9rem" for="tl-' + t.dataset.tolak + '">Alasan penolakan (opsional)</label><textarea id="tl-' + t.dataset.tolak + '" placeholder="Contoh: jadwal jaga sudah penuh"></textarea><div class="tombol"><button class="btn btn-line" type="button" data-batal-tolak>Batal</button><button class="btn btn-bad solid" type="button" data-ya-tolak="' + t.dataset.tolak + '">Ya, tolak</button></div></div>');
      art.querySelector('textarea').focus();
      return;
    }
    const bt = e.target.closest('[data-batal-tolak]'); if (bt) return bt.closest('.tolak-box').remove();
    const yt = e.target.closest('[data-ya-tolak]'); if (yt) return proses(yt.dataset.yaTolak, false, yt.closest('.tolak-box').querySelector('textarea').value.trim(), yt);
  });

  muat();
  return { muat };
}

// =====================================================================
// PENGURUS: pengaturan minimal lama jaga
// =====================================================================
async function mulaiPengaturanAbsen({ wadah }) {
  wadah.innerHTML = `
    <div class="card-head" style="margin-bottom:.6rem"><h2>Pengaturan Absen</h2></div>
    <form class="atur-jam" data-form>
      <label for="minJam">Satpam baru bisa absen pulang minimal</label>
      <div class="atur-isi"><input id="minJam" type="number" min="0" max="24" step="0.5" inputmode="decimal" required><span>jam setelah absen masuk</span>
        <button class="btn btn-gold" type="submit">Simpan</button></div>
      <small data-info style="color:var(--muted)"></small>
    </form>`;
  const inp = wadah.querySelector('#minJam'), info = wadah.querySelector('[data-info]');
  const { data } = await sb.from('pengaturan').select('nilai, diubah_pada').eq('kunci', 'min_jam_jaga').maybeSingle();
  inp.value = data ? data.nilai : 8;
  info.textContent = 'Isi 0 bila satpam boleh absen pulang kapan saja. Berlaku langsung untuk semua satpam.';
  wadah.querySelector('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = Number(String(inp.value).replace(',', '.'));
    if (!(n >= 0 && n <= 24)) return toast('Isi angka 0 sampai 24 jam.', true);
    const btn = e.submitter || wadah.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data: hasil, error } = await sb.rpc('atur_min_jam_jaga', { p_jam: n });
    btn.disabled = false; btn.textContent = 'Simpan';
    if (error) return toast('Gagal menyimpan. ' + pesanRpc(error), true);
    inp.value = Number(hasil);
    toast('Tersimpan. Absen pulang minimal ' + String(Number(hasil)).replace('.', ',') + ' jam setelah absen masuk.');
  });
}
