Necesito habilitar login con Google para mi app "Polla Mundialista 2026".

Objetivo:
Crear credenciales OAuth 2.0 en Google Cloud para una aplicacion web Next.js.

Datos de produccion:
- Dominio: https://polla-mundial.135.181.151.188.sslip.io
- Redirect URI exacto: https://polla-mundial.135.181.151.188.sslip.io/api/auth/google/callback

Pasos:
1. Abrir Google Cloud Console.
2. Crear o seleccionar un proyecto para "Polla Mundialista 2026".
3. Ir a APIs & Services > OAuth consent screen.
4. Configurar el consentimiento como External si aplica.
5. Completar nombre de app: Polla Mundialista 2026.
6. Agregar el correo del propietario como contacto.
7. En scopes, usar solo:
   - openid
   - email
   - profile
8. Ir a APIs & Services > Credentials.
9. Crear OAuth client ID.
10. Tipo de aplicacion: Web application.
11. Nombre: Polla Mundialista Web.
12. Authorized JavaScript origins:
    - https://polla-mundial.135.181.151.188.sslip.io
13. Authorized redirect URIs:
    - https://polla-mundial.135.181.151.188.sslip.io/api/auth/google/callback
14. Guardar.
15. Entregarme:
    - GOOGLE_CLIENT_ID=...
    - GOOGLE_CLIENT_SECRET=...

Importante:
- No crees Apps Script.
- No crees Google Sheets.
- No configures Google Analytics.
- Esto es solo login con Google.
- No compartas publicamente el client secret.
