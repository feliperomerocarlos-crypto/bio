// Netlify: exit 0 omite builds. No depende de paquetes instalados ni de Node 24.
// Incluye Deploy Previews y nombres pull/1/head, además de ramas dev.
process.exitCode = process.env.BRANCH === 'main' && process.env.CONTEXT === 'production' ? 1 : 0;
