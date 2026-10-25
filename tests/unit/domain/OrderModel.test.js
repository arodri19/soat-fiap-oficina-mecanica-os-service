const OrderStatus = require('../../../src/domain/value-objects/OrderStatus');
const Order = require('../../../src/domain/entities/Order');
const { ValidationError } = require('../../../src/utils/validation');
const { CreateOrderRequestDTO, OrderProgressResponseDTO } = require('../../../src/application/dtos/OrderDTOs');

describe('OrderStatus — máquina de estados da Fase 4', () => {
  it('expõe os 9 status, incluindo os da saga e CANCELADA', () => {
    expect(OrderStatus.STATUSES).toEqual([
      'RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PAGAMENTO',
      'AGUARDANDO_EXECUCAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE', 'CANCELADA'
    ]);
  });

  it.each([
    ['RECEBIDA', 'AGUARDANDO_APROVACAO'],
    ['AGUARDANDO_APROVACAO', 'AGUARDANDO_PAGAMENTO'],
    ['AGUARDANDO_PAGAMENTO', 'AGUARDANDO_EXECUCAO'],
    ['AGUARDANDO_EXECUCAO', 'EM_DIAGNOSTICO'],
    ['EM_DIAGNOSTICO', 'EM_EXECUCAO'],
    ['EM_EXECUCAO', 'FINALIZADA'],
    ['FINALIZADA', 'ENTREGUE']
  ])('%s → %s é válida', (from, to) => {
    const next = new OrderStatus(from).transitionTo(to);
    expect(next).toBeInstanceOf(OrderStatus);
    expect(next.value).toBe(to);
  });

  it.each(['RECEBIDA', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_EXECUCAO', 'EM_DIAGNOSTICO', 'EM_EXECUCAO'])(
    '%s pode ser compensada para CANCELADA',
    (from) => {
      expect(new OrderStatus(from).canTransitionTo('CANCELADA')).toBe(true);
    }
  );

  it.each([
    ['RECEBIDA', 'EM_EXECUCAO'],
    ['FINALIZADA', 'CANCELADA'],
    ['ENTREGUE', 'RECEBIDA'],
    ['CANCELADA', 'RECEBIDA']
  ])('%s → %s é inválida', (from, to) => {
    expect(() => new OrderStatus(from).transitionTo(to)).toThrow(ValidationError);
  });

  it('mensagem de erro informa "nenhuma" para status terminal', () => {
    expect(() => new OrderStatus('CANCELADA').transitionTo('RECEBIDA')).toThrow(/nenhuma/);
  });

  it('rejeita status desconhecido', () => {
    expect(() => new OrderStatus('APROVADA')).toThrow(ValidationError);
    expect(() => OrderStatus.create('XPTO')).toThrow(ValidationError);
  });

  it('isTerminal / isAwaitingApproval / equals / toString', () => {
    expect(new OrderStatus('ENTREGUE').isTerminal()).toBe(true);
    expect(new OrderStatus('CANCELADA').isTerminal()).toBe(true);
    expect(new OrderStatus('FINALIZADA').isTerminal()).toBe(false);
    expect(new OrderStatus('AGUARDANDO_APROVACAO').isAwaitingApproval()).toBe(true);
    expect(new OrderStatus('RECEBIDA').equals('RECEBIDA')).toBe(true);
    expect(new OrderStatus('RECEBIDA').equals(new OrderStatus('RECEBIDA'))).toBe(true);
    expect(`${new OrderStatus('RECEBIDA')}`).toBe('RECEBIDA');
    expect(OrderStatus.VALID_TRANSITIONS.ENTREGUE).toEqual([]);
  });
});

describe('Order — entidade', () => {
  const base = { description: 'Troca de óleo', vehicleId: 1, clientPFId: 1 };

  it('create valida campos e nasce RECEBIDA', () => {
    const order = Order.create(base);
    expect(order.status.value).toBe('RECEBIDA');
    expect(order.toPlainObject()).toEqual({ description: 'Troca de óleo', vehicleId: 1, status: 'RECEBIDA', clientPFId: 1 });
  });

  it('create exige cliente PF ou PJ', () => {
    expect(() => Order.create({ description: 'x', vehicleId: 1 })).toThrow(ValidationError);
  });

  it('create exige descrição e veículo', () => {
    expect(() => Order.create({ vehicleId: 1, clientPFId: 1 })).toThrow(ValidationError);
    expect(() => Order.create({ description: 'x', clientPFId: 1 })).toThrow(ValidationError);
  });

  it('budgetCreated grava orçamento e vai para AGUARDANDO_APROVACAO', () => {
    const order = new Order({ ...base, status: 'RECEBIDA' });
    order.budgetCreated({ budgetId: 'b-1', total: 170 });
    expect(order.status.value).toBe('AGUARDANDO_APROVACAO');
    expect(order.budgetId).toBe('b-1');
    expect(order.budgetValue).toBe(170);
  });

  it('approve só é permitido aguardando aprovação', () => {
    expect(() => new Order({ ...base, status: 'RECEBIDA' }).approve()).toThrow(/não está aguardando aprovação/);
    const order = new Order({ ...base, status: 'AGUARDANDO_APROVACAO' });
    order.approve();
    expect(order.status.value).toBe('AGUARDANDO_PAGAMENTO');
  });

  it('cancel registra motivo', () => {
    const order = new Order({ ...base, status: 'AGUARDANDO_PAGAMENTO' });
    order.cancel('Pagamento recusado');
    expect(order.status.value).toBe('CANCELADA');
    expect(order.cancelReason).toBe('Pagamento recusado');
    expect(order.isTerminal()).toBe(true);
  });

  it('cancel sem motivo deixa cancelReason nulo', () => {
    const order = new Order({ ...base, status: 'RECEBIDA' });
    order.cancel();
    expect(order.cancelReason).toBeNull();
  });

  it('EM_EXECUCAO define startAt uma única vez; FINALIZADA define endAt', () => {
    const order = new Order({ ...base, status: 'EM_DIAGNOSTICO' });
    order.transitionTo('EM_EXECUCAO');
    const firstStart = order.startAt;
    expect(firstStart).toBeInstanceOf(Date);
    order.transitionTo('FINALIZADA');
    expect(order.endAt).toBeInstanceOf(Date);
    expect(order.startAt).toBe(firstStart);
  });

  it('ENTREGUE define endAt se ainda não houver', () => {
    const order = new Order({ ...base, status: 'FINALIZADA' });
    order.transitionTo('ENTREGUE');
    expect(order.endAt).toBeInstanceOf(Date);
  });

  it('toPlainObject inclui campos opcionais preenchidos', () => {
    const order = new Order({
      ...base, clientPFId: null, clientPJId: 2, status: 'EM_EXECUCAO', mechanicName: 'Ana',
      startAt: new Date('2026-01-01'), endAt: new Date('2026-01-02'), budgetValue: 10
    });
    expect(order.toPlainObject()).toMatchObject({ clientPJId: 2, mechanicName: 'Ana', budgetValue: 10 });
    expect(order.toPlainObject().startAt).toBeInstanceOf(Date);
    expect(order.toPlainObject().endAt).toBeInstanceOf(Date);
  });

  it('fromPrisma reconstrói a entidade', () => {
    const order = Order.fromPrisma({ id: 1, externalId: 'e', status: 'CANCELADA', description: 'd', vehicleId: 1, cancelReason: 'x', budgetId: 'b' });
    expect(order.status.value).toBe('CANCELADA');
    expect(order.cancelReason).toBe('x');
    expect(order.budgetId).toBe('b');
  });

  it('aceita OrderStatus já instanciado no construtor', () => {
    const status = new OrderStatus('FINALIZADA');
    expect(new Order({ ...base, status }).status).toBe(status);
  });
});

describe('DTOs de OS', () => {
  it('CreateOrderRequestDTO normaliza serviços e peças (quantity padrão 1)', () => {
    const dto = new CreateOrderRequestDTO({
      description: ' Revisão ', vehicleId: '1', clientPFId: 1, mechanicName: 'Ana',
      services: [{ serviceId: 1, parts: [{ partId: 2 }] }, { serviceId: 3 }]
    });
    expect(dto.description).toBe('Revisão');
    expect(dto.services).toEqual([{ serviceId: 1, parts: [{ partId: 2, quantity: 1 }] }, { serviceId: 3, parts: [] }]);
    expect(dto.mechanicName).toBe('Ana');
  });

  it('CreateOrderRequestDTO sem services gera lista vazia e aceita PJ', () => {
    const dto = new CreateOrderRequestDTO({ description: 'x', vehicleId: 1, clientPJId: 4 });
    expect(dto.services).toEqual([]);
    expect(dto.clientPJId).toBe(4);
  });

  it('CreateOrderRequestDTO rejeita services que não é array, ids inválidos e quantity < 1', () => {
    expect(() => new CreateOrderRequestDTO({ description: 'x', vehicleId: 1, clientPFId: 1, services: 'a' })).toThrow(ValidationError);
    expect(() => new CreateOrderRequestDTO({ description: 'x', vehicleId: 1, clientPFId: 1, services: [{ serviceId: 'a' }] })).toThrow(ValidationError);
    expect(() => new CreateOrderRequestDTO({ description: 'x', vehicleId: 1, clientPFId: 1, services: [{ serviceId: 1, parts: [{ partId: 1, quantity: 0 }] }] })).toThrow(ValidationError);
  });

  it('OrderProgressResponseDTO expõe dados públicos da OS', () => {
    expect(OrderProgressResponseDTO.fromOrder({
      id: 1, externalId: 'e', status: new OrderStatus('RECEBIDA'), description: 'd'
    })).toEqual({
      id: 1, externalId: 'e', status: 'RECEBIDA', mechanicDescription: 'd', mechanicName: null, budgetValue: null, cancelReason: null
    });
    expect(OrderProgressResponseDTO.fromOrder({ status: 'CANCELADA', mechanicName: 'Ana', budgetValue: 5, cancelReason: 'x' }))
      .toMatchObject({ status: 'CANCELADA', mechanicName: 'Ana', budgetValue: 5, cancelReason: 'x' });
  });
});
