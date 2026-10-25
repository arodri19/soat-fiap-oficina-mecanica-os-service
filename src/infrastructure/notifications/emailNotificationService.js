const STATUS_LABELS = {
  RECEBIDA: 'Recebida',
  EM_DIAGNOSTICO: 'Em diagnóstico',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  AGUARDANDO_EXECUCAO: 'Aguardando execução',
  EM_EXECUCAO: 'Em execução',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada'
};

// Mock de envio de e-mail (mesmo padrão dos demais mocks do domínio: console.log).
// Substituir por um provedor real (ex.: Nodemailer + SMTP) trocando apenas esta função.
function sendOrderStatusEmail({ to, orderId, externalId, status }) {
  if (!to) return;

  const label = STATUS_LABELS[status] || status;
  console.log(
    `[MOCK EMAIL] Para: ${to} | Assunto: Ordem de Serviço #${orderId} - ${label} | Acompanhe em /api/track/${externalId}`
  );
}

module.exports = { sendOrderStatusEmail };
