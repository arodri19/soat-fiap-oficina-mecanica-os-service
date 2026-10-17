const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.sagaEvent.deleteMany();
  await prisma.sagaInstance.deleteMany();
  await prisma.outboxMessage.deleteMany();
  await prisma.processedMessage.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderServiceServicePart.deleteMany();
  await prisma.orderServiceService.deleteMany();
  await prisma.orderService.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.clientPF.deleteMany();
  await prisma.clientPJ.deleteMany();
  await prisma.part.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  const attendant = await prisma.user.create({
    data: { name: 'Atendente Padrão', email: 'admin@oficina.com', password: hashedPassword, role: 'ATTENDANT' }
  });
  const mechanic = await prisma.user.create({
    data: { name: 'Mecânico Padrão', email: 'mecanico@oficina.com', password: hashedPassword, role: 'MECHANIC' }
  });
  console.log('2 Usuários criados (admin@oficina.com / mecanico@oficina.com — senha: Admin123!)');
  return { attendant, mechanic };
}

async function seedServices() {
  const services = await Promise.all([
    prisma.service.create({ data: { name: 'Troca de Óleo',               slaMinutes: 60,  price: 80.00  } }),
    prisma.service.create({ data: { name: 'Alinhamento e Balanceamento', slaMinutes: 120, price: 120.00 } }),
    prisma.service.create({ data: { name: 'Revisão Completa',            slaMinutes: 240, price: 350.00 } }),
    prisma.service.create({ data: { name: 'Troca de Pastilha de Freio',  slaMinutes: 90,  price: 180.00 } }),
    prisma.service.create({ data: { name: 'Diagnóstico Eletrônico',      slaMinutes: 45,  price: 60.00  } }),
  ]);
  console.log(`${services.length} Serviços criados.`);
  return services;
}

async function seedParts() {
  const parts = await Promise.all([
    prisma.part.create({ data: { name: 'Óleo de Motor 5W40',  type: 'Óleo',    model: 'Sintético', color: 'N/A',  quantity: 50, price: 45.00  } }),
    prisma.part.create({ data: { name: 'Filtro de Óleo',      type: 'Filtro',  model: 'Padrão',    color: 'N/A',  quantity: 30, price: 25.00  } }),
    prisma.part.create({ data: { name: 'Pastilha de Freio',   type: 'Freio',   model: 'Cerâmica',  color: 'N/A',  quantity: 20, price: 150.00 } }),
    prisma.part.create({ data: { name: 'Correia Dentada',     type: 'Motor',   model: 'Universal', color: 'N/A',  quantity: 15, price: 90.00  } }),
    prisma.part.create({ data: { name: 'Vela de Ignição',     type: 'Motor',   model: 'NGK',       color: 'N/A',  quantity: 40, price: 18.00  } }),
  ]);
  console.log(`${parts.length} Peças criadas.`);
  return parts;
}

async function seedClients() {
  const pf = await Promise.all([
    prisma.clientPF.create({ data: { name: 'João Silva',    cpf: '52998224725', email: 'joao@example.com',  address: 'Rua das Flores',   number: '123', state: 'SP', cep: '01000-000' } }),
    prisma.clientPF.create({ data: { name: 'Maria Oliveira', cpf: '11144477735', email: 'maria@example.com', address: 'Av Paulista',      number: '456', state: 'SP', cep: '01310-100' } }),
    prisma.clientPF.create({ data: { name: 'Carlos Souza',  cpf: '12345678909', email: 'carlos@example.com', address: 'Rua do Comércio', number: '789', state: 'MG', cep: '30000-000' } }),
  ]);

  const pj = await Promise.all([
    prisma.clientPJ.create({ data: { name: 'Transportes ABC', companyName: 'Transportes ABC Ltda',   fantasyName: 'ABC Log',   cnpj: '11222333000181', email: 'contato@abclog.com',   address: 'Av Industrial', number: '1000', state: 'SP', cep: '06000-000', legalResponsible: 'Pedro Alves'  } }),
    prisma.clientPJ.create({ data: { name: 'Frota XYZ',      companyName: 'Frota XYZ Serviços Ltda', fantasyName: 'Frota XYZ', cnpj: '22333444000195', email: 'frota@xyzserv.com.br', address: 'Rua da Frota',   number: '200',  state: 'RJ', cep: '20000-000', legalResponsible: 'Ana Costa'    } }),
  ]);

  console.log(`${pf.length} Clientes PF e ${pj.length} Clientes PJ criados.`);
  return { pf, pj };
}

async function seedVehicles(clients) {
  const vehicles = await Promise.all([
    // Placas Antigas
    prisma.vehicle.create({ data: { plate: 'ABC1234', model: 'Honda Civic',    year: 2020, color: 'Prata',    clientPFId: clients.pf[0].id } }),
    prisma.vehicle.create({ data: { plate: 'DEF5678', model: 'Toyota Corolla', year: 2021, color: 'Preto',    clientPFId: clients.pf[1].id } }),
    prisma.vehicle.create({ data: { plate: 'GHI9012', model: 'VW Nivus',       year: 2022, color: 'Branco',   clientPFId: clients.pf[2].id } }),
    // Placas Mercosul (Vehicle só suporta clientPFId; empresas PJ trazem veículos de colaboradores PF)
    prisma.vehicle.create({ data: { plate: 'ABC1D23', model: 'Fiat Pulse',     year: 2023, color: 'Azul',     clientPFId: clients.pf[0].id } }),
    prisma.vehicle.create({ data: { plate: 'XYZ2E34', model: 'Hyundai HB20',  year: 2024, color: 'Vermelho', clientPFId: clients.pf[1].id } }),
    prisma.vehicle.create({ data: { plate: 'MNO3F45', model: 'VW Gol',        year: 2023, color: 'Cinza',    clientPFId: clients.pf[2].id } }),
  ]);
  console.log(`${vehicles.length} Veículos criados (placas Antigas e Mercosul).`);
  return vehicles;
}

// Fase 4: OS "em andamento" só nascem pela API (POST /api/orders), porque cada uma
// precisa da sua saga e do orçamento correspondente no billing-service. O seed cria
// apenas OS históricas já ENTREGUES — alimentam as métricas de tempo de execução.
async function seedOrders(clients, vehicles, services, parts) {
  const historical = [
    {
      description: 'Troca de óleo + filtro', mechanicName: 'Roberto Mecânico', budgetValue: 150.0,
      startAt: new Date('2026-06-01T08:00:00Z'), endAt: new Date('2026-06-01T09:30:00Z'),
      clientPFId: clients.pf[0].id, vehicleId: vehicles[0].id,
      items: [{ service: services[0], parts: [{ part: parts[0], quantity: 1 }, { part: parts[1], quantity: 1 }] }]
    },
    {
      description: 'Alinhamento, balanceamento e pastilha', mechanicName: 'Marcos Silva', budgetValue: 600.0,
      startAt: new Date('2026-06-10T09:00:00Z'), endAt: new Date('2026-06-10T12:30:00Z'),
      clientPFId: clients.pf[1].id, vehicleId: vehicles[1].id,
      items: [
        { service: services[1], parts: [] },
        { service: services[3], parts: [{ part: parts[2], quantity: 2 }] }
      ]
    }
  ];

  for (const { items, ...order } of historical) {
    const created = await prisma.orderService.create({
      data: {
        ...order,
        status: 'ENTREGUE',
        services: {
          create: items.map(({ service, parts: itemParts }) => ({
            serviceId: service.id,
            unitPrice: service.price,
            parts: { create: itemParts.map(({ part, quantity }) => ({ partId: part.id, quantity, unitPrice: part.price })) }
          }))
        }
      }
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: created.id, fromStatus: 'FINALIZADA', toStatus: 'ENTREGUE', source: 'SEED', note: 'OS histórica (pré-Fase 4)' }
    });
  }

  console.log(`${historical.length} Ordens de Serviço históricas (ENTREGUE) criadas para as métricas.`);
}

async function main() {
  // --if-empty: usado pelo pipeline de CD (deploy automático a cada merge) — só
  // popula um banco recém-criado, nunca apaga dados de um ambiente já em uso.
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Banco já populado — seed ignorado (--if-empty).');
    return;
  }

  console.log('Iniciando seed do banco de dados...');
  await clearDatabase();
  await seedUsers();
  const services = await seedServices();
  const parts    = await seedParts();
  const clients  = await seedClients();
  const vehicles = await seedVehicles(clients);
  await seedOrders(clients, vehicles, services, parts);
  console.log('\nSeed concluído! Credenciais de acesso:');
  console.log('  Atendente: admin@oficina.com    / Admin123!');
  console.log('  Mecânico:  mecanico@oficina.com / Admin123!');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
