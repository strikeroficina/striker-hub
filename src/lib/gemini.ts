import { invoke } from "@tauri-apps/api/core";
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
import { DGR_MANUAL_CORPUS_2025 } from "./dgrManualCorpus";

export class GeminiUnavailableError extends Error {
  status: number;
  constructor() {
    super("UNAVAILABLE");
    this.name = "GeminiUnavailableError";
    this.status = 503;
  }
}

const isTauri = () => typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

export function getStoredApiKey(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("striker_gemini_api_key");
    if (custom && custom.trim()) return custom.trim();
  }
  return (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "").trim();
}

export function setStoredApiKey(key: string) {
  if (typeof window !== "undefined") {
    if (key.trim()) {
      localStorage.setItem("striker_gemini_api_key", key.trim());
    } else {
      localStorage.removeItem("striker_gemini_api_key");
    }
  }
}

const BROWSER_SYSTEM_INSTRUCTION = `
Eres TABELION ("El espacio inteligente del escribano Uruguayo").
Eres un sistema jurídico-notarial de máxima precisión, sobrio, académico, directo al grano y sin adornos.
REGLAS DE COMUNICACIÓN:
- PROHIBIDO usar saludos, cortesías genéricas ("¡Hola!", "Con gusto", "Claro", "Espero que te sirva") o introducciones.
- Entra directo al resultado numérico, al dictamen normativo (Código Civil, Ley 16.871, Manual de Calificación de la DGR Edición 2025, Manual LIF Ley 19.210, Arancel AEU, Ley 18.083 IRPF) o a la ejecución de la orden.
- En cálculos: entrega solo viñetas secas con Base, Alícuota, Total UYU/USD y Norma.
- En consultas: responde solo con Criterio (1 línea), Norma (artículo o Resolución DGR exacta) y Ejecución (acción concreta).
- En auditorías: contrasta cada cláusula contra los 28 Capítulos del Manual de Calificación DGR 2025 y el Manual LIF integrados abajo. Usa la frase "Este punto presenta un alto riesgo de observación registral basado en [Norma/Resolución DGR]".
- Utiliza obligatoriamente los valores de UI, UR, URA y Dólar Interbancario informados en el contexto actual de TABELION.
- Cuando el escribano te ordene ejecutar una acción en el sistema, confirma en 1 línea seca e incluye al final la etiqueta:
  * [[ACTION:AGENDA_ADD|name=Nombre Completo|email=...|phone=...|observations=...]]
  * [[ACTION:AGENDA_DELETE|name=Nombre del Cliente]]
  * [[ACTION:AGENDA_NOTE|name=Nombre del Cliente|text=Nota]]
  * [[ACTION:INDICES_REFRESH]] o [[ACTION:INDICES_SET|ui=...|ur=...|ura=...|usd=...]]
  * [[ACTION:NAVIGATE|tab=dashboard|clients|audit|calculator|chat]]

${DGR_MANUAL_CORPUS_2025}
`;

async function callGeminiDirectBrowser(contents: any, systemInstruction: string, temperature = 0.2): Promise<string> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error("No se encontró una clave GEMINI_API_KEY configurada. Puedes ingresarla en el botón de configuración de IA.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature,
        },
      });
      if (response.text) return response.text;
    } catch (err: any) {
      lastErr = err;
      console.warn(`Browser direct Gemini attempt failed with ${model}:`, err);
    }
  }
  throw lastErr || new Error("No se pudo conectar con los modelos de Gemini.");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function generateLocalDeterministicAudit(
  docs: Array<{ fileName: string; text: string }>,
  clientName: string,
  timestamp: string
): string {
  const itemsList = docs.map((d, i) => `[Doc ${i + 1}]: ${d.fileName}`).join(", ");
  const fichas = docs.map((d, idx) => {
    const txt = d.text || "";
    const padronMatches = Array.from(new Set((txt.match(/padr[oó]n(?:es)?\s*(?:n[°ºo.]*)?\s*([\d.]+)/gi) || []).map(m => m.trim())));
    const ciMatches = Array.from(new Set((txt.match(/\b\d\.\d{3}\.\d{3}-\d\b/g) || [])));
    const dateMatches = Array.from(new Set((txt.match(/\b\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi) || [])));
    const montoMatches = Array.from(new Set((txt.match(/(?:U\$S|USD|\$|UI|UR)\s*[\d.,]+/gi) || [])));

    let docType = "Documento Notarial / Registral";
    if (/compraventa/i.test(txt)) docType = "Escritura / Compromiso de Compraventa";
    else if (/hipoteca/i.test(txt)) docType = "Contrato de Hipoteca";
    else if (/sucesi[oó]n|certificado de resultancias/i.test(txt)) docType = "Certificado de Resultancias de Autos (Sucesión)";
    else if (/arrendamiento|alquiler/i.test(txt)) docType = "Contrato de Arrendamiento";
    else if (/poder|mandato/i.test(txt)) docType = "Poder / Mandato Notarial";
    else if (/reserva|seña/i.test(txt)) docType = "Boleto de Reserva / Seña";

    return `### DOCUMENTO ${idx + 1}: ${d.fileName}
- **Tipo de Documento:** ${docType}
- **Fechas Detectadas:** ${dateMatches.length > 0 ? dateMatches.slice(0, 4).join(" | ") : "Verificar fecha de otorgamiento en matriz"}
- **Identificadores / Padrones / C.I.:** ${
      [
        padronMatches.length ? `Padrones: ${padronMatches.join(", ")}` : "",
        ciMatches.length ? `Cédulas: ${ciMatches.join(", ")}` : "",
        montoMatches.length ? `Valores: ${montoMatches.slice(0, 4).join(", ")}` : ""
      ].filter(Boolean).join(" • ") || "Controlar número de padrón, localidad catastral y plano de mensura"
    }`;
  }).join("\n\n");

  const combinedText = docs.map(d => d.text).join("\n");
  const hasPadron = /padr[oó]n/i.test(combinedText);
  const hasPlano = /plano|mensura|agrimensor/i.test(combinedText);
  const hasLIF = /transferencia|letra de cambio|banco|ley 19\.?210|inclusi[oó]n financiera/i.test(combinedText);
  const hasSaldoPrecio = /saldo de precio|plazo|cuotas/i.test(combinedText);
  const hasEstadoCivil = /solter|casad|divorciad|viud|bienes propios|ganancial/i.test(combinedText);
  const hasTracto = /adquiri[oó]|antecedente|inscript|registro de la propiedad/i.test(combinedText);
  const hasDJCU = /caracterizaci[oó]n urbana|djcu|17\.?296|19\.?996/i.test(combinedText);
  const hasSaneamiento = /saneamiento|18\.?840|ose/i.test(combinedText);
  const hasPJ = /sociedad an[oó]nima|s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|fideicomiso/i.test(combinedText);
  const hasBCU = /18\.?930|19\.?484|beneficiario final|bcu/i.test(combinedText);

  const hallazgos: string[] = [];
  if (!hasPadron) {
    hallazgos.push("1. **Identificación Catastral (Cap. 2.4.2 Manual DGR 2025 / Art. 9 Nº 1 Ley 16.871):** No se detectó mención expresa de número de Padrón, Departamento y Localidad Catastral en el texto extraído.");
  } else {
    hallazgos.push("1. **Identificación Catastral y Mutación (Cap. 2.2 Manual DGR 2025):** Se detectan referencias de padrón; si difiere del asiento registral antecedente, adjuntar obligatoriamente Cédula Catastral Informada de la que surja el padrón anterior.");
  }
  if (!hasPlano) {
    hallazgos.push("2. **Control de Plano de Mensura (Cap. 2.4.2 Manual DGR 2025 / Art. 286 Ley 12.804):** No consta referencia completa al plano de mensura (Agrimensor, fecha e inscripción en DNC) ni control de Adicional ITP 5% en Timbres Caja Notarial si el plano es posterior al 01/08/2004 (Art. 71 Lit. F Ley 17.738).");
  }
  if (!hasEstadoCivil) {
    hallazgos.push("3. **Datos de Comparecientes y Naturaleza del Bien (Cap. 2.4.1 Manual DGR 2025 / Art. 9 Nº 3 Ley 16.871 / Arts. 1955 y 1971 CC):** Verificar consignación expresa de estado civil actual, nombres y apellidos del cónyuge o ex-cónyuge, domicilio, nacionalidad y C.I.");
  }
  if (!hasLIF) {
    hallazgos.push("4. **Manual de Calificación LIF (Ley 19.210, Dtos. 350/351/017 y Ley 19.889):** No se individualiza el medio de pago admitido ni institución financiera emisora/receptora en operaciones iguales o superiores al umbral legal (1:000.000 UI vigencia actual / 40.000 o 160.000 UI según fecha del pago).");
  }
  if (hasSaldoPrecio) {
    hallazgos.push("5. **Cláusula Obligatoria por Saldo de Precio (Resolución DGR Nº 76/2024 - Cap. 2.4.4 Manual DGR 2025):** Al existir saldo de precio, es obligatorio incluir cláusula o declaración de partes estableciendo que los pagos del saldo se efectuarán por los medios autorizados en la Ley 19.210.");
  }
  if (!hasTracto) {
    hallazgos.push("6. **Tracto Sucesivo (Cap. 2.2 Manual DGR 2025 / Art. 57 Ley 16.871):** Controlar Nº, Fº y Lº o Nº de inscripción del antecedente dominial inscripto en DGR.");
  }
  if (!hasDJCU) {
    hallazgos.push("7. **Declaración Jurada de Caracterización Urbana — DJCU (Cap. 2.5.7 Manual DGR 2025 / Art. 178 Ley 17.296 red. Art. 125 Ley 19.996 y Res. 39/2022):** Controlar DJCU vigente a la fecha de inscripción (antigüedad máxima: 5 años en Propiedad Común y 10 años en Propiedad Horizontal).");
  }
  if (!hasSaneamiento) {
    hallazgos.push("8. **Certificado de Conexión a Saneamiento (Cap. 2.5.4 Manual DGR 2025 / Ley 18.840 y Res. 79/2016):** En transmisión de dominio de inmuebles urbanos/suburbanos con construcciones, controlar certificado vigente y declaración de inexistencia de nuevas obras posteriores.");
  }
  if (hasPJ && !hasBCU) {
    hallazgos.push("9. **Comunicación al BCU de Personas Jurídicas (Cap. 8 Manual DGR 2025 / Leyes 18.930 y 19.484, Res. 80/2020 y Res. 36/2025):** Interviene persona jurídica/fideicomiso sin constancia de control de Declaración Jurada ante BCU y declaración de no modificación posterior (Nota: el Art. 13 Ley 17.904 no es control registral según Res. DGR 35/2025).");
  }

  return `# TABELION — INFORME DE AUDITORÍA NOTARIAL & CALIFICACIÓN DGR
---

## CONTROL DE EMISIÓN
- **Ecosistema:** TABELION — El espacio inteligente del escribano Uruguayo
- **Dirigido a:** ${clientName || 'Escribano Actuante'}
- **Fecha y Hora de Emisión:** ${timestamp}
- **Documentos Auditados:** ${itemsList}

---

## FICHA TÉCNICA DE LOS DOCUMENTOS ANALIZADOS
${fichas}

---

## 1. HALLAZGOS Y OMISIONES CRÍTICAS
${hallazgos.join("\n")}

## 2. PRE-CALIFICACIÓN REGISTRAL
- **Control de Tracto y Matriculación:** Este punto presenta un alto riesgo de observación registral basado en los Arts. 9 y 57 de la Ley Orgánica Registral Nº 16.871 y el Manual de Calificación de la DGR si no se consignan íntegramente los datos de inscripción del antecedente inmediato y el plano de mensura.
- **Control de Medios de Pago (LIF):** Este punto presenta un alto riesgo de observación registral basado en el Manual de Calificación de la Ley de Inclusión Financiera (Ley 19.210) si el precio o entrega de dinero no detalla el instrumento bancario y las instituciones intervinientes.

## 3. SUGERENCIAS Y ACCIONES RECOMENDADAS
- Incorporar cláusula de relacionamiento de antecedentes dominiales (últimos 30 años) y certificados registrales vigentes libres de inscripciones adversas.
- Verificar constancias de BPS, DGI (Certificado Único si corresponde), Contribución Inmobiliaria y Primaria al día.
- Se deja a juicio y criterio del profesional actuante la valoración final de esta situación.

---
*Este informe es una herramienta de asistencia digital desarrollada por Striker IA y no sustituye la validación final del profesional.*`;
}

export async function chatWithELO(message: string, history: any[] = [], context?: string | null) {
  const customKey = getStoredApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (customKey) headers["x-gemini-api-key"] = customKey;

  if (!isTauri()) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message, history, context: context || null })
      });
      if (res.ok) {
        const data = await res.json();
        return data.response;
      }
      const errData = await res.json().catch(() => ({}));
      const errText = errData.error || `HTTP ${res.status}`;
      if (errText.includes("503") || errText.includes("UNAVAILABLE")) {
        throw new GeminiUnavailableError();
      }
      // Try browser direct fallback if server returned 404/500/502
      console.warn("Backend /api/chat returned non-OK, attempting direct Gemini fallback:", errText);
    } catch (error: any) {
      if (error instanceof GeminiUnavailableError) throw error;
      console.warn("Fetch to /api/chat failed, switching to browser direct fallback:", error);
    }

    // Fallback directo desde el navegador
    try {
      const fullInstruction = context
        ? `${BROWSER_SYSTEM_INSTRUCTION}\n\nCONTEXTO OPERATIVO ACTUAL DEL HUB:\n${context}`
        : BROWSER_SYSTEM_INSTRUCTION;
      const cleanHistory = (history || [])
        .filter((h: any) => h && h.parts && h.parts[0]?.text)
        .map((h: any) => ({ role: h.role, parts: h.parts }));
      return await callGeminiDirectBrowser(
        [...cleanHistory, { role: "user", parts: [{ text: message }] }],
        fullInstruction,
        0.2
      );
    } catch (fallbackErr: any) {
      const errText = String(fallbackErr.message || fallbackErr);
      if (errText.includes("503") || errText.includes("UNAVAILABLE")) {
        throw new GeminiUnavailableError();
      }
      throw new Error(errText);
    }
  }

  try {
    const response = await invoke<string>("tauri_chat_with_elo", {
      message,
      history,
      context: context || null
    });
    return response;
  } catch (error: any) {
    const errText = String(error.message || error);
    if (errText.includes("503") || errText.includes("UNAVAILABLE")) {
      throw new GeminiUnavailableError();
    }
    throw new Error(errText);
  }
}

export async function runAudit(
  fileBase64: string | null,
  mimeType: string | null,
  fileName: string | null,
  clientName?: string,
  timestamp?: string,
  files?: Array<{ fileBase64: string; mimeType: string; fileName: string; }>
) {
  const customKey = getStoredApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (customKey) headers["x-gemini-api-key"] = customKey;

  if (!isTauri()) {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fileBase64,
          mimeType,
          fileName,
          clientName: clientName || null,
          timestamp: timestamp || null,
          files: files || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.report;
      }
      const errData = await res.json().catch(() => ({}));
      const errText = errData.error || `HTTP ${res.status}`;
      if (errText.includes("503") || errText.includes("UNAVAILABLE")) {
        throw new GeminiUnavailableError();
      }
      console.warn("Backend /api/audit returned error, attempting browser fallback:", errText);
    } catch (error: any) {
      if (error instanceof GeminiUnavailableError) throw error;
      console.warn("Fetch to /api/audit failed (e.g., Failed to fetch), switching to browser fallback:", error);
    }

    // Browser Fallback: Process files directly in client and call Gemini (or deterministic normative engine if offline)
    const inputFiles = (files && files.length > 0)
      ? files
      : (fileBase64 ? [{ fileBase64, mimeType: mimeType || "application/pdf", fileName: fileName || "documento" }] : []);

    const contentParts: any[] = [];
    const extractedDocsForLocal: Array<{ fileName: string; text: string }> = [];

    for (let idx = 0; idx < inputFiles.length; idx++) {
      const f = inputFiles[idx];
      const nameLower = (f.fileName || "").toLowerCase();
      const isDocx = nameLower.endsWith(".docx") || f.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isTxt = nameLower.endsWith(".txt") || f.mimeType === "text/plain";

      if (isDocx && f.fileBase64) {
        try {
          const bytes = base64ToUint8Array(f.fileBase64);
          const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
          const text = (result.value || "").trim();
          extractedDocsForLocal.push({ fileName: f.fileName, text });
          contentParts.push({
            text: `=== CONTENIDO DEL DOCUMENTO ${idx + 1} (${f.fileName}) ===\n${text}\n=== FIN DEL DOCUMENTO ${idx + 1} ===`
          });
        } catch (e) {
          extractedDocsForLocal.push({ fileName: f.fileName, text: "" });
        }
      } else if (isTxt && f.fileBase64) {
        const bytes = base64ToUint8Array(f.fileBase64);
        const text = new TextDecoder("utf-8").decode(bytes);
        extractedDocsForLocal.push({ fileName: f.fileName, text });
        contentParts.push({
          text: `=== CONTENIDO DEL DOCUMENTO ${idx + 1} (${f.fileName}) ===\n${text}\n=== FIN DEL DOCUMENTO ${idx + 1} ===`
        });
      } else if (f.fileBase64) {
        // Try extracting ASCII/UTF-8 strings from PDF for local fallback if needed
        try {
          const bytes = base64ToUint8Array(f.fileBase64);
          const rawStr = new TextDecoder("latin1").decode(bytes);
          extractedDocsForLocal.push({ fileName: f.fileName, text: rawStr });
        } catch {
          extractedDocsForLocal.push({ fileName: f.fileName, text: "" });
        }
        contentParts.push({
          inlineData: {
            data: f.fileBase64,
            mimeType: f.mimeType || "application/pdf"
          }
        });
      }
    }

    const itemsList = inputFiles.map((f, i) => `[Doc ${i + 1}]: ${f.fileName}`).join(", ");
    const auditPrompt = `Analiza los siguientes documentos (${itemsList}) contrastándolos punto por punto contra los 28 Capítulos del Manual de Calificación de la DGR (Edición 2025), el Manual de Calificación LIF (Ley 19.210 y Res. DGR 76/2024) y la Ley Orgánica Registral Nº 16.871. Devuelve un INFORME DE AUDITORÍA NOTARIAL completo en Markdown con: CONTROL DE EMISIÓN (Dirigido a: ${clientName || 'Escribano Actuante'}, Fecha: ${timestamp || new Date().toLocaleString('es-UY')}), FICHA TÉCNICA DE LOS DOCUMENTOS ANALIZADOS, 1. HALLAZGOS Y OMISIONES CRÍTICAS, 2. PRE-CALIFICACIÓN REGISTRAL (usando obligatoriamente la frase "Este punto presenta un alto riesgo de observación registral basado en [Capítulo/Resolución/Artículo exacto del Manual DGR 2025]"), y 3. SUGERENCIAS Y ACCIONES RECOMENDADAS.`;

    contentParts.push({ text: auditPrompt });

    try {
      return await callGeminiDirectBrowser(
        [{ role: "user", parts: contentParts }],
        BROWSER_SYSTEM_INSTRUCTION,
        0.1
      );
    } catch (directErr: any) {
      console.warn("Direct Gemini browser call failed, using deterministic normative audit engine:", directErr);
      return generateLocalDeterministicAudit(
        extractedDocsForLocal,
        clientName || "Escribano Actuante",
        timestamp || new Date().toLocaleString("es-UY")
      );
    }
  }

  try {
    const response = await invoke<string>("tauri_run_audit", {
      fileBase64,
      mimeType,
      fileName,
      clientName: clientName || null,
      timestamp: timestamp || null,
      files: files || null
    });
    return response;
  } catch (error: any) {
    const errText = String(error.message || error);
    if (errText.includes("503") || errText.includes("UNAVAILABLE")) {
      throw new GeminiUnavailableError();
    }
    throw new Error(errText);
  }
}
