import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  console.log('--- Test 4: duplicate ProgramStaff assignment should fail ---')
  const staff = await prisma.staffUser.findFirst()
  const program = await prisma.program.findFirst()
  if (staff && program) {
    try {
      await prisma.programStaff.create({ data: { staff_user_id: staff.id, program_id: program.id } })
      await prisma.programStaff.create({ data: { staff_user_id: staff.id, program_id: program.id } })
      console.log('FAIL: duplicate ProgramStaff was allowed')
    } catch (e) {
      console.log('PASS: duplicate ProgramStaff rejected')
    }
  } else {
    console.log('SKIPPED: no staff or program found, check your seed data')
  }

  console.log('--- Test 5: duplicate AttendanceRecord should fail ---')
  const session = await prisma.session.findFirst()
  const enrollment = await prisma.enrollment.findFirst()
  if (session && enrollment) {
    try {
      await prisma.attendanceRecord.create({ data: { session_id: session.id, enrollment_id: enrollment.id, status: 'present' } })
      await prisma.attendanceRecord.create({ data: { session_id: session.id, enrollment_id: enrollment.id, status: 'present' } })
      console.log('FAIL: duplicate AttendanceRecord was allowed')
    } catch (e) {
      console.log('PASS: duplicate AttendanceRecord rejected')
    }
  } else {
    console.log('SKIPPED: no session or enrollment found, check your seed data')
  }

  console.log('--- Test 6: second Certificate for same enrollment should fail ---')
  if (enrollment) {
    try {
      await prisma.certificate.create({ data: { enrollment_id: enrollment.id, issued_at: new Date(), certificate_url: 'test1.pdf', template_used: 'default' } })
      await prisma.certificate.create({ data: { enrollment_id: enrollment.id, issued_at: new Date(), certificate_url: 'test2.pdf', template_used: 'default' } })
      console.log('FAIL: duplicate Certificate was allowed')
    } catch (e) {
      console.log('PASS: duplicate Certificate rejected')
    }
  } else {
    console.log('SKIPPED: no enrollment found, check your seed data')
  }
}

main().finally(() => prisma.$disconnect())