import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Receipt, 
  Info, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  Coins, 
  FileText,
  UserCheck,
  Search,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { dbGetContacts, dbInsertAttachment, AgendaContact } from '../lib/relationalDb';

interface CalculatorProps {
  onCalculationComplete?: (report: string) => void;
  onRefreshIndices?: () => Promise<void> | void;
  systemIndices?: {
    dolarInter: string;
    dolarCompra: string;
    dolarVenta: string;
    ui: string;
    ur: string;
    ura: string;
  } | null;
}

// Datos históricos aproximados de UI y USD en Uruguay (2002 - 2026)
const getHistoricalData = (dateString: string) => {
  if (!dateString) return { ui: 6.6803, usd: 40.14 };
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return { ui: 6.6803, usd: 40.14 };

  const uiHistory: { [key: number]: number } = {
    2002: 1.0000,
    2003: 1.1250,
    2004: 1.2840,
    2005: 1.3540,
    2006: 1.4420,
    2007: 1.5450,
    2008: 1.6780,
    2009: 1.8210,
    2010: 1.9540,
    2011: 2.1250,
    2012: 2.3240,
    2013: 2.5410,
    2014: 2.7850,
    2015: 3.0540,
    2016: 3.3210,
    2017: 3.6120,
    2018: 3.8950,
    2019: 4.1850,
    2020: 4.5420,
    2021: 4.9210,
    2022: 5.3120,
    2023: 5.7650,
    2024: 6.0850,
    2025: 6.3850,
    2026: 6.6803
  };

  const usdHistory: { [key: number]: number } = {
    2002: 21.20,
    2003: 28.20,
    2004: 28.70,
    2005: 24.40,
    2006: 24.05,
    2007: 23.50,
    2008: 20.90,
    2009: 22.50,
    2010: 20.05,
    2011: 19.30,
    2012: 20.30,
    2013: 21.40,
    2014: 23.20,
    2015: 27.20,
    2016: 30.10,
    2017: 28.60,
    2018: 31.20,
    2019: 35.30,
    2020: 42.10,
    2021: 43.60,
    2022: 41.20,
    2023: 38.80,
    2024: 39.40,
    2025: 40.50,
    2026: 40.14
  };

  // Safe fallback interpolation/values
  const ui = uiHistory[year] || (year < 2002 ? 1.0000 : 6.6803);
  const usd = usdHistory[year] || (year < 2002 ? 20.00 : 40.14);

  return { ui, usd };
};

// Helper to parse strings to numbers robustly across locales (handling dots/commas as decimal/thousands)
const parseLocaleFloat = (str: string | undefined, fallback: number): number => {
  if (!str) return fallback;
  const clean = str.replace(/[$\s]/g, '').trim();
  if (!clean) return fallback;

  const commaCount = (clean.match(/,/g) || []).length;
  const dotCount = (clean.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || fallback;
    } else {
      return parseFloat(clean.replace(/,/g, '')) || fallback;
    }
  }

  if (dotCount > 1) {
    return parseFloat(clean.replace(/\./g, '')) || fallback;
  }

  if (commaCount > 1) {
    return parseFloat(clean.replace(/,/g, '')) || fallback;
  }

  if (dotCount === 1) {
    return parseFloat(clean) || fallback;
  }

  if (commaCount === 1) {
    return parseFloat(clean.replace(',', '.')) || fallback;
  }

  return parseFloat(clean) || fallback;
};

// Helper para normalizar texto (quitar tildes y convertir a minúsculas)
const normalizeText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// Evalúa si el inmueble fue adquirido después de la Reforma Tributaria de Uruguay (01/07/2007)
const isPostReforma = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year > 2007) return true;
  if (year < 2007) return false;
  if (month > 7) return true;
  if (month < 7) return false;
  return day >= 1;
};

export const Calculator: React.FC<CalculatorProps> = ({ onCalculationComplete, onRefreshIndices, systemIndices }) => {
  // Cotizaciones de Referencia (Dinámicas desde el Hub)
  const usdRate = parseLocaleFloat(systemIndices?.dolarInter, 40.14);
  const uiRate = parseLocaleFloat(systemIndices?.ui, 6.6803);

  // --- ESTADOS DE NAVEGACIÓN Y CONFIGURACIÓN UX ---
  const [selectedMode, setSelectedMode] = useState<'dashboard' | 'tributario' | 'honorarios' | 'irpf_personal'>('dashboard');

  // Identificación del Acto (Persistente entre modos)
  const [padron, setPadron] = useState<string>('');
  const [localidad, setLocalidad] = useState<string>('');
  const [padronesAnexos, setPadronesAnexos] = useState<string>('');

  // --- ESTADOS CUADRO 1: IMPUESTOS ---
  const [taxType, setTaxType] = useState<'itp' | 'irpf_venta' | 'irpf_alquiler' | 'transferencia_automotor'>('itp');
  
  // ITP Inputs
  const [itpVariant, setItpVariant] = useState<'general' | 'sucesiones' | 'donatarios'>('general');
  const [valRealCatastral, setValRealCatastral] = useState<string>('1200000');
  const [coefReajuste, setCoefReajuste] = useState<string>('1.035');

  // IRPF Venta Inputs
  const [precioVenta, setPrecioVenta] = useState<string>('150000');
  const [precioVentaCurrency, setPrecioVentaCurrency] = useState<'USD' | 'UYU'>('USD');
  const [precioAdq, setPrecioAdq] = useState<string>('90000');
  const [precioAdqCurrency, setPrecioAdqCurrency] = useState<'USD' | 'UYU'>('USD');
  const [fechaAdq, setFechaAdq] = useState<string>('2005-05-15');
  const [mejoras, setMejoras] = useState<string>('8000');
  const [mejorasCurrency, setMejorasCurrency] = useState<'USD' | 'UYU'>('USD');
  const [irpfVentaRegimen, setIrpfVentaRegimen] = useState<'real' | 'ficto'>('ficto');
  const [valCatastralVenta, setValCatastralVenta] = useState<string>('1200000');
  const [gastosNotariales, setGastosNotariales] = useState<string>('4000');
  const [gastosNotarialesCurrency, setGastosNotarialesCurrency] = useState<'USD' | 'UYU'>('USD');

  // IRPF Alquiler Inputs
  const [montoAlquiler, setMontoAlquiler] = useState<string>('28000');
  const [montoAlquilerCurrency, setMontoAlquilerCurrency] = useState<'USD' | 'UYU'>('UYU');
  const [gastosDeducibles, setGastosDeducibles] = useState<string>('4000');
  const [gastosDeduciblesCurrency, setGastosDeduciblesCurrency] = useState<'USD' | 'UYU'>('UYU');

  // Transferencia Automotor Inputs
  const [aforoVehiculo, setAforoVehiculo] = useState<string>('15000');
  const [aforoCurrency, setAforoCurrency] = useState<'USD' | 'UYU'>('USD');
  const [tasasAsociadas, setTasasAsociadas] = useState<string>('6300');

  // --- ESTADOS IRPF PERSONAL ---
  const [ingresosPersonales, setIngresosPersonales] = useState<string>('85000');
  const [deduccionesPersonales, setDeduccionesPersonales] = useState<string>('15000');
  const [personalResult, setPersonalResult] = useState<any | null>(null);
  const [personalLoading, setPersonalLoading] = useState<boolean>(false);
  const [personalCopied, setPersonalCopied] = useState<boolean>(false);
  const [personalShowPicker, setPersonalShowPicker] = useState<boolean>(false);
  const [personalSelectedClientId, setPersonalSelectedClientId] = useState<string>('');
  const [personalSearchQuery, setPersonalSearchQuery] = useState<string>('');
  const [personalSyncSuccess, setPersonalSyncSuccess] = useState<boolean>(false);
  const [personalReference, setPersonalReference] = useState<string>('');

  // Resultados Impuestos
  const [taxResult, setTaxResult] = useState<any | null>(null);
  const [taxLoading, setTaxLoading] = useState<boolean>(false);
  const [taxCopied, setTaxCopied] = useState<boolean>(false);
  const [taxShowPicker, setTaxShowPicker] = useState<boolean>(false);
  const [taxSelectedClientId, setTaxSelectedClientId] = useState<string>('');
  const [taxSearchQuery, setTaxSearchQuery] = useState<string>('');
  const [taxSyncSuccess, setTaxSyncSuccess] = useState<boolean>(false);
  const [taxReference, setTaxReference] = useState<string>('');

  // --- ESTADOS CUADRO 2: HONORARIOS ---
  const [montoNegocio, setMontoNegocio] = useState<string>('150000');
  const [montoNegocioCurrency, setMontoNegocioCurrency] = useState<'USD' | 'UYU'>('USD');
  const [aplicaComplejidad, setAplicaComplejidad] = useState<boolean>(false);

  // Resultados Honorarios
  const [feesResult, setFeesResult] = useState<any | null>(null);
  const [feesLoading, setFeesLoading] = useState<boolean>(false);
  const [feesCopied, setFeesCopied] = useState<boolean>(false);
  const [feesShowPicker, setFeesShowPicker] = useState<boolean>(false);
  const [feesSelectedClientId, setFeesSelectedClientId] = useState<string>('');
  const [feesSearchQuery, setFeesSearchQuery] = useState<string>('');
  const [feesSyncSuccess, setFeesSyncSuccess] = useState<boolean>(false);
  const [feesReference, setFeesReference] = useState<string>('');

  // Listado de clientes cargados
  const [clientsList, setClientsList] = useState<AgendaContact[]>([]);

  useEffect(() => {
    const sorted = dbGetContacts()
      .filter(c => !c.deleted)
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    setClientsList(sorted);
  }, [taxShowPicker, feesShowPicker]);

  // Auto-seleccionar si hay coincidencia única o exacta en impuestos
  useEffect(() => {
    const filtered = filterClients(taxSearchQuery);
    if (filtered.length === 1) {
      setTaxSelectedClientId(filtered[0].id);
    } else {
      const normalizedQuery = normalizeText(taxSearchQuery);
      const exactMatch = filtered.find(c => normalizeText(c.name) === normalizedQuery);
      if (exactMatch) {
        setTaxSelectedClientId(exactMatch.id);
      }
    }
  }, [taxSearchQuery]);

  // Auto-seleccionar si hay coincidencia única o exacta en honorarios
  useEffect(() => {
    const filtered = filterClients(feesSearchQuery);
    if (filtered.length === 1) {
      setFeesSelectedClientId(filtered[0].id);
    } else {
      const normalizedQuery = normalizeText(feesSearchQuery);
      const exactMatch = filtered.find(c => normalizeText(c.name) === normalizedQuery);
      if (exactMatch) {
        setFeesSelectedClientId(exactMatch.id);
      }
    }
  }, [feesSearchQuery]);

  // Si la fecha de adquisición es posterior o igual a la reforma, forzar régimen Real obligatoriamente
  useEffect(() => {
    if (isPostReforma(fechaAdq)) {
      setIrpfVentaRegimen('real');
    }
  }, [fechaAdq]);

  const getFormattedDate = (): string => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // --- LÓGICA CÁLCULO IMPUESTOS ---
  const handleCalculateTax = () => {
    if (onRefreshIndices) {
      onRefreshIndices();
    }
    setTaxLoading(true);
    setTaxResult(null);
    setTaxShowPicker(false);
    setTaxSyncSuccess(false);

    setTimeout(() => {
      let resultDetails: any = {};
      const currentTimestamp = getFormattedDate();

      if (taxType === 'itp') {
        const vrc = parseLocaleFloat(valRealCatastral, 0);
        const coef = parseLocaleFloat(coefReajuste, 1.0);
        const vrcReajustado = vrc * coef;
        
        let rateComprador = 0.02;
        let rateVendedor = 0.02;
        let variantLabel = '';

        if (itpVariant === 'general') {
          rateComprador = 0.02;
          rateVendedor = 0.02;
          variantLabel = 'Enajenantes y Adquirentes Generales (2% cada uno)';
        } else if (itpVariant === 'sucesiones') {
          rateComprador = 0.03;
          rateVendedor = 0;
          variantLabel = 'Herederos y Legatarios en Sucesiones (3%)';
        } else if (itpVariant === 'donatarios') {
          rateComprador = 0.04;
          rateVendedor = 0;
          variantLabel = 'Donatarios (4%)';
        }

        const itpComprador = vrcReajustado * rateComprador;
        const itpVendedor = vrcReajustado * rateVendedor;
        const itpTotal = itpComprador + itpVendedor;

        const desglose = `Variante: ${variantLabel}
- Valor Real Catastral ingresado: $${vrc.toLocaleString('es-UY')} UYU
- Coeficiente de Reajuste/IPC: ${coef}
- Valor Real Catastral Reajustado: $${vrcReajustado.toLocaleString('es-UY')} UYU
- Impuesto Comprador (${(rateComprador * 100)}%): $${itpComprador.toLocaleString('es-UY')} UYU
- Impuesto Vendedor (${(rateVendedor * 100)}%): $${itpVendedor.toLocaleString('es-UY')} UYU
- TOTAL ITP RETENIDO: $${itpTotal.toLocaleString('es-UY')} UYU`;

        resultDetails = {
          type: 'ITP',
          label: 'Impuesto a las Trasmisiones Patrimoniales (ITP)',
          totalUYU: itpTotal,
          desglose
        };
      } else if (taxType === 'irpf_venta') {
        const pvRaw = parseLocaleFloat(precioVenta, 0);
        const paRaw = parseLocaleFloat(precioAdq, 0);
        const mejorasRaw = parseLocaleFloat(mejoras, 0);
        const vCatVentaRaw = parseLocaleFloat(valCatastralVenta, 0);
        const gastNotRaw = parseLocaleFloat(gastosNotariales, 0);

        const histData = getHistoricalData(fechaAdq);
        const usdAcq = histData.usd;
        const uiAcq = histData.ui;

        // Conversión a pesos
        const pvUYU = precioVentaCurrency === 'USD' ? pvRaw * usdRate : pvRaw;
        const paUYU = precioAdqCurrency === 'USD' ? paRaw * usdAcq : paRaw;
        const mejorasUYU = mejorasCurrency === 'USD' ? mejorasRaw * usdRate : mejorasRaw;
        const gastNotUYU = gastosNotarialesCurrency === 'USD' ? gastNotRaw * usdRate : gastNotRaw;

        // Evaluación de Reforma (01/07/2007)
        const postReforma = isPostReforma(fechaAdq);
        const regimenEfectivo = postReforma ? 'real' : irpfVentaRegimen;

        // 1. CÁLCULO A: Régimen Ficto (12% sobre el 15% del precio de venta = 1.8% directo)
        const impuestoFictoUYU = pvUYU * 0.018;

        // 2. CÁLCULO B: Régimen Real (12% sobre el Margen Real)
        // Costo de Adquisición indexado por UI/IPC
        const uiRatio = uiRate / uiAcq;
        const paActualizado = paUYU * uiRatio;

        // ITP Enajenante: 2% del Valor Catastral Reajustado
        const coef = parseLocaleFloat(coefReajuste, 1.0);
        const itpEnajenanteUYU = vCatVentaRaw * coef * 0.02;

        // Margen Real = Precio Venta - (Costo Compra indexado + ITP Enajenante + Gastos Notariales + Mejoras)
        const totalDeduccionesReal = paActualizado + itpEnajenanteUYU + gastNotUYU + mejorasUYU;
        const margenReal = Math.max(0, pvUYU - totalDeduccionesReal);
        const impuestoRealUYU = margenReal * 0.12;

        // Selección de régimen
        const totalUYU = regimenEfectivo === 'ficto' ? impuestoFictoUYU : impuestoRealUYU;
        const opcionMasConveniente = impuestoFictoUYU < impuestoRealUYU ? 'ficto' : 'real';
        const ahorroUYU = Math.abs(impuestoFictoUYU - impuestoRealUYU);

        // Desgloses independientes para el reporte
        const desgloseFicto = `REGIMEN FICTO (Opción A):
  * Precio de Venta: $${pvRaw.toLocaleString('es-UY')} ${precioVentaCurrency} ($${pvUYU.toLocaleString('es-UY')} UYU)
  * Base Imponible Ficta (15%): $${(pvUYU * 0.15).toLocaleString('es-UY')} UYU
  * Tasa IRPF/IRNR (12%): 12% de la Base Imponible (1.8% del total)
  * Impuesto Ficto: $${impuestoFictoUYU.toLocaleString('es-UY')} UYU`;

        const desgloseReal = `REGIMEN REAL (Opción B):
  * Precio de Venta: $${pvRaw.toLocaleString('es-UY')} ${precioVentaCurrency} ($${pvUYU.toLocaleString('es-UY')} UYU)
  * Costo Adquisición Original: $${paRaw.toLocaleString('es-UY')} ${precioAdqCurrency} (TC Histórico: $${usdAcq.toFixed(2)} UYU)
  * Costo Adquisición en pesos: $${paUYU.toLocaleString('es-UY')} UYU
  * Coeficiente evolución UI (${uiAcq.toFixed(4)} -> ${uiRate.toFixed(4)}): ${uiRatio.toFixed(4)}
  * Costo Adquisición Actualizado: $${paActualizado.toLocaleString('es-UY')} UYU
  * ITP Enajenante (2% de Catastro $${vCatVentaRaw.toLocaleString('es-UY')} * Coef. ${coef}): $${itpEnajenanteUYU.toLocaleString('es-UY')} UYU
  * Gastos Notariales Deducibles: $${gastNotRaw.toLocaleString('es-UY')} ${gastosNotarialesCurrency} ($${gastNotUYU.toLocaleString('es-UY')} UYU)
  * Mejoras Comprobadas: $${mejorasRaw.toLocaleString('es-UY')} ${mejorasCurrency} ($${mejorasUYU.toLocaleString('es-UY')} UYU)
  * Deducciones Totales (Costo Indexado + ITP + Gastos + Mejoras): $${totalDeduccionesReal.toLocaleString('es-UY')} UYU
  * Margen Real Imponible: $${margenReal.toLocaleString('es-UY')} UYU
  * Impuesto Real (12%): $${impuestoRealUYU.toLocaleString('es-UY')} UYU`;

        let desglose = '';
        if (postReforma) {
          desglose = `=== REGIMEN REAL OBLIGATORIO (Ley 18.083) ===
Alerta: Régimen Real Obligatorio: Inmueble adquirido con posterioridad a la Reforma Tributaria (Ley 18.083)

${desgloseReal}

==================================================
RESULTADO DE LIQUIDACIÓN:
* Régimen Aplicado: REAL (Obligatorio por adquisición posterior al 01/07/2007)
* Impuesto Real (12%): $${impuestoRealUYU.toLocaleString('es-UY')} UYU`;
        } else {
          desglose = `=== ANÁLISIS DE OPTIMIZACIÓN FISCAL EN PARALELO ===
${desgloseFicto}

--------------------------------------------------
${desgloseReal}

==================================================
RESULTADO DE OPTIMIZACIÓN:
* Régimen Seleccionado por el Escribano: ${irpfVentaRegimen.toUpperCase()}
* Régimen Fiscalmente Óptimo recomendado: ${opcionMasConveniente.toUpperCase()}
* Diferencia/Ahorro potencial para el cliente: $${ahorroUYU.toLocaleString('es-UY')} UYU (USD ${(ahorroUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        }

        resultDetails = {
          type: 'IRPF_VENTA',
          label: `IRPF / IRNR Incremento Patrimonial (Venta Inmueble - Régimen ${regimenEfectivo.toUpperCase()})`,
          totalUYU,
          impuestoFictoUYU,
          impuestoRealUYU,
          opcionMasConveniente: postReforma ? 'real' : opcionMasConveniente,
          ahorroUYU: postReforma ? 0 : ahorroUYU,
          desglose,
          postReforma
        };
      } else if (taxType === 'irpf_alquiler') {
        const alquilerRaw = parseLocaleFloat(montoAlquiler, 0);
        const deduciblesRaw = parseLocaleFloat(gastosDeducibles, 0);

        const alquilerUYU = montoAlquilerCurrency === 'USD' ? alquilerRaw * usdRate : alquilerRaw;
        const deduciblesUYU = gastosDeduciblesCurrency === 'USD' ? deduciblesRaw * usdRate : deduciblesRaw;

        const baseImponible = Math.max(0, alquilerUYU - deduciblesUYU);
        const totalUYU = baseImponible * 0.12; // 12% sobre el bruto menos deducciones

        const desglose = `Liquidación: Arrendamientos (Alquileres - 12%)
- Monto del Alquiler Bruto: $${alquilerRaw.toLocaleString('es-UY')} ${montoAlquilerCurrency} ($${alquilerUYU.toLocaleString('es-UY')} UYU)
- Gastos Deducibles Admitidos: $${deduciblesRaw.toLocaleString('es-UY')} ${gastosDeduciblesCurrency} ($${deduciblesUYU.toLocaleString('es-UY')} UYU)
- Base Imponible Líquida: $${baseImponible.toLocaleString('es-UY')} UYU
- TOTAL IRPF/IRNR ALQUILER RETENIDO (12%): $${totalUYU.toLocaleString('es-UY')} UYU`;

        resultDetails = {
          type: 'IRPF_ALQUILER',
          label: 'IRPF / IRNR Arrendamientos (Alquileres)',
          totalUYU,
          desglose
        };
      } else if (taxType === 'transferencia_automotor') {
        const aforoRaw = parseLocaleFloat(aforoVehiculo, 0);
        const aforoUYU = aforoCurrency === 'USD' ? aforoRaw * usdRate : aforoRaw;
        const tasasRaw = parseLocaleFloat(tasasAsociadas, 0);

        const itpAutomotor = aforoUYU * 0.04; // 4% de aforo
        const totalUYU = itpAutomotor + tasasRaw;

        const desglose = `Liquidación: Transferencia de Automotores (4% de Aforo + Tasas)
- Valor de Aforo del Vehículo: $${aforoRaw.toLocaleString('es-UY')} ${aforoCurrency} ($${aforoUYU.toLocaleString('es-UY')} UYU)
- Impuesto a las Trasmisiones Patrimoniales (4%): $${itpAutomotor.toLocaleString('es-UY')} UYU
- Tasas Asociadas (Inscripción Registral/Intendencia): $${tasasRaw.toLocaleString('es-UY')} UYU
- TOTAL LIQUIDADO EN TRANSFERENCIA: $${totalUYU.toLocaleString('es-UY')} UYU`;

        resultDetails = {
          type: 'TRANSFERENCIA_AUTOMOTOR',
          label: 'Trasmisión Patrimonial de Automotores (Transferencia 4%)',
          totalUYU,
          desglose
        };
      }

      let headerStr = `==================================================
        TABELION - INFORME DE LIQUIDACIÓN FISCAL
==================================================\n`;

      if (taxReference.trim()) {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Referencia: ${taxReference.trim()}
Fecha: ${currentTimestamp}
---\n\n`;
      } else {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Fecha: ${currentTimestamp}
---\n\n`;
      }

      const reportText = headerStr + `Ecosistema: TABELION — El espacio inteligente del escribano Uruguayo
Servicio: Liquidación de Impuesto Manual

--------------------------------------------------
DETALLE DE IMPUESTO LIQUIDADO
--------------------------------------------------
Tipo de Impuesto: ${resultDetails.label}
${resultDetails.desglose}

--------------------------------------------------
TOTAL RETENEDOR A LIQUIDAR: $${resultDetails.totalUYU.toLocaleString('es-UY')} UYU
Equivalente en Dólares: USD ${(resultDetails.totalUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
--------------------------------------------------
Liquidación manual efectuada por el escribano y validada matemáticamente por el Hub.
==================================================`;

      setTaxResult({
        ...resultDetails,
        reportText,
        fecha: currentTimestamp
      });

      if (onCalculationComplete) {
        onCalculationComplete(reportText);
      }
      setTaxLoading(false);
    }, 400);
  };

  // --- LÓGICA CÁLCULO IRPF PERSONAL ---
  const handleCalculatePersonal = () => {
    if (onRefreshIndices) {
      onRefreshIndices();
    }
    setPersonalLoading(true);
    setPersonalResult(null);
    setPersonalShowPicker(false);
    setPersonalSyncSuccess(false);

    setTimeout(() => {
      const ingresos = parseLocaleFloat(ingresosPersonales, 0);
      const deducciones = parseLocaleFloat(deduccionesPersonales, 0);
      const currentTimestamp = getFormattedDate();

      const bpc = 6500;

      const brackets = [
        { limit: 7 * bpc, rate: 0.00 },
        { limit: 10 * bpc, rate: 0.10 },
        { limit: 15 * bpc, rate: 0.15 },
        { limit: 30 * bpc, rate: 0.24 },
        { limit: 50 * bpc, rate: 0.25 },
        { limit: 75 * bpc, rate: 0.27 },
        { limit: 115 * bpc, rate: 0.31 },
        { limit: Infinity, rate: 0.36 }
      ];

      let impuestoIngresos = 0;
      let remIngresos = ingresos;
      let prevLimit = 0;
      let detalleTramos = '';

      for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        const size = bracket.limit - prevLimit;
        const gravable = Math.min(remIngresos, size);
        
        if (gravable > 0) {
          const impuestoTramo = gravable * bracket.rate;
          impuestoIngresos += impuestoTramo;
          
          const rangoStr = bracket.limit === Infinity 
            ? `Más de $${prevLimit.toLocaleString('es-UY')}`
            : `$${prevLimit.toLocaleString('es-UY')} a $${bracket.limit.toLocaleString('es-UY')}`;

          detalleTramos += `- Tramo ${i + 1} (${rangoStr}) al ${(bracket.rate * 100)}%: Gravable $${gravable.toLocaleString('es-UY')} -> Impuesto $${impuestoTramo.toLocaleString('es-UY')} UYU\n`;
        }
        
        remIngresos -= gravable;
        if (remIngresos <= 0) break;
        prevLimit = bracket.limit;
      }

      const impuestoDeducciones = deducciones * 0.08;
      const totalUYU = Math.max(0, impuestoIngresos - impuestoDeducciones);

      const desglose = `Liquidación: IRPF Trabajo Dependiente (Categoría II)
Parámetros de Cálculo (BPC 2026: $${bpc} UYU):
- Ingresos Nominales Mensuales: $${ingresos.toLocaleString('es-UY')} UYU
- Deducciones Declaradas Mensuales: $${deducciones.toLocaleString('es-UY')} UYU

Tramos de Renta Gravados (Ingresos):
${detalleTramos}
Subtotal Impuesto s/Ingresos: $${impuestoIngresos.toLocaleString('es-UY')} UYU

Deducciones de Control:
- Total Deducciones Admitidas: $${deducciones.toLocaleString('es-UY')} UYU
- Tasa Fija de Deducción (8%): $${impuestoDeducciones.toLocaleString('es-UY')} UYU

==================================================
RESULTADO DE LIQUIDACIÓN DE IRPF PERSONAL:
* Impuesto s/Ingresos: $${impuestoIngresos.toLocaleString('es-UY')} UYU
* Crédito por Deducciones: $${impuestoDeducciones.toLocaleString('es-UY')} UYU
* TOTAL MENSUAL A LIQUIDAR (IRPF Neto): $${totalUYU.toLocaleString('es-UY')} UYU`;

      let headerStr = `==================================================
      TABELION - INFORME DE LIQUIDACIÓN DE IRPF PERSONAL
==================================================\n`;

      if (personalReference.trim()) {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Referencia: ${personalReference.trim()}
Fecha: ${currentTimestamp}
---\n\n`;
      } else {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Fecha: ${currentTimestamp}
---\n\n`;
      }

      const reportText = headerStr + `Ecosistema: TABELION — El espacio inteligente del escribano Uruguayo
Servicio: Estimador de IRPF Trabajo Dependiente (Categoría II)

--------------------------------------------------
DESGLOSE DE IMPUESTO
--------------------------------------------------
${desglose}

--------------------------------------------------
TOTAL IRPF NETO MENSUAL A RETENER: $${totalUYU.toLocaleString('es-UY')} UYU
Equivalente en Dólares: USD ${(totalUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
--------------------------------------------------
Cálculo simulado bajo los tramos progresivos mensuales de IRPF vigentes en Uruguay.
==================================================`;

      setPersonalResult({
        totalUYU,
        impuestoIngresos,
        impuestoDeducciones,
        desglose,
        reportText,
        fecha: currentTimestamp
      });

      if (onCalculationComplete) {
        onCalculationComplete(reportText);
      }
      setPersonalLoading(false);
    }, 400);
  };

  // --- LÓGICA CÁLCULO HONORARIOS ---
  const handleCalculateFees = () => {
    if (onRefreshIndices) {
      onRefreshIndices();
    }
    setFeesLoading(true);
    setFeesResult(null);
    setFeesShowPicker(false);
    setFeesSyncSuccess(false);

    setTimeout(() => {
      const negocioRaw = parseLocaleFloat(montoNegocio, 0);
      const negocioUYU = montoNegocioCurrency === 'USD' ? negocioRaw * usdRate : negocioRaw;
      const currentTimestamp = getFormattedDate();

      const baseFeeRate = aplicaComplejidad ? 0.045 : 0.03;
      let baseFeeUYU = negocioUYU * baseFeeRate;
      let descArancel = `3% sobre el monto del negocio ($${negocioUYU.toLocaleString('es-UY')} UYU)`;

      if (aplicaComplejidad) {
        if (baseFeeUYU < 15000) {
          baseFeeUYU = 15000;
          descArancel = `Mínimo arancelario garantizado de $15.000 UYU aplicado por complejidad.`;
        } else {
          descArancel = `4.5% sobre el monto del negocio por complejidad arancelaria (3% base + 50% recargo)`;
        }
      }

      const ivaUYU = baseFeeUYU * 0.22;
      const montepioUYU = baseFeeUYU * 0.075;
      const totalNetoUYU = baseFeeUYU + ivaUYU + montepioUYU;

      const desglose = `- Monto del Negocio Declarado: $${negocioRaw.toLocaleString('es-UY')} ${montoNegocioCurrency} ($${negocioUYU.toLocaleString('es-UY')} UYU)
- Honorarios Básicos Liquidados: $${baseFeeUYU.toLocaleString('es-UY')} UYU (${descArancel})
- IVA sobre Honorarios (22%): $${ivaUYU.toLocaleString('es-UY')} UYU
- Montepío Notarial AEU (7.5%): $${montepioUYU.toLocaleString('es-UY')} UYU
- TOTAL NETO PROFESIONAL: $${totalNetoUYU.toLocaleString('es-UY')} UYU`;

      let headerStr = `==================================================
      TABELION - LIQUIDACIÓN DE HONORARIOS PROFESIONALES
==================================================\n`;

      if (feesReference.trim()) {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Referencia: ${feesReference.trim()}
Fecha: ${currentTimestamp}
---\n\n`;
      } else {
        headerStr = `LIQUIDACIÓN DE GASTOS FISCALES Y HONORARIOS
Fecha: ${currentTimestamp}
---\n\n`;
      }

      const reportText = headerStr + `Ecosistema: TABELION — El espacio inteligente del escribano Uruguayo
Servicio: Arancel de la Asociación de Escribanos del Uruguay

--------------------------------------------------
DESGLOSE DE HONORARIOS Y APORTES
--------------------------------------------------
${desglose}

--------------------------------------------------
TOTAL NETO PROFESIONAL A COBRAR: $${totalNetoUYU.toLocaleString('es-UY')} UYU
Equivalente en Dólares: USD ${(totalNetoUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
--------------------------------------------------
Liquidación arancelaria efectuada bajo control manual del escribano.
==================================================`;

      setFeesResult({
        negocioUYU,
        baseFeeUYU,
        ivaUYU,
        montepioUYU,
        totalUYU: totalNetoUYU,
        desglose,
        reportText,
        fecha: currentTimestamp
      });

      if (onCalculationComplete) {
        onCalculationComplete(reportText);
      }
      setFeesLoading(false);
    }, 400);
  };

  const handlePrintPDF = (reportText: string, title: string) => {
    const printableHtml = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>${title} - TABELION</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;700;950&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 40px; 
              color: #111; 
              background: #fff; 
              line-height: 1.6;
              font-size: 10pt;
            }
            .header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 25px; }
            .header h1 { font-family: 'Cinzel', Georgia, serif; font-size: 18pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; }
            .header p { margin: 6px 0 0 0; font-size: 9pt; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
            pre { font-family: monospace; white-space: pre-wrap; font-size: 9.5pt; background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; color: #212529; }
            .footer { margin-top: 40px; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #e9ecef; padding-top: 12px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>TABELION — El espacio inteligente del escribano Uruguayo</h1>
            <p>${title}</p>
          </div>
          <pre>${reportText}</pre>
          <div class="footer">
            <p>Liquidación emitida en TABELION • Uruguay 2026</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([printableHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const newWin = window.open(url, '_blank');
    if (!newWin) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${getFormattedDate().replace(/\//g, '-')}.html`;
      a.click();
    }
  };

  const handleCopyText = async (text: string, setCopied: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAttachReport = (
    result: any,
    clientId: string,
    filenamePrefix: string,
    referenceText: string,
    setSuccess: (val: boolean) => void,
    setShow: (val: boolean) => void
  ) => {
    if (!result || !clientId) return;

    // Generate PDF using jsPDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Configurar fuentes monoespaciadas para preservar alineación del desglose
    doc.setFont("Courier", "normal");
    doc.setFontSize(9.5);

    const lines = result.reportText.split('\n');
    let y = 15;
    lines.forEach(line => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 15, y);
      y += 5.5;
    });

    const dataUrl = doc.output('datauristring');
    const pdfSize = doc.output().length;

    // Crear nombre de archivo sanitizado
    const cleanRef = referenceText.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Calculo';
    const fileName = `${filenamePrefix}_${cleanRef}_${result.fecha.replace(/\//g, '-')}.pdf`;

    dbInsertAttachment({
      cliente_id: clientId,
      name: fileName,
      mimeType: 'application/pdf',
      dataUrl,
      size: `${(pdfSize / 1024).toFixed(2)} KB`,
      uploadedAt: result.fecha
    });

    setSuccess(true);
    setTimeout(() => {
      setShow(false);
      setSuccess(false);
    }, 2000);
  };

  // Filtro de clientes reactivo para el selector (ignorando mayúsculas, minúsculas y tildes)
  const filterClients = (query: string) => {
    const normalizedQuery = normalizeText(query);
    return clientsList.filter(c => 
      normalizeText(c.name).includes(normalizedQuery) || 
      (c.email && normalizeText(c.email).includes(normalizedQuery))
    );
  };

  const handleClearTax = () => {
    setValRealCatastral('');
    setCoefReajuste('1.0');
    setPrecioVenta('');
    setPrecioAdq('');
    setFechaAdq('2005-05-15');
    setMejoras('');
    setMontoAlquiler('');
    setGastosDeducibles('');
    setTaxType('itp');
    setItpVariant('general');
    setIrpfVentaRegimen('ficto');
    setTaxReference('');
    setTaxResult(null);
    setTaxSearchQuery('');
    setTaxSelectedClientId('');
    setTaxShowPicker(false);
    setTaxSyncSuccess(false);
  };

  const handleClearFees = () => {
    setMontoNegocio('');
    setMontoNegocioCurrency('USD');
    setAplicaComplejidad(false);
    setFeesReference('');
    setFeesResult(null);
    setFeesSearchQuery('');
    setFeesSelectedClientId('');
    setFeesShowPicker(false);
    setFeesSyncSuccess(false);
  };

  const handleClearPersonal = () => {
    setIngresosPersonales('');
    setDeduccionesPersonales('');
    setPersonalReference('');
    setPersonalResult(null);
    setPersonalSearchQuery('');
    setPersonalSelectedClientId('');
    setPersonalShowPicker(false);
    setPersonalSyncSuccess(false);
  };

  return (
    <div className="space-y-6 h-full flex flex-col font-sans">
      
      {/* Cabezal de la Suite (Siempre Visible) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-tabelion font-bold text-[#0f172a] uppercase tracking-[0.14em]">Liquidación Notarial</h1>
          <p className="text-[#475569] text-sm font-medium">Tributos, honorarios arancelarios y estimación de IRPF</p>
        </div>
        
        {/* Ticker de Cotizaciones de Referencia */}
        <div className="flex items-center gap-4 bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-xl text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
          <div className="flex items-center gap-2">
            <Coins className="text-blue-500" size={14} />
            <span>USD: <span className="font-mono text-white">${usdRate.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UYU</span></span>
          </div>
          <div className="w-[1px] h-4 bg-neutral-800"></div>
          <div>
            <span>UI: <span className="font-mono text-white">${uiRate.toLocaleString('es-UY', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} UYU</span></span>
          </div>
        </div>
      </div>

      {/* DASHBOARD DE SELECCIÓN (Cuando no hay modo seleccionado) */}
      {selectedMode === 'dashboard' ? (
        <div className="flex-1 flex flex-col justify-center items-center py-12 px-4">
          <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tarjeta 1: Tributario */}
            <button
              onClick={() => {
                setSelectedMode('tributario');
                setTaxResult(null);
              }}
              className="bg-[#f6f8fc] border border-[#cbd5e1] hover:border-[#3b82f6] p-8 rounded-3xl text-left transition-all duration-300 hover:shadow-[0_12px_32px_-8px_rgba(29,78,216,0.12)] group relative overflow-hidden flex flex-col justify-between min-h-[240px] cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-300">
                <Receipt size={24} />
              </div>
              <div className="space-y-2 mt-8">
                <h3 className="text-base font-bold text-[#0f172a] uppercase tracking-wider">Tributario</h3>
                <p className="text-[#475569] text-xs leading-relaxed font-medium">
                  Liquidación de ITP, IRPF/IRNR por incremento patrimonial, arrendamientos y trasmisiones patrimoniales de automotores.
                </p>
              </div>
            </button>

            {/* Tarjeta 2: Honorarios y Reajustes */}
            <button
              onClick={() => {
                setSelectedMode('honorarios');
                setFeesResult(null);
              }}
              className="bg-[#f6f8fc] border border-[#cbd5e1] hover:border-[#059669] p-8 rounded-3xl text-left transition-all duration-300 hover:shadow-[0_12px_32px_-8px_rgba(5,150,105,0.12)] group relative overflow-hidden flex flex-col justify-between min-h-[240px] cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                <Scale size={24} />
              </div>
              <div className="space-y-2 mt-8">
                <h3 className="text-base font-bold text-[#0f172a] uppercase tracking-wider">Honorarios y Reajustes</h3>
                <p className="text-[#475569] text-xs leading-relaxed font-medium">
                  Cálculo de honorarios notariales regulados por el arancel de la AEU, aportes de montepío e IVA aplicable.
                </p>
              </div>
            </button>

            {/* Tarjeta 3: IRPF Personal */}
            <button
              onClick={() => {
                setSelectedMode('irpf_personal');
                setPersonalResult(null);
              }}
              className="bg-[#f6f8fc] border border-[#cbd5e1] hover:border-[#1e3a8a] p-8 rounded-3xl text-left transition-all duration-300 hover:shadow-[0_12px_32px_-8px_rgba(30,58,138,0.12)] group relative overflow-hidden flex flex-col justify-between min-h-[240px] cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform duration-300">
                <Coins size={24} />
              </div>
              <div className="space-y-2 mt-8">
                <h3 className="text-base font-bold text-[#0f172a] uppercase tracking-wider">IRPF Personal</h3>
                <p className="text-[#475569] text-xs leading-relaxed font-medium">
                  Estimador progresivo mensual de retenciones sobre rendimientos del trabajo dependiente en Uruguay.
                </p>
              </div>
            </button>

          </div>
        </div>
      ) : (
        // FORMULARIO DINÁMICO DE MODO SELECCIONADO
        <div className="space-y-6 flex-1 flex flex-col">
          
          {/* Fila superior de navegación */}
          <div>
            <button
              onClick={() => setSelectedMode('dashboard')}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              ← Volver al Dashboard
            </button>
          </div>

          {/* BLOQUE FIJO SUPERIOR: Identificación del Acto */}
          <div className="bg-[#f6f8fc] border border-[#cbd5e1] rounded-[1.5rem] p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-[0.16em] border-b border-[#cbd5e1] pb-2">
              Identificación del Acto / Expediente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#334155] font-bold uppercase tracking-wider">Padrón catastral</label>
                <input
                  type="text"
                  value={padron}
                  onChange={(e) => setPadron(e.target.value)}
                  placeholder="Ej: 4015"
                  className="w-full h-10 bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-blue-500 placeholder:text-[#94a3b8]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#334155] font-bold uppercase tracking-wider">Localidad / Departamento</label>
                <input
                  type="text"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Ej: Maldonado"
                  className="w-full h-10 bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-blue-500 placeholder:text-[#94a3b8]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#334155] font-bold uppercase tracking-wider">Referencia / Padrones Anexos</label>
                <input
                  type="text"
                  value={padronesAnexos}
                  onChange={(e) => setPadronesAnexos(e.target.value)}
                  placeholder="Ej: Garage G4, Box B12"
                  className="w-full h-10 bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-blue-500 placeholder:text-[#94a3b8]"
                />
              </div>
            </div>
          </div>

          {/* VISTAS DE FORMULARIOS ESPECÍFICOS */}
          
          {/* MODO TRIBUTARIO */}
          {selectedMode === 'tributario' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
              
              {/* Formulario Izquierda */}
              <div className="lg:col-span-6 bg-[#f6f8fc] border border-neutral-800/80 rounded-[1.5rem] p-6 shadow-2xl flex flex-col space-y-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40"></div>
                
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    <Receipt className="text-blue-500" size={12} />
                    Liquidación de Impuestos Notariales
                  </h3>
                  <span className="text-[8px] bg-blue-950/40 text-blue-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">Tributario</span>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Tipo de Impuesto a Liquidar</label>
                    <select
                      value={taxType}
                      onChange={(e: any) => {
                        setTaxType(e.target.value);
                        setTaxResult(null);
                      }}
                      className="w-full h-11 bg-neutral-950 border border-neutral-850 rounded-xl px-3 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="itp">ITP (Impuesto a las Trasmisiones Patrimoniales)</option>
                      <option value="irpf_venta">IRPF / IRNR - Incremento Patrimonial (Venta de Inmuebles)</option>
                      <option value="irpf_alquiler">IRPF / IRNR - Arrendamientos (Alquileres)</option>
                      <option value="transferencia_automotor">Cálculo Especial: Transferencia Automotor</option>
                    </select>
                  </div>

                  {/* A) OPCIÓN ITP */}
                  {taxType === 'itp' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Variante Liquidada</label>
                        <select
                          value={itpVariant}
                          onChange={(e: any) => setItpVariant(e.target.value)}
                          className="w-full h-10 bg-neutral-950/60 border border-neutral-850 rounded-xl px-3 text-xs font-medium text-neutral-200 cursor-pointer focus:outline-none"
                        >
                          <option value="general">Enajenantes y Adquirentes generales (2% cada uno)</option>
                          <option value="sucesiones">Herederos y Legatarios en sucesiones (3%)</option>
                          <option value="donatarios">Donatarios (4%)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Valor Real Catastral</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                            <input
                              type="number"
                              value={valRealCatastral}
                              onChange={(e) => setValRealCatastral(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Coef. de Reajuste / IPC</label>
                          <input
                            type="number"
                            step="0.001"
                            value={coefReajuste}
                            onChange={(e) => setCoefReajuste(e.target.value)}
                            className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl px-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                            placeholder="1.000"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* B) OPCIÓN IRPF VENTA */}
                  {taxType === 'irpf_venta' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Precio de Venta</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                              <input
                                type="number"
                                value={precioVenta}
                                onChange={(e) => setPrecioVenta(e.target.value)}
                                className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                              />
                            </div>
                            <select
                              value={precioVentaCurrency}
                              onChange={(e: any) => setPrecioVentaCurrency(e.target.value)}
                              className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                            >
                              <option value="USD">USD</option>
                              <option value="UYU">UYU</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Precio Adq. Original</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                              <input
                                type="number"
                                value={precioAdq}
                                onChange={(e) => setPrecioAdq(e.target.value)}
                                className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                              />
                            </div>
                            <select
                              value={precioAdqCurrency}
                              onChange={(e: any) => setPrecioAdqCurrency(e.target.value)}
                              className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                            >
                              <option value="USD">USD</option>
                              <option value="UYU">UYU</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Fecha Adquisición</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={14} />
                            <input
                              type="date"
                              value={fechaAdq}
                              onChange={(e) => setFechaAdq(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-9 pr-2 text-xs text-white focus:outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Mejoras Comprobadas</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                              <input
                                type="number"
                                value={mejoras}
                                onChange={(e) => setMejoras(e.target.value)}
                                className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                              />
                            </div>
                            <select
                              value={mejorasCurrency}
                              onChange={(e: any) => setMejorasCurrency(e.target.value)}
                              className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                            >
                              <option value="USD">USD</option>
                              <option value="UYU">UYU</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Valor Catastral (UYU)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                            <input
                              type="number"
                              value={valCatastralVenta}
                              onChange={(e) => setValCatastralVenta(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Gastos Notariales Deducibles</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                              <input
                                type="number"
                                value={gastosNotariales}
                                onChange={(e) => setGastosNotariales(e.target.value)}
                                className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                              />
                            </div>
                            <select
                              value={gastosNotarialesCurrency}
                              onChange={(e: any) => setGastosNotarialesCurrency(e.target.value)}
                              className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                            >
                              <option value="USD">USD</option>
                              <option value="UYU">UYU</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="bg-[#eaeff7] p-3.5 border border-neutral-850 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                          <span>Opción de Régimen (IRPF)</span>
                          {isPostReforma(fechaAdq) ? (
                            <span className="text-[8px] bg-amber-950/40 border border-amber-900/30 text-amber-400 px-2 py-0.5 rounded font-black">REAL OBLIGATORIO</span>
                          ) : (
                            <span className="text-[8px] bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-black">DERECHO DE OPCIÓN</span>
                          )}
                        </div>
                        <div className="flex gap-2 p-1 bg-neutral-900 rounded-lg">
                          <button
                            type="button"
                            disabled={isPostReforma(fechaAdq)}
                            onClick={() => setIrpfVentaRegimen('ficto')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${
                              isPostReforma(fechaAdq)
                                ? 'text-neutral-700 cursor-not-allowed'
                                : irpfVentaRegimen === 'ficto'
                                  ? 'bg-blue-600 text-white' 
                                  : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            Régimen Ficto (1.8% s/Venta)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIrpfVentaRegimen('real')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${
                              irpfVentaRegimen === 'real'
                                ? 'bg-blue-600 text-white' 
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            Régimen Real (12% s/Incremento)
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* C) OPCIÓN IRPF ALQUILER */}
                  {taxType === 'irpf_alquiler' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Monto Alquiler</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                            <input
                              type="number"
                              value={montoAlquiler}
                              onChange={(e) => setMontoAlquiler(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                          <select
                            value={montoAlquilerCurrency}
                            onChange={(e: any) => setMontoAlquilerCurrency(e.target.value)}
                            className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                          >
                            <option value="UYU">UYU</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Gastos Deducibles</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                            <input
                              type="number"
                              value={gastosDeducibles}
                              onChange={(e) => setGastosDeducibles(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                          <select
                            value={gastosDeduciblesCurrency}
                            onChange={(e: any) => setGastosDeduciblesCurrency(e.target.value)}
                            className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                          >
                            <option value="UYU">UYU</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* D) OPCIÓN TRANSFERENCIA AUTOMOTOR */}
                  {taxType === 'transferencia_automotor' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Aforo del Vehículo</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                            <input
                              type="number"
                              value={aforoVehiculo}
                              onChange={(e) => setAforoVehiculo(e.target.value)}
                              className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                            />
                          </div>
                          <select
                            value={aforoCurrency}
                            onChange={(e: any) => setAforoCurrency(e.target.value)}
                            className="w-20 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-400 focus:outline-none"
                          >
                            <option value="USD">USD</option>
                            <option value="UYU">UYU</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 col-span-1">
                        <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Tasas Registrales / Municipales</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                          <input
                            type="number"
                            value={tasasAsociadas}
                            onChange={(e) => setTasasAsociadas(e.target.value)}
                            className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-2 text-xs font-mono text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Texto de referencia / Identificación del cálculo */}
                  <div className="space-y-1.5 mt-4">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Identificación del cálculo / Referencia (Opcional)</label>
                    <input
                      type="text"
                      value={taxReference}
                      onChange={(e) => setTaxReference(e.target.value)}
                      placeholder="Ej: Compraventa García o Automotor Matrícula SBG1234"
                      className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-750"
                    />
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={handleClearTax}
                      className="py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={handleCalculateTax}
                      disabled={taxLoading}
                      className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {taxLoading ? 'Procesando...' : 'Calcular Impuestos'}
                    </button>
                  </div>

                </div>
              </div>

              {/* Panel de Resultados Derecha */}
              <div className="lg:col-span-6 flex flex-col justify-start">
                {taxResult ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Tarjeta de resultado principal */}
                    <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-2xl space-y-4">
                      {taxResult.type === 'IRPF_VENTA' && (
                        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl space-y-3">
                          {taxResult.postReforma ? (
                            <div className="p-2.5 bg-amber-950/15 border border-amber-900/30 rounded-lg text-[9px] text-amber-400 leading-normal font-bold">
                              Régimen Real Obligatorio por fecha de adquisición posterior a la reforma.
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center pb-2 border-b border-neutral-800 text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                                <span>Simulación de tramos óptimos</span>
                                <span className="text-emerald-400">Recomendado: {taxResult.opcionMasConveniente.toUpperCase()}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className={`p-3 rounded-lg border ${irpfVentaRegimen === 'ficto' ? 'bg-blue-950/20 border-blue-500/30' : 'bg-neutral-950/40 border-neutral-850'}`}>
                                  <span className="block text-[8px] text-neutral-500 uppercase font-black">Ficto</span>
                                  <span className="font-mono font-bold text-neutral-200 block mt-1">$ {taxResult.impuestoFictoUYU.toLocaleString('es-UY')}</span>
                                </div>
                                <div className={`p-3 rounded-lg border ${irpfVentaRegimen === 'real' ? 'bg-blue-950/20 border-blue-500/30' : 'bg-neutral-950/40 border-neutral-850'}`}>
                                  <span className="block text-[8px] text-neutral-500 uppercase font-black">Real</span>
                                  <span className="font-mono font-bold text-neutral-200 block mt-1">$ {taxResult.impuestoRealUYU.toLocaleString('es-UY')}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-blue-600/[0.02] border border-blue-500/10 p-5 rounded-xl">
                        <div>
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block">Impuesto Total Retenido</span>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block mt-1">Liquidado a la fecha</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-mono font-black text-blue-400 block leading-none">
                            $ {taxResult.totalUYU.toLocaleString('es-UY', { minimumFractionDigits: 2 })} <span className="text-[10px] font-sans font-bold text-neutral-500">UYU</span>
                          </span>
                          <span className="text-[9px] font-mono text-neutral-600 block mt-1">
                            ~ USD {(taxResult.totalUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Desglose de Operación</span>
                        <pre className="text-[10px] font-mono leading-relaxed text-neutral-300 whitespace-pre-wrap bg-neutral-900 p-3.5 border border-neutral-850 rounded-xl max-h-[160px] overflow-y-auto">
                          {taxResult.desglose}
                        </pre>
                      </div>

                      {/* Botones de acción del informe */}
                      <div className="flex gap-2 pt-2 border-t border-neutral-900">
                        <button
                          onClick={() => handlePrintPDF(taxResult.reportText, taxResult.label)}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                        >
                          Descargar PDF
                        </button>
                        <button
                          onClick={() => handleCopyText(taxResult.reportText, setTaxCopied)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 ${
                            taxCopied ? 'bg-emerald-600 text-white border-transparent' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {taxCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                        <button
                          onClick={() => setTaxShowPicker(!taxShowPicker)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 cursor-pointer ${
                            taxShowPicker ? 'bg-blue-600/20 text-blue-400 border-blue-500/20' : 'bg-neutral-900 text-neutral-300 hover:text-white'
                          }`}
                        >
                          {taxShowPicker ? 'Cerrar' : 'Adjuntar'}
                        </button>
                      </div>

                      {/* Selector de Cliente para Adjunto */}
                      <AnimatePresence>
                        {taxShowPicker && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-neutral-900/60 p-3 border border-neutral-850 rounded-xl space-y-3 mt-2 overflow-hidden">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Vincular al Historial del Cliente</span>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
                              <input
                                type="text"
                                value={taxSearchQuery}
                                onChange={(e) => setTaxSearchQuery(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full h-8 pl-8 pr-3 bg-neutral-950 border border-neutral-850 rounded-lg text-[10px] text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={taxSelectedClientId}
                                onChange={(e) => setTaxSelectedClientId(e.target.value)}
                                className="flex-1 h-9 bg-neutral-950 border border-neutral-850 rounded-lg px-2 text-[10px] text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">Seleccione contacto...</option>
                                {filterClients(taxSearchQuery).map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAttachReport(taxResult, taxSelectedClientId, `Liquidacion_Fiscal_${taxType.toUpperCase()}`, taxReference, setTaxSyncSuccess, setTaxShowPicker)}
                                disabled={!taxSelectedClientId}
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-950 disabled:text-neutral-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Guardar
                              </button>
                            </div>
                            {taxSyncSuccess && (
                              <div className="p-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider text-center">
                                ✓ ¡Informe guardado en la ficha del cliente con éxito!
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full border-2 border-dashed border-neutral-850 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-neutral-600 min-h-[250px]">
                    <Info size={32} className="text-neutral-700" />
                    <p className="text-[10px] font-black uppercase tracking-wider mt-4">Esperando Liquidación</p>
                    <p className="text-xs max-w-[240px] mt-1">Introduce los parámetros catastrales e impositivos a la izquierda y presiona calcular.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* MODO HONORARIOS */}
          {selectedMode === 'honorarios' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
              
              {/* Formulario Izquierda */}
              <div className="lg:col-span-6 bg-[#f6f8fc] border border-neutral-800/80 rounded-[1.5rem] p-6 shadow-2xl flex flex-col space-y-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-40"></div>
                
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    <Scale className="text-emerald-500" size={12} />
                    Liquidación de Honorarios Profesionales
                  </h3>
                  <span className="text-[8px] bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">Arancel AEU</span>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Monto del Negocio / Operación</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                        <input
                          type="number"
                          value={montoNegocio}
                          onChange={(e) => setMontoNegocio(e.target.value)}
                          className="w-full h-11 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                          placeholder="0"
                        />
                      </div>
                      <select
                        value={montoNegocioCurrency}
                        onChange={(e: any) => setMontoNegocioCurrency(e.target.value)}
                        className="w-24 bg-neutral-950 border border-neutral-850 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="UYU">UYU ($)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 p-3.5 bg-neutral-950 rounded-xl border border-neutral-850 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aplicaComplejidad}
                      onChange={(e) => setAplicaComplejidad(e.target.checked)}
                      className="mt-0.5 accent-emerald-500 shrink-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-[10px] font-black text-neutral-300 uppercase tracking-wide block">
                        Aplica Complejidad / Mínimo Arancelario
                      </span>
                      <span className="text-[8px] text-neutral-500 font-medium leading-relaxed block mt-0.5">
                        Aplica recargo arancelario de 50% extra (tasa efectiva del 4.5%) y garantiza un honorario mínimo de $15.000 UYU.
                      </span>
                    </div>
                  </label>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Identificación del cálculo / Referencia (Opcional)</label>
                    <input
                      type="text"
                      value={feesReference}
                      onChange={(e) => setFeesReference(e.target.value)}
                      placeholder="Ej: Sucesión González o Compraventa Padrón 9102"
                      className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-750"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={handleClearFees}
                      className="py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={handleCalculateFees}
                      disabled={feesLoading}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {feesLoading ? 'Procesando...' : 'Calcular Honorarios'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel de Resultados Derecha */}
              <div className="lg:col-span-6 flex flex-col justify-start">
                {feesResult ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-2xl space-y-4">
                      
                      <div className="flex justify-between items-center bg-emerald-600/[0.02] border border-emerald-500/10 p-5 rounded-xl">
                        <div>
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block">Total Neto Profesional</span>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block mt-1">Aportes e impuestos incluidos</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-mono font-black text-emerald-400 block leading-none">
                            $ {feesResult.totalUYU.toLocaleString('es-UY', { minimumFractionDigits: 2 })} <span className="text-[10px] font-sans font-bold text-neutral-500">UYU</span>
                          </span>
                          <span className="text-[9px] font-mono text-neutral-600 block mt-1">
                            ~ USD {(feesResult.totalUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-neutral-900/50 p-3 border border-neutral-850 rounded-xl text-center">
                        <div>
                          <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest block">Arancel</span>
                          <span className="text-xs font-mono font-bold text-white block mt-1">$ {feesResult.baseFeeUYU.toLocaleString('es-UY')}</span>
                        </div>
                        <div className="border-x border-neutral-850">
                          <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest block">IVA (22%)</span>
                          <span className="text-xs font-mono font-bold text-white block mt-1">$ {feesResult.ivaUYU.toLocaleString('es-UY')}</span>
                        </div>
                        <div>
                          <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest block">Montepío (7.5%)</span>
                          <span className="text-xs font-mono font-bold text-white block mt-1">$ {feesResult.montepioUYU.toLocaleString('es-UY')}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Desglose Técnico</span>
                        <pre className="text-[10px] font-mono leading-relaxed text-neutral-300 whitespace-pre-wrap bg-neutral-900 p-3.5 border border-neutral-850 rounded-xl max-h-[160px] overflow-y-auto">
                          {feesResult.desglose}
                        </pre>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-neutral-900">
                        <button
                          onClick={() => handlePrintPDF(feesResult.reportText, 'Liquidación de Honorarios Profesionales')}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer animate-pulse"
                        >
                          Descargar PDF
                        </button>
                        <button
                          onClick={() => handleCopyText(feesResult.reportText, setFeesCopied)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 ${
                            feesCopied ? 'bg-emerald-600 text-white border-transparent' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {feesCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                        <button
                          onClick={() => setFeesShowPicker(!feesShowPicker)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 cursor-pointer ${
                            feesShowPicker ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20' : 'bg-neutral-900 text-neutral-300 hover:text-white'
                          }`}
                        >
                          {feesShowPicker ? 'Cerrar' : 'Adjuntar'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {feesShowPicker && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-neutral-900/60 p-3 border border-neutral-850 rounded-xl space-y-3 mt-2 overflow-hidden">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Vincular al Historial del Cliente</span>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
                              <input
                                type="text"
                                value={feesSearchQuery}
                                onChange={(e) => setFeesSearchQuery(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full h-8 pl-8 pr-3 bg-neutral-950 border border-neutral-850 rounded-lg text-[10px] text-white focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={feesSelectedClientId}
                                onChange={(e) => setFeesSelectedClientId(e.target.value)}
                                className="flex-1 h-9 bg-neutral-950 border border-neutral-850 rounded-lg px-2 text-[10px] text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">Seleccione contacto...</option>
                                {filterClients(feesSearchQuery).map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAttachReport(feesResult, feesSelectedClientId, 'Liquidacion_Honorarios_AEU', feesReference, setFeesSyncSuccess, setFeesShowPicker)}
                                disabled={!feesSelectedClientId}
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-950 disabled:text-neutral-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Guardar
                              </button>
                            </div>
                            {feesSyncSuccess && (
                              <div className="p-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider text-center">
                                ✓ ¡Informe guardado en la ficha del cliente con éxito!
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full border-2 border-dashed border-neutral-850 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-neutral-600 min-h-[250px]">
                    <Info size={32} className="text-neutral-700" />
                    <p className="text-[10px] font-black uppercase tracking-wider mt-4">Esperando liquidación</p>
                    <p className="text-xs max-w-[240px] mt-1">Introduce el monto de la operación y el arancel base a la izquierda y presiona calcular.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* MODO IRPF PERSONAL */}
          {selectedMode === 'irpf_personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
              
              {/* Formulario Izquierda */}
              <div className="lg:col-span-6 bg-[#f6f8fc] border border-neutral-800/80 rounded-[1.5rem] p-6 shadow-2xl flex flex-col space-y-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-40"></div>
                
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    <Coins className="text-amber-500" size={12} />
                    Estimador de IRPF Personal (Trabajo)
                  </h3>
                  <span className="text-[8px] bg-amber-950/40 text-amber-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">Categoría II</span>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Ingresos Mensuales Nominales (UYU)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                      <input
                        type="number"
                        value={ingresosPersonales}
                        onChange={(e) => setIngresosPersonales(e.target.value)}
                        className="w-full h-11 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Deducciones Mensuales Admitidas (UYU)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">$</span>
                      <input
                        type="number"
                        value={deduccionesPersonales}
                        onChange={(e) => setDeduccionesPersonales(e.target.value)}
                        className="w-full h-11 bg-neutral-950 border border-neutral-850 rounded-xl pl-7 pr-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[8px] text-neutral-600 leading-normal block">
                      Incluye aportes jubilatorios personales, Fonasa, FRL y fictos por hijos a cargo (Categoría II).
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Identificación del cálculo / Referencia (Opcional)</label>
                    <input
                      type="text"
                      value={personalReference}
                      onChange={(e) => setPersonalReference(e.target.value)}
                      placeholder="Ej: Planilla Mensual Julio 2026"
                      className="w-full h-10 bg-neutral-950 border border-neutral-850 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-neutral-750"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={handleClearPersonal}
                      className="py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={handleCalculatePersonal}
                      disabled={personalLoading}
                      className="py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {personalLoading ? 'Procesando...' : 'Calcular IRPF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel de Resultados Derecha */}
              <div className="lg:col-span-6 flex flex-col justify-start">
                {personalResult ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-2xl space-y-4">
                      
                      <div className="flex justify-between items-center bg-amber-600/[0.02] border border-amber-500/10 p-5 rounded-xl">
                        <div>
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block">Impuesto IRPF Neto Mensual</span>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase block mt-1">Retención Progresiva estimada</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-mono font-black text-amber-400 block leading-none">
                            $ {personalResult.totalUYU.toLocaleString('es-UY', { minimumFractionDigits: 2 })} <span className="text-[10px] font-sans font-bold text-neutral-500">UYU</span>
                          </span>
                          <span className="text-[9px] font-mono text-neutral-600 block mt-1">
                            ~ USD {(personalResult.totalUYU / usdRate).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Desglose de Tramos y Control</span>
                        <pre className="text-[10px] font-mono leading-relaxed text-neutral-300 whitespace-pre-wrap bg-neutral-900 p-3.5 border border-neutral-850 rounded-xl max-h-[160px] overflow-y-auto">
                          {personalResult.desglose}
                        </pre>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-neutral-900">
                        <button
                          onClick={() => handlePrintPDF(personalResult.reportText, 'Liquidación de IRPF Personal')}
                          className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                        >
                          Descargar PDF
                        </button>
                        <button
                          onClick={() => handleCopyText(personalResult.reportText, setPersonalCopied)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 ${
                            personalCopied ? 'bg-emerald-600 text-white border-transparent' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {personalCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                        <button
                          onClick={() => setPersonalShowPicker(!personalShowPicker)}
                          className={`px-3 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-neutral-800 cursor-pointer ${
                            personalShowPicker ? 'bg-amber-600/20 text-amber-400 border-amber-500/20' : 'bg-neutral-900 text-neutral-300 hover:text-white'
                          }`}
                        >
                          {personalShowPicker ? 'Cerrar' : 'Adjuntar'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {personalShowPicker && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-neutral-900/60 p-3 border border-neutral-850 rounded-xl space-y-3 mt-2 overflow-hidden">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Vincular al Historial del Cliente</span>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
                              <input
                                type="text"
                                value={personalSearchQuery}
                                onChange={(e) => setPersonalSearchQuery(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full h-8 pl-8 pr-3 bg-neutral-950 border border-neutral-850 rounded-lg text-[10px] text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={personalSelectedClientId}
                                onChange={(e) => setPersonalSelectedClientId(e.target.value)}
                                className="flex-1 h-9 bg-neutral-950 border border-neutral-850 rounded-lg px-2 text-[10px] text-white focus:outline-none cursor-pointer"
                              >
                                <option value="">Seleccione contacto...</option>
                                {filterClients(personalSearchQuery).map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAttachReport(personalResult, personalSelectedClientId, 'Liquidacion_IRPF_Personal', personalReference, setPersonalSyncSuccess, setPersonalShowPicker)}
                                disabled={!personalSelectedClientId}
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-950 disabled:text-neutral-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Guardar
                              </button>
                            </div>
                            {personalSyncSuccess && (
                              <div className="p-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider text-center">
                                ✓ ¡Informe guardado en la ficha del cliente con éxito!
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full border-2 border-dashed border-neutral-850 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-neutral-600 min-h-[250px]">
                    <Info size={32} className="text-neutral-700" />
                    <p className="text-[10px] font-black uppercase tracking-wider mt-4">Esperando estimación</p>
                    <p className="text-xs max-w-[240px] mt-1">Introduce los ingresos nominales mensuales y deducciones de tu cliente a la izquierda y presiona calcular.</p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
};
