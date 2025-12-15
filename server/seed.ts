import { storage } from "./storage";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create a diner user
    const diner = await storage.createUser({
      email: "diner@test.com",
      password: "password123",
      name: "John Doe",
      userType: "diner"
    });
    console.log("✓ Created diner user:", diner.email);

    // Create a restaurant admin user
    const admin = await storage.createUser({
      email: "admin@trattoria.com",
      password: "password123",
      name: "Maria Rossi",
      userType: "restaurant_admin"
    });
    console.log("✓ Created restaurant admin:", admin.email);

    // Create restaurants
    const trattoria = await storage.createRestaurant({
      name: "La Trattoria",
      adminUserId: admin.id,
      voucherValue: "R100 Loyalty Voucher",
      voucherValidityDays: 30,
      color: "bg-orange-500"
    });
    console.log("✓ Created restaurant:", trattoria.name);

    const sushiZen = await storage.createRestaurant({
      name: "Sushi Zen",
      adminUserId: admin.id,
      voucherValue: "Free Sushi Roll",
      voucherValidityDays: 45,
      color: "bg-rose-500"
    });
    console.log("✓ Created restaurant:", sushiZen.name);

    const burgerJoint = await storage.createRestaurant({
      name: "Fancy Franks",
      adminUserId: admin.id,
      voucherValue: "Free Milkshake",
      voucherValidityDays: 60,
      color: "bg-amber-500"
    });
    console.log("✓ Created restaurant:", burgerJoint.name);

    // Create initial points balances
    await storage.createPointsBalance({
      dinerId: diner.id,
      restaurantId: trattoria.id,
      currentPoints: 850,
      totalPointsEarned: 1850,
      totalVouchersGenerated: 1
    });
    console.log("✓ Created points balance for La Trattoria");

    await storage.createPointsBalance({
      dinerId: diner.id,
      restaurantId: sushiZen.id,
      currentPoints: 120,
      totalPointsEarned: 120,
      totalVouchersGenerated: 0
    });
    console.log("✓ Created points balance for Sushi Zen");

    await storage.createPointsBalance({
      dinerId: diner.id,
      restaurantId: burgerJoint.id,
      currentPoints: 950,
      totalPointsEarned: 2950,
      totalVouchersGenerated: 2
    });
    console.log("✓ Created points balance for Fancy Franks");

    // Create some sample vouchers
    const voucher1Expiry = new Date();
    voucher1Expiry.setDate(voucher1Expiry.getDate() + 15);
    
    await storage.createVoucher({
      dinerId: diner.id,
      restaurantId: trattoria.id,
      title: "R100 Loyalty Voucher",
      code: "TRAT-992",
      expiryDate: voucher1Expiry,
      isRedeemed: false,
      redeemedAt: null
    });
    console.log("✓ Created voucher for La Trattoria");

    const voucher2Expiry = new Date();
    voucher2Expiry.setDate(voucher2Expiry.getDate() + 20);
    
    await storage.createVoucher({
      dinerId: diner.id,
      restaurantId: burgerJoint.id,
      title: "Free Milkshake",
      code: "BURG-112",
      expiryDate: voucher2Expiry,
      isRedeemed: false,
      redeemedAt: null
    });

    await storage.createVoucher({
      dinerId: diner.id,
      restaurantId: burgerJoint.id,
      title: "Free Milkshake",
      code: "BURG-882",
      expiryDate: voucher2Expiry,
      isRedeemed: false,
      redeemedAt: null
    });
    console.log("✓ Created vouchers for Fancy Franks");

    // Create some sample transactions
    await storage.createTransaction({
      dinerId: diner.id,
      restaurantId: trattoria.id,
      amountSpent: "250.00",
      pointsEarned: 250
    });

    await storage.createTransaction({
      dinerId: diner.id,
      restaurantId: burgerJoint.id,
      amountSpent: "150.00",
      pointsEarned: 150
    });
    console.log("✓ Created sample transactions");

    console.log("\n✅ Seed completed successfully!");
    console.log("\n📝 Test credentials:");
    console.log("   Diner: diner@test.com / password123");
    console.log("   Diner ID:", diner.id);
    console.log("   Admin: admin@trattoria.com / password123");
    console.log("\n🍽️  Restaurants created:");
    console.log("   - La Trattoria (ID:", trattoria.id + ")");
    console.log("   - Sushi Zen (ID:", sushiZen.id + ")");
    console.log("   - The Burger Joint (ID:", burgerJoint.id + ")");
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
  
  process.exit(0);
}

seed();
