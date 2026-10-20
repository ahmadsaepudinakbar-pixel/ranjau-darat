// Laporan Keuangan bulanan CV. Ranjau Darat
// Memakai gaji.js (fmtRp, escG, namaPeriode, bulanIni, tglID) dan keuangan.js (rentangBulan, muatPengaturanKas) — muat keduanya lebih dulu.
// mulaiLaporan({ wadah })

const PESAN_SQL3 = 'Fitur laporan belum disiapkan di database. Jalankan file 03_laporan_pengaturan.sql di Supabase (SQL Editor) satu kali.';

function mulaiLaporan({ wadah }) {
  let periode = bulanIni();
  let lap = null;

  wadah.innerHTML = `
    <div class="card no-print">
      <div class="card-head" style="margin-bottom:0">
        <h2>Laporan Keuangan</h2>
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

  async function muat() {
    aktifkan(false);
    kertas.innerHTML = '<p class="kosong">Memuat laporan...</p>';
    const [awal, akhir] = rentangBulan(periode);
    const [pg, sa, kas, gj] = await Promise.all([
      muatPengaturanKas(),
      sb.rpc('saldo_awal_bulan', { p_bulan: awal }),
      sb.from('kas').select('tanggal, jenis, kategori, jumlah, keterangan').gte('tanggal', awal).lt('tanggal', akhir)
        .order('tanggal', { ascending: true }).order('dibuat_pada', { ascending: true }),
      sb.from('gaji').select('total').gte('tanggal_gajian', awal).lt('tanggal_gajian', akhir)
    ]);
    const err = sa.error || kas.error || gj.error;
    if (err) {
      const belumSql = /saldo_awal_bulan|schema cache|does not exist|Could not find/i.test(err.message || '');
      kertas.innerHTML = '<p class="kosong">Gagal memuat laporan. ' + escG(belumSql ? PESAN_SQL3 : pesanError(err)) + '</p>';
      return;
    }
    lap = {
      periode,
      pg: pg || { nama_organisasi: 'CV. Ranjau Darat', alamat: '', nama_ketua: '', nama_bendahara: '' },
      saldoAwal: Number(sa.data || 0),
      kas: kas.data,
      gajiTotal: gj.data.reduce((a, g) => a + Number(g.total), 0),
      gajiJumlah: gj.data.length
    };
    tampil();
    aktifkan(true);
  }

  const jumlahJenis = (l, jenis) => l.kas.filter((t) => t.jenis === jenis).reduce((a, t) => a + Number(t.jumlah), 0);
  function perKategori(l, jenis) {
    const m = new Map();
    l.kas.filter((t) => t.jenis === jenis).forEach((t) => m.set(t.kategori, (m.get(t.kategori) || 0) + Number(t.jumlah)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function tampil() {
    const l = lap;
    const masuk = jumlahJenis(l, 'masuk');
    const keluar = jumlahJenis(l, 'keluar');
    const saldoAkhir = l.saldoAwal + masuk - keluar - l.gajiTotal;
    const baris = (k, v, cls = '') => '<tr class="' + cls + '"><td>' + k + '</td><td class="rp">' + v + '</td></tr>';
    const rincian = (daftar, total, kosongTeks) => daftar.length
      ? daftar.map(([k, v]) => baris(escG(k), fmtRp(v))).join('') + baris('Total', fmtRp(total), 'jml')
      : '<tr><td colspan="2" class="kosong-kecil">' + kosongTeks + '</td></tr>';
    const pg = l.pg;
    const dicetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    kertas.innerHTML = `
      <header class="kop">
        <h2>${escG(pg.nama_organisasi)}</h2>
        ${pg.alamat ? '<p>' + escG(pg.alamat) + '</p>' : ''}
        <h3>LAPORAN KEUANGAN</h3>
        <p><b>Periode: ${namaPeriode(l.periode)}</b></p>
      </header>

      <section>
        <h4>Ringkasan</h4>
        <table class="lap-tbl">
          ${baris('Saldo awal bulan', fmtRp(l.saldoAwal))}
          ${baris('Total pemasukan', '+ ' + fmtRp(masuk), 'plus')}
          ${baris('Total pengeluaran kas', '− ' + fmtRp(keluar), 'minus')}
          ${baris('Gaji anggota' + (l.gajiJumlah ? ' (' + l.gajiJumlah + ' slip)' : ''), '− ' + fmtRp(l.gajiTotal), 'minus')}
          ${baris('Saldo akhir bulan', (saldoAkhir < 0 ? '− ' : '') + fmtRp(Math.abs(saldoAkhir)), 'jml besar')}
        </table>
      </section>

      <div class="dua-kolom">
        <section><h4>Rincian Pemasukan</h4><table class="lap-tbl">${rincian(perKategori(l, 'masuk'), masuk, 'Tidak ada pemasukan.')}</table></section>
        <section><h4>Rincian Pengeluaran</h4><table class="lap-tbl">${
          rincian(perKategori(l, 'keluar'), keluar, 'Tidak ada pengeluaran kas.')
        }${l.gajiTotal ? baris('Gaji anggota', fmtRp(l.gajiTotal)) : ''}</table></section>
      </div>

      <section>
        <h4>Daftar Transaksi Kas</h4>
        <div class="table-scroll" style="margin-top:.5rem">
          <table class="tbl lap-trx">
            <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="rp">Pemasukan</th><th class="rp">Pengeluaran</th></tr></thead>
            <tbody>${l.kas.length ? l.kas.map((t) => `
              <tr class="tidak-klik"><td class="tgl">${tglID(t.tanggal)}</td><td>${escG(t.kategori)}</td><td>${t.keterangan ? escG(t.keterangan) : '–'}</td>
              <td class="rp masuk">${t.jenis === 'masuk' ? fmtRp(t.jumlah) : ''}</td><td class="rp keluar">${t.jenis === 'keluar' ? fmtRp(t.jumlah) : ''}</td></tr>`).join('')
              : '<tr class="tidak-klik"><td colspan="5" class="empty">Tidak ada transaksi kas di ' + namaPeriode(l.periode) + '.</td></tr>'}</tbody>
          </table>
        </div>
        ${l.gajiTotal ? '<p class="catatan-gaji">Gaji anggota (' + fmtRp(l.gajiTotal) + ') tidak ditampilkan per baris di sini; rinciannya ada di menu Gaji Anggota.</p>' : ''}
      </section>

      <footer class="ttd">
        <div><p>Mengetahui,<br>Ketua</p><span class="garis"></span><b>${escG(pg.nama_ketua || '..............................')}</b></div>
        <div><p>Dicetak ${dicetak}<br>Bendahara</p><span class="garis"></span><b>${escG(pg.nama_bendahara || '..............................')}</b></div>
      </footer>`;
  }

  function unduhCsv() {
    const l = lap;
    const masuk = jumlahJenis(l, 'masuk');
    const keluar = jumlahJenis(l, 'keluar');
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const baris = [
      [l.pg.nama_organisasi], ['LAPORAN KEUANGAN'], ['Periode', namaPeriode(l.periode)], [],
      ['Saldo awal', l.saldoAwal], ['Total pemasukan', masuk], ['Total pengeluaran kas', keluar], ['Gaji anggota', l.gajiTotal],
      ['Saldo akhir', l.saldoAwal + masuk - keluar - l.gajiTotal], [],
      ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah'],
      ...l.kas.map((t) => [t.tanggal, t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran', t.kategori, t.keterangan || '', t.jumlah])
    ];
    // Titik koma sebagai pemisah, supaya langsung rapi di Excel versi Indonesia
    const isi = '\ufeff' + baris.map((r) => r.map(q).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    a.download = 'laporan-keuangan-' + l.periode + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  wadah.querySelector('[data-periode]').addEventListener('change', (e) => { if (e.target.value) { periode = e.target.value; muat(); } });
  tCetak.addEventListener('click', () => window.print());
  tCsv.addEventListener('click', unduhCsv);
  muat();
}
