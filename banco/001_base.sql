-- REDES DE LOJAS
create table public.redes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- UNIDADES (LOJAS)
create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  rede_id uuid not null references public.redes(id),
  nome text not null,
  endereco text,
  cidade text,
  estado text,
  latitude double precision not null,
  longitude double precision not null,
  raio_metros integer not null default 100 check (raio_metros between 20 and 1000),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- PERFIS DAS PESSOAS
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  apelido text not null unique check (char_length(apelido) between 3 and 30),
  nivel text not null default 'Iniciante',
  pontos integer not null default 0,
  reputacao integer not null default 0 check (reputacao between 0 and 100),
  criado_em timestamptz not null default now()
);

-- CRIA O PERFIL AUTOMATICAMENTE QUANDO ALGUEM SE CADASTRA
create function public.novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, apelido)
  values (new.id, 'usuario_' || substr(replace(new.id::text, '-', ''), 1, 8));
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.novo_usuario();

-- LIGA A SEGURANCA POR LINHA
alter table public.redes enable row level security;
alter table public.unidades enable row level security;
alter table public.perfis enable row level security;

-- PERMISSOES: so leitura, exceto o apelido do proprio perfil
revoke all on public.redes, public.unidades, public.perfis from anon, authenticated;
grant select on public.redes, public.unidades, public.perfis to anon, authenticated;
grant update (apelido) on public.perfis to authenticated;

-- REGRAS
create policy "ler redes ativas" on public.redes
  for select to anon, authenticated using (ativa);
create policy "ler unidades ativas" on public.unidades
  for select to anon, authenticated using (ativa);
create policy "ler perfis" on public.perfis
  for select to anon, authenticated using (true);
create policy "editar o proprio perfil" on public.perfis
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- PRIMEIRA REDE
insert into public.redes (nome) values ('Americanas');
