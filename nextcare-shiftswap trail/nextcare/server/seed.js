require('dotenv').config();
const mongoose     = require('mongoose');
const connectDB    = require('./config/db');
const User         = require('./models/User');
const Shift        = require('./models/Shift');
const SwapRequest  = require('./models/SwapRequest');
const Notification = require('./models/Notification');

const TYPES = [
  { type: 'Morning',   start: '08:00', end: '16:00' },
  { type: 'Afternoon', start: '16:00', end: '00:00' },
  { type: 'Night',     start: '00:00', end: '08:00' },
  { type: 'Half',      start: '08:00', end: '12:00' },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

async function seed() {
  await connectDB();
  console.log('\n🌱 Seeding database...\n');

  await Promise.all([
    User.deleteMany({}), Shift.deleteMany({}),
    SwapRequest.deleteMany({}), Notification.deleteMany({})
  ]);
  console.log('🗑  Cleared old data');

  // Manager
  const manager = await User.create({
    name: 'Mustafa Ibrahim', email: 'manager@nextcare.com',
    password: 'manager123', role: 'manager', department: 'Management'
  });
  console.log(`👔 Manager: ${manager.email} / manager123`);

  // Employees
  const empData = [
    { name: 'Ahmed Mohamed',  email: 'ahmed@nextcare.com',   department: 'Operations' },
    { name: 'Sara Mahmoud',   email: 'sara@nextcare.com',    department: 'Operations' },
    { name: 'Mohamed Ali',    email: 'mohamed@nextcare.com', department: 'Support'    },
    { name: 'Nour Hossam',    email: 'nour@nextcare.com',    department: 'Support'    },
    { name: 'Karim Reda',     email: 'karim@nextcare.com',   department: 'Sales'      },
    { name: 'Heba Mansour',   email: 'heba@nextcare.com',    department: 'Operations' },
    { name: 'Rami Selim',     email: 'rami@nextcare.com',    department: 'Support'    },
    { name: 'Yasmin Omar',    email: 'yasmin@nextcare.com',  department: 'Sales'      },
    { name: 'Omar Farouk',    email: 'omar@nextcare.com',    department: 'Operations' },
    { name: 'Mona Khaled',    email: 'mona@nextcare.com',    department: 'Management' },
  ];
  const employees = await User.insertMany(
    empData.map(e => ({ ...e, password: 'emp123456', role: 'employee' }))
  );
  console.log(`👥 ${employees.length} employees created (password: emp123456)`);

  // Shifts — next 14 days, Mon–Fri
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const shiftDocs = [];
  for (const emp of employees) {
    for (let d = 0; d < 14; d++) {
      if (d % 7 === 5 || d % 7 === 6) continue;
      const t = pick(TYPES);
      shiftDocs.push({
        user: emp._id, date: addDays(today, d),
        startTime: t.start, endTime: t.end,
        type: t.type, department: emp.department, status: 'Confirmed'
      });
    }
  }
  const createdShifts = await Shift.insertMany(shiftDocs, { ordered: false });
  console.log(`📅 ${createdShifts.length} shifts created`);

  // Sample swap requests
  const [ahmed, sara, nour, rami] = employees;

  const ahmedShift = createdShifts.find(s => s.user.toString() === ahmed._id.toString());
  if (ahmedShift) {
    ahmedShift.status = 'NeedsCoverage'; await ahmedShift.save();
    await SwapRequest.create({
      requester: ahmed._id, requesterShift: ahmedShift._id,
      reason: 'Family event', availableTimes: 'Friday & Saturday',
      urgency: 'Medium', status: 'Open'
    });
    console.log('🔄 Open swap: Ahmed');
  }

  const nourShift = createdShifts.find(s => s.user.toString() === nour._id.toString());
  if (nourShift) {
    nourShift.status = 'NeedsCoverage'; await nourShift.save();
    const swap2 = await SwapRequest.create({
      requester: nour._id, requesterShift: nourShift._id,
      acceptor: rami._id, reason: 'Medical emergency',
      urgency: 'Urgent', status: 'Accepted'
    });
    await Notification.create({
      user: nour._id, type: 'swap_accepted',
      title: 'Swap Accepted',
      message: 'Rami Selim accepted your swap — awaiting manager approval',
      relatedSwap: swap2._id
    });
    console.log('🔄 Accepted swap: Nour ↔ Rami');
  }

  const saraShift = createdShifts.find(s => s.user.toString() === sara._id.toString());
  if (saraShift) {
    saraShift.status = 'Swapped'; await saraShift.save();
    await SwapRequest.create({
      requester: sara._id, requesterShift: saraShift._id,
      acceptor: employees[8]._id, reason: 'Travel',
      urgency: 'Normal', status: 'Approved',
      reviewedBy: manager._id, reviewedAt: new Date(), reviewNote: 'Approved'
    });
    console.log('✅ Approved swap: Sara ↔ Omar');
  }

  console.log('\n✅ Seed complete!\n');
  console.log('  manager@nextcare.com  /  manager123');
  console.log('  ahmed@nextcare.com    /  emp123456');
  console.log('  (all employees: emp123456)\n');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
