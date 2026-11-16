# Revisar la mesa de ayuda sin publicar

Esta copia incluye los estilos y scripts. No instala paquetes, no envía datos a la red y no usa Gemini ni SMTP reales.

1. Abre `revision/index.html` con un navegador actual.
2. Ve a **Mesa de ayuda** y crea una solicitud con datos ficticios.
3. Prueba el historial, nuevos mensajes, «Me sirvió» y «Sigo con el problema».
4. En **Acceso docente** usa el PIN de demostración **DEMO**. Puedes asignar José Montalvo, Cristopher Orozco o Carlos Romero, responder como humano y añadir notas internas.
5. Para probar recuperación, usa el ID y el correo ficticio de un ticket creado aquí. El código de prueba es **123456**. No se envía ningún correo.

Las respuestas del agente están marcadas explícitamente como simulación; no proceden de Gemini. Los tickets de esta copia se pierden al recargar. Los códigos y PIN de demostración no funcionan en la plataforma real.

La versión de producción con agente real está en la raíz del proyecto. Esta carpeta es solo para revisión y no debe reemplazar por sí sola el despliegue completo. Antes de publicar la mejora, revisar `docs/MESA-AYUDA.md`, aplicar la migración con autorización y configurar SMTP si se requiere recuperación por correo.
