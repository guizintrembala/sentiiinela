
function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classificarAlerta(dados) {
  const riscoInformado = normalizarTexto(dados.risco);
  const pulseira = normalizarTexto(
    dados.pulseira ?? dados.corPulseira
  );
  const sintoma = normalizarTexto(dados.sintoma);

  const riscosValidos = ["vermelho", "amarelo", "verde"];

  const sinaisDeAlerta = [
    "falta_ar_grave",
    "infarto",
    "avc",
    "convulsao",
    "hemorragia"
  ];

  // Uma pulseira vermelha nunca deve ser rebaixada.
  if (
    riscoInformado === "vermelho" ||
    pulseira === "vermelho" ||
    pulseira === "red" ||
    sinaisDeAlerta.includes(sintoma)
  ) {
    return {
      risco: "vermelho",
      alerta: true,
      motivo: "Prioridade máxima indicada; requer avaliação imediata."
    };
  }

  // Não inventa uma classificação quando faltam dados.
  if (!riscosValidos.includes(riscoInformado)) {
    return {
      risco: "pendente_avaliacao",
      alerta: true,
      motivo: "Classificação profissional necessária."
    };
  }

  return {
    risco: riscoInformado,
    alerta: false,
    motivo: "Classificação informada para revisão da equipe."
  };
}

app.post("/triagem", (req, res) => {
  try {
    const db = readDB();
    const dados = req.body || {};

    if (!dados.nome && !dados.pacienteId) {
      return res.status(400).json({
        erro: "Informe o nome ou o identificador do paciente."
      });
    }

    const resultado = classificarAlerta(dados);

    const triagem = {
      id: Date.now(),
      pacienteId: dados.pacienteId ?? null,
      nome: String(dados.nome ?? "").trim(),
      sintoma: String(dados.sintoma ?? "").trim(),
      temperatura: dados.temperatura ?? null,
      alergia: String(dados.alergia ?? "").trim(),
      observacao: String(dados.observacao ?? "").trim(),

      risco: resultado.risco,
      alerta: resultado.alerta,
      motivoAlerta: resultado.motivo,

      status: "aguardando_medico",
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(db.triagens)) {
      db.triagens = [];
    }

    if (!Array.isArray(db.pacientes)) {
      db.pacientes = [];
    }

    db.triagens.push(triagem);

    const paciente = db.pacientes.find(
      p => String(p.id) === String(dados.pacienteId)
    );

    if (paciente) {
      paciente.status = "aguardando_medico";
    }

    writeDB(db);

    return res.status(201).json({
      sucesso: true,
      triagem
    });
  } catch (erro) {
    console.error("Erro ao registrar triagem:", erro);

    return res.status(500).json({
      erro: "Não foi possível registrar a triagem."
    });
  }
});
