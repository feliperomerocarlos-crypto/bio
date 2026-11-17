# Revisar BioVolt con nueva tipografía y cifras sin publicar

Esta copia incluye los estilos, scripts y la fuente Manrope, sin consultas a servicios de tipografía. Las cifras aparecen completas con un fundido y desplazamiento suaves, sin el antiguo tablero de dígitos. No instala paquetes, no envía datos a la red y no usa Gemini ni SMTP reales.

La apertura y las otras siete secciones comparten ahora la misma nube de partículas: se transforma al bajar y se revierte al subir, también detrás de los paneles de datos. Para revisar el recorrido visual, abre Inicio y recorre las ocho secciones haciendo scroll. Los enlaces de la barra y del indicador lateral te llevan a cada módulo; la URL usa #inventario, #ayuda, etc. Baja y vuelve a subir: la misma nube cambia de forma y los gráficos responden al recorrido. El movimiento se mantiene activo aunque el sistema solicite reducirlo. El botón de pausa/reproducción de la barra permite detenerlo por elección propia; también se conserva el selector de Inicio. Las tablas y módulos generales siguen transparentes. Solo el acceso privado, el listado y formulario de la mesa, el chat del asistente y los controles de reportes/PDF tienen paneles translúcidos con borde tenue. Las partículas giran, se inclinan y se expanden suavemente aunque dejes de hacer scroll, también bajo tablas y hasta el pie. Al escribir o abrir un diálogo, continúan animadas con atenuación suave. Si no hay WebGL, se intenta una escena animada Canvas 2D. Extrae primero el ZIP completo y abre el HTML en un navegador que ejecute JavaScript. En un visor de archivos los scripts pueden no ejecutarse.

1. Abre `revision/index.html` con un navegador actual.
2. Ve a **Mesa de ayuda** y crea una solicitud con datos ficticios.
3. Prueba el historial, nuevos mensajes, «Me sirvió» y «Sigo con el problema».
4. En **Acceso docente** usa el PIN de demostración **DEMO**. Puedes asignar José Montalvo, Cristopher Orozco o Carlos Romero, responder como humano y añadir notas internas.
5. Para probar recuperación, usa el ID y el correo ficticio de un ticket creado aquí. El código de prueba es **123456**. No se envía ningún correo.

Las respuestas del agente están marcadas explícitamente como simulación; no proceden de Gemini. Los tickets de esta copia se pierden al recargar. Los códigos y PIN de demostración no funcionan en la plataforma real.

La versión de producción con agente real está en la raíz del proyecto. Esta carpeta es solo para revisión y no debe reemplazar por sí sola el despliegue completo. Antes de publicar la mejora, revisar `docs/MESA-AYUDA.md`, aplicar la migración con autorización y configurar SMTP si se requiere recuperación por correo.
