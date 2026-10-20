// Penjaga halaman dashboard: hanya akun yang login, disetujui, dan jabatannya cocok yang boleh masuk.
// Pakai: const akun = await wajibLogin(['ketua']);

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
