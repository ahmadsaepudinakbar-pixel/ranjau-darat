// Kerangka dashboard: menu samping + bar atas. Dipakai semua halaman dashboard.
// Pakai: pasangLayout({ peran: 'sekretaris', aktif: 'dashboard', judul: 'Dashboard Sekretaris', akun })

const IKON = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>',
  pendaftaran: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  anggota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5c2.6.2 4.4 2 5 5"/></svg>',
  surat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5"/></svg>',
  absensi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
  keuangan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2" fill="currentColor"/></svg>',
  gaji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 2-1.1 1.6-2.5 2-2.5 1-2.5 2.1 1.1 2 2.5 2 2.5-.8 2.5-1.8"/></svg>',
  laporan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  profil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  pengaturan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  keluar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
};

// Menu tiap jabatan. href kosong = belum dibuat (ditandai "Segera").
const MENU = {
  ketua: [
    ['dashboard', 'Dashboard', 'ketua.html'],
    ['pendaftaran', 'Pendaftaran', 'ketua.html#pendaftaran'],
    ['anggota', 'Data Anggota', ''],
    ['absensi', 'Absensi', 'absensi.html'],
    ['keuangan', 'Keuangan', 'keuangan.html'],
    ['laporan', 'Laporan', 'laporan.html'],
    ['pengaturan', 'Pengaturan', '']
  ],
  sekretaris: [
    ['dashboard', 'Dashboard', 'sekretaris.html'],
    ['pendaftaran', 'Pendaftaran', 'sekretaris.html#pendaftaran'],
    ['anggota', 'Data Anggota', ''],
    ['surat', 'Surat & Dokumen', ''],
    ['absensi', 'Absensi', 'absensi.html'],
    ['laporan', 'Laporan', ''],
    ['pengaturan', 'Pengaturan', '']
  ],
  bendahara: [
    ['dashboard', 'Dashboard', 'bendahara.html'],
    ['keuangan', 'Keuangan', 'keuangan.html'],
    ['gaji', 'Gaji Anggota', 'gaji.html'],
    ['laporan', 'Laporan Keuangan', 'laporan.html'],
    ['pengaturan', 'Pengaturan', 'pengaturan.html']
  ],
  anggota: [
    ['dashboard', 'Dashboard', 'anggota.html#dashboard'],
    ['profil', 'Profil Saya', 'anggota.html#profil'],
    ['absensi', 'Absensi', 'anggota.html#absensi'],
    ['gaji', 'Gaji', 'anggota.html#gaji']
  ]
};

function pasangLayout({ peran, aktif, judul, akun }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const side = document.getElementById('side');
  side.innerHTML =
    '<a class="side-brand" href="index.html"><img src="assets/logo.png" alt=""><span><b>CV. RANJAU DARAT</b><small>SATPAM &amp; ADMINISTRASI</small></span></a>' +
    '<nav aria-label="Menu ' + esc(peran) + '">' +
      MENU[peran].map(([key, label, href]) => href
        ? '<a href="' + href + '" data-key="' + key + '"' + (key === aktif ? ' aria-current="page"' : '') + '>' + IKON[key] + '<span>' + label + '</span></a>'
        : '<a class="soon" aria-disabled="true" title="Segera hadir">' + IKON[key] + '<span>' + label + '</span><span class="tag">Segera</span></a>'
      ).join('') +
    '</nav>' +
    '<div class="side-foot"><button type="button" onclick="keluar()">' + IKON.keluar + '<span>Logout</span></button></div>';

  document.getElementById('judul').textContent = judul;
  document.getElementById('tgl').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const chip = document.getElementById('chip');
  chip.innerHTML = '<span class="nm">' + esc(akun.nama) + '</span><span class="av" aria-hidden="true">' + esc((akun.nama || '?').trim().charAt(0).toUpperCase()) + '</span>';
  chip.title = akun.nama + ' (' + akun.username + ')';

  // Menu samping di HP: buka/tutup
  const burger = document.getElementById('burger');
  burger.addEventListener('click', () => {
    const buka = side.classList.toggle('open');
    burger.setAttribute('aria-expanded', buka);
  });
  document.addEventListener('click', (e) => {
    if (side.classList.contains('open') && !side.contains(e.target) && !burger.contains(e.target)) {
      side.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
    }
  });
  side.addEventListener('click', (e) => { if (e.target.closest('nav a[href]')) side.classList.remove('open'); });
}

// Angka kecil di menu (mis. jumlah pendaftar menunggu)
function setBadgeMenu(key, n) {
  const a = document.querySelector('#side nav a[data-key="' + key + '"]');
  if (!a) return;
  let c = a.querySelector('.count');
  if (!n) { if (c) c.remove(); return; }
  if (!c) { c = document.createElement('span'); c.className = 'count'; a.appendChild(c); }
  c.textContent = n;
}

function toast(teks, buruk = false) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = teks;
  t.className = 'toast' + (buruk ? ' bad' : '');
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.hidden = true), 3500);
}

// Menu yang menunjuk ke bagian di halaman yang sama (mis. #pendaftaran): tandai aktif saat dipilih
window.addEventListener('hashchange', () => {
  const links = document.querySelectorAll('#side nav a[href]');
  let cocok = null;
  links.forEach((a) => { if (location.hash && a.getAttribute('href').endsWith(location.hash)) cocok = a; });
  if (!cocok) cocok = [...links].find((a) => !a.getAttribute('href').includes('#'));
  links.forEach((a) => a.toggleAttribute('aria-current', a === cocok));
  if (cocok) cocok.setAttribute('aria-current', 'page');
});
