// Bukti kehadiran: titik lokasi + foto kamera depan + foto kamera belakang.
// Foto diambil LANGSUNG dari kamera (bukan dari galeri), diberi cap waktu & koordinat, lalu dikompres.
//
// Pakai:
//   const bukti = pasangBukti(elemen, saatUbah);  // tampilkan 3 tombol (saatUbah opsional)
//   bukti.lengkap()                          // true jika lokasi + 2 foto sudah ada
//   const b = await bukti.unggah('masuk');   // -> { lat, lng, akurasi, depan, belakang } (path di Storage)

function pasangBukti(wadah, saatUbah) {
  const st = { lok: null, depan: null, belakang: null };
  const jamTeks = () => new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  wadah.innerHTML = `
    <div class="bukti">
      <button type="button" class="bk" data-bk="lok">
        <span class="bk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.1 7-11.5A7 7 0 005 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>
        <span class="bk-t"><b>Ambil lokasi sekarang</b><small data-ket="lok">Belum diambil</small></span>
      </button>
      <button type="button" class="bk" data-bk="depan">
        <span class="bk-ic" data-th="depan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span>
        <span class="bk-t"><b>Foto kamera depan</b><small data-ket="depan">Foto wajah (selfie)</small></span>
      </button>
      <button type="button" class="bk" data-bk="belakang">
        <span class="bk-ic" data-th="belakang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
        <span class="bk-t"><b>Foto kamera belakang</b><small data-ket="belakang">Foto lokasi / pos jaga</small></span>
      </button>
    </div>`;

  const q = (s) => wadah.querySelector(s);
  const tandai = (k, ok, teks) => {
    const b = q('[data-bk="' + k + '"]');
    b.classList.toggle('ok', ok);
    q('[data-ket="' + k + '"]').textContent = teks;
    if (saatUbah) saatUbah();
  };

  // ---------- Lokasi ----------
  q('[data-bk="lok"]').addEventListener('click', () => {
    if (!navigator.geolocation) return tandai('lok', false, 'HP/browser ini tidak mendukung lokasi.');
    tandai('lok', false, 'Mencari lokasi... (nyalakan GPS)');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        st.lok = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), akurasi: Math.round(p.coords.accuracy) };
        tandai('lok', true, st.lok.lat + ', ' + st.lok.lng + ' (±' + st.lok.akurasi + ' m)');
      },
      (e) => {
        st.lok = null;
        tandai('lok', false, e.code === 1
          ? 'Akses lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'
          : 'Lokasi tidak ditemukan. Pastikan GPS menyala lalu coba lagi.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });

  // ---------- Kamera ----------
  q('[data-bk="depan"]').addEventListener('click', () => bukaKamera('depan'));
  q('[data-bk="belakang"]').addEventListener('click', () => bukaKamera('belakang'));

  function bukaKamera(sisi) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return tandai(sisi, false, 'Kamera tidak bisa dibuka di browser ini. Gunakan Chrome di HP.');
    }
    const dlg = document.createElement('dialog');
    dlg.className = 'kamera';
    dlg.innerHTML = `
      <div class="km-head"><b>${sisi === 'depan' ? 'Kamera depan (selfie)' : 'Kamera belakang'}</b><button type="button" data-x aria-label="Tutup">×</button></div>
      <div class="km-vid"><video playsinline autoplay muted></video><p data-km-msg>Membuka kamera...</p></div>
      <div class="km-foot"><button type="button" class="km-jepret" data-jepret disabled aria-label="Ambil foto"></button></div>`;
    document.body.appendChild(dlg);
    const video = dlg.querySelector('video');
    let stream = null;
    const tutup = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); dlg.close(); dlg.remove(); };
    dlg.querySelector('[data-x]').onclick = tutup;
    dlg.addEventListener('cancel', tutup);
    dlg.showModal();
    if (sisi === 'depan') video.classList.add('cermin');

    const mode = sisi === 'depan' ? 'user' : 'environment';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        stream = s; video.srcObject = s;
        dlg.querySelector('[data-km-msg]').hidden = true;
        dlg.querySelector('[data-jepret]').disabled = false;
      })
      .catch((e) => {
        dlg.querySelector('[data-km-msg]').textContent = e.name === 'NotAllowedError'
          ? 'Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.'
          : 'Kamera tidak bisa dibuka: ' + (e.message || e.name);
      });

    dlg.querySelector('[data-jepret]').onclick = () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w) return;
      const skala = Math.min(1, 1280 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * skala); c.height = Math.round(h * skala);
      const x = c.getContext('2d');
      if (sisi === 'depan') { x.translate(c.width, 0); x.scale(-1, 1); }
      x.drawImage(video, 0, 0, c.width, c.height);
      x.setTransform(1, 0, 0, 1, 0, 0);
      // Cap waktu + koordinat
      const fs = Math.max(14, Math.round(c.width / 40));
      const baris = ['CV. RANJAU DARAT · ' + (sisi === 'depan' ? 'Kamera depan' : 'Kamera belakang'), jamTeks() + ' WIB',
        st.lok ? st.lok.lat + ', ' + st.lok.lng + ' (±' + st.lok.akurasi + ' m)' : 'Lokasi belum diambil'];
      const tinggi = fs * 1.35 * baris.length + fs;
      x.fillStyle = 'rgba(7,18,38,.62)'; x.fillRect(0, c.height - tinggi, c.width, tinggi);
      x.fillStyle = '#fff'; x.font = '600 ' + fs + 'px system-ui, sans-serif'; x.textBaseline = 'top';
      baris.forEach((t, i) => x.fillText(t, fs * 0.6, c.height - tinggi + fs * 0.5 + i * fs * 1.35));
      c.toBlob((blob) => {
        st[sisi] = blob;
        const th = q('[data-th="' + sisi + '"]');
        th.innerHTML = '<img alt="">';
        th.querySelector('img').src = URL.createObjectURL(blob);
        tandai(sisi, true, 'Foto siap · ketuk untuk ulang');
        tutup();
      }, 'image/jpeg', 0.72);
    };
  }

  return {
    lengkap: () => !!(st.lok && st.depan && st.belakang),
    kurang: () => [!st.lok && 'lokasi', !st.depan && 'foto kamera depan', !st.belakang && 'foto kamera belakang'].filter(Boolean),
    async unggah(label) {
      const { data } = await sb.auth.getSession();
      const uid = data.session.user.id;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const naik = async (sisi) => {
        const path = uid + '/absensi/' + stamp + '-' + label + '-' + sisi + '.jpg';
        const { error } = await sb.storage.from('dokumen').upload(path, st[sisi], { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        return path;
      };
      const [depan, belakang] = await Promise.all([naik('depan'), naik('belakang')]);
      return { lat: st.lok.lat, lng: st.lok.lng, akurasi: st.lok.akurasi, depan, belakang };
    }
  };
}

// Link peta untuk pengurus
const linkPeta = (lat, lng) => 'https://www.google.com/maps?q=' + lat + ',' + lng;
