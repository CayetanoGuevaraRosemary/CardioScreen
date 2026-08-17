# Sunqu

Aplicación móvil-first que digitaliza el tamizaje neonatal de cardiopatías congénitas críticas, adaptando los umbrales de saturación de oxígeno (SpO₂) a la altitud del establecimiento de salud, en vez de usar los parámetros estándar de nivel del mar que generan diagnósticos erróneos en la sierra peruana.

Los datos utilizados en la demo son ficticios (médicos, pacientes y tamizajes de ejemplo), pero los módulos reflejan el flujo real que seguiría un médico de un establecimiento rural: identificarse, tomar la medición, revisar el resultado y, si es necesario, derivar al recién nacido a un especialista.

Proyecto desarrollado para la **Hackathon Niño San Borja**.

> *Sunqu* significa "corazón" en quechua. Ningún corazón peruano debería quedar sin ser escuchado por la altura en la que nació.

## Propósito

El tamizaje cardíaco neonatal estándar no considera la altitud: un recién nacido sano en la sierra tiene naturalmente menos oxígeno en sangre que uno en Lima, lo que genera falsos positivos (traslados innecesarios) y falsos negativos (bebés dados de alta que luego entran en shock). A esto se suma el aislamiento del médico rural, sin herramientas ágiles de interconsulta ni un flujo de referencia simplificado, y el tiempo perdido en papeleo justo cuando cada minuto importa.

Sunqu no busca reemplazar el flujo que ya siguen los establecimientos de salud, sino potenciarlo: se integra al proceso existente para hacerlo más rápido y más preciso, reduciendo tanto falsos positivos como falsos negativos. Atacamos tres problemas concretos:

**1. Altitud mal considerada**
Los umbrales de SpO₂ se ajustan automáticamente según la altitud real del establecimiento (vía geolocalización, editable si falla), en vez de aplicar el estándar de nivel del mar. Esto evita traslados innecesarios y altas prematuras de bebés que en realidad están en riesgo.

**2. Médico rural sin soporte clínico inmediato**
Ante un resultado de riesgo, el sistema entrega recomendaciones personalizadas de protocolo según los valores obtenidos en el tamizaje y los síntomas reportados, junto con los pasos a seguir si el médico no está familiarizado con el cuadro. Todo aparece directamente en el botón superior de alertas, sin que el médico tenga que buscar en otro lado. Además, Sunqu muestra los hospitales más cercanos según la ubicación del establecimiento y permite llamarlos directamente desde la app; si no hay respuesta, ofrece un número de teleconsulta gratuito como respaldo. Todo esto pensado para acompañar en todo momento al serumista o médico rural, que muchas veces enfrenta estos casos en soledad y sin una red de apoyo inmediata.

**3. Papeleo de derivación que consume tiempo**
El llenado de la referencia se reduce a completar los datos ya recogidos durante el tamizaje, y se imprime en el formato oficial real del MINSA, listo para acompañar al paciente en su traslado — sin duplicar el trabajo administrativo.

## Comunidad médica

Sunqu contempla una red de médicos activos y jubilados dispuestos a apoyar la causa. A través de un grupo de Telegram, el equipo puede compartir los casos más relevantes ("wow") del sistema y recibir comentarios, orientación y respaldo de la comunidad. La información del paciente y de sus padres se mantiene estrictamente confidencial en todo momento; solo se comparte lo estrictamente necesario para el intercambio clínico, nunca datos identificables.

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
- Login seguro por código de doctor y contraseña
- Tutorial / guía clínica rápida de tamizaje, paso a paso y reutilizable en cualquier momento
- Medición de SpO₂ preductal y postductal, con umbrales ajustados automáticamente según la altitud del establecimiento (vía geolocalización, editable si falla)
- Identificación del paciente por DNI, con autocompletado de datos e historial de tamizajes previos
- Alertas de riesgo con recomendaciones de protocolo personalizadas según los valores obtenidos y los síntomas reportados, más los pasos a seguir en caso de duda
- Cardio-Packet: resumen clínico del caso, listo para enviar o compartir
- Red de derivación: documento de referencia en formato oficial MINSA + hospitales cercanos con llamada directa y teleconsulta gratuita de respaldo
- Estado de sincronización, notificaciones e historial completo de tamizajes

## Estructura del Proyecto

```
Sunqu/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── Login.tsx
│   │   ├── PatientPicker.tsx
│   │   ├── ProfileModal.tsx
│   │   ├── TutorialScreen.tsx
│   │   └── WifiModal.tsx
│   ├── context/
│   │   └── PatientContext.tsx     ¿
│   └── lib/
│       ├── auth.ts
│       ├── geolocation.ts
│       ├── notifications.ts
│       ├── patients.ts
│       ├── risk.ts
│       ├── supabase.ts
│       └── tamizajes.ts
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── public/
│   └── favicon.svg
├── index.html
├── scale-fonts.mjs
├── vite.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── .env                              
├── .gitignore
└── README.md
```

## Instalación y Uso

```
git clone <URL-del-repositorio>
cd Sunqu
npm install
npm run dev
```

Build de producción:
```
npm run build
```

## Puerto

`http://localhost:5173`
