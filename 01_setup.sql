-- =====================================================================
-- CV. RANJAU DARAT — Setup database Supabase (tahap 1: anggota & login)
-- Jalankan SEKALI di Supabase: SQL Editor > New query > tempel > Run
-- =====================================================================

-- ---------- 1. Tabel anggota ----------
-- Satu baris per akun. id = id akun login (auth.users).
create table if not exists public.anggota (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique check (username ~ '^[a-z0-9._]{4,20}$'),
  jabatan          text not null default 'anggota'
                   check (jabatan in ('ketua','sekretaris','bendahara','anggota')),
  status           text not null default 'menunggu'
                   check (status in ('menunggu','diterima','ditolak')),

  -- Data pribadi
  nama             text not null,
  nik              text not null unique check (nik ~ '^[0-9]{16}$'),
  tempat_lahir     text not null,
  tanggal_lahir    date not null,
  jenis_kelamin    text not null check (jenis_kelamin in ('L','P')),
  posisi           text not null default 'satpam' check (posisi in ('satpam','anggota')),  -- untuk saat ini hanya 'satpam' yang dipakai
  no_wa            text not null,

  -- Data alamat
  alamat           text not null,
  rt               text not null,
  rw               text not null,
  desa             text not null,
  kecamatan        text not null,
  kabupaten        text not null,
  provinsi         text not null,

  -- Dokumen (lokasi file di Storage, bukan file-nya)
  foto_path        text,
  ktp_path         text,

  -- Persetujuan
  disetujui_oleh   uuid references public.anggota(id),
  disetujui_pada   timestamptz,
  catatan          text,

  dibuat_pada      timestamptz not null default now()
);

alter table public.anggota enable row level security;

-- ---------- 2. Fungsi bantu ----------
-- Jabatan akun yang sedang login (hanya jika sudah diterima)
create or replace function public.jabatan_saya()
returns text
language sql stable security definer set search_path = public
as $$
  select jabatan from public.anggota
  where id = auth.uid() and status = 'diterima'
$$;

-- Apakah yang login adalah Ketua atau Sekretaris
create or replace function public.is_pengurus()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.jabatan_saya() in ('ketua','sekretaris'), false)
$$;

-- Cek username / NIK sudah dipakai (dipanggil dari form pendaftaran sebelum login)
create or replace function public.username_tersedia(u text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.anggota where username = lower(u))
$$;

create or replace function public.nik_terdaftar(n text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.anggota where nik = n)
$$;

grant execute on function public.username_tersedia(text) to anon, authenticated;
grant execute on function public.nik_terdaftar(text) to anon, authenticated;

-- ---------- 3. Aturan akses (RLS) ----------
drop policy if exists "daftar diri sendiri" on public.anggota;
drop policy if exists "lihat data sendiri" on public.anggota;
drop policy if exists "pengurus lihat semua" on public.anggota;
drop policy if exists "bendahara lihat semua" on public.anggota;
drop policy if exists "pengurus ubah data" on public.anggota;

-- Pendaftar hanya boleh membuat baris untuk dirinya sendiri,
-- dengan jabatan 'anggota' dan status 'menunggu' (tidak bisa mengangkat diri jadi ketua).
create policy "daftar diri sendiri" on public.anggota
  for insert to authenticated
  with check (id = auth.uid() and jabatan = 'anggota' and status = 'menunggu');

-- Setiap orang boleh melihat datanya sendiri
create policy "lihat data sendiri" on public.anggota
  for select to authenticated
  using (id = auth.uid());

-- Ketua & Sekretaris boleh melihat semua anggota
create policy "pengurus lihat semua" on public.anggota
  for select to authenticated
  using (public.is_pengurus());

-- Bendahara boleh melihat daftar anggota (untuk iuran)
create policy "bendahara lihat semua" on public.anggota
  for select to authenticated
  using (public.jabatan_saya() = 'bendahara');

-- Hanya Ketua & Sekretaris yang boleh mengubah data (menyetujui / menolak / mengedit)
create policy "pengurus ubah data" on public.anggota
  for update to authenticated
  using (public.is_pengurus())
  with check (public.is_pengurus());

-- Hanya Ketua yang boleh mengangkat jabatan pengurus (ketua/sekretaris/bendahara)
create or replace function public.jaga_jabatan()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.jabatan is distinct from old.jabatan
     and coalesce(public.jabatan_saya(), '') <> 'ketua'
     and auth.uid() is not null then
    raise exception 'Hanya Ketua yang boleh mengubah jabatan.';
  end if;
  if new.status is distinct from old.status and new.status in ('diterima','ditolak') then
    new.disetujui_oleh := auth.uid();
    new.disetujui_pada := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_jaga_jabatan on public.anggota;
create trigger trg_jaga_jabatan before update on public.anggota
  for each row execute function public.jaga_jabatan();

-- ---------- 4. Penyimpanan foto & KTP (PRIVAT) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumen', 'dokumen', false, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png'];

drop policy if exists "unggah dokumen sendiri" on storage.objects;
drop policy if exists "lihat dokumen sendiri atau pengurus" on storage.objects;

-- File disimpan di folder <id akun>/..., pendaftar hanya bisa mengunggah ke foldernya sendiri
create policy "unggah dokumen sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dokumen' and (storage.foldername(name))[1] = auth.uid()::text);

-- Yang boleh melihat: pemilik file, Ketua, dan Sekretaris
create policy "lihat dokumen sendiri atau pengurus" on storage.objects
  for select to authenticated
  using (bucket_id = 'dokumen'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_pengurus()));

-- Selesai.
