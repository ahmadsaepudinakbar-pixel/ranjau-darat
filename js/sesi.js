// Penjaga halaman dashboard: hanya akun yang login, disetujui, dan jabatannya cocok yang boleh masuk.
// Pakai: const akun = await wajibLogin(['ketua']);
// Akun berjabatan 'admin' boleh membuka semua dashboard.

async function wajibLogin(jabatanBoleh) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace('login.html'); return null; }

  const { data: akun, error } = await sb.from('anggota')
    .select('id, username, nama, jabatan, status, posisi')
    .eq('id', session.user.id).maybeSingle();

  if (error || !akun || akun.status !== 'diterima') {
    await sb.auth.signOut();
    location.replace('login.html');
    return null;
  }
  // Admin boleh membuka semua dashboard
  if (akun.jabatan === 'admin') { pasangBarAdmin(); return akun; }

  if (!jabatanBoleh.includes(akun.jabatan)) {
    // Salah halaman: arahkan ke dashboard miliknya sendiri
    location.replace(DASHBOARD[akun.jabatan] || DASHBOARD.anggota);
    return null;
  }
  return akun;
}

async function keluar() {
  await sb.auth.signOut();
  location.replace('login.html');
}

// Bar kecil di atas halaman untuk Admin: pindah antar dashboard
function pasangBarAdmin() {
  if (document.getElementById('barAdmin')) return;
  const sekarang = location.pathname.split('/').pop() || 'index.html';
  const menu = [['admin.html', 'Admin'], ['ketua.html', 'Ketua'], ['sekretaris.html', 'Sekretaris'],
                ['bendahara.html', 'Bendahara'], ['anggota.html', 'Anggota']];
  const bar = document.createElement('nav');
  bar.id = 'barAdmin';
  bar.setAttribute('aria-label', 'Pindah dashboard (Admin)');
  bar.innerHTML = '<b>Mode Admin</b>' + menu.map(([href, label]) =>
    '<a href="' + href + '"' + (href === sekarang ? ' aria-current="page"' : '') + '>' + label + '</a>').join('');
  const css = document.createElement('style');
  css.textContent = '#barAdmin{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .5rem;background:#3b1d5e;color:#fff;font-size:.85rem;padding:.45rem max(16px,env(safe-area-inset-left,0px))}' +
    '#barAdmin b{margin-right:.4rem;color:#f2c75a;letter-spacing:.04em}' +
    '#barAdmin a{color:#e6dcf5;text-decoration:none;padding:.2rem .6rem;border-radius:99px;border:1px solid rgba(255,255,255,.25)}' +
    '#barAdmin a:hover{background:rgba(255,255,255,.12)}' +
    '#barAdmin a[aria-current]{background:#f2c75a;color:#2a1446;border-color:#f2c75a;font-weight:700}';
  document.head.appendChild(css);
  document.body.prepend(bar);
}
