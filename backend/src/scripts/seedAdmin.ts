// backend/scripts/seedAdmin.ts
import { PrismaClient } from '../../generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    console.log('🔍 Checking for existing admin users...');
    
    // Check if any admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists. Skipping admin creation.');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Name: ${existingAdmin.name}`);
      return;
    }

    console.log('👤 No admin user found. Creating default admin...');

    // Default admin credentials
    const defaultAdmin = {
      username: 'admin',
      name: 'System Administrator',
      password: 'admin123', // This will be hashed
      role: 'ADMIN' as const
    };

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(defaultAdmin.password, saltRounds);

    // Create the admin user
    const newAdmin = await prisma.user.create({
      data: {
        username: defaultAdmin.username,
        name: defaultAdmin.name,
        password: hashedPassword,
        role: defaultAdmin.role
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    console.log('🎉 Default admin user created successfully!');
    console.log('📋 Admin Details:');
    console.log(`   ID: ${newAdmin.id}`);
    console.log(`   Username: ${newAdmin.username}`);
    console.log(`   Name: ${newAdmin.name}`);
    console.log(`   Role: ${newAdmin.role}`);
    console.log(`   Created: ${newAdmin.createdAt}`);
    console.log('');
    console.log('🔐 Default Login Credentials:');
    console.log(`   Username: ${defaultAdmin.username}`);
    console.log(`   Password: ${defaultAdmin.password}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder if this script is executed directly
if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('✅ Admin seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Admin seeding failed:', error);
      process.exit(1);
    });
}

// seedAdmin();

export default seedAdmin;