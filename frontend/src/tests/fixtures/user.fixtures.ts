export type TestUserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

export interface TestUser {
  _id: string;
  firstName: string;
  lastName: string;
  role: TestUserRole;
  token: string;
}

export const artisanUser: TestUser = {
  _id: 'user-artisan-1',
  firstName: 'Amine',
  lastName: 'Artisan',
  role: 'artisan',
  token: 'token-artisan-1',
};

export const expertUser: TestUser = {
  _id: 'user-expert-1',
  firstName: 'Eya',
  lastName: 'Expert',
  role: 'expert',
  token: 'token-expert-1',
};

export const manufacturerUser: TestUser = {
  _id: 'user-manufacturer-1',
  firstName: 'Moez',
  lastName: 'Manufacturer',
  role: 'manufacturer',
  token: 'token-manufacturer-1',
};

export const adminUser: TestUser = {
  _id: 'user-admin-1',
  firstName: 'Asma',
  lastName: 'Admin',
  role: 'admin',
  token: 'token-admin-1',
};

export const usersByRole: Record<TestUserRole, TestUser> = {
  artisan: artisanUser,
  expert: expertUser,
  manufacturer: manufacturerUser,
  admin: adminUser,
};
