create table if not exists medicos (
  id_medico text primary key,           
  contrasena text not null,           
  nombre text not null,
  establecimiento text,
  creado_en timestamptz default now()
);

create table if not exists pacientes (
  dni text primary key,              
  nombre text not null,
  fecha_nacimiento text,              
  edad_gestacional text,
  establecimiento text,
  altitud integer,
  historial text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create table if not exists tamizajes (
  id uuid primary key default gen_random_uuid(),
  paciente_dni text references pacientes(dni),
  medico_codigo text references medicos(codigo),
  spo2_pre integer,
  spo2_post integer,
  altitud integer,
  resultado text check (resultado in ('negativo', 'repetir', 'positivo')),
  sintomas jsonb default '[]',
  sync_status text default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  creado_en timestamptz default now()
);

alter table medicos enable row level security;
alter table pacientes enable row level security;
alter table tamizajes enable row level security;

create policy "medicos_all" on medicos for all using (true) with check (true);
create policy "pacientes_all" on pacientes for all using (true) with check (true);
create policy "tamizajes_all" on tamizajes for all using (true) with check (true);

