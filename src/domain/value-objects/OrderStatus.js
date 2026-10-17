const { ValidationError } = require('../../utils/validation');

const STATUSES = Object.freeze([
  'RECEBIDA',
  'EM_DIAGNOSTICO',
  'AGUARDANDO_APROVACAO',
  'AGUARDANDO_PAGAMENTO',
  'AGUARDANDO_EXECUCAO',
  'EM_EXECUCAO',
  'FINALIZADA',
  'ENTREGUE',
  'CANCELADA'
]);

// Fase 4: as transições são conduzidas pela saga (OrderSagaOrchestrator):
//   RECEBIDA → (orçamento criado no billing) → AGUARDANDO_APROVACAO
//   → (cliente aprova) → AGUARDANDO_PAGAMENTO → (pagamento confirmado) → AGUARDANDO_EXECUCAO
//   → (execução: diagnóstico) → EM_DIAGNOSTICO → (reparo) → EM_EXECUCAO → FINALIZADA → ENTREGUE
// Qualquer etapa anterior à finalização pode ser compensada → CANCELADA.
const VALID_TRANSITIONS = Object.freeze({
  RECEBIDA: ['AGUARDANDO_APROVACAO', 'CANCELADA'],
  AGUARDANDO_APROVACAO: ['AGUARDANDO_PAGAMENTO', 'CANCELADA'],
  AGUARDANDO_PAGAMENTO: ['AGUARDANDO_EXECUCAO', 'CANCELADA'],
  AGUARDANDO_EXECUCAO: ['EM_DIAGNOSTICO', 'CANCELADA'],
  EM_DIAGNOSTICO: ['EM_EXECUCAO', 'CANCELADA'],
  EM_EXECUCAO: ['FINALIZADA', 'CANCELADA'],
  FINALIZADA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADA: []
});

class OrderStatus {
  constructor(value) {
    if (!STATUSES.includes(value)) {
      throw new ValidationError(`Status inválido: ${value}. Permitidos: ${STATUSES.join(', ')}.`);
    }
    this.value = value;
  }

  static create(value) {
    return new OrderStatus(value);
  }

  static get STATUSES() {
    return STATUSES;
  }

  static get VALID_TRANSITIONS() {
    return VALID_TRANSITIONS;
  }

  canTransitionTo(next) {
    return (VALID_TRANSITIONS[this.value] || []).includes(next);
  }

  transitionTo(next) {
    if (!this.canTransitionTo(next)) {
      const allowed = VALID_TRANSITIONS[this.value] || [];
      throw new ValidationError(
        `Transição inválida: ${this.value} → ${next}. Permitido: ${allowed.join(', ') || 'nenhuma'}.`
      );
    }
    return new OrderStatus(next);
  }

  isAwaitingApproval() {
    return this.value === 'AGUARDANDO_APROVACAO';
  }

  isTerminal() {
    return (VALID_TRANSITIONS[this.value] || []).length === 0;
  }

  equals(other) {
    const val = other instanceof OrderStatus ? other.value : other;
    return this.value === val;
  }

  toString() {
    return this.value;
  }
}

module.exports = OrderStatus;
