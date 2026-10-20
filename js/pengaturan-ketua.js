// Pengaturan Ketua: kelola jabatan pengurus + ganti password.
// Memakai gaji.js (escG) — muat lebih dulu.
// mulaiPengaturanKetua({ wadah, akun })

function mulaiPengaturanKetua({ wadah, akun }) {
  const JABATAN = { ketua: 'Ketua', sekretaris: 'Sekretaris', bendahara: 'Bendahara', anggota: 'Anggota', admin: 'Admin' };
  const BOLEH_PILIH = ['anggota', 'sekretaris', 'bendahara'];   // jabatan Ketua & Admin tidak diubah dari sini
  let daftar = [];

  wadah.innerHTML = `
    <section class="card pengaturan-kartu">
      <div class="card-head" style="margin-bottom:.3rem">
        <h2>Kelola Pengurus</h2>
      </div>
      <p class="sub" style="margin:0 0 .6rem;color:var(--muted);font-size:.92rem">
        Tentukan siapa yang menjadi Sekretaris atau Bendahara. Perubahan berlaku saat orangnya login berikutnya.
        Jabatan Ketua dan Admin tidak bisa diubah dari halaman ini.
      </p>
      <div class="toolbar"><label class="cari" style="margin-left:0;flex:1 1 280px"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cari anggota</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input type="search" placeholder="Cari nama atau username" data-cari></label></div>
      <div class="table-scroll">
        <table class="tbl" style="min-width:600px">
          <thead><tr><th>No</th><th>Nama</th><th>Jabatan Saat Ini</th><th>Ubah Menjadi</th><th></th></tr></thead>
          <tbody data-isi><tr><td colspan="5" class="empty">Memuat data...</td></tr></tbody>
        </table>
      </div>
    </section>

    <form class="pengaturan" data-form-sandi novalidate>
      <section class="card">
        <h2>Keamanan Akun</h2>
        <p class="sub">Ganti password akun <b>@${escG(akun.username)}</b>. Gunakan minimal 8 karakter.</p>
        <div class="slip-form dua">
          <div class="f"><label for="sBaru">Password baru</label><input id="sBaru" type="password" autocomplete="new-password" minlength="8"><small class="err"></small></div>
          <div class="f"><label for="sUlang">Ulangi password baru</label><input id="sUlang" type="password" autocomplete="new-password"><small class="err"></small></div>
        </div>
        <p class="form-alert" data-alert-sandi hidden style="margin-top:.9rem"></p>
        <div class="aksi" style="margin-top:.9rem"><button class="btn btn-line" type="submit" data-simpan-sandi>Ganti Password</button></div>
      </section>
    </form>`;

  const q = (s) => wadah.querySelector(s);
  const tbody = q('[data-isi]');
  let kataCari = '';

  async function muat() {
    const { data, error } = await sb.from('anggota').select('id, username, nama, jabatan, posisi')
      .eq('status', 'diterima').order('nama', { ascending: true });
    if (error) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Gagal memuat data. ' + escG(pesanError(error)) + '</td></tr>'; return; }
    daftar = data;
    tampil();
  }

  function tampil() {
    const k = kataCari.trim().toLowerCase();
    const rows = daftar.filter((r) => !k || r.nama.toLowerCase().includes(k) || r.username.includes(k));
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">' + (k ? 'Tidak ada yang cocok.' : 'Belum ada anggota yang disetujui.') + '</td></tr>'; return; }
    tbody.innerHTML = rows.map((r, i) => {
      const tetap = !BOLEH_PILIH.includes(r.jabatan) || r.id === akun.id;
      return `<tr class="tidak-klik" data-id="${r.id}">
        <td class="no">${i + 1}</td>
        <td class="nm"><b>${escG(r.nama)}</b><small>@${escG(r.username)}</small></td>
        <td><span class="pill j-${escG(r.jabatan)}">${JABATAN[r.jabatan] || escG(r.jabatan)}</span></td>
        <td>${tetap ? '<span class="tdk" style="color:var(--muted)">–</span>'
          : '<select class="filter-jab" data-pilih aria-label="Jabatan baru untuk ' + escG(r.nama) + '">' +
            BOLEH_PILIH.map((j) => '<option value="' + j + '"' + (j === r.jabatan ? ' selected' : '') + '>' + JABATAN[j] + '</option>').join('') + '</select>'}</td>
        <td style="text-align:right">${tetap ? '' : '<button class="btn btn-gold btn-sm" type="button" data-simpan disabled>Simpan</button>'}</td>
      </tr>`;
    }).join('');
  }

  q('[data-cari]').addEventListener('input', (e) => { kataCari = e.target.value; tampil(); });

  tbody.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-pilih]');
    if (!sel) return;
    const tr = sel.closest('tr');
    const r = daftar.find((x) => x.id === tr.dataset.id);
    tr.querySelector('[data-simpan]').disabled = sel.value === r.jabatan;
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-simpan]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const r = daftar.find((x) => x.id === tr.dataset.id);
    const baru = tr.querySelector('[data-pilih]').value;
    if (!confirm('Ubah jabatan ' + r.nama + ' dari ' + JABATAN[r.jabatan] + ' menjadi ' + JABATAN[baru] + '?')) return;

    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { data, error } = await sb.from('anggota').update({ jabatan: baru }).eq('id', r.id).select('id');
    if (error || !data || !data.length) {
      btn.disabled = false; btn.textContent = awal;
      toast('Gagal mengubah jabatan. ' + (error ? pesanError(error) : 'Anda tidak punya izin untuk ini.'), true);
      return;
    }
    toast(r.nama + ' sekarang ' + JABATAN[baru] + '.');
    muat();
  });

  // ---------- Ganti password ----------
  const setErr = (el, t) => { el.closest('.f').querySelector('.err').textContent = t || ''; el.setAttribute('aria-invalid', t ? 'true' : 'false'); return !t; };
  const alertSandi = q('[data-alert-sandi]');
  q('[data-form-sandi]').addEventListener('submit', async (e) => {
    e.preventDefault();
    alertSandi.hidden = true;
    const baru = q('#sBaru'), ulang = q('#sUlang');
    let ok = true;
    ok = setErr(baru, baru.value.length >= 8 ? '' : 'Password minimal 8 karakter.') && ok;
    ok = setErr(ulang, ulang.value === baru.value ? '' : 'Password tidak sama.') && ok;
    if (!ok) return;
    const btn = q('[data-simpan-sandi]');
    const awal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const { error } = await sb.auth.updateUser({ password: baru.value });
    btn.disabled = false; btn.textContent = awal;
    if (error) {
      alertSandi.textContent = /same|different from the old/i.test(error.message || '') ? 'Password baru harus berbeda dari yang lama.' : 'Gagal mengganti password. ' + pesanError(error);
      alertSandi.hidden = false;
      return;
    }
    baru.value = ''; ulang.value = '';
    toast('Password berhasil diganti.');
  });

  muat();
}
