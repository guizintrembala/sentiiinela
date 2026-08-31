const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(cors());

// =====================================================
// FRONTEND
// =====================================================

app.use(
  express.static(
    path.join(__dirname, "../frontend")
  )
);

// =====================================================
// CONFIGURAÇÃO DE UPLOAD
// =====================================================

const UPLOAD_DIR = path.join(
  __dirname,
  "uploads"
);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {

    const extensao =
      path.extname(file.originalname);

    const nomeArquivo =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      extensao;

    cb(null, nomeArquivo);
  }

});

const upload = multer({

  storage: storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf"
    ];

    if (
      tiposPermitidos.includes(
        file.mimetype
      )
    ) {

      cb(null, true);

    } else {

      cb(
        new Error(
          "Formato de arquivo não permitido. Envie JPG, PNG ou PDF."
        )
      );

    }

  }

});

// Permitir acesso aos documentos
app.use(
  "/uploads",
  express.static(UPLOAD_DIR)
);

// =====================================================
// BANCO DE DADOS
// =====================================================

const DB_FILE = path.join(
  __dirname,
  "db.json"
);

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

    const db = JSON.parse(
      fs.readFileSync(
        DB_FILE,
        "utf8"
      )
    );

    if (!db.usuarios)
      db.usuarios = [];

    if (!db.pacientes)
      db.pacientes = [];

    if (!db.triagens)
      db.triagens = [];

    if (!db.consultas)
      db.consultas = [];

    if (!db.tv_chamada)
      db.tv_chamada = null;

    if (!db.tv_historico)
      db.tv_historico = [];

    return db;

  } catch (erro) {

    console.error(
      "Erro ao ler banco de dados:",
      erro
    );

    return bancoVazio();

  }

}

function writeDB(data) {

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );

}

// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {

  const db = readDB();

  const user = db.usuarios.find(
    u =>
      u.usuario === req.body.usuario &&
      u.senha === req.body.senha
  );

  if (!user) {

    return res.status(401).json({
      erro: "Login inválido"
    });

  }

  res.json(user);

});

// =====================================================
// ATENDIMENTO
// =====================================================

app.post(
  "/atendimento",
  upload.single("documento"),
  (req, res) => {

    try {

      const db = readDB();

      const paciente = {

        id: Date.now(),

        // DADOS PESSOAIS
        nome: req.body.nome,
        cpf: req.body.cpf,
        nomeMae: req.body.nomeMae,
        dataNascimento:
          req.body.dataNascimento,
        estadoCivil:
          req.body.estadoCivil,

        // CONTATOS
        contato: req.body.contato,
        telefone: req.body.telefone,
        email: req.body.email,
        contatoEmergencia:
          req.body.contatoEmergencia,

        // ENDEREÇO
        endereco: {

          cep: req.body.cep,
          logradouro:
            req.body.logradouro,
          numero: req.body.numero,
          complemento:
            req.body.complemento,
          bairro: req.body.bairro,
          cidade: req.body.cidade,
          estado: req.body.estado

        },

        // ATENDIMENTO
        tipo: req.body.tipo,
        convenio: req.body.convenio,

        // DOCUMENTO
        documento: req.file
          ? {

              nomeOriginal:
                req.file.originalname,

              nomeArquivo:
                req.file.filename,

              tipo:
                req.file.mimetype,

              tamanho:
                req.file.size,

              caminho:
                `/uploads/${req.file.filename}`

            }
          : null,

        // CONTROLE
        status: "triagem",

        createdAt:
          new Date().toISOString()

      };

      db.pacientes.push(
        paciente
      );

      writeDB(db);

      res.status(201).json({

        sucesso: true,

        mensagem:
          "Paciente cadastrado com sucesso",

        paciente

      });

    } catch (erro) {

      console.error(
        "Erro ao cadastrar:",
        erro
      );

      res.status(500).json({

        erro:
          "Erro ao cadastrar paciente"

      });

    }

  }
);

// =====================================================
// LISTAR PACIENTES
// =====================================================

app.get(
  "/pacientes",
  (req, res) => {

    const db = readDB();

    res.json(
      db.pacientes
    );

  }
);

// =====================================================
// BUSCAR PACIENTE
// =====================================================

app.get(
  "/pacientes/:id",
  (req, res) => {

    const db = readDB();

    const paciente =
      db.pacientes.find(
        p =>
          p.id ==
          req.params.id
      );

    if (!paciente) {

      return res.status(404).json({

        erro:
          "Paciente não encontrado"

      });

    }

    res.json(paciente);

  }
);

// =====================================================
// TRIAGEM
// =====================================================

app.post(
  "/triagem",
  (req, res) => {

    const db = readDB();

    let risco =
      req.body.risco;

    const temperatura =
      Number(
        req.body.temperatura
      );

    if (
      temperatura >= 39
    ) {

      risco = "vermelho";

    } else if (
      temperatura >= 38
    ) {

      risco = "amarelo";

    } else if (!risco) {

      risco = "verde";

    }

    const triagem = {

      id: Date.now(),

      pacienteId:
        req.body.pacienteId,

      nome:
        req.body.nome,

      sintoma:
        req.body.sintoma,

      temperatura:
        req.body.temperatura,

      alergia:
        req.body.alergia,

      observacao:
        req.body.observacao,

      risco,

      status:
        "aguardando_medico",

      createdAt:
        new Date().toISOString()

    };

    db.triagens.push(
      triagem
    );

    const paciente =
      db.pacientes.find(
        p =>
          p.id ==
          req.body.pacienteId
      );

    if (paciente) {

      paciente.status =
        "aguardando_medico";

    }

    writeDB(db);

    res.json(
      triagem
    );

  }
);

// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get(
  "/triagens",
  (req, res) => {

    const db = readDB();

    res.json(
      db.triagens
    );

  }
);

// =====================================================
// TV - CHAMAR PACIENTE
// =====================================================

app.post(
  "/tv/chamar",
  (req, res) => {

    const db = readDB();

    const chamada = {

      id:
        Date.now().toString(),

      localTipo:
        req.body.localTipo,

      localNumero:
        req.body.localNumero,

      paciente:
        req.body.paciente,

      hora:
        new Date().toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )

    };

    db.tv_chamada =
      chamada;

    db.tv_historico.unshift(
      chamada
    );

    if (
      db.tv_historico.length > 5
    ) {

      db.tv_historico.pop();

    }

    writeDB(db);

    res.json(
      chamada
    );

  }
);

// =====================================================
// TV - CONSULTAR CHAMADA
// =====================================================

app.get(
  "/tv/chamada",
  (req, res) => {

    const db = readDB();

    res.json({

      chamada:
        db.tv_chamada,

      historico:
        db.tv_historico

    });

  }
);

// =====================================================
// LISTA DE MEDICAÇÕES
// =====================================================

app.get(
  "/lista-medicacoes",
  (req, res) => {

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

  }
);

// =====================================================
// CONSULTA
// =====================================================

app.post(
  "/consulta",
  (req, res) => {

    const db = readDB();

    const consulta = {

      id: Date.now(),

      pacienteId:
        req.body.pacienteId,

      paciente:
        req.body.paciente,

      diagnostico:
        req.body.diagnostico,

      medicacao:
        req.body.medicacao,

      obs:
        req.body.obs,

      createdAt:
        new Date().toISOString()

    };

    db.consultas.push(
      consulta
    );

    const paciente =
      db.pacientes.find(
        p =>
          p.id ==
          req.body.pacienteId
      );

    if (paciente) {

      paciente.status =
        "atendido";

    }

    writeDB(db);

    res.json(
      consulta
    );

  }
);

// =====================================================
// MEDICAÇÕES / CONSULTAS
// =====================================================

app.get(
  "/medicacoes",
  (req, res) => {

    const db = readDB();

    res.json(
      db.consultas
    );

  }
);

// =====================================================
// ERROS DO UPLOAD
// =====================================================

app.use(
  (err, req, res, next) => {

    console.error(err);

    if (
      err instanceof
      multer.MulterError
    ) {

      return res.status(400).json({

        erro:
          "Erro no upload",

        detalhe:
          err.message

      });

    }

    if (err) {

      return res.status(400).json({

        erro:
          err.message

      });

    }

    next();

  }
);

// =====================================================
// START
// =====================================================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      `Servidor rodando na porta ${PORT}`
    );

  }
);
