# Revisión de usabilidad y diseño (16/11/2026, actualizada el 17/11/2026)

Revisión hecha leyendo el código, sin ejecutar la app. Las alturas reales, el comportamiento del teclado y la lectura con TalkBack están sin comprobar en un móvil.

## Contraste (WCAG) sobre los fondos del tema
| Color | Sobre fondo | Sobre tarjeta | Resultado |
|---|---|---|---|
| Texto `#F2F3F5` | 17,3 | 15,8 | Pasa |
| Secundario antiguo `#8B909A` | 5,98 | 5,49 | Pasa AA |
| Terciario antiguo `#5A5F69` | 2,99 | 2,74 | Fallaba |
| Blanco sobre naranja `#FF6B35` | 2,84 | — | Fallaba |
| Negro `#0E0F12` sobre naranja | 6,76 | — | Pasa |

## Hallazgos
| # | Prioridad | Problema | Arreglo | Estado |
|---|---|---|---|---|
| 1 | Alta | Texto blanco sobre naranja en el botón principal y controles activos (2,84:1) | Texto oscuro sobre el acento | ✅ Hecho |
| 2 | Alta | El gris terciario se usaba como texto (pestañas, ejes, fechas) | Terciario `#858A95` y secundario `#A3A8B2` | ✅ Hecho |
| 3 | Alta | Botones ± de las series de 38 dp, papelera pegada al «+» | 48 dp y papelera separada | ✅ Hecho |
| 4 | Alta | Salir de una sesión o medición con cambios lo pierde todo sin avisar | Confirmar al salir o guardar borrador | ✅ Hecho (sesión, gimnasio y medición) |
| 5 | Alta | Hoy apila demasiados bloques; «Registrar sesión» queda lejos | Tarjeta de hoy arriba con el botón tras el título; objetivos en una tarjeta | ✅ Hecho |
| 6 | Media | Más zonas de toque pequeñas: enlaces de texto, ± de avisos y viaje, ⇄, selector compacto | Mínimo de 48 dp; unir «Cambiar lo que hago hoy» y «Hoy estoy fuera» en «Más opciones» | ✅ Hecho |
| 7 | Media | El selector segmentado está escrito 4 veces y el interruptor 3, con tamaños distintos | Un solo `Segmented`, `ToggleRow` y `Stepper` | ✅ Hecho |
| 8 | Media | Teclado: en Perfil el primer toque solo cierra el teclado; no salta al campo siguiente; «Guardar» al final de 16 campos | `keyboardShouldPersistTaps`, encadenar campos, botón fijo abajo | ✅ Hecho: teclado que no se cierra al tocar, botón fijo en la medición y tecla «Siguiente» que salta de campo en la medición y en la caminata |
| 9 | Media | Un viaje solapado borra el otro sin avisar; un test mal tecleado no se puede corregir; pegar la captura cambia la fecha sin decirlo | Confirmar, permitir editar y borrar, avisar del cambio de fecha | ✅ Hecho |
| 10 | Media | «Guardar» se desactiva sin decir por qué; medidas sin rangos; se admite el 31 de febrero | Error junto al campo y rangos plausibles | ✅ Hecho |
| 11 | Media | Tarjetas pulsables sin rol ni etiqueta de accesibilidad; el mes lee «2026-11-16: Hecho» | Rol, etiqueta y fecha larga | ✅ Hecho en tarjetas, días y controles; sin comprobar con TalkBack |
| 12 | Media | Tema sin afinar: sin tipografía propia ni interlineado, rótulos en mayúsculas en cada sección, tarjetas y campos apenas se distinguen | Tipografía con carácter para cifras y titulares; interlineado; más separación de grises | Parcial: interlineado, rótulos sin mayúsculas y grises más separados. Falta una tipografía propia |
| 13 | Baja | Las gráficas solo rotulan mínimo y máximo; no se puede leer un punto | Etiqueta del último valor y toque en un punto | ✅ Hecho: último valor rotulado, estado vacío y, al tocar o arrastrar el dedo por la gráfica, fecha y valor del punto debajo |
| 14 | Baja | Textos: «Hoy no» ambiguo; campana en Hoy y persona en Cuerpo para lo mismo; «Gym» y «Gimnasio»; «Expo Go» en un mensaje | «Hoy no entreno», un solo icono, términos uniformes | ✅ Hecho |
| 15 | Baja | Gestos ocultos: tocar el título para volver a hoy, pulsación larga para viaje o borrar foto | Chip «Hoy», botón de borrar visible | ✅ Hecho |

## Navegación recomendada
**Barra: Hoy · Entrenar · Calendario · Cuerpo · Progreso.**

- **Entrenar**: cuatro tarjetas (Fuerza, Estiramientos, Flexibilidad, Marcha), cada una con «lo próximo». La semana tipo y las fichas de ejercicio pasan a Fuerza.
- **Progreso**: selector por área, reutilizando las gráficas.
- **Calendario**: un punto de color por área en cada día.
- **Hoy**: lista «Plan de hoy», una fila por área con una sola acción. Los estiramientos aparecen al guardar la sesión; la flexibilidad, cuando toca; el test mensual, como el aviso de pesarse.

Alternativas descartadas: una pestaña por disciplina (entierra Calendario y Cuerpo) y mantener cuatro pestañas (sobrecarga Hoy).

## Icono e identidad
Una sola forma con 2–3 planos rectos, naranja sobre casi negro con un segundo tono cálido para la sombra, sin degradados. Debe reconocerse a 48 px y en la versión monocroma de Android, con el motivo dentro del 66 % central.
