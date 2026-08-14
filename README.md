# Sunqu

Aplicación móvil-first que digitaliza el tamizaje neonatal de cardiopatías congénitas críticas, adaptando los umbrales de saturación de oxígeno (SpO₂) a la altitud del establecimiento de salud, en vez de usar los parámetros estándar de nivel del mar que generan diagnósticos erróneos en la sierra peruana.

Los datos utilizados en la demo son ficticios (médicos, pacientes y tamizajes de ejemplo), pero los módulos reflejan el flujo real que seguiría un médico de un establecimiento rural: identificarse, tomar la medición, revisar el resultado y, si es necesario, derivar al recién nacido a un especialista.

Proyecto desarrollado para la **Hackathon Niño San Borja**.

## Propósito

El tamizaje cardíaco neonatal estándar no considera la altitud: un recién nacido sano en la sierra tiene naturalmente menos oxígeno en sangre que uno en Lima, lo que genera falsos positivos (traslados innecesarios) y falsos negativos (bebés dados de alta que luego entran en shock). A esto se suma el aislamiento del médico rural, sin herramientas ágiles de interconsulta ni un flujo de referencia simplificado.

CardioScreen busca resolver eso: interpretar la medición según la altitud real del establecimiento, guiar al médico durante la toma con una guía clínica rápida, y dejar lista la información para derivar al paciente sin perder tiempo en papeleo.

## Desarrollado por

Equipo **LifeHackers**

*Proyecto académico / de hackathon.*

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Base de datos y API | Supabase (Postgres + API REST autogenerada) |
| Control de versiones | GitHub |
| Despliegue | Vercel (build automático desde GitHub) |

## Módulos del Sistema

**Rol Médico**
- Login por código de doctor y contraseña
- Tutorial / guía clínica rápida de tamizaje (paso a paso, reutilizable)
- Medición de SpO₂ preductal/postductal, con altitud vía geolocalización (editable si falla)
- Identificación del paciente por DNI, con autocompletado de datos e historial
- Cardio-Packet: resumen clínico del caso listo para enviar
- Red de derivación: documento de referencia + establecimientos cercanos
- Alertas, estado de sincronización e historial de tamizajes

## Estructura del Proyecto

```
Sunqu/
├── src/
│   ├── App.tsx
│   ├── components/       (Login, TutorialScreen, PatientPicker)
│   ├── context/          (PatientContext — paciente activo compartido)
│   └── lib/               (supabase, auth, patients, tamizajes, risk, geolocation)
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── .env.example
└── package.json
```

## Instalación y Uso

```
git clone <URL-del-repositorio>
cd CardioScreen
npm install
npm run dev
```

Build de producción:
```
npm run build
```

## Puerto

`http://localhost:5173`
