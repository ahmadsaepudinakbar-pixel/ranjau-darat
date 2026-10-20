-- =====================================================================
-- CV. RANJAU DARAT — Setup Laporan Keuangan & Pengaturan
-- Jalankan SEKALI di Supabase (project ranjau-darat): SQL Editor > New query > tempel > Run
-- Jalankan SETELAH 02_keuangan.sql. Aman dijalankan ulang.
-- =====================================================================

-- ---------- 1. Tabel pengaturan (satu baris saja, id = 1) ----------
create table if not exists public.pengaturan_kas (
  id               int primary key default 1 check (id = 1),
  nama_organisasi  text not null default 'CV. Ranjau Darat' check (char_length(nama_organisasi) between 1 and 100),
  alamat           text check (alamat is null or char_length(alamat) <= 200),
  nama_ketua       text check (nama_ketua is null or char_length(nama_ketua) <= 80),
  nama_bendahara   text check (nama_bendahara is null or char_length(nama_bendahara) <= 80),
  saldo_awal       bigint not null default 0 check (saldo_awal >= 0),
  kategori_masuk   text[] not null default array['Iuran Anggota','Pembayaran Jasa Pengamanan','Donasi','Lainnya']
                   check (cardinality(kategori_masuk) between 1 and 20),
  kategori_keluar  text[] not null default array['Operasional','Seragam & Perlengkapan','Transportasi','Alat Tulis & Cetak','Lainnya']
                   check (cardinality(kategori_keluar) between 1 and 20),
  diubah_pada      timestamptz not null default now()
);

insert into public.pengaturan_kas (id) values (1) on conflict (id) do nothing;

alter table public.pengaturan_kas enable row level security;

drop policy if exists "pengaturan lihat" on public.pengaturan_kas;
drop policy if exists "pengaturan ubah" on public.pengaturan_kas;

-- Bendahara, Ketua, Admin boleh melihat (Ketua perlu untuk laporan)
create policy "pengaturan lihat" on public.pengaturan_kas
  for select to authenticated
  using (coalesce(public.jabatan_saya(), '') in ('bendahara','ketua','admin'));

-- Hanya Bendahara dan Admin yang boleh mengubah
create policy "pengaturan ubah" on public.pengaturan_kas
  for update to authenticated
  using (coalesce(public.jabatan_saya(), '') in ('bendahara','admin'))
  with check (coalesce(public.jabatan_saya(), '') in ('bendahara','admin'));

-- ---------- 2. Ringkasan kas: sekarang ikut menghitung saldo awal ----------
create or replace function public.ringkasan_kas(p_bulan date)
returns table (masuk_bulan bigint, keluar_bulan bigint, gaji_bulan bigint, saldo bigint)
language plpgsql stable security definer set search_path = public
as $$
declare
  awal  date := date_trunc('month', p_bulan)::date;
  akhir date := (date_trunc('month', p_bulan) + interval '1 month')::date;
begin
  if coalesce(public.jabatan_saya(), '') not in ('bendahara','ketua','admin') then
    raise exception 'Anda tidak punya izin melihat keuangan.';
  end if;

  return query select
    coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'masuk'  and k.tanggal >= awal and k.tanggal < akhir), 0)::bigint,
    coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'keluar' and k.tanggal >= awal and k.tanggal < akhir), 0)::bigint,
    coalesce((select sum(g.total)  from public.gaji g where g.tanggal_gajian >= awal and g.tanggal_gajian < akhir), 0)::bigint,
    (
      coalesce((select p.saldo_awal from public.pengaturan_kas p where p.id = 1), 0)
      + coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'masuk'), 0)
      - coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'keluar'), 0)
      - coalesce((select sum(g.total) from public.gaji g), 0)
    )::bigint;
end $$;

-- ---------- 3. Saldo pada awal suatu bulan (untuk laporan bulanan) ----------
create or replace function public.saldo_awal_bulan(p_bulan date)
returns bigint
language plpgsql stable security definer set search_path = public
as $$
declare
  awal date := date_trunc('month', p_bulan)::date;
begin
  if coalesce(public.jabatan_saya(), '') not in ('bendahara','ketua','admin') then
    raise exception 'Anda tidak punya izin melihat keuangan.';
  end if;

  return (
    coalesce((select p.saldo_awal from public.pengaturan_kas p where p.id = 1), 0)
    + coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'masuk'  and k.tanggal < awal), 0)
    - coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'keluar' and k.tanggal < awal), 0)
    - coalesce((select sum(g.total)  from public.gaji g where g.tanggal_gajian < awal), 0)
  )::bigint;
end $$;

revoke all on function public.ringkasan_kas(date) from public, anon;
revoke all on function public.saldo_awal_bulan(date) from public, anon;
grant execute on function public.ringkasan_kas(date) to authenticated;
grant execute on function public.saldo_awal_bulan(date) to authenticated;

-- Selesai.
