-- =====================================================================
-- CV. RANJAU DARAT — Setup fitur Keuangan (kas pemasukan & pengeluaran)
-- Jalankan SEKALI di Supabase: SQL Editor > New query > tempel > Run
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------- 1. Tabel kas ----------
create table if not exists public.kas (
  id           uuid primary key default gen_random_uuid(),
  tanggal      date not null default current_date,
  jenis        text not null check (jenis in ('masuk','keluar')),
  kategori     text not null check (char_length(kategori) between 1 and 60),
  jumlah       bigint not null check (jumlah > 0),
  keterangan   text check (keterangan is null or char_length(keterangan) <= 200),
  dibuat_oleh  uuid references public.anggota(id) on delete set null default auth.uid(),
  dibuat_pada  timestamptz not null default now()
);

create index if not exists kas_tanggal_idx on public.kas (tanggal desc);

alter table public.kas enable row level security;

-- ---------- 2. Aturan akses (RLS) ----------
drop policy if exists "kas lihat" on public.kas;
drop policy if exists "kas tambah" on public.kas;
drop policy if exists "kas ubah" on public.kas;
drop policy if exists "kas hapus" on public.kas;

-- Bendahara, Ketua, dan Admin boleh melihat kas
create policy "kas lihat" on public.kas
  for select to authenticated
  using (coalesce(public.jabatan_saya(), '') in ('bendahara','ketua','admin'));

-- Hanya Bendahara dan Admin yang boleh mencatat, mengubah, dan menghapus
create policy "kas tambah" on public.kas
  for insert to authenticated
  with check (coalesce(public.jabatan_saya(), '') in ('bendahara','admin') and dibuat_oleh = auth.uid());

create policy "kas ubah" on public.kas
  for update to authenticated
  using (coalesce(public.jabatan_saya(), '') in ('bendahara','admin'))
  with check (coalesce(public.jabatan_saya(), '') in ('bendahara','admin'));

create policy "kas hapus" on public.kas
  for delete to authenticated
  using (coalesce(public.jabatan_saya(), '') in ('bendahara','admin'));

-- ---------- 3. Ringkasan kas ----------
-- Saldo = semua pemasukan - semua pengeluaran - semua gaji yang sudah dibayarkan.
-- Gaji diambil otomatis dari tabel gaji, jadi TIDAK perlu dicatat ulang sebagai pengeluaran.
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
      coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'masuk'), 0)
      - coalesce((select sum(k.jumlah) from public.kas k where k.jenis = 'keluar'), 0)
      - coalesce((select sum(g.total) from public.gaji g), 0)
    )::bigint;
end $$;

revoke all on function public.ringkasan_kas(date) from public, anon;
grant execute on function public.ringkasan_kas(date) to authenticated;

-- Selesai.
