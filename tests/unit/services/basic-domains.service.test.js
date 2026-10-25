jest.mock('../../../src/repositories/vehicle.repository', () => ({
  createVehicle: jest.fn().mockResolvedValue({ id: 10 }),
  listVehicles: jest.fn().mockResolvedValue([]),
  getVehicle: jest.fn().mockResolvedValue({ id: 10 }),
  updateVehicle: jest.fn().mockResolvedValue({ id: 10 }),
  deleteVehicle: jest.fn().mockResolvedValue({ id: 10 })
}));

jest.mock('../../../src/repositories/part.repository', () => ({
  createPart: jest.fn().mockResolvedValue({ id: 20 }),
  listParts: jest.fn().mockResolvedValue([]),
  getPart: jest.fn().mockResolvedValue({ id: 20 }),
  updatePart: jest.fn().mockResolvedValue({ id: 20 }),
  deletePart: jest.fn().mockResolvedValue({ id: 20 })
}));

jest.mock('../../../src/repositories/service.repository', () => ({
  createService: jest.fn().mockResolvedValue({ id: 30 }),
  listServices: jest.fn().mockResolvedValue([]),
  getService: jest.fn().mockResolvedValue({ id: 30 }),
  updateService: jest.fn().mockResolvedValue({ id: 30 }),
  deleteService: jest.fn().mockResolvedValue({ id: 30 })
}));

const vehicleService = require('../../../src/services/vehicle.service');
const partService = require('../../../src/services/part.service');
const serviceService = require('../../../src/services/service.service');

describe('Serviços dos domínios básicos', () => {
  it('executa operações de veículo', async () => {
    await expect(vehicleService.createVehicle({
      plate: 'ABC1234',
      model: 'Sedan',
      year: 2024,
      color: 'Preto',
      clientPFId: 1
    })).resolves.toEqual({ id: 10 });
    await expect(vehicleService.listVehicles()).resolves.toEqual([]);
    await expect(vehicleService.getVehicle(10)).resolves.toEqual({ id: 10 });
    await expect(vehicleService.updateVehicle(10, { color: 'Branco' })).resolves.toEqual({ id: 10 });
    await expect(vehicleService.deleteVehicle(10)).resolves.toEqual({ id: 10 });
  });

  it('executa operações de peça e serviço', async () => {
    await expect(partService.createPart({
      name: 'Filtro',
      type: 'Motor',
      model: 'FX',
      color: 'Preto',
      quantity: 10
    })).resolves.toEqual({ id: 20 });
    await expect(partService.listParts()).resolves.toEqual([]);
    await expect(partService.getPart(20)).resolves.toEqual({ id: 20 });
    await expect(partService.updatePart(20, { quantity: 8 })).resolves.toEqual({ id: 20 });
    await expect(partService.deletePart(20)).resolves.toEqual({ id: 20 });

    await expect(serviceService.createService({ name: 'Troca de óleo', slaMinutes: 60 })).resolves.toEqual({ id: 30 });
    await expect(serviceService.listServices()).resolves.toEqual([]);
    await expect(serviceService.getService(30)).resolves.toEqual({ id: 30 });
    await expect(serviceService.updateService(30, { slaMinutes: 70 })).resolves.toEqual({ id: 30 });
    await expect(serviceService.deleteService(30)).resolves.toEqual({ id: 30 });
  });
});
