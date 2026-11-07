import { openDatabase, Database } from '../../../../src/shared/database';
import { ClientRepository } from '../../../../src/modules/clients/repositories';
import { getClient, seedClient, seedPackage } from '../../../helpers/db-fixtures';

describe('ClientRepository', () => {
  let db: Database;
  let repo: ClientRepository;

  beforeEach(() => {
    db = openDatabase();
    repo = new ClientRepository(db);
  });

  describe('getPackageId', () => {
    it("returns the client's package id", async () => {
      const packageId = seedPackage(db);
      const clientId = seedClient(db, { packageId });

      expect(await repo.getPackageId(clientId)).toBe(packageId);
    });

    it('returns a real null (not the text "null") when the client has no package', async () => {
      const clientId = seedClient(db, { packageId: null });

      expect(await repo.getPackageId(clientId)).toBeNull();
    });

    it('throws for an unknown client', async () => {
      await expect(repo.getPackageId('nope')).rejects.toThrow('nope');
    });
  });

  describe('setPackage', () => {
    it('sets the package, and clears it with null', async () => {
      const packageId = seedPackage(db);
      const clientId = seedClient(db);

      await repo.setPackage(clientId, packageId);
      expect(getClient(db, clientId).packageId).toBe(packageId);

      await repo.setPackage(clientId, null);
      expect(getClient(db, clientId).packageId).toBeNull();
    });

    it('throws for an unknown client', async () => {
      await expect(repo.setPackage('nope', null)).rejects.toThrow('nope');
    });
  });

  describe('addToWallet', () => {
    it('adds credit, and a negative amount takes it back', async () => {
      const clientId = seedClient(db, { walletBalance: 500 });

      await repo.addToWallet(clientId, 12_000);
      expect(getClient(db, clientId).walletBalance).toBe(12_500);

      await repo.addToWallet(clientId, -12_000);
      expect(getClient(db, clientId).walletBalance).toBe(500);
    });

    it('does the math in SQL, so two parallel credits both count', async () => {
      const clientId = seedClient(db, { walletBalance: 0 });

      await Promise.all([repo.addToWallet(clientId, 100), repo.addToWallet(clientId, 200)]);

      expect(getClient(db, clientId).walletBalance).toBe(300);
    });

    it('throws for an unknown client', async () => {
      await expect(repo.addToWallet('nope', 100)).rejects.toThrow('nope');
    });
  });
});
