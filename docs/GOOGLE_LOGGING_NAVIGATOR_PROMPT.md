# Prompt para IA navegadora: Google Sheets logging

Usa este prompt con una IA navegadora que tenga acceso a mi cuenta de Google:

```text
Necesito crear el logging en Google para mi app "Polla Mundialista 2026".

Objetivo:
1. Crear un Google Sheet llamado "Polla Mundialista 2026 - Logs".
2. Crear una hoja/tab llamada "AuditLog".
3. Poner estos encabezados en la fila 1:
   timestamp, app, event, actor, targetType, targetId, googleStatus, payloadJson
4. Abrir Extensions > Apps Script y crear un Web App que reciba POST JSON desde mi app.
5. Usar este Apps Script:

const SHEET_NAME = "AuditLog";
const EXPECTED_SECRET = "CAMBIA_ESTE_SECRETO_LARGO";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (EXPECTED_SECRET && body.secret !== EXPECTED_SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["timestamp", "app", "event", "actor", "targetType", "targetId", "googleStatus", "payloadJson"]);
    }

    sheet.appendRow([
      body.timestamp || new Date().toISOString(),
      body.app || "",
      body.event || "",
      body.actor || "",
      body.targetType || "",
      body.targetId || "",
      "RECEIVED",
      JSON.stringify(body.payload || {}),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

6. Reemplazar CAMBIA_ESTE_SECRETO_LARGO por un secreto largo aleatorio, por ejemplo 32 caracteres.
7. Deploy > New deployment > Web app.
8. Configurar:
   - Execute as: Me
   - Who has access: Anyone
9. Autorizar permisos de Google.
10. Copiar la URL del Web App que termina en /exec.
11. Entregarme al final:
   - URL del Google Sheet
   - GOOGLE_LOG_WEBHOOK_URL=...
   - GOOGLE_LOG_SECRET=...
   - Confirmacion de que hiciste una prueba manual POST o, si no puedes hacer POST, confirma que el Web App quedo publicado.

Importante:
- No cambies el nombre de la hoja "AuditLog".
- No compartas publicamente el secreto.
- Si Google muestra advertencia de app no verificada, continuar solo porque el script es mio y se ejecuta en mi cuenta.
```

