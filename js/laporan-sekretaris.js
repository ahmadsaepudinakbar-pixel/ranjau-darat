// Laporan Sekretariat bulanan: keanggotaan, persuratan, dan kehadiran.
// Memakai gaji.js (escG, namaPeriode, tglID, bulanIni) — muat lebih dulu.
// mulaiLaporanSekretariat({ wadah })

const PESAN_SQL5 = 'Pengaturan sekretariat belum disiapkan. Jalankan file 05_sekretariat.sql di Supabase (SQL Editor) satu kali. Sementara itu laporan memakai data bawaan.';

function mulaiLaporanSekretariat({ wadah }) {
  let periode = bulanIni();
  let lap = null;

  wadah.innerHTML = `
    <div class="card no-print">
      <div class="card-head" style="margin-bottom:0">
        <h2>Laporan Sekretariat</h2>
        <div class="toolbar" style="flex:1;justify-content:flex-end">
          <label class="periode">Periode <input type="month" data-periode value="${periode}"></label>
          <button class="btn btn-line" type="button" data-csv disabled>Unduh CSV</button>
          <button class="btn btn-gold" type="button" data-cetak disabled>Cetak / Simpan PDF</button>
        </div>
      </div>
    </div>
    <article class="kertas" data-kertas aria-live="polite"><p class="kosong">Memuat laporan...</p></article>`;

  const kertas = wadah.querySelector('[data-kertas]');
  const tCsv = wadah.querySelector('[data-csv]');
  const tCetak = wadah.querySelector('[data-cetak]');
  const aktifkan = (ya) => { tCsv.disabled = !ya; tCetak.disabled = !ya; };

  // Rentang bulan: [awal, akhir) sebagai tanggal 'YYYY-MM-DD'
  function rentang(p) {
    const [y, m] = p.split('-').map(Number);
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return [p + '-01', ny + '-' + String(nm).padStart(2, '0') + '-01'];
  }

  async function muat() {
    aktifkan(false);
    kertas.innerHTML = '<p class="kosong">Memuat laporan...</p>';
    const [awal, akhir] = rentang(periode);
    const wAwal = awal + 'T00:00:00+07:00', wAkhir = akhir + 'T00:00:00+07:00';

    const [pg, ang, sur, abs, izin] = await Promise.all([
      sb.from('pengaturan_sekretariat').select('nama_organisasi, alamat, telepon, email, nama_ketua, nama_sekretaris').maybeSingle(),
      sb.from('anggota').select('jabatan, status, posisi, dibuat_pada, disetujui_pada'),
      sb.from('surat').select('arah, nomor_surat, tanggal, pihak, perihal').gte('tanggal', awal).lt('tanggal', akhir)
        .order('tanggal', { ascending: true }).order('dibuat_pada', { ascending: true }),
      sb.from('absensi').select('status').gte('tanggal', awal).lt('tanggal', akhir),
      sb.from('pengajuan_izin').select('jenis').gte('tanggal_mulai', awal).lt('tanggal_mulai', akhir)
    ]);

    const err = ang.error;
    if (err) { kertas.innerHTML = '<p class="kosong">Gagal memuat laporan. ' + escG(pesanError(err)) + '</p>'; return; }

    const dalam = (t) => t && t >= wAwal && t < wAkhir;
    const a = ang.data;
    const hitungAbs = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
    if (!abs.error) abs.data.forEach((x) => { if (x.status in hitungAbs) hitungAbs[x.status]++; });

    lap = {
      periode,
      pgBelum: !!pg.error,
      pg: (pg.data) || { nama_organisasi: 'CV. Ranjau Darat', alamat: '', telepon: '', email: '', nama_ketua: '', nama_sekretaris: '' },
      anggota: {
        aktif: a.filter((r) => r.status === 'diterima').length,
        satpam: a.filter((r) => r.status === 'diterima' && r.posisi === 'satpam').length,
        pengurus: a.filter((r) => r.status === 'diterima' && r.jabatan !== 'anggota').length,
        daftar: a.filter((r) => r.jabatan === 'anggota' && dalam(r.dibuat_pada)).length,
        diterima: a.filter((r) => r.jabatan === 'anggota' && r.status === 'diterima' && dalam(r.disetujui_pada)).length,
        ditolak: a.filter((r) => r.jabatan === 'anggota' && r.status === 'ditolak' && dalam(r.disetujui_pada)).length,
        menunggu: a.filter((r) => r.jabatan === 'anggota' && r.status === 'menunggu').length
      },
      suratBelum: !!sur.error,
      surat: sur.error ? [] : sur.data,
      absBelum: !!abs.error,
      abs: hitungAbs,
      izinBelum: !!izin.error,
      izin: izin.error ? { izin: 0, sakit: 0 } : { izin: izin.data.filter((x) => x.jenis === 'izin').length, sakit: izin.data.filter((x) => x.jenis === 'sakit').length }
    };
    tampil();
    aktifkan(true);
  }

  function tampil() {
    const l = lap, pg = l.pg, an = l.anggota;
    const masuk = l.surat.filter((s) => s.arah === 'masuk');
    const keluar = l.surat.filter((s) => s.arah === 'keluar');
    const baris = (k, v, cls = '') => '<tr class="' + cls + '"><td>' + k + '</td><td class="rp">' + v + '</td></tr>';
    const dicetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const kontak = [pg.telepon && 'Telp. ' + pg.telepon, pg.email].filter(Boolean).map(escG).join(' · ');
    const totalAbs = l.abs.hadir + l.abs.izin + l.abs.sakit + l.abs.alpha;

    kertas.innerHTML = `
      ${l.pgBelum ? '<p class="form-alert no-print">' + escG(PESAN_SQL5) + '</p>' : ''}
      <header class="kop">
        <h2>${escG(pg.nama_organisasi)}</h2>
        ${pg.alamat ? '<p>' + escG(pg.alamat) + '</p>' : ''}
        ${kontak ? '<p>' + kontak + '</p>' : ''}
        <h3>LAPORAN SEKRETARIAT</h3>
        <p><b>Periode: ${namaPeriode(l.periode)}</b></p>
      </header>

      <div class="dua-kolom">
        <section>
          <h4>Keanggotaan</h4>
          <table class="lap-tbl">
            ${baris('Anggota aktif (saat ini)', an.aktif, 'jml')}
            ${baris('Satpam', an.satpam)}
            ${baris('Pengurus', an.pengurus)}
          </table>
        </section>
        <section>
          <h4>Pendaftaran Bulan Ini</h4>
          <table class="lap-tbl">
            ${baris('Pendaftar baru', an.daftar)}
            ${baris('Disetujui', an.diterima, 'plus')}
            ${baris('Ditolak', an.ditolak, 'minus')}
            ${baris('Masih menunggu (saat ini)', an.menunggu)}
          </table>
        </section>
      </div>

      <section>
        <h4>Persuratan</h4>
        ${l.suratBelum
          ? '<p class="catatan-lap">Data surat belum tersedia. Jalankan 04_surat.sql di Supabase.</p>'
          : `<table class="lap-tbl">
              ${baris('Surat masuk', masuk.length)}
              ${baris('Surat keluar', keluar.length)}
              ${baris('Total surat', l.surat.length, 'jml')}
            </table>
            <div class="table-scroll" style="margin-top:.7rem">
              <table class="tbl lap-surat">
                <thead><tr><th>Tanggal</th><th>Nomor Surat</th><th>Jenis</th><th>Pengirim / Tujuan</th><th>Perihal</th></tr></thead>
                <tbody>${l.surat.length ? l.surat.map((s) => `
                  <tr class="tidak-klik"><td class="tgl">${tglID(s.tanggal)}</td><td class="nomor">${escG(s.nomor_surat)}</td>
                  <td>${s.arah === 'masuk' ? 'Masuk' : 'Keluar'}</td><td>${escG(s.pihak)}</td><td>${escG(s.perihal)}</td></tr>`).join('')
                  : '<tr class="tidak-klik"><td colspan="5" class="empty">Tidak ada surat di ' + namaPeriode(l.periode) + '.</td></tr>'}</tbody>
              </table>
            </div>`}
      </section>

      <section>
        <h4>Kehadiran Satpam</h4>
        ${l.absBelum
          ? '<p class="catatan-lap">Data absensi tidak dapat dimuat.</p>'
          : `<table class="lap-tbl">
              ${baris('Hadir', l.abs.hadir, 'plus')}
              ${baris('Izin', l.abs.izin)}
              ${baris('Sakit', l.abs.sakit)}
              ${baris('Alpha', l.abs.alpha, 'minus')}
              ${baris('Total catatan absensi', totalAbs, 'jml')}
            </table>
            <p class="catatan-lap">Dihitung dari catatan absensi yang tersimpan pada bulan ini.${l.izinBelum ? '' : ' Pengajuan bulan ini: ' + l.izin.izin + ' izin, ' + l.izin.sakit + ' sakit.'}</p>`}
      </section>

      <footer class="ttd">
        <div><p>Mengetahui,<br>Ketua</p><span class="garis"></span><b>${escG(pg.nama_ketua || '..............................')}</b></div>
        <div><p>Dicetak ${dicetak}<br>Sekretaris</p><span class="garis"></span><b>${escG(pg.nama_sekretaris || '..............................')}</b></div>
      </footer>`;
  }

  function unduhCsv() {
    const l = lap, an = l.anggota;
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const baris = [
      [l.pg.nama_organisasi], ['LAPORAN SEKRETARIAT'], ['Periode', namaPeriode(l.periode)], [],
      ['KEANGGOTAAN'], ['Anggota aktif (saat ini)', an.aktif], ['Satpam', an.satpam], ['Pengurus', an.pengurus],
      ['Pendaftar baru', an.daftar], ['Disetujui', an.diterima], ['Ditolak', an.ditolak], ['Masih menunggu', an.menunggu], [],
      ['KEHADIRAN'], ['Hadir', l.abs.hadir], ['Izin', l.abs.izin], ['Sakit', l.abs.sakit], ['Alpha', l.abs.alpha], [],
      ['PERSURATAN'], ['Tanggal', 'Nomor Surat', 'Jenis', 'Pengirim / Tujuan', 'Perihal'],
      ...l.surat.map((s) => [s.tanggal, s.nomor_surat, s.arah === 'masuk' ? 'Masuk' : 'Keluar', s.pihak, s.perihal])
    ];
    // Titik koma sebagai pemisah, supaya langsung rapi di Excel versi Indonesia
    const isi = '\ufeff' + baris.map((r) => r.map(q).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    a.download = 'laporan-sekretariat-' + l.periode + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  wadah.querySelector('[data-periode]').addEventListener('change', (e) => { if (e.target.value) { periode = e.target.value; muat(); } });
  tCetak.addEventListener('click', () => window.print());
  tCsv.addEventListener('click', unduhCsv);
  muat();
}
