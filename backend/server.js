```javascript
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
    path.join(__dirname, "../frontend")
  )
);


// =====================================================
// UPLOAD
// =====================================================

const UPLOAD_DIR =
  path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {

  fs.mkdirSync(
    UPLOAD_DIR,
    {
      recursive: true
    }
  );

}


const storage =
  multer.diskStorage({

    destination:
      function (req, file, cb) {

        cb(
          null,
          UPLOAD_DIR
        );

      },

    filename:
      function (req, file, cb) {

        const extensao =
          path.extname(
            file.originalname
          );

        const nomeArquivo =
          Date.now() +
          "-" +
          Math.round(
            Math.random() * 1e9
          ) +
          extensao;

        cb(
          null,
          nomeArquivo
        );

      }

  });


const upload =
  multer({

    storage: storage,

    limits: {
      fileSize:
        10 * 1024 * 1024
    },

    fileFilter:
      function (req, file, cb) {

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


app.use(
  "/uploads",
  express.static(
    UPLOAD_DIR
  )
);


// =====================================================
// BANCO
// =====================================================

const DB_FILE =
  path.join(
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

  if (
    !fs.existsSync(DB_FILE)
  ) {

    const banco =
      bancoVazio();

    writeDB(banco);

    return banco;

  }


  try {

    const db =
      JSON.parse(
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

    if (!db.tv_historico)
      db.tv_historico = [];

    if (
      typeof db.tv_chamada ===
      "undefined"
    ) {

      db.tv_chamada = null;

    }


    return db;

  }

  catch (erro) {

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

app.post(
  "/login",
  (req, res) => {

    const db =
      readDB();


    const user =
      db.usuarios.find(
        u =>
          u.usuario ===
            req.body.usuario &&
          u.senha ===
            req.body.senha
      );


    if (!user) {

      return res
        .status(401)
        .json({

          erro:
            "Login inválido"

        });

    }


    res.json(user);

  }
);


// =====================================================
// ATENDIMENTO
// =====================================================

app.post(
  "/atendimento",
  upload.single("documento"),
  (req, res) => {

    try {

      const db =
        readDB();


      const paciente = {

        id: Date.now(),

        nome:
          req.body.nome,

        cpf:
          req.body.cpf,

        nomeMae:
          req.body.nomeMae,

        dataNascimento:
          req.body.dataNascimento,

        estadoCivil:
          req.body.estadoCivil,

        contato:
          req.body.contato,

        telefone:
          req.body.telefone,

        email:
          req.body.email,

        contatoEmergencia:
          req.body.contatoEmergencia,


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


        tipo:
          req.body.tipo,

        convenio:
          req.body.convenio,


        documento:
          req.file
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


        status:
          "triagem",

        createdAt:
          new Date().toISOString()

      };


      db.pacientes.push(
        paciente
      );


      writeDB(db);


      res
        .status(201)
        .json({

          sucesso: true,

          mensagem:
            "Paciente cadastrado com sucesso",

          paciente

        });

    }

    catch (erro) {

      console.error(
        "Erro ao cadastrar:",
        erro
      );


      res
        .status(500)
        .json({

          erro:
            "Erro ao cadastrar paciente"

        });

    }

  }
);


// =====================================================
// PACIENTES
// =====================================================

app.get(
  "/pacientes",
  (req, res) => {

    const db =
      readDB();

    res.json(
      db.pacientes
    );

  }
);


app.get(
  "/pacientes/:id",
  (req, res) => {

    const db =
      readDB();


    const paciente =
      db.pacientes.find(
        p =>
          p.id ==
          req.params.id
      );


    if (!paciente) {

      return res
        .status(404)
        .json({

          erro:
            "Paciente não encontrado"

        });

    }


    res.json(
      paciente
    );

  }
);


// =====================================================
// TRIAGEM
// =====================================================

app.post(
  "/triagem",
  (req, res) => {

    const db =
      readDB();


    let risco =
      req.body.risco;


    const temperatura =
      Number(
        req.body.temperatura
      );


    if (
      temperatura >= 39
    ) {

      risco =
        "vermelho";

    }

    else if (
      temperatura >= 38
    ) {

      risco =
        "amarelo";

    }

    else if (!risco) {

      risco =
        "verde";

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

      risco:

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

    const db =
      readDB();

    res.json(
      db.triagens
    );

  }
);


// =====================================================
// TV
// =====================================================

app.post(
  "/tv/chamar",
  (req, res) => {

    const db =
      readDB();


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


app.get(
  "/tv/chamada",
  (req, res) => {

    const db =
      readDB();


    res.json({

      chamada:
        db.tv_chamada,

      historico:
        db.tv_historico

    });

  }
);


// =====================================================
// MEDICAÇÕES
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

      const db =
        readDB();


      const consulta = {

        id:
          Date.now(),

        pacienteId:
          req.body.pacienteId,

        paciente:
          req.body.paciente,

        dataNascimento:
          req.body.dataNascimento,

        cpf:
          req.body.cpf,

        telefone:
          req.body.telefone,

        email:
          req.body.email,

        diagnostico:
          req.body.diagnostico,

        medicacao:
          req.body.medicacao,

        procedimento:
          req.body.procedimento,

        orientacoes:
          req.body.orientacoes,

        obs:
          req.body.obs,

        medico:
          req.body.medico,

        crm:
          req.body.crm,

        tipo:
          "consulta",

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

    catch (erro) {

      console.error(
        "Erro ao salvar consulta:",
        erro
      );


      res
        .status(500)
        .json({

          erro:
            "Erro ao salvar consulta",

          detalhe:
            erro.message

        });

    }

  }
);


// =====================================================
// LISTAR CONSULTAS
// =====================================================

app.get(
  "/medicacoes",
  (req, res) => {

    const db =
      readDB();

    res.json(
      db.consultas
    );

  }
);


// =====================================================
// FUNÇÃO AUXILIAR PARA PDF
// =====================================================

function texto(valor, padrao) {

  const resultado =
    String(
      valor ??
      ""
    ).trim();


  return resultado ||
    padrao ||
    "Não informado";

}


// =====================================================
// ALTA + PDF
// =====================================================

app.post(
  "/alta",
  (req, res) => {

    try {

      const db =
        readDB();


      // -------------------------------------------------
      // DADOS DO FORMULÁRIO
      // -------------------------------------------------

      const pacienteId =
        req.body.pacienteId;


      const nomePaciente =
        texto(
          req.body.paciente,
          ""
        );


      const diagnostico =
        texto(
          req.body.diagnostico,
          ""
        );


      const medicacao =
        texto(
          req.body.medicacao,
          ""
        );


      const procedimento =
        texto(
          req.body.procedimento,
          "Não informado."
        );


      const orientacoes =
        texto(
          req.body.orientacoes,
          "Nenhuma orientação informada."
        );


      const obs =
        texto(
          req.body.obs,
          "Nenhuma observação."
        );


      const medico =
        texto(
          req.body.medico,
          "Não informado"
        );


      const crm =
        texto(
          req.body.crm,
          "Não informado"
        );


      // -------------------------------------------------
      // VALIDAÇÕES
      // -------------------------------------------------

      if (!nomePaciente) {

        return res
          .status(400)
          .json({

            erro:
              "Paciente não informado."

          });

      }


      if (!diagnostico) {

        return res
          .status(400)
          .json({

            erro:
              "Diagnóstico não informado."

          });

      }


      if (!medicacao) {

        return res
          .status(400)
          .json({

            erro:
              "Medicação não informada."

          });

      }


      // -------------------------------------------------
      // LOCALIZAR PACIENTE
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


      if (!paciente) {

        paciente =
          db.pacientes.find(
            p =>
              String(
                p.nome || ""
              )
                .trim()
                .toLowerCase() ===
              nomePaciente
                .toLowerCase()
          );

      }


      // -------------------------------------------------
      // DADOS DO PACIENTE
      // -------------------------------------------------

      const dataNascimento =
        req.body.dataNascimento ||
        paciente?.dataNascimento ||
        "";


      const cpf =
        req.body.cpf ||
        paciente?.cpf ||
        "";


      const telefone =
        req.body.telefone ||
        paciente?.telefone ||
        "";


      const email =
        req.body.email ||
        paciente?.email ||
        "";


      // -------------------------------------------------
      // CONSULTA DE ALTA
      // -------------------------------------------------

      const consulta = {

        id:
          Date.now(),

        pacienteId:
          paciente
            ? paciente.id
            : pacienteId || null,

        paciente:
          nomePaciente,

        dataNascimento:
          dataNascimento,

        cpf:
          cpf,

        telefone:
          telefone,

        email:
          email,

        diagnostico:
          diagnostico,

        medicacao:
          medicacao,

        procedimento:
          procedimento,

        orientacoes:
          orientacoes,

        obs:
          obs,

        medico:
          medico,

        crm:
          crm,

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
      // REMOVER DA FILA
      // -------------------------------------------------

      if (paciente) {

        db.triagens =
          db.triagens.filter(
            t =>
              t.pacienteId !=
              paciente.id
          );

      }

      else {

        db.triagens =
          db.triagens.filter(
            t =>
              String(
                t.nome || ""
              )
                .trim()
                .toLowerCase() !==
              nomePaciente
                .toLowerCase()
          );

      }


      // -------------------------------------------------
      // SALVAR
      // -------------------------------------------------

      writeDB(db);


      // -------------------------------------------------
      // PDF
      // -------------------------------------------------

      const doc =
        new PDFDocument({

          size:
            "A4",

          margin:
            50

        });


      res.status(200);


      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        `inline; filename="alta-${Date.now()}.pdf"`
      );


      doc.pipe(res);


      // =================================================
      // CABEÇALHO
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(20)
        .text(
          "RELATÓRIO DE ALTA",
          {
            align:
              "center"
          }
        );


      doc.moveDown(0.5);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          "PAINEL MÉDICO",
          {
            align:
              "center"
          }
        );


      doc.moveDown();


      doc
        .moveTo(
          50,
          doc.y
        )
        .lineTo(
          545,
          doc.y
        )
        .stroke();


      doc.moveDown(1.5);


      // =================================================
      // DADOS DO PACIENTE
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Dados do Paciente"
        );


      doc.moveDown(0.5);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          `Nome: ${nomePaciente}`
        );


      doc.text(
        `CPF: ${
          cpf ||
          "Não informado"
        }`
      );


      doc.text(
        `Data de nascimento: ${
          dataNascimento ||
          "Não informada"
        }`
      );


      doc.text(
        `Telefone: ${
          telefone ||
          "Não informado"
        }`
      );


      doc.text(
        `E-mail: ${
          email ||
          "Não informado"
        }`
      );


      doc.moveDown(1.3);


      // =================================================
      // DIAGNÓSTICO
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Diagnóstico"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          diagnostico,
          {
            width:
              495
          }
        );


      doc.moveDown(1.2);


      // =================================================
      // MEDICAÇÃO
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Medicação"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          medicacao
        );


      doc.moveDown(1.2);


      // =================================================
      // PROCEDIMENTO
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Procedimento Realizado"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          procedimento,
          {
            width:
              495
          }
        );


      doc.moveDown(1.2);


      // =================================================
      // ORIENTAÇÕES
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Orientações de Alta"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          orientacoes,
          {
            width:
              495
          }
        );


      doc.moveDown(1.2);


      // =================================================
      // OBSERVAÇÕES
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Observações"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          obs,
          {
            width:
              495
          }
        );


      doc.moveDown(1.4);


      // =================================================
      // RESPONSÁVEL
      // =================================================

      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(14)
        .text(
          "Profissional Responsável"
        );


      doc.moveDown(0.4);


      doc
        .font(
          "Helvetica"
        )
        .fontSize(11)
        .text(
          `Médico: ${medico}`
        );


      doc.text(
        `CRM: ${crm}`
      );


      doc.moveDown(1.4);


      // =================================================
      // DATA DA ALTA
      // =================================================

      const dataAlta =
        new Date()
          .toLocaleString(
            "pt-BR",
            {
              dateStyle:
                "short",

              timeStyle:
                "short"
            }
          );


      doc
        .fontSize(11)
        .text(
          `Data e hora da alta: ${dataAlta}`
        );


      doc.moveDown(3);


      // =================================================
      // ASSINATURA
      // =================================================

      doc
        .moveTo(
          170,
          doc.y
        )
        .lineTo(
          375,
          doc.y
        )
        .stroke();


      doc.moveDown(0.5);


      doc
        .fontSize(10)
        .text(
          medico !==
            "Não informado"
            ? medico
            : "Assinatura do responsável",
          {
            align:
              "center",
            width:
              205
          }
        );


      if (
        crm !==
        "Não informado"
      ) {

        doc
          .fontSize(9)
          .text(
            `CRM: ${crm}`,
            {
              align:
                "center",
              width:
                205
            }
          );

      }


      // =================================================
      // RODAPÉ
      // =================================================

      doc
        .fontSize(8)
        .font(
          "Helvetica"
        )
        .text(
          "Documento gerado automaticamente pelo Painel Médico.",
          50,
          780,
          {
            align:
              "center",
            width:
              495
          }
        );


      // =================================================
      // FINALIZAR
      // =================================================

      doc.end();

    }

    catch (erro) {

      console.error(
        "Erro ao gerar alta:",
        erro
      );


      if (
        !res.headersSent
      ) {

        return res
          .status(500)
          .json({

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

      return res
        .status(400)
        .json({

          erro:
            "Erro no upload",

          detalhe:
            err.message

        });

    }


    if (err) {

      return res
        .status(400)
        .json({

          erro:
            err.message

        });

    }


    next();

  }
);


// =====================================================
// SERVIDOR
// =====================================================

const PORT =
  process.env.PORT ||
  3000;


app.listen(
  PORT,
  () => {

    console.log(
      `Servidor rodando na porta ${PORT}`
    );

  }
);
```
