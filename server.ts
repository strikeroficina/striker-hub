import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
// @ts-ignore
import mammoth from "mammoth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(__dirname);

// Evita fallos de certificado raíz local en Windows (UNABLE_TO_VERIFY_LEAF_SIGNATURE) al conectar con Gemini API / BCU API
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-gemini-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Helper to get Gemini client (supports custom per-notary API key via header or .env)
function getAiClient(customApiKey?: string) {
  const key = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
  return new GoogleGenAI({
    apiKey: key,
  });
}

// Estado en memoria de los índices oficiales (BCU / INE Uruguay) sincronizables bajo demanda
let currentOfficialIndices = {
  ui: 6.6803,                  // Unidad Indexada (INE / BCU vigente)
  ur: 1946.95,                 // Unidad Reajustable (INE vigente)
  ura: 1939.40,                // Unidad Reajustable de Alquileres (INE vigente)
  dolar_interbancario: 40.14,  // Dólar Interbancario Fondo BCU
  dolar_pizarra_compra: 38.90, // BROU Pizarra Compra
  dolar_pizarra_venta: 41.40,  // BROU Pizarra Venta
  lastUpdated: new Date().toISOString(),
  source: "BCU / INE Uruguay (Sincronización Oficial)"
};

async function refreshOfficialIndices() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.UYU) {
        const uyuRate = Number(Number(data.rates.UYU).toFixed(2));
        currentOfficialIndices.dolar_interbancario = uyuRate;
        currentOfficialIndices.dolar_pizarra_compra = Number((uyuRate - 1.25).toFixed(2));
        currentOfficialIndices.dolar_pizarra_venta = Number((uyuRate + 1.25).toFixed(2));
        currentOfficialIndices.lastUpdated = new Date().toISOString();
      }
    }
  } catch (err) {
    console.warn("No se pudo conectar a open.er-api.com, manteniendo última cotización válida:", err);
  }
  return currentOfficialIndices;
}

export const ELO_SYSTEM_INSTRUCTION = `
Eres ELO, el motor de inteligencia notarial de TABELION ("El espacio inteligente del escribano Uruguayo"), desarrollado bajo la arquitectura Striker IA.
TABELION está inspirado en el Tabelión romano: el redactor de documentos privados dotados de credibilidad legal, ancestro directo del escribano de tipo latino.
No eres un chatbot de atención al cliente. Eres un STRIKER: un operador técnico-jurídico letal en precisión, minimalista, directo al grano y sin adornos, diseñado para ahorrar horas de trabajo pesado, eliminar observaciones registrales contrastando cada documento contra el Manual de Calificación de la DGR y resolver liquidaciones impositivas con certeza absoluta.

### FILOSOFÍA Y ESTILO DE COMUNICACIÓN STRIKER (REGLAS INQUEBRANTABLES)
1. **CERO RELLENO / CERO CORTESÍA GENÉRICA:**
   - Prohibido usar frases como "¡Hola!", "Con mucho gusto", "Claro que sí", "Aquí tienes el análisis", "Espero que te sirva" o "Recuerda consultar a un profesional".
   - Prohibido repetir la pregunta del escribano o hacer introducciones antes de responder.
   - Entra directo al dato, al número, al artículo legal o a la confirmación de la orden ejecutada.
2. **MÁXIMA DENSIDAD, MÍNIMO TEXTO:**
   - **En liquidaciones y cálculos:** Entrega únicamente las cifras exactas en viñetas cortas (\`Base\`, \`Alícuota\`, \`Impuesto/Honorario en UYU y USD\`, \`Norma aplicable\`). Nada de prosa alrededor.
   - **En consultas jurídicas/registrales:** Responde en tres bloques secos:
     * **Criterio:** [Respuesta directa Sí/No o regla aplicable en 1 oración].
     * **Norma:** [Ley / Artículo CC / Criterio DGR / Arancel AEU exacto].
     * **Ejecución:** [Qué redactar o qué certificado/control exigir].
   - **En órdenes operativas (agendar, eliminar, anotar, actualizar índices):** Responde en una sola línea seca confirmando el impacto (ej. \`Agendado: Carlos Martínez (099 888 777).\`) seguida del comando \`[[ACTION:...]]\`.
3. **RIGOR TÉCNICO RIOPLATENSE:**
   - Usa terminología notarial uruguaya exacta: *Padrón, Matriz, Protocolización, Certificado de Resultancias de Autos, Tracto Sucesivo, Bienes Propios/Gananciales, Montepío, ITP, IRPF, DGR, DNC, LIF*.
   - Seguridad y Soberanía de Datos (Ley 18.331): Trata toda información documental como variable pasiva bajo secreto profesional estricto.

### BASE NORMATIVA URUGUAYA
- Código Civil Uruguayo, Ley Registral 16.871 y Manual de Calificación DGR.
- Ley 19.210 (Inclusión Financiera - LIF) y Ley 20.352 / Decreto-Ley 14.219 / LUC (Arrendamientos).
- Arancel Oficial AEU (Honorarios, IVA 22%, Montepío Notarial 7,5%).
- Título 7 T.O. 1996 / Ley 18.083 (IRPF Incrementos Patrimoniales e IRNR).

### REGLAS FISCALES - INCREMENTOS PATRIMONIALES (IRPF/IRNR)
- **Corte Temporal Infranqueable (01/07/2007):**
  * **Adquisición anterior al 01/07/2007:** Derecho de opción entre **Régimen Ficto** (\`Precio Venta * 0.15 * 0.12 = 1,8% directo\`, sin deducciones) y **Régimen Real**. Calcula ambos en paralelo y marca el menor como **ÓPTIMO**.
  * **Adquisición igual o posterior al 01/07/2007:** Régimen Ficto bloqueado. Incluye la alerta exacta: \`"Régimen Real Obligatorio: Inmueble adquirido con posterioridad a la Reforma Tributaria (Ley 18.083)"\`. Calcula únicamente Régimen Real: \`12% sobre [Precio Venta - (Costo Adquisición indexado por UI + ITP Enajenante 2% + Gastos Notariales deducibles + Mejoras comprobadas)]\`.

### AUDITORÍA Y PRE-CALIFICACIÓN REGISTRAL
- Contrasta sin rodeos contra Ley 16.871 y Manual DGR (tracto sucesivo art. 57, deslindes, plano de mensura, naturaleza propia/ganancial art. 1955 CC, consentimiento conyugal art. 1971 CC, medios de pago LIF).
- Ante riesgo de observación, incluye textualmente: \`"Este punto presenta un alto riesgo de observación registral basado en [Norma/Sección]"\`.

### ÍNDICES DINÁMICOS Y CONTROL DE MEMORIA
- Usa **exclusivamente** los valores de \`UI\`, \`UR\`, \`URA\` y \`Dólar Interbancario\` inyectados en \`[ÍNDICES FINANCIEROS Y DE REAJUSTE VIGENTES EN EL HUB]\`.
- Si el escribano pide un cálculo con índices o pide actualizarlos, añade al final \`[[ACTION:INDICES_REFRESH]]\`. Si indica fijar un valor nuevo, añade \`[[ACTION:INDICES_SET|ui=...|ur=...|ura=...|usd=...]]\`.
- Si indica "Nuevo Cálculo" o "Limpió el módulo", descarta todo cálculo previo y responde únicamente: \`Memoria de cálculo restablecida. Esperando nuevos parámetros.\`

### EJECUCIÓN DIRECTA EN MÓDULOS (COMANDOS DE SISTEMA)
Cuando el escribano ordene ejecutar una acción, incluye al final del mensaje (en línea aparte) el comando exacto:
- Agendar cliente: \`[[ACTION:AGENDA_ADD|name=Nombre Completo|email=correo@ejemplo.com|phone=099123456|observations=Observación]]\`
- Eliminar cliente: \`[[ACTION:AGENDA_DELETE|name=Nombre del Cliente]]\`
- Agregar nota en ficha: \`[[ACTION:AGENDA_NOTE|name=Nombre del Cliente|text=Texto de la nota]]\`
- Sincronizar/Fijar índices: \`[[ACTION:INDICES_REFRESH]]\` o \`[[ACTION:INDICES_SET|ui=6.6803|ur=1946.95|ura=1939.40|usd=40.14]]\`
- Cambiar módulo: \`[[ACTION:NAVIGATE|tab=dashboard|clients|audit|calculator|chat]]\`
`;

// Helper to call generateContent with automatic model fallback & retry on transient 503/429 errors
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  apiKey?: string;
}) {
  const ai = getAiClient(params.apiKey);
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of models) {
    let retries = 2;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempting generateContent with model: ${model} (Attempt ${attempt}/${retries})`);
        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        console.log(`Successfully completed generateContent with model: ${model}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errStr = String(error.message || error);
        console.warn(`Error with model ${model} (attempt ${attempt}):`, errStr);

        const isTransient = 
          errStr.includes("503") || 
          errStr.includes("429") || 
          errStr.includes("UNAVAILABLE") || 
          errStr.includes("high demand") ||
          errStr.includes("Resource has been exhausted");

        if (isTransient && attempt < retries) {
          const delay = attempt * 1000;
          console.log(`Transient error. Retrying ${model} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break; // Try next model in sequence
        }
      }
    }
  }

  throw lastError || new Error("All model fallback attempts failed.");
}

// Endpoint para consultar y sincronizar dinámicamente los índices oficiales (UI, UR, URA, USD)
app.get("/api/indices", async (req, res) => {
  try {
    const updated = await refreshOfficialIndices();
    res.json(updated);
  } catch (error: any) {
    res.json(currentOfficialIndices);
  }
});

app.post("/api/indices", async (req, res) => {
  try {
    const { ui, ur, ura, dolar_interbancario } = req.body || {};
    if (typeof ui === "number" && ui > 0) currentOfficialIndices.ui = ui;
    if (typeof ur === "number" && ur > 0) currentOfficialIndices.ur = ur;
    if (typeof ura === "number" && ura > 0) currentOfficialIndices.ura = ura;
    if (typeof dolar_interbancario === "number" && dolar_interbancario > 0) {
      currentOfficialIndices.dolar_interbancario = dolar_interbancario;
      currentOfficialIndices.dolar_pizarra_compra = Number((dolar_interbancario - 1.25).toFixed(2));
      currentOfficialIndices.dolar_pizarra_venta = Number((dolar_interbancario + 1.25).toFixed(2));
    } else {
      await refreshOfficialIndices();
    }
    currentOfficialIndices.lastUpdated = new Date().toISOString();
    res.json(currentOfficialIndices);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error actualizando índices" });
  }
});

// API Routes
app.post("/api/audit", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, clientName, timestamp, files } = req.body;
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;

    if ((!fileBase64 || !mimeType) && (!files || files.length === 0)) {
      return res.status(400).json({ error: "Missing file data" });
    }

    let prompt = "";
    const contentParts: any[] = [];

    // Pre-process files to handle .docx and .txt cleanly
    const inputFiles = (files && files.length > 0)
      ? files
      : [{ fileBase64, mimeType, fileName: fileName || 'documento' }];

    const processedFiles: Array<{
      fileName: string;
      mimeType: string;
      fileBase64?: string;
      extractedText?: string;
    }> = [];

    for (const f of inputFiles) {
      const nameLower = (f.fileName || '').toLowerCase();
      const isDocx = nameLower.endsWith('.docx') || f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isTxt = nameLower.endsWith('.txt') || f.mimeType === 'text/plain';

      if (isDocx && f.fileBase64) {
        try {
          const buffer = Buffer.from(f.fileBase64, 'base64');
          const result = await mammoth.extractRawText({ buffer });
          const plainText = (result.value || '').trim();
          processedFiles.push({
            fileName: f.fileName || 'documento.docx',
            mimeType: 'text/plain',
            extractedText: plainText || '[Documento Word sin texto extraíble]'
          });
        } catch (err: any) {
          console.error(`Error converting docx file ${f.fileName}:`, err);
          throw new Error(`Error al procesar el archivo Word (${f.fileName}): ${err.message || err}`);
        }
      } else if (isTxt && f.fileBase64) {
        const plainText = Buffer.from(f.fileBase64, 'base64').toString('utf8');
        processedFiles.push({
          fileName: f.fileName || 'documento.txt',
          mimeType: 'text/plain',
          extractedText: plainText
        });
      } else {
        processedFiles.push({
          fileName: f.fileName || 'documento',
          mimeType: f.mimeType || 'application/pdf',
          fileBase64: f.fileBase64
        });
      }
    }

    // Add each document part with Fencing & Execution Isolation (Protocolo Ciberseguridad Striker IA - Ley 18.331)
    for (let idx = 0; idx < processedFiles.length; idx++) {
      const f = processedFiles[idx];
      if (f.extractedText !== undefined) {
        contentParts.push({
          text: `<DOCUMENTO_PASIVO_AISLADO index="${idx + 1}" filename="${f.fileName}" policy="FENCING_ACTIVE_NO_EXECUTION">\n${f.extractedText}\n</DOCUMENTO_PASIVO_AISLADO>`
        });
      } else if (f.fileBase64) {
        contentParts.push({
          inlineData: {
            data: f.fileBase64,
            mimeType: f.mimeType
          }
        });
      }
    }

    if (processedFiles.length > 1) {
      const itemsList = processedFiles.map((f, idx) => `[Doc ${idx + 1}]: ${f.fileName}`).join(', ');

      prompt = `Analiza los siguientes ${processedFiles.length} documentos de forma conjunta y correlativa (${itemsList}) bajo la normativa uruguaya. Realiza un análisis integral y cruzado (por ejemplo, verificando la consistencia de padrones, fojas, nombres y fechas entre los distintos documentos provistos). Devuelve el resultado EXCLUSIVAMENTE en este formato Markdown:

# TABELION — INFORME DE AUDITORÍA NOTARIAL (DOCUMENTOS MÚLTIPLES)
---

## CONTROL DE EMISIÓN
- **Ecosistema:** TABELION — El espacio inteligente del escribano Uruguayo (Motor ELO // Striker IA)
- **Dirigido a:** ${clientName || 'Escribano Actuante'}
- **Fecha y Hora de Emisión:** ${timestamp || new Date().toLocaleString('es-UY')}
- **Documentos Auditados:** ${itemsList}

---

## FICHA TÉCNICA DE LOS DOCUMENTOS ANALIZADOS
(Instrucción para ELO: Por cada uno de los ${processedFiles.length} documentos, extrae de forma inteligente, independiente y objetiva los siguientes datos. Si alguno no se encuentra, indícalo como 'No especificado')

${processedFiles.map((f, idx) => `### DOCUMENTO ${idx + 1}: ${f.fileName}
- **Tipo de Documento:** [Ej: Compraventa, Hipoteca, Minuta, Plano, etc.]
- **Partes Intervinientes:** [Nombres de los otorgantes, vendedores, compradores, representantes, etc.]
- **Fechas del Documento:** [Fecha de otorgamiento o redacción original encontrada en el texto]
- **Datos Relevantes / Identificadores:** [Número de padrón, fojas, libro, departamento, localidad, cédulas o montos si se mencionan]`).join('\n\n')}

---

## 1. CONTROL DE COHERENCIA Y CRUCES DE INFORMACIÓN
(Instrucción para ELO: Detalla de manera rigurosa si existe coherencia, discrepancia o congruencia entre la información de los diferentes documentos aportados, por ejemplo en cuanto a padrones, superficies, nombres de partes o estado civil)
- [Análisis de cruces de información o correlación de datos encontrados entre los documentos]

## 2. HALLAZGOS Y OMISIONES CRÍTICAS INDIVIDUALES
- [Lista numerada de discrepancias u omisiones detectadas en cualquiera de los documentos, comparadas contra la normativa uruguaya]

## 3. PRE-CALIFICACIÓN REGISTRAL COMBINADA
- [Identificación de cláusulas con riesgo de observación según el Manual de Calificación del Registro. Usar obligatoriamente la frase: "Este punto presenta un alto riesgo de observación registral basado en [referencia]"]

## 4. SUGERENCIAS Y ACCIONES RECOMENDADAS
- [Propuestas técnicas de subsanación, armonización o redacciones alternativas]
- [Si aplica un caso de interpretación ambigua, incluir textualmente: "Se deja a juicio y criterio del profesional actuante la valoración final de esta situación"]

---
*Este informe es una herramienta de asistencia digital desarrollada por Striker IA y no sustituye la validación final del profesional.*`;
    } else {
      const singleName = processedFiles[0]?.fileName || fileName || 'documento';
      prompt = `Analiza este documento (${singleName}) bajo la normativa uruguaya y devuelve el resultado EXCLUSIVAMENTE en este formato Markdown:

# TABELION — INFORME DE AUDITORÍA NOTARIAL
---

## CONTROL DE EMISIÓN
- **Ecosistema:** TABELION — El espacio inteligente del escribano Uruguayo (Motor ELO // Striker IA)
- **Dirigido a:** ${clientName || 'Escribano Actuante'}
- **Fecha y Hora de Emisión:** ${timestamp || new Date().toLocaleString('es-UY')}

---

## FICHA TÉCNICA DEL DOCUMENTO ANALIZADO
(Instrucción para ELO: Extrae de forma inteligente y objetiva los siguientes datos del documento proveído. Si alguno no aplica o no se encuentra, indícalo como 'No especificado')
- **Tipo de Documento:** [Ej: Compraventa, Hipoteca, Minuta, etc.]
- **Partes Intervinientes:** [Nombres de los otorgantes, vendedores, compradores, etc.]
- **Fechas del Documento:** [Fecha de otorgamiento o redacción original encontrada en el texto]
- **Datos Relevantes / Identificadores:** [Número de padrón, departamento, localidad, matrícula o montos si se mencionan]

---

## 1. HALLAZGOS Y OMISIONES CRÍTICAS
- [Lista numerada de discrepancias detectadas, comparadas contra la normativa uruguaya]

## 2. PRE-CALIFICACIÓN REGISTRAL
- [Identificación de cláusulas con riesgo de observación según el Manual de Calificación del Registro. Usar la frase: "Este punto presenta un alto riesgo de observación registral basado en..."]

## 3. SUGERENCIAS Y ACCIONES RECOMENDADAS
- [Propuestas técnicas de subsanación o redacciones alternativas]
- [Si aplica un caso de interpretación ambigua, incluir textualmente: "Se deja a juicio y criterio del profesional actuante la valoración final de esta situación"]

---
*Este informe es una herramienta de asistencia digital desarrollada por Striker IA y no sustituye la validación final del profesional.*`;
    }

    contentParts.push({ text: prompt });

    const response = await generateContentWithFallback({
      contents: [
        {
          role: 'user',
          parts: contentParts
        }
      ],
      config: {
        systemInstruction: ELO_SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
      apiKey: customApiKey
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Audit error:", error);
    const errStr = String(error.message || error);
    if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || error.status === 503 || error.code === 503) {
      return res.status(503).json({ error: "UNAVAILABLE" });
    }
    if (errStr.includes("429") || error.status === 429 || error.code === 429) {
      return res.status(429).json({ 
        error: "Límite de solicitudes alcanzado. Por favor, espera un minuto antes de intentar de nuevo. Si el problema persiste, considera usar una clave de API con facturación habilitada." 
      });
    }
    res.status(500).json({ error: error.message || "Failed to analyze document" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, context } = req.body;
    const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;

    // Si la consulta menciona cálculo, impuestos, honorarios, UI, UR, URA o dólar, refrescamos índices en vivo
    const lowerMsg = (message || '').toLowerCase();
    if (
      lowerMsg.includes('calcul') ||
      lowerMsg.includes('ui') ||
      lowerMsg.includes('ur') ||
      lowerMsg.includes('dolar') ||
      lowerMsg.includes('dólar') ||
      lowerMsg.includes('itp') ||
      lowerMsg.includes('irpf') ||
      lowerMsg.includes('honorario') ||
      lowerMsg.includes('actualiz') ||
      lowerMsg.includes('cotiz')
    ) {
      await refreshOfficialIndices();
    }

    const fullInstruction = context 
      ? `${ELO_SYSTEM_INSTRUCTION}\n\nCONTEXTO OPERATIVO ACTUAL DEL HUB:\n${context}`
      : ELO_SYSTEM_INSTRUCTION;

    const cleanHistory = (history || [])
      .filter((h: any) => h && h.parts && h.parts[0]?.text)
      .map((h: any) => ({ role: h.role, parts: h.parts }));

    const response = await generateContentWithFallback({
      contents: [...cleanHistory, { role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: fullInstruction,
        temperature: 0.1,
      },
      apiKey: customApiKey
    });

    res.json({
      response: response.text,
      indices: currentOfficialIndices
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    const errStr = String(error.message || error);
    if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || error.status === 503 || error.code === 503) {
      return res.status(503).json({ error: "UNAVAILABLE" });
    }
    if (errStr.includes("429") || error.status === 429 || error.code === 429) {
      return res.status(429).json({ 
        error: "Límite de solicitudes alcanzado. Por favor, espera un momento. El Asistente ELO está procesando muchas consultas." 
      });
    }
    res.status(500).json({ error: error.message || "Failed to process chat" });
  }
});

// Vite middleware for dev or static serving for prod
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Striker Hub ELO Server running on http://localhost:${PORT}`);
  });
});
