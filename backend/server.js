const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const PDFDocument = require("pdfkit");

const app = express();

// =====================================================
// CONFIGURAÇÕES GERAIS
// =====================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// PASTAS
// =====================================================
const FRONTEND_DIR = path.join(__dirname, "../front-end");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(__dirname, "db.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Servir os arquivos HTML, CSS e JavaScript do front-end
app.use(express.static(FRONTEND_DIR));

// Permitir acesso aos documentos enviados
app.use("/uploads", express.static(UPLOAD_DIR));

// =====================================================
// CONFIGURAÇÃO DE UPLOAD
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    const nomeArquivo =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + extensao;

    cb(null, nomeArquivo);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "application/pdf"
    ];

    if (tiposPermitidos.includes(file.mimetype)) {
      return cb(null, true);
    }

    cb(new Error("Formato não permitido. Envie JPG, PNG ou PDF."));
  }
});

// =====================================================
// BANCO DE DADOS JSON
// =====================================================
function bancoVazio() {
  return {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    tv_chamada: null,
    tv_historico: []
  };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const banco = bancoVazio();
    writeDB(banco);
    return banco;
  }

  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
    db.pacientes = Array.isArray(db.pacientes) ? db.pacientes : [];
    db.triagens = Array.isArray(db.triagens) ? db.triagens : [];
    db.consultas = Array.isArray(db.consultas) ? db.consultas : [];
    db.tv_historico = Array.isArray(db.tv_historico)
      ? db.tv_historico
      : [];

    if (typeof db.tv_chamada === "undefined") {
      db.tv_chamada = null;
    }

    return db;
  } catch (erro) {
    console.error("Erro ao ler banco de dados:", erro);
    throw new Error("Não foi possível ler o banco de dados.");
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Mantém campos vazios quando a validação precisa detectá-los.
function texto(valor, padrao = "Não informado") {
  const resultado = String(valor ?? "").trim();
  return resultado || padrao;
}

// =====================================================
// LOGIN
// =====================================================
app.post("/login", (req, res) => {
  try {
    const db = readDB();
    const { usuario, senha } = req.body;

    const user = db.usuarios.find(
      u => u.usuario === usuario && u.senha === senha
    );

    if (!user) {
      return res.status(401).json({ erro: "Login inválido." });
    }

    res.json(user);
  } catch (erro) {
    console.error("Erro no login:", erro);
    res.status(500).json({ erro: "Erro interno no login." });
  }
});

// =====================================================
// CADASTRO DE PACIENTES
// =====================================================
app.post("/atendimento", upload.single("documento"), (req, res) => {
  try {
    const db = readDB();

    const paciente = {
      id: Date.now(),
      nome: req.body.nome,
      cpf: req.body.cpf,
      nomeMae: req.body.nomeMae,
      dataNascimento: req.body.dataNascimento,
      estadoCivil: req.body.estadoCivil,
      contato: req.body.contato,
      telefone: req.body.telefone,
      email: req.body.email,
      contatoEmergencia: req.body.contatoEmergencia,

      endereco: {
        cep: req.body.cep,
        logradouro: req.body.logradouro,
        numero: req.body.numero,
        complemento: req.body.complemento,
        bairro: req.body.bairro,
        cidade: req.body.cidade,
        estado: req.body.estado
      },

      tipo: req.body.tipo,
      convenio: req.body.convenio,

      documento: req.file
        ? {
            nomeOriginal: req.file.originalname,
            nomeArquivo: req.file.filename,
            tipo: req.file.mimetype,
            tamanho: req.file.size,
            caminho: `/uploads/${req.file.filename}`
          }
        : null,

      status: "triagem",
      createdAt: new Date().toISOString()
    };

    if (!paciente.nome || !paciente.nome.trim()) {
      return res.status(400).json({
        erro: "O nome do paciente é obrigatório."
      });
    }

    db.pacientes.push(paciente);
    writeDB(db);

    res.status(201).json({
      sucesso: true,
      mensagem: "Paciente cadastrado com sucesso.",
      paciente
    });
  } catch (erro) {
    console.error("Erro ao cadastrar paciente:", erro);
    res.status(500).json({
      erro: "Erro ao cadastrar paciente."
    });
  }
});

app.get("/pacientes", (req, res) => {
  try {
    res.json(readDB().pacientes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao buscar pacientes." });
  }
});

app.get("/pacientes/:id", (req, res) => {
  try {
    const db = readDB();
    const paciente = db.pacientes.find(
      p => String(p.id) === String(req.params.id)
    );

    if (!paciente) {
      return res.status(404).json({
        erro: "Paciente não encontrado."
      });
    }

    res.json(paciente);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao buscar paciente." });
  }
});

// =====================================================
// TRIAGEM
// =====================================================
app.post("/triagem", (req, res) => {
  try {
    const db = readDB();

    const {
      pacienteId,
      nome,
      sintoma,
      temperatura,
      alergia,
      observacao
    } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        erro: "O nome do paciente é obrigatório."
      });
    }

    const tempInformada =
      temperatura !== undefined &&
      temperatura !== null &&
      String(temperatura).trim() !== "";

    const temp = tempInformada ? Number(temperatura) : null;

    if (tempInformada && (!Number.isFinite(temp) || temp < 25 || temp > 45)) {
      return res.status(400).json({
        erro: "Temperatura inválida."
      });
    }

    const riscosPermitidos = ["vermelho", "laranja", "amarelo", "verde", "azul"];
    let risco = String(req.body.risco || "verde").toLowerCase();

    if (!riscosPermitidos.includes(risco)) {
      return res.status(400).json({
        erro: "Classificação de risco inválida."
      });
    }

    // ALERTA AUXILIAR: febre elevada exige avaliação profissional.
    // A temperatura sozinha não determina a classificação clínica.
    const alertaTemperatura = temp !== null && temp >= 39;

    const triagem = {
      id: Date.now(),
      pacienteId: pacienteId || null,
      nome: String(nome).trim(),
      sintoma: sintoma || "",
      temperatura: temp,
      alergia: alergia || "",
      observacao: observacao || "",
      risco,
      alertaTemperatura,
      status: "aguardando_medico",
      createdAt: new Date().toISOString()
    };

    db.triagens.push(triagem);

    const paciente = db.pacientes.find(
      p => String(p.id) === String(pacienteId)
    );

    if (paciente) {
      paciente.status = "aguardando_medico";
    }

    writeDB(db);
    res.status(201).json(triagem);
  } catch (erro) {
    console.error("Erro ao registrar triagem:", erro);
    res.status(500).json({
      erro: "Erro ao registrar triagem."
    });
  }
});

app.get("/triagens", (req, res) => {
  try {
    res.json(readDB().triagens);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao buscar triagens." });
  }
});

// =====================================================
// PAINEL DE CHAMADAS
// =====================================================
app.post("/tv/chamar", (req, res) => {
  try {
    const db = readDB();
    const { localTipo, localNumero, paciente } = req.body;

    if (!paciente || !String(paciente).trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const chamada = {
      id: Date.now().toString(),
      localTipo: localTipo || "consultório",
      localNumero: localNumero || "1",
      paciente: String(paciente).trim(),
      hora: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      createdAt: new Date().toISOString()
    };

    db.tv_chamada = chamada;
    db.tv_historico.unshift(chamada);
    db.tv_historico = db.tv_historico.slice(0, 5);

    writeDB(db);
    res.json(chamada);
  } catch (erro) {
    console.error("Erro ao chamar paciente:", erro);
    res.status(500).json({
      erro: "Erro ao registrar chamada."
    });
  }
});

app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    res.json({
      chamada: db.tv_chamada,
      historico: db.tv_historico
    });
  } catch (erro) {
    console.error("Erro ao consultar chamadas:", erro);
    res.status(500).json({
      erro: "Erro ao consultar painel de chamadas."
    });
  }
});

// =====================================================
// LISTA DE MEDICAÇÕES
// =====================================================
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// =====================================================
// CONSULTAS
// =====================================================
app.post("/consulta", (req, res) => {
  try {
    const db = readDB();

    const consulta = {
      id: Date.now(),
      pacienteId: req.body.pacienteId || null,
      paciente: req.body.paciente || "",
      dataNascimento: req.body.dataNascimento || "",
      cpf: req.body.cpf || "",
      telefone: req.body.telefone || "",
      email: req.body.email || "",
      diagnostico: req.body.diagnostico || "",
      medicacao: req.body.medicacao || "",
      procedimento: req.body.procedimento || "",
      orientacoes: req.body.orientacoes || "",
      obs: req.body.obs || "",
      medico: req.body.medico || "",
      crm: req.body.crm || "",
      tipo: "consulta",
      createdAt: new Date().toISOString()
    };

    db.consultas.push(consulta);

    const paciente = db.pacientes.find(
      p => String(p.id) === String(req.body.pacienteId)
    );

    if (paciente) {
      paciente.status = "atendido";
    }

    writeDB(db);
    res.status(201).json(consulta);
  } catch (erro) {
    console.error("Erro ao salvar consulta:", erro);
    res.status(500).json({
      erro: "Erro ao salvar consulta."
    });
  }
});

app.get("/consultas", (req, res) => {
  try {
    res.json(readDB().consultas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao buscar consultas." });
  }
});

// =====================================================
// ALTA E GERAÇÃO DE PDF
// =====================================================
app.post("/alta", (req, res) => {
  try {
    const db = readDB();

    const pacienteId = req.body.pacienteId;
    const nomePaciente = texto(req.body.paciente, "");
    const diagnostico = texto(req.body.diagnostico, "");
    const medicacao = texto(req.body.medicacao, "");
    const procedimento = texto(
      req.body.procedimento,
      "Não informado."
    );
    const orientacoes = texto(
      req.body.orientacoes,
      "Nenhuma orientação informada."
    );
    const obs = texto(req.body.obs, "Nenhuma observação.");
    const medico = texto(req.body.medico, "Não informado");
    const crm = texto(req.body.crm, "Não informado");

    if (!nomePaciente) {
      return res.status(400).json({
        erro: "Paciente não informado."
      });
    }

    if (!diagnostico) {
      return res.status(400).json({
        erro: "Diagnóstico não informado."
      });
    }

    if (!medicacao) {
      return res.status(400).json({
        erro: "Medicação não informada."
      });
    }

    let paciente = null;

    if (pacienteId) {
      paciente = db.pacientes.find(
        p => String(p.id) === String(pacienteId)
      );
    }

    if (!paciente) {
      paciente = db.pacientes.find(
        p =>
          String(p.nome || "").trim().toLowerCase() ===
          nomePaciente.toLowerCase()
      );
    }

    const dataNascimento =
      req.body.dataNascimento || paciente?.dataNascimento || "";
    const cpf = req.body.cpf || paciente?.cpf || "";
    const telefone = req.body.telefone || paciente?.telefone || "";
    const email = req.body.email || paciente?.email || "";

    const consulta = {
      id: Date.now(),
      pacienteId: paciente ? paciente.id : pacienteId || null,
      paciente: nomePaciente,
      dataNascimento,
      cpf,
      telefone,
      email,
      diagnostico,
      medicacao,
      procedimento,
      orientacoes,
      obs,
      medico,
      crm,
      tipo: "alta",
      createdAt: new Date().toISOString()
    };

    db.consultas.push(consulta);

    if (paciente) {
      paciente.status = "alta";
      paciente.dataAlta = new Date().toISOString();

      db.triagens = db.triagens.filter(
        t => String(t.pacienteId) !== String(paciente.id)
      );
    } else {
      db.triagens = db.triagens.filter(
        t =>
          String(t.nome || "").trim().toLowerCase() !==
          nomePaciente.toLowerCase()
      );
    }

    writeDB(db);

    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="alta-${Date.now()}.pdf"`
    );

    doc.on("error", erro => {
      console.error("Erro no PDF:", erro);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("RELATÓRIO DE ALTA", { align: "center" });

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11)
      .text("PAINEL MÉDICO", { align: "center" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").fontSize(14)
      .text("Dados do Paciente");
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(11)
      .text(`Nome: ${nomePaciente}`)
      .text(`CPF: ${cpf || "Não informado"}`)
      .text(`Data de nascimento: ${dataNascimento || "Não informada"}`)
      .text(`Telefone: ${telefone || "Não informado"}`)
      .text(`E-mail: ${email || "Não informado"}`);

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14).text("Diagnóstico");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(diagnostico, { width: 495 });

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14).text("Medicação");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(medicacao, { width: 495 });

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14)
      .text("Procedimento Realizado");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(procedimento, { width: 495 });

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14)
      .text("Orientações de Alta");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(orientacoes, { width: 495 });

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14).text("Observações");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(obs, { width: 495 });

    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(14)
      .text("Profissional Responsável");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11)
      .text(`Médico: ${medico}`)
      .text(`CRM: ${crm}`);

    doc.moveDown();

    const dataAlta = new Date().toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });

    doc.text(`Data e hora da alta: ${dataAlta}`);
    doc.moveDown(2);

    doc.moveTo(170, doc.y).lineTo(375, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).text(
      medico !== "Não informado"
        ? medico
        : "Assinatura do responsável",
      170,
      doc.y,
      { align: "center", width: 205 }
    );

    if (crm !== "Não informado") {
      doc.fontSize(9).text(
        `CRM: ${crm}`,
        { align: "center", width: 495 }
      );
    }

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(8).text(
      "Documento gerado automaticamente pelo Painel Médico.",
      50,
      780,
      { align: "center", width: 495 }
    );

    doc.end();
  } catch (erro) {
    console.error("Erro ao gerar alta:", erro);

    if (!res.headersSent) {
      return res.status(500).json({
        erro: "Erro ao gerar PDF de alta.",
        detalhe: erro.message
      });
    }
  }
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================
app.use((err, req, res, next) => {
  console.error("Erro na aplicação:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      erro: "Erro no upload.",
      detalhe: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      erro: err.message || "Erro na requisição."
    });
  }

  next();
});

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
