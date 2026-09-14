const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const PDFDocument = require("pdfkit");

const app = express();

app.use(express.json());
app.use(cors());


// =====================================================
// FRONTEND
// =====================================================

app.use(
  express.static(
    path.join(__dirname, "../front-end")
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

        nomeMae:
          req.body.nomeMae,

        dataNascimento:
          req.body.dataNascimento,

        estadoCivil:
          req.body.estadoCivil,


        // CONTATOS

        contato:
          req.body.contato,

        telefone:
          req.body.telefone,

        email:
          req.body.email,

        contatoEmergencia:
          req.body.contatoEmergencia,


        // ENDEREÇO

        endereco: {

          cep:
            req.body.cep,

          logradouro:
            req.body.logradouro,

          numero:
            req.body.numero,

          complemento:
            req.body.complemento,

          bairro:
            req.body.bairro,

          cidade:
            req.body.cidade,

          estado:
            req.body.estado

        },


        // ATENDIMENTO

        tipo:
          req.body.tipo,

        convenio:
          req.body.convenio,


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

        status:
          "triagem",

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

    try {

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

    } catch (erro) {

      console.error(
        "Erro ao salvar consulta:",
        erro
      );

      res.status(500).json({

        erro:
          "Erro ao salvar consulta"

      });

    }

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
// ALTA + GERAÇÃO DO PDF
// =====================================================

app.post(
  "/alta",
  (req, res) => {

    try {

      const db = readDB();


      // -------------------------------------------------
      // DADOS RECEBIDOS
      // -------------------------------------------------

      const pacienteId =
        req.body.pacienteId;

      const nomePaciente =
        String(
          req.body.paciente || ""
        ).trim();

      const diagnostico =
        String(
          req.body.diagnostico || ""
        ).trim();

      const medicacao =
        String(
          req.body.medicacao || ""
        ).trim();

      const obs =
        String(
          req.body.obs || ""
        ).trim();


      if (!nomePaciente) {

        return res.status(400).json({

          erro:
            "Paciente não informado."

        });

      }


      if (!diagnostico) {

        return res.status(400).json({

          erro:
            "Diagnóstico não informado."

        });

      }


      if (!medicacao) {

        return res.status(400).json({

          erro:
            "Medicação não informada."

        });

      }


      // -------------------------------------------------
      // LOCALIZA O PACIENTE
      // -------------------------------------------------

      let paciente = null;


      if (pacienteId) {

        paciente =
          db.pacientes.find(
            p =>
              p.id ==
              pacienteId
          );

      }


      // Caso o ID não seja encontrado,
      // tenta encontrar pelo nome.

      if (!paciente) {

        paciente =
          db.pacientes.find(
            p =>
              String(p.nome || "")
                .trim()
                .toLowerCase() ===
              nomePaciente.toLowerCase()
          );

      }


      // -------------------------------------------------
      // SALVAR CONSULTA
      // -------------------------------------------------

      const consulta = {

        id: Date.now(),

        pacienteId:
          paciente
            ? paciente.id
            : pacienteId || null,

        paciente:
          nomePaciente,

        diagnostico:
          diagnostico,

        medicacao:
          medicacao,

        obs:
          obs,

        tipo:
          "alta",

        createdAt:
          new Date().toISOString()

      };


      db.consultas.push(
        consulta
      );


      // -------------------------------------------------
      // ATUALIZAR PACIENTE
      // -------------------------------------------------

      if (paciente) {

        paciente.status =
          "alta";

        paciente.dataAlta =
          new Date().toISOString();

      }


      // -------------------------------------------------
      // REMOVER DA FILA DE TRIAGEM
      // -------------------------------------------------

      if (paciente) {

        db.triagens =
          db.triagens.filter(
            t =>
              t.pacienteId !=
              paciente.id
          );

      } else {

        db.triagens =
          db.triagens.filter(
            t =>
              String(t.nome || "")
                .trim()
                .toLowerCase() !==
              nomePaciente.toLowerCase()
          );

      }


      // -------------------------------------------------
      // SALVAR BANCO
      // -------------------------------------------------

      writeDB(db);


      // -------------------------------------------------
      // GERAR PDF
      // -------------------------------------------------

      const doc =
        new PDFDocument({
          size: "A4",
          margin: 50
        });


      // -------------------------------------------------
      // CABEÇALHOS DA RESPOSTA
      // -------------------------------------------------

      res.status(200);

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="alta-${Date.now()}.pdf"`
      );


      // Envia o PDF diretamente
      // para o navegador.

      doc.pipe(res);


      // -------------------------------------------------
      // CABEÇALHO
      // -------------------------------------------------

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(
          "RELATÓRIO DE ALTA",
          {
            align: "center"
          }
        );


      doc.moveDown();


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          "Painel Médico"
        );


      doc
        .moveTo(50, doc.y + 10)
        .lineTo(545, doc.y + 10)
        .stroke();


      doc.moveDown(2);


      // -------------------------------------------------
      // INFORMAÇÕES DO PACIENTE
      // -------------------------------------------------

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          "Dados do Paciente"
        );


      doc.moveDown(0.5);


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          `Nome: ${nomePaciente}`
        );


      if (paciente) {

        if (paciente.cpf) {

          doc.text(
            `CPF: ${paciente.cpf}`
          );

        }


        if (paciente.dataNascimento) {

          doc.text(
            `Data de nascimento: ${paciente.dataNascimento}`
          );

        }


        if (paciente.telefone) {

          doc.text(
            `Telefone: ${paciente.telefone}`
          );

        }


        if (paciente.email) {

          doc.text(
            `E-mail: ${paciente.email}`
          );

        }

      }


      doc.moveDown(1.5);


      // -------------------------------------------------
      // DIAGNÓSTICO
      // -------------------------------------------------

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          "Diagnóstico"
        );


      doc.moveDown(0.5);


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          diagnostico
        );


      doc.moveDown(1.5);


      // -------------------------------------------------
      // MEDICAÇÃO
      // -------------------------------------------------

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          "Medicação"
        );


      doc.moveDown(0.5);


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          medicacao
        );


      doc.moveDown(1.5);


      // -------------------------------------------------
      // OBSERVAÇÕES
      // -------------------------------------------------

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          "Observações"
        );


      doc.moveDown(0.5);


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          obs || "Nenhuma observação."
        );


      doc.moveDown(2);


      // -------------------------------------------------
      // DATA DA ALTA
      // -------------------------------------------------

      const dataAlta =
        new Date().toLocaleString(
          "pt-BR"
        );


      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          `Data e hora da alta: ${dataAlta}`
        );


      doc.moveDown(4);


      // -------------------------------------------------
      // ASSINATURA
      // -------------------------------------------------

      doc
        .moveTo(180, doc.y)
        .lineTo(365, doc.y)
        .stroke();


      doc.moveDown(0.5);


      doc
        .fontSize(10)
        .text(
          "Assinatura do responsável",
          {
            align: "center"
          }
        );


      // -------------------------------------------------
      // RODAPÉ
      // -------------------------------------------------

      doc
        .fontSize(8)
        .text(
          "Documento gerado automaticamente pelo Painel Médico.",
          50,
          780,
          {
            align: "center",
            width: 495
          }
        );


      // Finaliza o PDF.

      doc.end();


    } catch (erro) {

      console.error(
        "Erro ao gerar alta:",
        erro
      );


      // Se o PDF ainda não começou
      // a ser enviado, retorna JSON.

      if (!res.headersSent) {

        return res.status(500).json({

          erro:
            "Erro ao gerar PDF de alta.",

          detalhe:
            erro.message

        });

      }

    }

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
