# Web de reservas Ritmo: MVP con recordatorios y lista de espera

Ritmo · Product Requirements Document

| | | | |
|---|---|---|---|
| Estado | En revisión | Versión | 1.0 · Octubre 2026 |
| Responsable | Product Designer | Piloto | Sede Palermo · 4 semanas |
| Stakeholders | Producto, Diseño, Desarrollo y Operaciones del estudio | | |

## 1. Resumen

Ritmo gestiona hoy sus reservas por WhatsApp, Instagram y una planilla. Una de cada cinco reservas termina en un lugar vacío: el alumno se anota y no va, y la clase figura completa aunque en la sala sobran lugares. Proponemos una web de reservas mobile-first, sin descarga, con cupos en tiempo real, recordatorio por WhatsApp con confirmación, cancelación en un toque y lista de espera automática.

## 2. Problema y evidencia

- **20%** de las reservas no se presenta (planilla del último trimestre).
- **5 de 5** entrevistados se anota "por las dudas" toda la semana.
- **4 de 5** dice que cancelar por WhatsApp es incómodo.

Citas:

- "Me dicen que está llena, llego y hay lugares."
- "Me da cosa escribir para cancelar, y a veces nadie contesta."
- "Me acuerdo de la clase cuando ya empezó."

Recepción, además, gestiona todo a mano: responde mensajes y actualiza la planilla. La hipótesis inicial (falta de motivación, resolver con gamificación) no apareció en la investigación.

## 3. Objetivos y no objetivos

**Objetivos**

- Reducir las ausencias un 30% en 4 semanas.
- Que el 70% de las reservas se haga desde la web.
- Recuperar al menos la mitad de los lugares liberados.

**No objetivos**

- Gamificación: puntos, rankings o logros.
- Pagos online y planes.
- Penalizar ausencias en esta versión.

## 4. Usuarios

| Usuario | Necesidad principal |
|---|---|
| Alumno frecuente | Reservar y cancelar sin depender de que alguien conteste. |
| Alumno en lista de espera | Enterarse a tiempo cuando se libera un lugar. |
| Recepción del estudio | Dejar de gestionar reservas a mano y saber quién viene. |

## 5. Historias de usuario

- Como alumno, quiero ver los cupos y reservar desde el celular, sin esperar una respuesta.
- Como alumno, quiero un recordatorio antes de la clase para confirmar o liberar mi lugar.
- Como alumno en lista de espera, quiero que me avisen cuando se libera un lugar.
- Como recepción, quiero ver quién confirmó en cada clase.

## 6. Métricas de éxito

| Métrica | Hoy | Objetivo | Cómo se mide |
|---|---|---|---|
| Tasa de ausencias | 20% | 14% | Reservas sin check-in / reservas totales |
| Reservas desde la web | 0% | ≥70% | Reservas en la web / reservas totales |
| Lugares recuperados | 0% | ≥50% | Lugares liberados que se vuelven a ocupar |
| Respuesta al recordatorio | — | ≥60% | Confirmaciones o liberaciones / enviados |
| Guardrail: bajas de recordatorios | — | <5% | Alumnos que piden no recibir recordatorios |

## 7. Requisitos funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| R1 | Ver clases con cupos en tiempo real y reservar en un toque. | P0 |
| R2 | Recordatorio por WhatsApp 3 horas antes de cada clase reservada. | P0 |
| R3 | Confirmar o liberar el lugar desde el mensaje, en un toque. | P0 |
| R4 | El lugar liberado se ofrece al primero de la lista de espera. | P0 |
| R5 | La oferta vence a los 30 minutos y pasa al siguiente. | P0 |
| R6 | Cancelar una reserva en un toque. | P0 |
| R7 | Panel de recepción con confirmados y lista de espera. | P1 |
| R8 | Ingreso con link por WhatsApp, sin crear contraseña. | P1 |
| R9 | Anticipación del recordatorio configurable. | P2 |

P0: imprescindible para el piloto. P1: deseable. P2: después del piloto.

## 8. Requisitos no funcionales

- El recordatorio llega como máximo 1 minuto después de la hora programada.
- Accesibilidad: contraste WCAG AA y áreas táctiles de 44 px como mínimo.
- Mobile-first: funciona en el navegador del celular, sin instalar nada.
- Textos claros, sin jerga interna del estudio.

## 9. Flujo principal

1. El alumno recibe el link por WhatsApp y entra a la web, sin descargar nada.
2. Ve las clases con cupos en tiempo real y reserva en un toque.
3. 3 horas antes recibe el recordatorio: "Spinning hoy, 19:00. ¿Venís?".
4. Si confirma, recepción lo ve en el panel. Si libera, el lugar pasa a la lista de espera.
5. Si no responde, la reserva se mantiene y no se penaliza.

## 10. Casos borde

- Reserva hecha menos de 3 horas antes: no se envía recordatorio.
- Lugar liberado menos de 30 minutos antes: se ofrece igual, con aviso de urgencia.
- Nadie en lista de espera: el lugar vuelve a estar disponible.
- Clase cancelada por el estudio: aviso inmediato a reservados y lista de espera.
- Alumno que no entra a la web: recepción lo anota desde el panel.

## 11. Fuera de alcance

App nativa, gamificación, pagos online, penalizaciones por ausencia y reserva recurrente. Se evalúan después del piloto con datos.

## 12. Analítica

- `class_viewed`, `booking_created`, `booking_cancelled`
- `reminder_sent`, `reminder_confirmed`, `reminder_released`
- `waitlist_joined`, `waitlist_offer_accepted`, `waitlist_offer_expired`

## 13. Lanzamiento

| Fase | Alcance |
|---|---|
| Semana 0 | Prueba interna con el equipo y 20 alumnos frecuentes. |
| Semanas 1 a 4 | Piloto en Sede Palermo, con WhatsApp como respaldo. |
| Semana 5 | Comparación con las 4 semanas previas y decisión de escalar. |

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Alumnos que siguen escribiendo por WhatsApp | Respuesta automática con el link de la web y respaldo manual al principio. |
| Exceso de mensajes | Un solo recordatorio por clase y guardrail de bajas. |
| Ofertas que nadie toma | Vencimiento a los 30 minutos y paso al siguiente. |

## 15. Preguntas abiertas

- ¿3 horas es la anticipación correcta para todas las franjas?
- ¿Cómo pasamos a los alumnos de WhatsApp a la web sin perder a nadie?
- ¿Conviene penalizar ausencias repetidas en una versión futura?

## 16. Referencias

- Research plan, encuesta y guía de entrevista (Etapa 02).
- Síntesis de 5 entrevistas (Etapa 03).
- Árbol de oportunidades y experimentos rápidos (Etapas 04 y 05).
