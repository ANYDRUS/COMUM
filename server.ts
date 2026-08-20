import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initialDataset } from "./src/data/initialData";
import { FullDataset, ExtractedEntitiesDraft, GoogleUser } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Persistent Data File Path
const DATA_FILE = path.join(process.cwd(), "geocomum_data.json");
const USERS_FILE = path.join(process.cwd(), "geocomum_users.json");
const GOOGLE_SPREADSHEET_ID = "1LB6am5MTMhlCLAjdXhmpOoubScjnGx5L7OqQwWcfbM4";

// Initial Authorized Users (Allowlist) with root admin alexandre.n.pedrozo@gmail.com
const DEFAULT_AUTHORIZED_USERS: GoogleUser[] = [
  {
    id: "admin-alexandre",
    name: "Alexandre N. Pedrozo",
    email: "alexandre.n.pedrozo@gmail.com",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    organization: "Ministério Público do Estado do Paraná (MPPR)",
    role: "admin",
    isAuthenticated: true,
  },
  {
    id: "admin-adilson",
    name: "Adilson Pedrozo",
    email: "adnpedrozo@mppr.mp.br",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    organization: "Ministério Público do Estado do Paraná (MPPR)",
    role: "admin",
    isAuthenticated: true,
  },
];

function loadAuthorizedUsers(): GoogleUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, "utf-8");
      const users: GoogleUser[] = JSON.parse(content);
      // Ensure root admin alexandre.n.pedrozo@gmail.com is always present and has admin role
      const rootExists = users.some(
        (u) => u.email.toLowerCase() === "alexandre.n.pedrozo@gmail.com"
      );
      if (!rootExists) {
        users.unshift(DEFAULT_AUTHORIZED_USERS[0]);
      } else {
        const root = users.find(
          (u) => u.email.toLowerCase() === "alexandre.n.pedrozo@gmail.com"
        );
        if (root) root.role = "admin";
      }
      return users;
    }
  } catch (err) {
    console.error("Error reading users file:", err);
  }
  saveAuthorizedUsers(DEFAULT_AUTHORIZED_USERS);
  return DEFAULT_AUTHORIZED_USERS;
}

function saveAuthorizedUsers(users: GoogleUser[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

let currentAuthorizedUsers = loadAuthorizedUsers();

// Robust CSV Parser for Google Sheets CSV Export
function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines: string[][] = [];
  let curLine: string[] = [];
  let curVal = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    const nextC = cleanText[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        curVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      curLine.push(curVal.trim());
      curVal = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && nextC === "\n") i++;
      curLine.push(curVal.trim());
      if (curLine.some((cell) => cell.length > 0)) lines.push(curLine);
      curLine = [];
      curVal = "";
    } else {
      curVal += c;
    }
  }
  if (curVal.length > 0 || curLine.length > 0) {
    curLine.push(curVal.trim());
    if (curLine.some((cell) => cell.length > 0)) lines.push(curLine);
  }
  return lines;
}

function cleanCell(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).replace(/^\uFEFF/, "").trim();
}

// Helper to create a dynamic header column mapper for Google Sheets rows
function createHeaderMapper(headerRow: string[] = []) {
  const normalizedHeaders = (headerRow || []).map((h) =>
    cleanCell(h)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  return (
    row: string[],
    candidateKeys: string[],
    fallbackPosIndexOrDefault: number | string = -1,
    defaultValue = ""
  ): string => {
    let fallbackPosIndex = -1;
    let defVal = defaultValue;

    if (typeof fallbackPosIndexOrDefault === "string") {
      defVal = fallbackPosIndexOrDefault;
    } else {
      fallbackPosIndex = fallbackPosIndexOrDefault;
    }

    // 1. Try EXACT match across candidate keys first
    for (const key of candidateKeys) {
      const normKey = key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const idx = normalizedHeaders.indexOf(normKey);
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && cleanCell(row[idx]) !== "") {
        return cleanCell(row[idx]);
      }
    }

    // 2. Try substring match (only for keys longer than 2 characters)
    for (const key of candidateKeys) {
      const normKey = key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normKey.length <= 2) continue;
      const idx = normalizedHeaders.findIndex((h) => h === normKey || (h.length > 2 && h.includes(normKey)));
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && cleanCell(row[idx]) !== "") {
        return cleanCell(row[idx]);
      }
    }

    // 3. Fallback to positional index if valid
    if (
      fallbackPosIndex >= 0 &&
      fallbackPosIndex < row.length &&
      row[fallbackPosIndex] !== undefined &&
      row[fallbackPosIndex] !== null &&
      cleanCell(row[fallbackPosIndex]) !== ""
    ) {
      return cleanCell(row[fallbackPosIndex]);
    }

    return defVal;
  };
}

function parseFormattedNumber(val: string, fallback = 0): number {
  if (!val || val.trim() === "") return fallback;
  const sanitized = val.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(sanitized);
  return isNaN(num) ? fallback : num;
}

// Fetch and consume all 5 tabs live from Google Sheets
async function fetchGoogleSheetsDataset(): Promise<FullDataset> {
  const fetchSheet = async (sheetName: string): Promise<string[][]> => {
    const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Falha ao carregar aba ${sheetName} da Planilha Google: status ${res.status}`);
      }
      const text = await res.text();
      return parseCSV(text);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const [comRows, evRows, movRows, pjRows, pfRows] = await Promise.all([
    fetchSheet("TB_COMUNIDADES"),
    fetchSheet("TB_EVENTO"),
    fetchSheet("TB_MOVIMENTO"),
    fetchSheet("TB_PJ"),
    fetchSheet("TB_PF"),
  ]);

  const comunidadesMap = new Map<string, any>();

  // Process TB_COMUNIDADES (ID_COMUNIDADE, NOM_COMUNIDADE, MUNICIPIO, LAT, LON)
  if (comRows.length > 1) {
    const getComVal = createHeaderMapper(comRows[0]);

    comRows.slice(1).forEach((r, idx) => {
      let rawId = getComVal(r, ["ID_COMUNIDADE", "ID", "COD_COMUNIDADE", "CODIGO"], 0, `COM_${idx + 1}`);
      if (comunidadesMap.has(String(rawId))) {
        rawId = `${rawId}_COM_${idx + 1}`;
      }
      const cod = getComVal(r, ["COD_COMUNIDADE", "CODIGO", "COD", "CD_COMUNIDADE"], -1, rawId);
      const nom = getComVal(r, ["NOM_COMUNIDADE", "NOME_COMUNIDADE", "NOME", "COMUNIDADE", "NOM_COM"], 1);
      const mun = getComVal(r, ["MUNICIPIO", "CIDADE", "MUNIC", "NOM_MUNICIPIO"], 2, "");
      const latStr = getComVal(r, ["LAT", "LATITUDE", "Y", "COORD_Y"], 3);
      const lonStr = getComVal(r, ["LON", "LONGITUDE", "LNG", "X", "COORD_X"], 4);
      const sit = getComVal(r, ["SITUACAO_URBANISTICA", "SITUACAO", "URBANISTICA", "SIT_URB"], 5, "Em cadastramento");
      const famStr = getComVal(r, ["FAMILIAS_ESTIMADAS", "FAMILIAS", "QTD_FAMILIAS"], 6, "0");
      const uf = getComVal(r, ["UF", "ESTADO"], 7, "PR");
      const dataCad = getComVal(r, ["DATA_CADASTRO", "DATA", "CADASTRADO_EM"], 8);

      const lat = parseFormattedNumber(latStr, 0);
      const lon = parseFormattedNumber(lonStr, 0);
      const familias = parseFormattedNumber(famStr, 0);

      const comName = nom || (cod ? `Comunidade ${cod}` : `Comunidade ${rawId}`);
      
      const com = {
        ID_COMUNIDADE: String(rawId),
        COD_COMUNIDADE: cod,
        NOM_COMUNIDADE: comName,
        MUNICIPIO: mun || "NÃO INFORMADO",
        UF: uf,
        LAT: lat,
        LON: lon,
        FAMILIAS_ESTIMADAS: familias,
        SITUACAO_URBANISTICA: sit,
        DATA_CADASTRO: dataCad || new Date().toISOString().slice(0, 10),
      };

      if (com.NOM_COMUNIDADE) {
        comunidadesMap.set(String(rawId), com);
      }
    });
  }

  // Process TB_EVENTO
  const getEvVal = createHeaderMapper(evRows[0]);
  const seenEvtIds = new Set<string>();
  const eventos: any[] = evRows.slice(1).map((r, idx) => {
    let idEvt = getEvVal(r, ["ID_EVENTO", "ID", "CODIGO_EVENTO"]) || `EVT_${idx + 1}`;
    if (seenEvtIds.has(String(idEvt))) {
      idEvt = `${idEvt}_EVT_${idx + 1}`;
    }
    seenEvtIds.add(String(idEvt));

    const dataEvt = getEvVal(r, ["DATA_EVENTO", "DATA", "DATA_EVT"]);
    const tipoEvt = getEvVal(r, ["TIPO_EVENTO", "TIPO", "CATEGORIA", "TP_EVENTO"], "AÇÃO JUDICIAL");
    const nomEvt = getEvVal(r, ["NOM_EVENTO", "NOME_EVENTO", "NOME", "TITULO", "DES_EVENTO"], "Evento");
    const desEvt = getEvVal(r, ["DES_EVENTO", "DESCRICAO", "DESC", "DESCRICAO_EVENTO"]);
    const idCom = getEvVal(r, ["ID_COMUNIDADE", "COMUNIDADE_ID", "ID_COM"]);
    const idPj = getEvVal(r, ["ID_PJ", "PJ_ID"]);
    const statusEvt = getEvVal(r, ["STATUS_EVENTO", "STATUS", "SITUACAO"], "Ativo");

    return {
      ID_EVENTO: String(idEvt),
      DATA_EVENTO: dataEvt,
      TIPO_EVENTO: tipoEvt,
      NOM_EVENTO: nomEvt,
      DES_EVENTO: desEvt || nomEvt,
      ID_COMUNIDADE: String(idCom),
      ID_PJ: idPj ? String(idPj) : null,
      STATUS_EVENTO: statusEvt,
    };
  });

  // Process TB_MOVIMENTO
  const getMovVal = createHeaderMapper(movRows[0]);
  const seenMovIds = new Set<string>();
  const movimentos: any[] = movRows.slice(1).map((r, idx) => {
    let idMov = getMovVal(r, ["ID_MOVIMENTO", "ID", "COD_MOVIMENTO"]) || `MOV_${idx + 1}`;
    if (seenMovIds.has(String(idMov))) {
      idMov = `${idMov}_MOV_${idx + 1}`;
    }
    seenMovIds.add(String(idMov));

    const dataMov = getMovVal(r, ["DATA_MOV", "DATA", "DATA_MOVIMENTO"]);
    const nomMov = getMovVal(r, ["NOM_MOV", "NOME_MOVIMENTO", "NOME", "DESCRICAO_MOVIMENTO"], "Movimento");
    const tipoMov = getMovVal(r, ["TIPO_MOV", "TIPO", "TIPO_MOVIMENTO"], "Atividade");
    const idEvt = getMovVal(r, ["ID_EVENTO", "EVENTO_ID", "ID_EVT"]);
    const descMov = getMovVal(r, ["DESC_MOV", "DESCRICAO", "DESC", "DESCRICAO_MOVIMENTO"]);
    const resp = getMovVal(r, ["RESPONSAVEL_MOV", "RESPONSAVEL", "LIDERANCA"]);

    return {
      ID_MOVIMENTO: String(idMov),
      DATA_MOV: dataMov,
      NOM_MOV: nomMov,
      TIPO_MOV: tipoMov,
      ID_EVENTO: String(idEvt),
      DESC_MOV: descMov || nomMov,
      RESPONSAVEL_MOV: resp || "Liderança Local",
    };
  });

  // Process TB_PJ
  const getPjVal = createHeaderMapper(pjRows[0]);
  const seenPjIds = new Set<string>();
  const pjs: any[] = pjRows.slice(1).map((r, idx) => {
    let idPj = getPjVal(r, ["ID_PJ", "ID"]) || `PJ_${idx + 1}`;
    if (seenPjIds.has(String(idPj))) {
      idPj = `${idPj}_PJ_${idx + 1}`;
    }
    seenPjIds.add(String(idPj));

    const nomPj = getPjVal(r, ["NOM_PJ", "NOME_PJ", "NOME", "RAZAO_SOCIAL", "ENTIDADE"], "Pessoa Jurídica");
    const tipoPj = getPjVal(r, ["TIPO_ENTIDADE", "TIPO", "CATEGORIA"], "Órgão / Entidade");

    return {
      ID_PJ: String(idPj),
      NOM_PJ: nomPj,
      TIPO_ENTIDADE: tipoPj,
    };
  });

  // Process TB_PF
  const getPfVal = createHeaderMapper(pfRows[0]);
  const seenPfIds = new Set<string>();
  const pfs: any[] = pfRows.slice(1).map((r, idx) => {
    let idPf = getPfVal(r, ["ID_PF", "ID"]) || `PF_${idx + 1}`;
    if (seenPfIds.has(String(idPf))) {
      idPf = `${idPf}_PF_${idx + 1}`;
    }
    seenPfIds.add(String(idPf));

    const nomPf = getPfVal(r, ["NOM_PF", "NOME_PF", "NOME", "PESSOA"], "Pessoa Física");
    const cargoPf = getPfVal(r, ["CARGO_FUNCAO", "CARGO", "FUNCAO"], "Membro / Servidor");
    const idPj = getPfVal(r, ["ID_PJ", "PJ_ID"]);

    return {
      ID_PF: String(idPf),
      NOM_PF: nomPf,
      CARGO_FUNCAO: cargoPf,
      ID_PJ: idPj ? String(idPj) : null,
    };
  });

  const comunidades = Array.from(comunidadesMap.values());

  return {
    comunidades,
    eventos,
    movimentos,
    pjs,
    pfs,
  };
}

// Helper to load dataset
function loadDataset(): FullDataset {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.comunidades) && parsed.comunidades.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading data file, resetting to initial dataset:", err);
  }
  saveDataset(initialDataset);
  return initialDataset;
}

// Helper to save dataset
function saveDataset(data: FullDataset) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}

// Initialize stored data
let currentDataset: FullDataset = loadDataset();
let lastSyncTimestamp: string = new Date().toISOString();

// Trigger background sync with Google Sheets on startup
(async () => {
  try {
    console.log("Sincronizando dados com a Planilha Google Oficial...");
    const sheetData = await fetchGoogleSheetsDataset();
    if (sheetData && sheetData.comunidades.length > 0) {
      currentDataset = sheetData;
      saveDataset(currentDataset);
      lastSyncTimestamp = new Date().toISOString();
      console.log(`Planilha Google carregada com sucesso! ${sheetData.comunidades.length} comunidades, ${sheetData.eventos.length} eventos, ${sheetData.movimentos.length} movimentos, ${sheetData.pjs.length} PJs e ${sheetData.pfs.length} PFs.`);
    }
  } catch (err) {
    console.error("Aviso: Não foi possível sincronizar no boot da aplicação, usando cache local:", err);
  }
})();

// Gemini Client Lazy / Safe Setup
function getGeminiAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("A chave GEMINI_API_KEY não está configurada no arquivo .env. Por favor, adicione GEMINI_API_KEY no arquivo .env para habilitar as funcionalidades de IA.");
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// --- API ROUTES ---

// 0. AUTHENTICATION & ACCESS CONTROL (Google Gatekeeper & Allowlist)
app.get("/api/auth/users", (req, res) => {
  res.json({ users: currentAuthorizedUsers });
});

app.post("/api/auth/verify", (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ authorized: false, error: "E-mail não fornecido." });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Always ensure alexandre.n.pedrozo@gmail.com is authorized as Administrator
    if (cleanEmail === "alexandre.n.pedrozo@gmail.com") {
      let adminUser = currentAuthorizedUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!adminUser) {
        adminUser = {
          id: "admin-alexandre",
          name: name || "Alexandre N. Pedrozo",
          email: "alexandre.n.pedrozo@gmail.com",
          avatar: avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          organization: "Ministério Público do Estado do Paraná (MPPR)",
          role: "admin",
          isAuthenticated: true,
        };
        currentAuthorizedUsers.unshift(adminUser);
        saveAuthorizedUsers(currentAuthorizedUsers);
      }
      return res.json({
        authorized: true,
        user: { ...adminUser, isAuthenticated: true },
        message: "Administrador autenticado com sucesso.",
      });
    }

    // Check if user is in authorized list
    const foundUser = currentAuthorizedUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (foundUser) {
      return res.json({
        authorized: true,
        user: { ...foundUser, isAuthenticated: true },
        message: "Usuário autorizado autenticado com sucesso.",
      });
    }

    // User is NOT in the allowlist
    return res.status(403).json({
      authorized: false,
      error: `Acesso não autorizado. O e-mail "${email}" não possui permissão para acessar o GeoCOMUM. Solicite autorização ao administrador Alexandre N. Pedrozo (alexandre.n.pedrozo@gmail.com).`,
    });
  } catch (err: any) {
    res.status(500).json({ authorized: false, error: err.message });
  }
});

app.post("/api/auth/users", (req, res) => {
  try {
    const { name, email, organization, role, avatar } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingIndex = currentAuthorizedUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    const newUserObj: GoogleUser = {
      id: existingIndex >= 0 ? currentAuthorizedUsers[existingIndex].id : `user-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      organization: organization ? organization.trim() : "Ministério Público do Estado do Paraná (MPPR)",
      role: role === "admin" ? "admin" : "viewer",
      avatar: avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      isAuthenticated: true,
    };

    if (existingIndex >= 0) {
      currentAuthorizedUsers[existingIndex] = newUserObj;
    } else {
      currentAuthorizedUsers.push(newUserObj);
    }

    saveAuthorizedUsers(currentAuthorizedUsers);
    res.json({ success: true, users: currentAuthorizedUsers, user: newUserObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/auth/users/:id/role", (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const userToUpdate = currentAuthorizedUsers.find((u) => u.id === id);
    if (!userToUpdate) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Root admin role cannot be downgraded
    if (userToUpdate.email.toLowerCase() === "alexandre.n.pedrozo@gmail.com" && role !== "admin") {
      return res.status(400).json({ error: "O administrador principal não pode ter sua função alterada." });
    }

    userToUpdate.role = role === "admin" ? "admin" : "viewer";
    saveAuthorizedUsers(currentAuthorizedUsers);

    res.json({ success: true, users: currentAuthorizedUsers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/auth/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const userToDelete = currentAuthorizedUsers.find((u) => u.id === id);

    if (!userToDelete) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Root admin cannot be deleted
    if (userToDelete.email.toLowerCase() === "alexandre.n.pedrozo@gmail.com") {
      return res.status(400).json({ error: "O administrador principal não pode ser removido do sistema." });
    }

    currentAuthorizedUsers = currentAuthorizedUsers.filter((u) => u.id !== id);
    saveAuthorizedUsers(currentAuthorizedUsers);

    res.json({ success: true, users: currentAuthorizedUsers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. GET FULL DATASET
app.get("/api/data", (req, res) => {
  res.json({
    ...currentDataset,
    meta: {
      lastSyncTimestamp,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${GOOGLE_SPREADSHEET_ID}/edit`,
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
    },
  });
});

// SYNC DIRECTLY FROM GOOGLE SHEETS (5 TABS)
app.post("/api/data/sync-sheets", async (req, res) => {
  try {
    const sheetData = await fetchGoogleSheetsDataset();
    if (sheetData && sheetData.comunidades.length > 0) {
      currentDataset = sheetData;
      saveDataset(currentDataset);
      lastSyncTimestamp = new Date().toISOString();
      return res.json({
        success: true,
        message: `Planilha Google sincronizada com sucesso! (${sheetData.comunidades.length} comunidades, ${sheetData.eventos.length} eventos, ${sheetData.movimentos.length} movimentos, ${sheetData.pjs.length} PJs, ${sheetData.pfs.length} PFs)`,
        dataset: currentDataset,
        lastSyncTimestamp,
      });
    }
    res.status(400).json({ error: "Nenhum dado válido retornado da Planilha Google." });
  } catch (err: any) {
    console.error("Erro ao sincronizar com Planilha Google:", err);
    res.status(500).json({ error: "Erro na sincronização com Google Sheets: " + err.message });
  }
});

// 2. SAVE OR UPDATE RECORD
app.post("/api/data/records", (req, res) => {
  try {
    const { table, action, record, id } = req.body;
    
    if (!["comunidades", "eventos", "movimentos", "pjs", "pfs"].includes(table)) {
      return res.status(400).json({ error: "Tabela inválida." });
    }

    const key = table as keyof FullDataset;
    let list = [...(currentDataset[key] as any[])];

    if (action === "create") {
      const newId = record.id || record.ID_COMUNIDADE || record.ID_EVENTO || record.ID_MOVIMENTO || record.ID_PJ || record.ID_PF || String(Date.now());
      const newRecord = { ...record };
      if (table === "comunidades" && !newRecord.ID_COMUNIDADE) newRecord.ID_COMUNIDADE = String(newId);
      if (table === "eventos" && !newRecord.ID_EVENTO) newRecord.ID_EVENTO = String(newId);
      if (table === "movimentos" && !newRecord.ID_MOVIMENTO) newRecord.ID_MOVIMENTO = String(newId);
      if (table === "pjs" && !newRecord.ID_PJ) newRecord.ID_PJ = String(newId);
      if (table === "pfs" && !newRecord.ID_PF) newRecord.ID_PF = String(newId);
      
      list.push(newRecord);
    } else if (action === "update") {
      const idProp = table === "comunidades" ? "ID_COMUNIDADE" :
                     table === "eventos" ? "ID_EVENTO" :
                     table === "movimentos" ? "ID_MOVIMENTO" :
                     table === "pjs" ? "ID_PJ" : "ID_PF";
      
      list = list.map((item) => (String(item[idProp]) === String(id) ? { ...item, ...record } : item));
    } else if (action === "delete") {
      const idProp = table === "comunidades" ? "ID_COMUNIDADE" :
                     table === "eventos" ? "ID_EVENTO" :
                     table === "movimentos" ? "ID_MOVIMENTO" :
                     table === "pjs" ? "ID_PJ" : "ID_PF";
      
      list = list.filter((item) => String(item[idProp]) !== String(id));
    }

    currentDataset = { ...currentDataset, [key]: list };
    saveDataset(currentDataset);

    res.json({ success: true, dataset: currentDataset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. BULK IMPORT / MERGE
app.post("/api/data/import", (req, res) => {
  try {
    const { newData, mode } = req.body; // mode = 'merge' | 'replace'
    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Dados inválidos para importação." });
    }

    if (mode === "replace") {
      currentDataset = {
        comunidades: newData.comunidades || [],
        eventos: newData.eventos || [],
        movimentos: newData.movimentos || [],
        pjs: newData.pjs || [],
        pfs: newData.pfs || [],
      };
    } else {
      // Merge
      const mergeArrays = (arr1: any[], arr2: any[], idKey: string) => {
        const map = new Map();
        (arr1 || []).forEach((item) => map.set(String(item[idKey]), item));
        (arr2 || []).forEach((item) => map.set(String(item[idKey]), { ...map.get(String(item[idKey])), ...item }));
        return Array.from(map.values());
      };

      currentDataset = {
        comunidades: mergeArrays(currentDataset.comunidades, newData.comunidades, "ID_COMUNIDADE"),
        eventos: mergeArrays(currentDataset.eventos, newData.eventos, "ID_EVENTO"),
        movimentos: mergeArrays(currentDataset.movimentos, newData.movimentos, "ID_MOVIMENTO"),
        pjs: mergeArrays(currentDataset.pjs, newData.pjs, "ID_PJ"),
        pfs: mergeArrays(currentDataset.pfs, newData.pfs, "ID_PF"),
      };
    }

    saveDataset(currentDataset);
    res.json({ success: true, dataset: currentDataset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GEMINI CHAT AI ("Inteligência Comum")
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { userMessage, selectedIds, contextMode } = req.body;
    const ai = getGeminiAI();

    // Prepare context
    let targetComunidades = currentDataset.comunidades;
    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      targetComunidades = currentDataset.comunidades.filter((c) =>
        selectedIds.includes(String(c.ID_COMUNIDADE))
      );
    }

    // Build relational context
    const contextData = targetComunidades.map((com) => {
      const evs = currentDataset.eventos
        .filter((e) => String(e.ID_COMUNIDADE) === String(com.ID_COMUNIDADE))
        .map((ev) => {
          const pj = currentDataset.pjs.find((p) => String(p.ID_PJ) === String(ev.ID_PJ)) || {
            ID_PJ: null,
            NOM_PJ: "Entidade Não Informada",
          };
          const movs = currentDataset.movimentos.filter((m) => String(m.ID_EVENTO) === String(ev.ID_EVENTO));
          const pfs = currentDataset.pfs.filter((f) => String(f.ID_PJ) === String(pj.ID_PJ));
          return {
            ID_EVENTO: ev.ID_EVENTO,
            NOM_EVENTO: ev.NOM_EVENTO,
            TIPO_EVENTO: ev.TIPO_EVENTO,
            DATA_EVENTO: ev.DATA_EVENTO,
            DES_EVENTO: ev.DES_EVENTO,
            pj,
            movimentos: movs,
            pfs,
          };
        });
      return {
        ID_COMUNIDADE: com.ID_COMUNIDADE,
        NOM_COMUNIDADE: com.NOM_COMUNIDADE,
        MUNICIPIO: com.MUNICIPIO,
        SITUACAO_URBANISTICA: com.SITUACAO_URBANISTICA,
        FAMILIAS_ESTIMADAS: com.FAMILIAS_ESTIMADAS,
        LAT: com.LAT,
        LON: com.LON,
        eventos: evs,
      };
    });

    const systemInstruction = `
ATUE COMO: Especialista em Planejamento Urbano, Meio Ambiente, Habitação Social e Comunidades.

OBJETIVO: Analisar os dados das comunidades fornecidas no contexto e responder à pergunta do usuário de forma didática, organizada e objetiva em português do Brasil.

REGRAS GERAIS E PROTOCOLOS DE DADOS:
1. Ausência de Dados: Se a comunidade solicitada não constar no JSON ou não possuir dados vinculados, sua resposta deve ser exclusivamente: "Dados não encontrados para a(s) comunidade(s) selecionada(s)."
2. Sem Sugestões Jurídicas/Aviso Legal: Nunca forneça pareceres jurídicos vinculantes. Forneça insights analíticos e factuais para subsidiar o planejamento técnico.
3. Exaustividade Obrigatória: Liste apenas os itens solicitados presentes no dataset sem usar "etc." ou omitir items.
4. Resumo de Descrições: Na descrição de eventos, resuma mantendo o sentido original sem ultrapassar 200 caracteres.

REGRAS DE FORMATAÇÃO VISUAL (MARKDOWN):
- PROIBIDO: O uso de tabelas em Markdown.
- OBRIGATÓRIO: Uso exclusivo de tópicos hierárquicos (Bullet Points). Uso de divisórias (---) para separar seções. Uso de Negrito para chaves de dados e títulos. Uso de Citações (> ) para destacar insights críticos, cruzamento de dados importantes ou alertas.

FLUXO DE INTERAÇÃO E RESPOSTA:
Se o usuário estiver fazendo uma pergunta geral inicial, responda em 1 parágrafo objetivo baseado nos dados e logo abaixo adicione a seguinte pergunta padrão e as 3 opções em botões de escolha:
"Gostaria de aprofundar a análise? Escolha um tipo de relato ou síntese que melhor atenda sua demanda:

Opção 1: Síntese;
Opção 2: Detalhamento por Comunidade e Cronologia;
Opção 3: Análise Exploratória."

Se o usuário explicitamente pediu a Opção 1, 2 ou 3, monte a estrutura correspondente:
- SE OPÇÃO 1: Síntese e Análise Direta (Eventos com ID, DATA, TIPO, NOM, DES; Análise Direta; Cruzamento de Dados > insights; Observações Normativas face à Constituição/Estatuto da Cidade/REURB Lei 13.465/17).
- SE OPÇÃO 2: Detalhamento por Comunidade e Cronologia (Situação Atual, Histórico Cronológico [Data] - [Nome], Atores Envolvidos PJ/PF e Movimentos, Conexões).
- SE OPÇÃO 3: Análise Exploratória e Normativa (Fatos Relevantes, Reflexão Urbanística e Ambiental > gargalos e legislação).
`;

    const promptText = `
DADOS DE CONTEXTO (JSON):
${JSON.stringify(contextData)}

PERGUNTA DO USUÁRIO:
${userMessage}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("Gemini Chat Error:", err);
    res.status(500).json({ error: err.message || "Erro na comunicação com o Gemini." });
  }
});

// 5. GEMINI AI STRUCTURED EXTRACTION FROM NEWS / DOCUMENTS
app.post("/api/gemini/extract-news", async (req, res) => {
  try {
    const { inputText } = req.body;
    if (!inputText || inputText.trim().length < 10) {
      return res.status(400).json({ error: "Por favor insira um texto de notícia ou processo válido para análise." });
    }

    const ai = getGeminiAI();

    const extractionInstruction = `
Você é uma IA especialista em extração de dados estruturados para o sistema Geo.COMUM do Paraná.
Sua tarefa é ler a notícia, ata de reunião, processo judicial ou relatório fornecido e extrair entidades estruturadas nos seguintes formatos exatos:

1. Comunidades (NOM_COMUNIDADE, MUNICIPIO, UF, LAT, LON, FAMILIAS_ESTIMADAS, SITUACAO_URBANISTICA)
2. Eventos (NOM_EVENTO, TIPO_EVENTO, DATA_EVENTO [formato YYYY-MM-DD], DES_EVENTO, STATUS_EVENTO)
3. Movimentos (NOM_MOV, TIPO_MOV, DATA_MOV [formato YYYY-MM-DD], DESC_MOV, RESPONSAVEL_MOV)
4. PJs - Pessoas Jurídicas/Entidades (NOM_PJ, CNPJ, TIPO_ENTIDADE, CONTATO)
5. PFs - Pessoas Físicas/Lideranças (NOM_PF, CARGO_FUNCAO, EMAIL, TELEFONE)

Defina latitudes e longitudes estimadas para o município se não houver coordenadas exatas no texto.
Forneça os resultados no schema JSON exato especificado.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `TEXTO PARA ANÁLISE:\n${inputText}`,
      config: {
        systemInstruction: extractionInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comunidades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  NOM_COMUNIDADE: { type: Type.STRING },
                  MUNICIPIO: { type: Type.STRING },
                  UF: { type: Type.STRING },
                  LAT: { type: Type.NUMBER },
                  LON: { type: Type.NUMBER },
                  FAMILIAS_ESTIMADAS: { type: Type.NUMBER },
                  SITUACAO_URBANISTICA: { type: Type.STRING },
                },
                required: ["NOM_COMUNIDADE", "MUNICIPIO"],
              },
            },
            eventos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  NOM_EVENTO: { type: Type.STRING },
                  TIPO_EVENTO: { type: Type.STRING },
                  DATA_EVENTO: { type: Type.STRING },
                  DES_EVENTO: { type: Type.STRING },
                  STATUS_EVENTO: { type: Type.STRING },
                },
                required: ["NOM_EVENTO", "DATA_EVENTO"],
              },
            },
            movimentos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  NOM_MOV: { type: Type.STRING },
                  TIPO_MOV: { type: Type.STRING },
                  DATA_MOV: { type: Type.STRING },
                  DESC_MOV: { type: Type.STRING },
                  RESPONSAVEL_MOV: { type: Type.STRING },
                },
                required: ["NOM_MOV"],
              },
            },
            pjs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  NOM_PJ: { type: Type.STRING },
                  TIPO_ENTIDADE: { type: Type.STRING },
                  CNPJ: { type: Type.STRING },
                  CONTATO: { type: Type.STRING },
                },
                required: ["NOM_PJ"],
              },
            },
            pfs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  NOM_PF: { type: Type.STRING },
                  CARGO_FUNCAO: { type: Type.STRING },
                  EMAIL: { type: Type.STRING },
                  TELEFONE: { type: Type.STRING },
                },
                required: ["NOM_PF"],
              },
            },
          },
        },
      },
    });

    const parsedJson = JSON.parse(response.text || "{}");
    const draft: ExtractedEntitiesDraft = {
      id: "draft-" + Date.now(),
      sourceTextSnippet: inputText.slice(0, 200) + "...",
      createdAt: new Date().toISOString(),
      comunidades: parsedJson.comunidades || [],
      eventos: parsedJson.eventos || [],
      movimentos: parsedJson.movimentos || [],
      pjs: parsedJson.pjs || [],
      pfs: parsedJson.pfs || [],
      status: "pending",
    };

    res.json({ draft });
  } catch (err: any) {
    console.error("News extraction error:", err);
    res.status(500).json({ error: err.message || "Falha na extração de dados com IA." });
  }
});

// 6. SIMULATED GOOGLE AUTH USER PROFILES
let activeUser = {
  id: "user-1",
  name: "Adilson Pedrozo",
  email: "adnpedrozo@mppr.mp.br",
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
  organization: "Ministério Público do Estado do Paraná (MPPR)",
  isAuthenticated: true,
};

app.get("/api/auth/me", (req, res) => {
  res.json(activeUser);
});

app.post("/api/auth/login", (req, res) => {
  const { name, email, organization } = req.body;
  activeUser = {
    ...activeUser,
    name: name || activeUser.name,
    email: email || activeUser.email,
    organization: organization || activeUser.organization,
    isAuthenticated: true,
  };
  res.json(activeUser);
});

// VITE MIDDLEWARE & SERVER LISTEN
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Geo.COMUM backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Erro fatal ao iniciar servidor Geo.COMUM:", err);
});
