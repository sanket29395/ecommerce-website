import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/crypto";
import { required } from "../src/lib/env";
import { email,password } from "../src/lib/validation";
async function main(){
 const adminEmail=email.parse(required("ADMIN_EMAIL"));const adminPassword=password.parse(required("ADMIN_PASSWORD"));
 if(adminPassword.includes("replace-")||adminPassword.includes("change-me"))throw new Error("Set a unique admin password before seeding");
 await db.user.upsert({where:{email:adminEmail},create:{email:adminEmail,name:"Store Administrator",passwordHash:await hashPassword(adminPassword),role:"ADMIN"},update:{}});
 // Existing accounts are intentionally NEVER promoted or reset by repeated seeding.
 const admin=await db.user.findUnique({where:{email:adminEmail}});if(admin?.role!=="ADMIN")throw new Error("Email belongs to a customer; use a different bootstrap email");
 for(const [name,slug] of [["Living","living"],["Accessories","accessories"],["Everyday essentials","everyday-essentials"]])await db.category.upsert({where:{slug},create:{name,slug},update:{}});
 console.log("Administrator and categories ready. Add products through /admin/products.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
