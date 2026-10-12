import { int, mulberry32, pick, type Rng } from '@/lib/rng';
import { addDays, monthKey, today, ymd } from '@/lib/format';
import { scoreInspection } from '@/lib/rules';
import type {
  AdrReport, Answer, Base, Batch, Bi, CorrectiveAction, Customer, Db, DocumentFile, Destruction, District, Drug,
  DrugCategory, GoodsReceipt, Inspection, InspectionTemplate, MonthlyStat, Pharmacy, PharmacyType, Prescription,
  Province, RegulatoryReport, RenewalRequest, Role, Sale, StockMovement, Supplier, User,
} from './types';

export const DEMO_PHARMACY_ID = 'ph-001';
export const DEMO_DEVICE = 'D01';

/* ---------------------------------------------------------------- geography */

const PROVINCES: [string, string, string, number, number][] = [
  ['VTE', 'ນະຄອນຫຼວງວຽງຈັນ', 'Vientiane Capital', 17.9757, 102.6331],
  ['PSL', 'ຜົ້ງສາລີ', 'Phongsaly', 21.6819, 102.109],
  ['LNT', 'ຫຼວງນ້ຳທາ', 'Luang Namtha', 20.95, 101.4],
  ['ODX', 'ອຸດົມໄຊ', 'Oudomxay', 20.6927, 101.984],
  ['BKO', 'ບໍ່ແກ້ວ', 'Bokeo', 20.287, 100.42],
  ['LPB', 'ຫຼວງພະບາງ', 'Luang Prabang', 19.8856, 102.1347],
  ['HPN', 'ຫົວພັນ', 'Houaphanh', 20.42, 104.048],
  ['XYB', 'ໄຊຍະບູລີ', 'Xayaboury', 19.25, 101.71],
  ['XKH', 'ຊຽງຂວາງ', 'Xiengkhouang', 19.45, 103.19],
  ['VTP', 'ແຂວງວຽງຈັນ', 'Vientiane Province', 18.49, 102.41],
  ['BLX', 'ບໍລິຄຳໄຊ', 'Bolikhamxay', 18.39, 103.66],
  ['KHM', 'ຄຳມ່ວນ', 'Khammouane', 17.4, 104.83],
  ['SVK', 'ສະຫວັນນະເຂດ', 'Savannakhet', 16.56, 104.75],
  ['SRV', 'ສາລະວັນ', 'Salavan', 15.7167, 106.4167],
  ['SKG', 'ເຊກອງ', 'Sekong', 15.35, 106.72],
  ['CPS', 'ຈຳປາສັກ', 'Champasak', 15.12, 105.8],
  ['ATP', 'ອັດຕະປື', 'Attapeu', 14.81, 106.83],
  ['XSB', 'ໄຊສົມບູນ', 'Xaisomboun', 18.87, 103.05],
];

const DISTRICTS: Record<string, [string, string][]> = {
  VTE: [['ຈັນທະບູລີ', 'Chanthabouly'], ['ສີສັດຕະນາກ', 'Sisattanak'], ['ໄຊເສດຖາ', 'Xaysetha'], ['ສີໂຄດຕະບອງ', 'Sikhottabong'], ['ຫາດຊາຍຟອງ', 'Hadxayfong']],
  PSL: [['ຜົ້ງສາລີ', 'Phongsaly']],
  LNT: [['ນ້ຳທາ', 'Namtha'], ['ສີງ', 'Sing']],
  ODX: [['ໄຊ', 'Xay']],
  BKO: [['ຫ້ວຍຊາຍ', 'Houayxay']],
  LPB: [['ຫຼວງພະບາງ', 'Luang Prabang'], ['ນ້ຳບາກ', 'Nambak'], ['ຊຽງເງິນ', 'Xiengngeun']],
  HPN: [['ຊຳເໜືອ', 'Xamneua']],
  XYB: [['ໄຊຍະບູລີ', 'Xayaboury'], ['ປາກລາຍ', 'Paklai']],
  XKH: [['ແປກ', 'Pek']],
  VTP: [['ໂພນໂຮງ', 'Phonhong'], ['ວັງວຽງ', 'Vangvieng']],
  BLX: [['ປາກຊັນ', 'Paksan']],
  KHM: [['ທ່າແຂກ', 'Thakhek']],
  SVK: [['ໄກສອນ ພົມວິຫານ', 'Kaysone Phomvihane'], ['ອຸທຸມພອນ', 'Outhoumphone'], ['ສອງຄອນ', 'Songkhone']],
  SRV: [['ສາລະວັນ', 'Salavan']],
  SKG: [['ລະມາມ', 'Lamarm']],
  CPS: [['ປາກເຊ', 'Pakse'], ['ຈຳປາສັກ', 'Champasak'], ['ໂພນທອງ', 'Phonthong']],
  ATP: [['ສາມັກຄີໄຊ', 'Samakkhixay']],
  XSB: [['ອະນຸວົງ', 'Anouvong']],
};

/* ---------------------------------------------------------------- people */

const PEOPLE: Bi[] = [
  { lo: 'ສົມສັກ ພົມມະຈັນ', en: 'Somsak Phommachanh' },
  { lo: 'ວັນນາ ສີສຸວັນ', en: 'Vanna Sisouvanh' },
  { lo: 'ບຸນມີ ແກ້ວມະນີ', en: 'Bounmy Keomany' },
  { lo: 'ຄຳແພງ ແສງດາລາ', en: 'Khampheng Sengdala' },
  { lo: 'ນ້ອຍ ອິນທະວົງ', en: 'Noy Inthavong' },
  { lo: 'ພອນສະຫວັນ ວົງສາ', en: 'Phonsavanh Vongsa' },
  { lo: 'ດາວວອນ ສຸວັນນະວົງ', en: 'Daovone Souvannavong' },
  { lo: 'ທອງຈັນ ໄຊຍະວົງ', en: 'Thongchanh Sayavong' },
  { lo: 'ມະນີວອນ ແກ້ວລາ', en: 'Manivone Keola' },
  { lo: 'ແສງເພັດ ຈັນທະລາດ', en: 'Sengphet Chanthalath' },
  { lo: 'ອານຸສອນ ພິລາວົງ', en: 'Anousone Philavong' },
  { lo: 'ສຸລິຍາ ບຸບຜາ', en: 'Souliya Bouppha' },
  { lo: 'ຄຳຫຼ້າ ສີຫາລາດ', en: 'Khamla Sihalath' },
  { lo: 'ວິໄລພອນ ດວງມາລາ', en: 'Vilayphone Douangmala' },
  { lo: 'ບົວສອນ ລາດຊະວົງ', en: 'Bouasone Latsavong' },
  { lo: 'ສີສະຫວາດ ໄຊສົມບັດ', en: 'Sisavath Xaysombath' },
];

const SHOP_NAMES: Bi[] = [
  { lo: 'ສຸກສະບາຍ', en: 'Souksabay' }, { lo: 'ມິດຕະພາບ', en: 'Mittaphab' }, { lo: 'ພອນສະຫວັນ', en: 'Phonsavanh' },
  { lo: 'ຄຳແສງ', en: 'Khamsaeng' }, { lo: 'ວັດທະນາ', en: 'Vatthana' }, { lo: 'ສີວິໄລ', en: 'Sivilay' },
  { lo: 'ສົມບູນ', en: 'Somboun' }, { lo: 'ແສງຕາເວັນ', en: 'Saengtavanh' }, { lo: 'ດາວເຮືອງ', en: 'Daoheuang' },
  { lo: 'ທອງດີ', en: 'Thongdy' }, { lo: 'ສະບາຍດີ', en: 'Sabaidee' }, { lo: 'ຈັນທະວົງ', en: 'Chanthavong' },
  { lo: 'ນາງນວນ', en: 'Nangnuan' }, { lo: 'ຮຸ່ງອາລຸນ', en: 'Houng Aloun' }, { lo: 'ໃຈດີ', en: 'Jaidee' },
  { lo: 'ສຸຂະພາບດີ', en: 'Soukhaphab Dee' }, { lo: 'ເພື່ອນແພດ', en: 'Pheuan Phaet' }, { lo: 'ລ້ານຊ້າງ', en: 'Lane Xang' },
  { lo: 'ແມ່ຂອງ', en: 'Mekong' }, { lo: 'ດອກຈຳປາ', en: 'Dok Champa' },
];

const VILLAGES = ['ບ້ານ ໂພນໄຊ', 'ບ້ານ ສີເມືອງ', 'ບ້ານ ຫາຍໂສກ', 'ບ້ານ ທົ່ງຂັນຄຳ', 'ບ້ານ ໂພນສະອາດ', 'ບ້ານ ນາໄຊ', 'ບ້ານ ດົງໂດກ', 'ບ້ານ ໜອງບົວທອງ', 'ບ້ານ ໂພນທັນ', 'ບ້ານ ສະພັງໝໍ້'];

/* ---------------------------------------------------------------- drugs */

type DrugSeed = [generic: string, category: DrugCategory, form: string, strengths: string[], price: number, pack: string, ingredients?: string[]];

const DRUG_SEEDS: DrugSeed[] = [
  ['Paracetamol', 'GENERAL', 'Tablet', ['500 mg', '650 mg'], 1500, 'Box 10×10'],
  ['Paracetamol', 'GENERAL', 'Syrup', ['120 mg/5 mL'], 18000, 'Bottle 60 mL'],
  ['Ibuprofen', 'GENERAL', 'Tablet', ['200 mg', '400 mg'], 2500, 'Box 10×10'],
  ['Aspirin', 'GENERAL', 'Tablet', ['81 mg'], 1000, 'Box 10×10'],
  ['Vitamin C', 'GENERAL', 'Tablet', ['500 mg', '1000 mg'], 1200, 'Bottle 100'],
  ['Multivitamin', 'GENERAL', 'Capsule', ['—'], 2500, 'Bottle 30', ['vitamins']],
  ['Oral Rehydration Salts', 'GENERAL', 'Powder', ['20.5 g'], 3000, 'Sachet ×10', ['sodium chloride', 'glucose']],
  ['Loratadine', 'GENERAL', 'Tablet', ['10 mg'], 2000, 'Box 10×10'],
  ['Cetirizine', 'GENERAL', 'Tablet', ['10 mg'], 1800, 'Box 10×10'],
  ['Chlorpheniramine', 'GENERAL', 'Tablet', ['4 mg'], 500, 'Box 50×10'],
  ['Aluminium Hydroxide + Magnesium', 'GENERAL', 'Suspension', ['240 mL'], 22000, 'Bottle', ['aluminium hydroxide', 'magnesium hydroxide']],
  ['Loperamide', 'GENERAL', 'Capsule', ['2 mg'], 1500, 'Box 10×10'],
  ['Bisacodyl', 'GENERAL', 'Tablet', ['5 mg'], 1000, 'Box 10×10'],
  ['Dextromethorphan', 'GENERAL', 'Syrup', ['15 mg/5 mL'], 20000, 'Bottle 60 mL'],
  ['Ferrous Sulfate', 'GENERAL', 'Tablet', ['200 mg'], 800, 'Bottle 100'],
  ['Folic Acid', 'GENERAL', 'Tablet', ['5 mg'], 600, 'Bottle 100'],
  ['Calcium Carbonate', 'GENERAL', 'Tablet', ['600 mg'], 1500, 'Bottle 60'],
  ['Zinc Sulfate', 'GENERAL', 'Tablet', ['20 mg'], 1200, 'Box 10×10'],
  ['Povidone Iodine', 'GENERAL', 'Solution', ['10%'], 15000, 'Bottle 30 mL'],
  ['Hydrocortisone', 'GENERAL', 'Cream', ['1%'], 18000, 'Tube 15 g'],
  ['Clotrimazole', 'GENERAL', 'Cream', ['1%'], 16000, 'Tube 20 g'],
  ['Albendazole', 'GENERAL', 'Tablet', ['400 mg'], 4000, 'Box 1'],
  ['Mebendazole', 'GENERAL', 'Tablet', ['500 mg'], 4000, 'Box 1'],
  ['Amoxicillin', 'PRESCRIPTION_ONLY', 'Capsule', ['250 mg', '500 mg'], 1500, 'Box 10×10', ['amoxicillin', 'penicillin']],
  ['Amoxicillin + Clavulanate', 'PRESCRIPTION_ONLY', 'Tablet', ['625 mg', '1 g'], 6500, 'Box 2×7', ['amoxicillin', 'clavulanate', 'penicillin']],
  ['Azithromycin', 'PRESCRIPTION_ONLY', 'Tablet', ['250 mg', '500 mg'], 7000, 'Box 1×3'],
  ['Ciprofloxacin', 'PRESCRIPTION_ONLY', 'Tablet', ['500 mg'], 3000, 'Box 10×10'],
  ['Metronidazole', 'PRESCRIPTION_ONLY', 'Tablet', ['250 mg'], 800, 'Box 10×10'],
  ['Doxycycline', 'PRESCRIPTION_ONLY', 'Capsule', ['100 mg'], 1500, 'Box 10×10'],
  ['Cefixime', 'PRESCRIPTION_ONLY', 'Capsule', ['200 mg'], 6000, 'Box 1×10', ['cefixime', 'cephalosporin']],
  ['Ceftriaxone', 'PRESCRIPTION_ONLY', 'Injection', ['1 g'], 25000, 'Vial'],
  ['Co-trimoxazole', 'PRESCRIPTION_ONLY', 'Tablet', ['480 mg'], 700, 'Box 10×10', ['sulfamethoxazole', 'trimethoprim', 'sulfa']],
  ['Metformin', 'PRESCRIPTION_ONLY', 'Tablet', ['500 mg', '850 mg'], 900, 'Box 10×10'],
  ['Glibenclamide', 'PRESCRIPTION_ONLY', 'Tablet', ['5 mg'], 700, 'Box 10×10'],
  ['Amlodipine', 'PRESCRIPTION_ONLY', 'Tablet', ['5 mg', '10 mg'], 1200, 'Box 10×10'],
  ['Enalapril', 'PRESCRIPTION_ONLY', 'Tablet', ['5 mg', '10 mg'], 1000, 'Box 10×10'],
  ['Losartan', 'PRESCRIPTION_ONLY', 'Tablet', ['50 mg'], 2000, 'Box 3×10'],
  ['Atenolol', 'PRESCRIPTION_ONLY', 'Tablet', ['50 mg'], 900, 'Box 10×10'],
  ['Hydrochlorothiazide', 'PRESCRIPTION_ONLY', 'Tablet', ['25 mg'], 600, 'Box 10×10', ['hydrochlorothiazide', 'sulfa']],
  ['Atorvastatin', 'PRESCRIPTION_ONLY', 'Tablet', ['20 mg', '40 mg'], 2500, 'Box 3×10'],
  ['Omeprazole', 'PRESCRIPTION_ONLY', 'Capsule', ['20 mg'], 1500, 'Box 10×10'],
  ['Prednisolone', 'PRESCRIPTION_ONLY', 'Tablet', ['5 mg'], 500, 'Box 10×10'],
  ['Dexamethasone', 'PRESCRIPTION_ONLY', 'Tablet', ['0.5 mg'], 400, 'Box 10×10'],
  ['Salbutamol', 'PRESCRIPTION_ONLY', 'Inhaler', ['100 mcg'], 45000, 'Inhaler 200 doses'],
  ['Artemether + Lumefantrine', 'PRESCRIPTION_ONLY', 'Tablet', ['20/120 mg'], 30000, 'Box 24'],
  ['Fluconazole', 'PRESCRIPTION_ONLY', 'Capsule', ['150 mg'], 8000, 'Box 1'],
  ['Acyclovir', 'PRESCRIPTION_ONLY', 'Tablet', ['400 mg'], 2000, 'Box 10×10'],
  ['Insulin (human, NPH)', 'PRESCRIPTION_ONLY', 'Injection', ['100 IU/mL'], 120000, 'Vial 10 mL'],
  ['Diazepam', 'CONTROLLED', 'Tablet', ['5 mg'], 1500, 'Box 10×10'],
  ['Alprazolam', 'CONTROLLED', 'Tablet', ['0.5 mg'], 2500, 'Box 3×10'],
  ['Phenobarbital', 'CONTROLLED', 'Tablet', ['30 mg'], 800, 'Bottle 100'],
  ['Codeine Phosphate', 'CONTROLLED', 'Tablet', ['30 mg'], 3000, 'Box 10×10'],
  ['Tramadol', 'CONTROLLED', 'Capsule', ['50 mg'], 2500, 'Box 10×10'],
  ['Morphine Sulfate', 'CONTROLLED', 'Injection', ['10 mg/mL'], 35000, 'Ampoule'],
  ['Pethidine', 'CONTROLLED', 'Injection', ['50 mg/mL'], 40000, 'Ampoule'],
  ['Clonazepam', 'CONTROLLED', 'Tablet', ['0.5 mg'], 2500, 'Box 3×10'],
  ['Pseudoephedrine', 'CONTROLLED', 'Tablet', ['60 mg'], 2000, 'Box 10×10'],
  ['Methotrexate', 'DANGEROUS', 'Tablet', ['2.5 mg'], 4000, 'Bottle 100'],
  ['Warfarin', 'DANGEROUS', 'Tablet', ['5 mg'], 2000, 'Box 10×10'],
  ['Isotretinoin', 'DANGEROUS', 'Capsule', ['20 mg'], 12000, 'Box 3×10'],
  ['Digoxin', 'DANGEROUS', 'Tablet', ['0.25 mg'], 1000, 'Box 10×10'],
];

const MANUFACTURERS = ['Lao Pharma Factory No.2', 'Lao Pharma Factory No.3', 'Mekong Pharma', 'Siam Generic Lab', 'Hanoi Medipharm', 'Indochina Generics', 'Asia Pacific Healthcare', 'Saigon Pharmaco'];
const IMPORTERS = ['—', 'Vientiane Medical Supply', 'Lane Xang Import', 'Champa Pharma Trading'];
const BRAND_SUFFIX = ['', '-LP', ' Forte', '-M', ' Plus', '-Gen', 'zol', 'mex'];

/* ---------------------------------------------------------------- inspection template */

export const GPP_TEMPLATE: InspectionTemplate = {
  id: 'tpl-gpp-v3',
  name: { lo: 'ມາດຕະຖານການປະຕິບັດທີ່ດີທາງຮ້ານຂາຍຢາ (GPP)', en: 'Good Pharmacy Practice (GPP)' },
  version: 3,
  sections: [
    { id: 'S1', title: { lo: 'ສະຖານທີ່ ແລະ ອຸປະກອນ', en: 'Premises & equipment' }, items: [
      { id: 'S1.1', q: { lo: 'ຮ້ານສະອາດ, ເປັນລະບຽບ ແລະ ມີແສງສະຫວ່າງພຽງພໍ', en: 'Premises clean, orderly and well lit' }, evidence: { lo: 'ຮູບຖ່າຍ', en: 'Photo' }, weight: 2, critical: false },
      { id: 'S1.2', q: { lo: 'ມີປ້າຍຊື່ຮ້ານ ແລະ ໃບອະນຸຍາດຕິດໃຫ້ເຫັນຊັດເຈນ', en: 'Sign board and license displayed' }, evidence: { lo: 'ຮູບຖ່າຍ', en: 'Photo' }, weight: 2, critical: false },
      { id: 'S1.3', q: { lo: 'ພື້ນທີ່ຮ້ານບໍ່ໜ້ອຍກວ່າ 12 ຕາແມັດ', en: 'Floor area at least 12 m²' }, evidence: { lo: 'ການວັດແທກ', en: 'Measurement' }, weight: 1, critical: false },
    ] },
    { id: 'S2', title: { lo: 'ບຸກຄະລາກອນ', en: 'Personnel' }, items: [
      { id: 'S2.1', q: { lo: 'ເພສັດກອນຜູ້ຮັບຜິດຊອບຢູ່ປະຈຳການໃນເວລາເປີດ', en: 'Responsible pharmacist present during opening hours' }, evidence: { lo: 'ບັດປະຈຳຕົວ', en: 'ID check' }, weight: 5, critical: true },
      { id: 'S2.2', q: { lo: 'ພະນັກງານນຸ່ງເຄື່ອງແບບ ແລະ ຕິດບັດຊື່', en: 'Staff in uniform with name badge' }, evidence: { lo: 'ສັງເກດ', en: 'Observation' }, weight: 1, critical: false },
      { id: 'S2.3', q: { lo: 'ພະນັກງານໄດ້ຮັບການຝຶກອົບຮົມ GPP ພາຍໃນ 2 ປີ', en: 'Staff GPP training within 2 years' }, evidence: { lo: 'ໃບຢັ້ງຢືນ', en: 'Certificate' }, weight: 2, critical: false },
    ] },
    { id: 'S3', title: { lo: 'ການເກັບຮັກສາຢາ', en: 'Storage' }, items: [
      { id: 'S3.1', q: { lo: 'ອຸນຫະພູມຫ້ອງບໍ່ເກີນ 30°C ແລະ ມີບັນທຶກປະຈຳວັນ', en: 'Room temperature ≤ 30°C with daily log' }, evidence: { lo: 'ບັນທຶກອຸນຫະພູມ', en: 'Temperature log' }, weight: 3, critical: false },
      { id: 'S3.2', q: { lo: 'ມີຕູ້ເຢັນສຳລັບຢາທີ່ຕ້ອງເກັບໃນ 2–8°C', en: 'Refrigerator for 2–8°C products' }, evidence: { lo: 'ຮູບຖ່າຍ', en: 'Photo' }, weight: 2, critical: false },
      { id: 'S3.3', q: { lo: 'ບໍ່ພົບຢາໝົດອາຍຸ ຫຼື ຢາເຖື່ອນໃນບ່ອນຂາຍ', en: 'No expired or unregistered drugs on shelves' }, evidence: { lo: 'ກວດສຸ່ມ', en: 'Spot check' }, weight: 5, critical: true },
      { id: 'S3.4', q: { lo: 'ຈັດວາງຢາແບບ FEFO', en: 'Stock arranged FEFO' }, evidence: { lo: 'ສັງເກດ', en: 'Observation' }, weight: 2, critical: false },
    ] },
    { id: 'S4', title: { lo: 'ການຈ່າຍຢາ', en: 'Dispensing' }, items: [
      { id: 'S4.1', q: { lo: 'ຢາຕ້ອງມີໃບສັ່ງແພດ ຂາຍຕາມໃບສັ່ງແພດເທົ່ານັ້ນ', en: 'Prescription-only drugs sold only with prescription' }, evidence: { lo: 'ກວດໃບສັ່ງແພດ', en: 'Prescription audit' }, weight: 5, critical: true },
      { id: 'S4.2', q: { lo: 'ມີສະຫຼາກວິທີໃຊ້ຢາເປັນພາສາລາວ', en: 'Lao-language dosage labels on dispensed drugs' }, evidence: { lo: 'ຕົວຢ່າງ', en: 'Sample' }, weight: 2, critical: false },
      { id: 'S4.3', q: { lo: 'ໃຫ້ຄຳແນະນຳການໃຊ້ຢາແກ່ຄົນເຈັບ', en: 'Patient counselling provided' }, evidence: { lo: 'ສັງເກດ', en: 'Observation' }, weight: 2, critical: false },
    ] },
    { id: 'S5', title: { lo: 'ຢາຄວບຄຸມພິເສດ', en: 'Controlled drugs' }, items: [
      { id: 'S5.1', q: { lo: 'ເກັບໃນຕູ້ລັອກ 2 ຊັ້ນ ແຍກຕ່າງຫາກ', en: 'Stored in separate double-locked cabinet' }, evidence: { lo: 'ຮູບຖ່າຍ', en: 'Photo' }, weight: 4, critical: true },
      { id: 'S5.2', q: { lo: 'ປຶ້ມບັນທຶກຢາຄວບຄຸມຖືກຕ້ອງກັບສະຕັອກຕົວຈິງ', en: 'Controlled register matches physical stock' }, evidence: { lo: 'ນັບສະຕັອກ', en: 'Stock count' }, weight: 5, critical: true },
    ] },
    { id: 'S6', title: { lo: 'ເອກະສານ', en: 'Documentation' }, items: [
      { id: 'S6.1', q: { lo: 'ມີໃບບິນຊື້ຢາຈາກຜູ້ສະໜອງທີ່ໄດ້ຮັບອະນຸຍາດ', en: 'Purchase invoices from licensed suppliers' }, evidence: { lo: 'ໃບບິນ', en: 'Invoices' }, weight: 3, critical: false },
      { id: 'S6.2', q: { lo: 'ສົ່ງລາຍງານປະຈຳເດືອນຄົບຖ້ວນ', en: 'Monthly reports submitted on time' }, evidence: { lo: 'ລະບົບ', en: 'System' }, weight: 2, critical: false },
    ] },
  ],
};

/* ---------------------------------------------------------------- generator */

function base(id: string, at: Date, by = 'system'): Base {
  const iso = at.toISOString();
  return { id, createdAt: iso, updatedAt: iso, createdBy: by, version: 1, deletedAt: null };
}
const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const iso = (d: Date) => d.toISOString();
const atTime = (d: Date, r: Rng) => new Date(d.getTime() + int(r, 8, 20) * 3_600_000 + int(r, 0, 59) * 60_000);

export interface Seed extends Db {
  monthly: MonthlyStat[];
}

export function generateSeed(): Seed {
  const r = mulberry32(20260101);
  const now = today();

  const provinces: Province[] = PROVINCES.map(([code, lo, en, lat, lng]) => ({ id: `pv-${code}`, code, name: { lo, en }, lat, lng }));
  const districts: District[] = provinces.flatMap((p) =>
    DISTRICTS[p.code].map(([lo, en], i) => ({ id: `${p.id}-d${i + 1}`, provinceId: p.id, name: { lo, en } })),
  );

  /* pharmacies — weighted toward populous provinces */
  const weights: Record<string, number> = { VTE: 15, SVK: 6, CPS: 6, LPB: 5, VTP: 3, KHM: 2, XYB: 2, BLX: 1, LNT: 1, ODX: 1, BKO: 1, HPN: 1, XKH: 1, SRV: 1, SKG: 1, ATP: 1, PSL: 1, XSB: 1 };
  const pharmacies: Pharmacy[] = [];
  const types: PharmacyType[] = ['PHARMACY', 'PHARMACY', 'PHARMACY', 'DRUG_STORE', 'CLINIC_DISPENSARY'];
  let n = 0;
  for (const p of provinces) {
    const ds = districts.filter((d) => d.provinceId === p.id);
    for (let k = 0; k < weights[p.code]; k++) {
      n++;
      const shop = SHOP_NAMES[(n - 1) % SHOP_NAMES.length];
      const suffix = n > SHOP_NAMES.length ? ` ${Math.ceil(n / SHOP_NAMES.length)}` : '';
      const isDemo = n === 1;
      const spread = p.code === 'VTE' ? 0.045 : 0.06;
      const issue = addDays(now, -int(r, 120, 1500));
      // Mix of license expiries so every status bucket is populated
      const bucket = r();
      const expiry = isDemo ? addDays(now, 47)
        : bucket < 0.08 ? addDays(now, -int(r, 5, 120))
        : bucket < 0.16 ? addDays(now, int(r, 1, 30))
        : bucket < 0.24 ? addDays(now, int(r, 31, 90))
        : addDays(now, int(r, 91, 1000));
      const status = isDemo ? 'ACTIVE' : n % 23 === 0 ? 'SUSPENDED' : n % 17 === 0 ? 'PENDING' : n === 41 ? 'CLOSED' : 'ACTIVE';
      const t = isDemo ? 'PHARMACY' : pick(r, types);
      const prefix = t === 'PHARMACY' ? { lo: 'ຮ້ານຂາຍຢາ', en: 'Pharmacy' } : t === 'DRUG_STORE' ? { lo: 'ຮ້ານຢາ', en: 'Drug Store' } : { lo: 'ຫ້ອງຈ່າຍຢາຄລີນິກ', en: 'Clinic Dispensary' };
      pharmacies.push({
        ...base(`ph-${pad(n)}`, issue),
        code: `${p.code}-${pad(n)}`,
        name: { lo: `${prefix.lo} ${shop.lo}${suffix}`, en: `${shop.en}${suffix} ${prefix.en}` },
        type: t,
        provinceId: p.id,
        districtId: isDemo ? ds[0].id : pick(r, ds).id,
        village: pick(r, VILLAGES),
        phone: `020 ${int(r, 2, 9)}${int(r, 100, 999)} ${int(r, 1000, 9999)}`,
        owner: isDemo ? PEOPLE[0] : pick(r, PEOPLE),
        pharmacist: isDemo ? PEOPLE[1] : pick(r, PEOPLE),
        lat: isDemo ? 17.9666 : +(p.lat + (r() - 0.5) * spread).toFixed(5),
        lng: isDemo ? 102.6133 : +(p.lng + (r() - 0.5) * spread).toFixed(5),
        status,
        license: { number: `MOH/PH/${issue.getFullYear()}/${pad(n, 4)}`, issueDate: iso(issue), expiryDate: iso(expiry), revoked: status === 'SUSPENDED' && n % 2 === 0 },
        complianceScore: isDemo ? 86 : int(r, 70, 99),
      });
    }
  }

  /* drug catalog (~300 items) */
  const drugs: Drug[] = [];
  let dn = 0;
  for (const [generic, category, form, strengths, price, pack, ingr] of DRUG_SEEDS) {
    for (const strength of strengths) {
      const brandCount = strengths.length > 1 ? int(r, 2, 3) : int(r, 3, 5);
      for (let b = 0; b < brandCount; b++) {
        dn++;
        const mf = MANUFACTURERS[(dn * 7 + b) % MANUFACTURERS.length];
        const root = generic.split(/[ +(]/)[0];
        const brand = b === 0 ? `${root} ${mf.split(' ')[0]}` : `${root.slice(0, 5)}${BRAND_SUFFIX[(dn + b) % BRAND_SUFFIX.length]}`;
        const status = dn === 37 || dn === 151 || dn === 212 ? 'BANNED' : dn === 18 || dn === 88 || dn === 190 || dn === 260 ? 'RECALLED' : 'APPROVED';
        drugs.push({
          ...base(`dr-${pad(dn)}`, addDays(now, -int(r, 400, 2000))),
          generic, brand, strength, form, packSize: pack, category,
          regNo: `LA-${category[0]}${pad(dn, 4)}-${int(r, 18, 26)}`,
          manufacturer: mf, importer: mf.startsWith('Lao') ? '—' : pick(r, IMPORTERS.slice(1)),
          barcode: `885${pad(int(r, 1000, 9999), 4)}${pad(dn, 6)}`,
          status,
          ingredients: ingr ?? [generic.toLowerCase()],
          refPrice: Math.round((price * (0.85 + r() * 0.4)) / 100) * 100 || 500,
        });
      }
    }
  }

  /* demo pharmacy suppliers */
  const suppliers: Supplier[] = [
    ['Vientiane Medical Supply', 'ນາງ ສຸດາ', 'NET 30'],
    ['Lane Xang Import Co.', 'ທ້າວ ບຸນທັນ', 'NET 15'],
    ['Champa Pharma Trading', 'ນາງ ແກ້ວ', 'COD'],
    ['Lao Pharma Factory No.2 (Sales)', 'ທ້າວ ສົມພອນ', 'NET 30'],
    ['Mekong Pharma Distribution', 'ນາງ ມາລີ', 'NET 45'],
  ].map(([name, contact, terms], i) => ({
    ...base(`sp-${pad(i + 1)}`, addDays(now, -400)), pharmacyId: DEMO_PHARMACY_ID, name, contact,
    phone: `021 ${int(r, 200, 999)} ${int(r, 100, 999)}`, licenseNo: `MOH/WS/${pad(int(r, 10, 300))}`, paymentTerms: terms,
  }));

  /* batches + receiving movements for the demo pharmacy */
  const batches: Batch[] = [];
  const movements: StockMovement[] = [];
  const receipts: GoodsReceipt[] = [];
  const stocked = drugs.filter((d, i) => d.status !== 'BANNED' && (i % 2 === 0 || d.category === 'CONTROLLED'));
  // keep one recalled drug in stock so the recall alert has something to point at
  const recalledInStock = drugs.find((d) => d.status === 'RECALLED');
  if (recalledInStock && !stocked.includes(recalledInStock)) stocked.push(recalledInStock);
  let bn = 0;
  const balance = new Map<string, number>();
  stocked.forEach((d, i) => {
    const nb = int(r, 1, 3);
    for (let k = 0; k < nb; k++) {
      bn++;
      const recvDay = addDays(now, -int(r, 100, 220));
      const expBucket = r();
      const expiry = expBucket < 0.05 ? addDays(now, -int(r, 1, 40))
        : expBucket < 0.12 ? addDays(now, int(r, 5, 30))
        : expBucket < 0.2 ? addDays(now, int(r, 31, 60))
        : expBucket < 0.28 ? addDays(now, int(r, 61, 90))
        : addDays(now, int(r, 120, 900));
      const cost = Math.round((d.refPrice * 0.72) / 100) * 100 || 300;
      const id = `bt-${pad(bn, 4)}`;
      batches.push({
        ...base(id, recvDay), pharmacyId: DEMO_PHARMACY_ID, drugId: d.id,
        lot: `${d.generic.slice(0, 2).toUpperCase()}${int(r, 10, 99)}${String.fromCharCode(65 + (bn % 26))}${int(r, 100, 999)}`,
        mfgDate: iso(addDays(expiry, -730)), expiryDate: iso(expiry), cost, price: d.refPrice,
      });
      const lowStock = i % 11 === 0;
      const qty = lowStock ? int(r, 25, 45) : d.category === 'CONTROLLED' ? int(r, 60, 150) : int(r, 120, 600);
      balance.set(id, qty);
      movements.push({
        ...base(`mv-r-${bn}`, recvDay), pharmacyId: DEMO_PHARMACY_ID, batchId: id, drugId: d.id, type: 'RECEIVE',
        qty, ref: `GR-${pad(Math.ceil(bn / 8), 4)}`, device: DEMO_DEVICE, at: iso(recvDay),
      });
    }
  });
  for (let g = 1; g <= Math.ceil(bn / 8); g++) {
    const at = addDays(now, -int(r, 100, 220));
    receipts.push({
      ...base(`GR-${pad(g, 4)}`, at), pharmacyId: DEMO_PHARMACY_ID, supplierId: pick(r, suppliers).id,
      invoiceNo: `INV-${int(r, 10000, 99999)}`, at: iso(at), total: int(r, 15, 120) * 100000, lineCount: 8, hasPhoto: r() > 0.3,
    });
  }

  /* customers */
  const customers: Customer[] = PEOPLE.slice(2, 14).map((p, i) => ({
    ...base(`cu-${pad(i + 1)}`, addDays(now, -int(r, 30, 300))), pharmacyId: DEMO_PHARMACY_ID, name: p.lo,
    phone: `020 5${int(r, 100, 999)} ${int(r, 1000, 9999)}`,
    allergies: i === 0 ? ['penicillin'] : i === 3 ? ['sulfa'] : i === 6 ? ['aspirin'] : [],
  }));

  /* 90 days of sales history (FEFO-consistent so stock never goes negative) */
  const sales: Sale[] = [];
  const prescriptions: Prescription[] = [];
  const batchesByDrug = new Map<string, Batch[]>();
  for (const b of batches) batchesByDrug.set(b.drugId, [...(batchesByDrug.get(b.drugId) ?? []), b]);
  const general = stocked.filter((d) => d.category === 'GENERAL' && d.status === 'APPROVED');
  const rx = stocked.filter((d) => d.category !== 'GENERAL' && d.status === 'APPROVED');
  const cashiers = ['u-pharmacist', 'u-staff', 'u-owner'];
  let rn = 0, pn = 0;
  for (let day = 90; day >= 0; day--) {
    const date = addDays(now, -day);
    const count = day === 0 ? 14 : int(r, 16, 34);
    for (let s = 0; s < count; s++) {
      const at = day === 0 ? new Date(date.getTime() + (8 + s * 0.4) * 3_600_000) : atTime(date, r);
      const lines: Sale['lines'] = [];
      const lineCount = int(r, 1, 3);
      let needsRx = false;
      for (let l = 0; l < lineCount; l++) {
        const useRx = r() < 0.22;
        const d = pick(r, useRx ? rx : general);
        if (lines.some((x) => x.drugId === d.id)) continue;
        const qty = d.form === 'Tablet' || d.form === 'Capsule' ? int(r, 6, 30) : int(r, 1, 2);
        const avail = (batchesByDrug.get(d.id) ?? [])
          .filter((b) => b.expiryDate > iso(at) && (balance.get(b.id) ?? 0) > qty + 15)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
        if (!avail) continue;
        balance.set(avail.id, (balance.get(avail.id) ?? 0) - qty);
        if (d.category !== 'GENERAL') needsRx = true;
        lines.push({ drugId: d.id, batchId: avail.id, qty, price: avail.price, cost: avail.cost });
      }
      if (!lines.length) continue;
      rn++;
      const subtotal = lines.reduce((a, x) => a + x.qty * x.price, 0);
      const discount = r() < 0.1 ? Math.round(subtotal * 0.05 / 1000) * 1000 : 0;
      const saleId = `sl-${pad(rn, 5)}`;
      let prescriptionId: string | undefined;
      if (needsRx) {
        pn++;
        prescriptionId = `rx-${pad(pn, 4)}`;
        const pat = pick(r, PEOPLE);
        prescriptions.push({
          ...base(prescriptionId, at, pick(r, cashiers)), pharmacyId: DEMO_PHARMACY_ID,
          doctorName: `Dr. ${pick(r, PEOPLE).en}`, doctorLicense: `MD-${int(r, 1000, 9999)}`,
          facility: pick(r, ['ໂຮງໝໍມິດຕະພາບ', 'ໂຮງໝໍມະໂຫສົດ', 'ໂຮງໝໍເສດຖາທິລາດ', 'ຄລີນິກ ສຸຂະພາບດີ', 'ໂຮງໝໍແມ່ ແລະ ເດັກ']),
          patientName: pat.lo, patientAge: int(r, 4, 78), patientSex: r() > 0.5 ? 'M' : 'F', patientIdNo: `${int(r, 100000, 999999)}`,
          date: iso(at), hasPhoto: r() > 0.05, saleId, drugIds: lines.filter((x) => drugs.find((d) => d.id === x.drugId)!.category !== 'GENERAL').map((x) => x.drugId),
        });
      }
      sales.push({
        ...base(saleId, at, cashiers[s % 3]), pharmacyId: DEMO_PHARMACY_ID,
        receiptNo: `${DEMO_DEVICE}-${ymd(at)}-${pad(s + 1, 4)}`, at: iso(at), cashier: cashiers[s % 3],
        method: r() < 0.6 ? 'CASH' : r() < 0.6 ? 'QR' : 'BANK', lines, subtotal, discount, total: subtotal - discount,
        customerId: r() < 0.15 ? pick(r, customers).id : undefined, prescriptionId,
      });
      lines.forEach((ln, li) =>
        movements.push({
          ...base(`mv-s-${rn}-${li}`, at), pharmacyId: DEMO_PHARMACY_ID, batchId: ln.batchId, drugId: ln.drugId,
          type: 'SALE', qty: -ln.qty, ref: saleId, device: DEMO_DEVICE, at: iso(at),
        }),
      );
    }
  }
  // a couple of adjustments
  batches.slice(3, 6).forEach((b, i) => {
    const at = addDays(now, -int(r, 5, 40));
    movements.push({ ...base(`mv-a-${i}`, at), pharmacyId: DEMO_PHARMACY_ID, batchId: b.id, drugId: b.drugId, type: 'ADJUST', qty: -int(r, 1, 4), ref: `ADJ-${i + 1}`, reason: 'Damaged packaging', device: DEMO_DEVICE, at: iso(at) });
  });

  /* destruction + ADR */
  const expiredBatches = batches.filter((b) => new Date(b.expiryDate) < now).slice(0, 6);
  const destructions: Destruction[] = [
    { ...base('ds-001', addDays(now, -60)), pharmacyId: DEMO_PHARMACY_ID, date: iso(addDays(now, -58)), method: 'Incineration', witnesses: [PEOPLE[1].lo, PEOPLE[4].lo], items: expiredBatches.slice(0, 2).map((b) => ({ batchId: b.id, drugId: b.drugId, qty: 20 })), status: 'APPROVED', approvedBy: 'u-officer' },
    { ...base('ds-002', addDays(now, -4)), pharmacyId: DEMO_PHARMACY_ID, date: iso(addDays(now, 3)), method: 'Incineration', witnesses: [PEOPLE[1].lo], items: expiredBatches.slice(2, 4).map((b) => ({ batchId: b.id, drugId: b.drugId, qty: 10 })), status: 'PENDING_APPROVAL' },
  ];
  const adrs: AdrReport[] = [
    { ...base('adr-001', addDays(now, -20)), pharmacyId: DEMO_PHARMACY_ID, patientInitials: 'S.K.', patientAge: 34, drugId: drugs.find((d) => d.generic === 'Amoxicillin')!.id, batchLot: 'AM45C220', reaction: 'ຜື່ນແດງ ແລະ ຄັນທົ່ວຮ່າງກາຍ ຫຼັງກິນຢາ 2 ຊົ່ວໂມງ', severity: 'MODERATE', outcome: 'RECOVERED', reporter: PEOPLE[1].lo, date: iso(addDays(now, -20)) },
    { ...base('adr-002', addDays(now, -6)), pharmacyId: DEMO_PHARMACY_ID, patientInitials: 'B.V.', patientAge: 61, drugId: drugs.find((d) => d.generic === 'Enalapril')!.id, batchLot: 'EN12F540', reaction: 'ໄອແຫ້ງເຮື້ອຮັງ', severity: 'MILD', outcome: 'RECOVERING', reporter: PEOPLE[1].lo, date: iso(addDays(now, -6)) },
  ];

  /* users */
  const u = (id: string, username: string, name: Bi, role: Role, extra: Partial<User> = {}): User => ({
    ...base(id, addDays(now, -300)), username, phone: `020 ${int(r, 5000, 9999)} ${int(r, 1000, 9999)}`, name, role,
    active: true, twoFactor: ['SUPER_ADMIN', 'MINISTRY_ADMIN', 'PROVINCIAL_OFFICER', 'INSPECTOR'].includes(role),
    lastLogin: iso(addDays(now, -int(r, 0, 5))), ...extra,
  });
  const users: User[] = [
    u('u-super', 'admin', { lo: 'ຜູ້ດູແລລະບົບ', en: 'System Admin' }, 'SUPER_ADMIN'),
    u('u-ministry', 'ministry', PEOPLE[10], 'MINISTRY_ADMIN'),
    u('u-officer', 'officer.vte', PEOPLE[11], 'PROVINCIAL_OFFICER', { provinceId: 'pv-VTE' }),
    u('u-officer2', 'officer.svk', PEOPLE[12], 'PROVINCIAL_OFFICER', { provinceId: 'pv-SVK' }),
    u('u-inspector', 'inspector1', PEOPLE[13], 'INSPECTOR', { provinceId: 'pv-VTE' }),
    u('u-inspector2', 'inspector2', PEOPLE[14], 'INSPECTOR', { provinceId: 'pv-VTE' }),
    u('u-inspector3', 'inspector3', PEOPLE[15], 'INSPECTOR', { provinceId: 'pv-CPS' }),
    u('u-owner', 'owner', PEOPLE[0], 'PHARMACY_OWNER', { pharmacyId: DEMO_PHARMACY_ID }),
    u('u-pharmacist', 'pharmacist', PEOPLE[1], 'PHARMACIST', { pharmacyId: DEMO_PHARMACY_ID }),
    u('u-staff', 'staff', PEOPLE[4], 'STAFF', { pharmacyId: DEMO_PHARMACY_ID }),
    u('u-staff2', 'staff2', PEOPLE[8], 'STAFF', { pharmacyId: DEMO_PHARMACY_ID, active: false }),
  ];

  /* inspections */
  const inspections: Inspection[] = [];
  const corrective: CorrectiveAction[] = [];
  const allItems = GPP_TEMPLATE.sections.flatMap((s) => s.items);
  let inn = 0, can = 0;
  for (const ph of pharmacies) {
    if (ph.status === 'PENDING') continue;
    const past = int(r, 1, 3);
    for (let k = 0; k < past; k++) {
      inn++;
      const date = addDays(now, -int(r, 10, 360) - k * 120);
      const answers: Record<string, Answer> = {};
      const quality = ph.complianceScore / 100;
      for (const it of allItems) answers[it.id] = r() < quality + (it.critical ? 0.12 : 0.04) ? 'YES' : r() < 0.15 ? 'NA' : 'NO';
      const { score, result } = scoreInspection(GPP_TEMPLATE, answers);
      const insp: Inspection = {
        ...base(`in-${pad(inn, 4)}`, date, 'u-inspector'), pharmacyId: ph.id,
        inspectorIds: [ph.provinceId === 'pv-CPS' ? 'u-inspector3' : pick(r, ['u-inspector', 'u-inspector2'])],
        date: iso(date), status: 'COMPLETED', templateId: GPP_TEMPLATE.id, answers, notes: {}, photos: {},
        score, result, checkIn: { lat: ph.lat, lng: ph.lng, at: iso(date) }, signedByInspector: true, signedByPharmacy: true,
      };
      inspections.push(insp);
      if (k === 0 && result !== 'PASS') {
        for (const it of allItems.filter((x) => answers[x.id] === 'NO').slice(0, 2)) {
          can++;
          const deadline = addDays(date, 30);
          const status = deadline < now ? (r() < 0.6 ? 'VERIFIED' : 'OVERDUE') : r() < 0.4 ? 'SUBMITTED' : 'OPEN';
          corrective.push({
            ...base(`ca-${pad(can, 4)}`, date, 'u-inspector'), pharmacyId: ph.id, inspectionId: insp.id,
            finding: it.q, action: { lo: `ແກ້ໄຂ: ${it.q.lo}`, en: `Remediate: ${it.q.en}` }, deadline: iso(deadline), status,
          });
        }
      }
    }
  }
  // demo pharmacy: ensure an open corrective action
  corrective.push({
    ...base('ca-demo', addDays(now, -12), 'u-inspector'), pharmacyId: DEMO_PHARMACY_ID, inspectionId: inspections.find((i) => i.pharmacyId === DEMO_PHARMACY_ID)!.id,
    finding: allItems[6].q, action: { lo: 'ຕິດຕັ້ງເຄື່ອງວັດອຸນຫະພູມ ແລະ ບັນທຶກປະຈຳວັນ', en: 'Install thermometer and keep a daily temperature log' },
    deadline: iso(addDays(now, 18)), status: 'OPEN',
  });
  // upcoming planned inspections
  pharmacies.filter((p) => p.provinceId === 'pv-VTE' || p.provinceId === 'pv-CPS').slice(0, 14).forEach((ph, i) => {
    inn++;
    const date = addDays(now, i < 2 ? 0 : int(r, 1, 40));
    inspections.push({
      ...base(`in-${pad(inn, 4)}`, addDays(now, -3), 'u-officer'), pharmacyId: ph.id,
      inspectorIds: [ph.provinceId === 'pv-CPS' ? 'u-inspector3' : i % 2 ? 'u-inspector2' : 'u-inspector'],
      date: iso(date), status: 'PLANNED', templateId: GPP_TEMPLATE.id, answers: {}, notes: {}, photos: {},
    });
  });

  /* renewals */
  const renewals: RenewalRequest[] = pharmacies
    .filter((p) => { const days = (new Date(p.license.expiryDate).getTime() - now.getTime()) / 86_400_000; return days < 60 && p.id !== DEMO_PHARMACY_ID; })
    .slice(0, 9)
    .map((p, i) => ({
      ...base(`rn-${pad(i + 1)}`, addDays(now, -int(r, 1, 25)), 'u-owner'), pharmacyId: p.id, submittedAt: iso(addDays(now, -int(r, 1, 25))),
      status: i < 6 ? 'PENDING' : i < 8 ? 'APPROVED' : 'REJECTED',
      notes: 'ຂໍຕໍ່ອາຍຸໃບອະນຸຍາດ 3 ປີ', documents: ['license-old.pdf', 'pharmacist-cert.pdf', 'tax-clearance.pdf'],
      decisionNotes: i === 8 ? 'ໃບຢັ້ງຢືນເພສັດກອນໝົດອາຍຸ' : undefined, reviewedBy: i >= 6 ? 'u-officer' : undefined,
    }));

  /* documents */
  const documents: DocumentFile[] = pharmacies.flatMap((p, i) => [
    { ...base(`doc-${i}-1`, new Date(p.license.issueDate)), pharmacyId: p.id, type: 'LICENSE' as const, fileName: `license-${p.code}.pdf`, sizeKb: int(r, 180, 900) },
    { ...base(`doc-${i}-2`, new Date(p.license.issueDate)), pharmacyId: p.id, type: 'PHARMACIST_CERT' as const, fileName: `pharmacist-cert.pdf`, sizeKb: int(r, 120, 600) },
    ...(i % 3 === 0 ? [{ ...base(`doc-${i}-3`, new Date(p.license.issueDate)), pharmacyId: p.id, type: 'FLOOR_PLAN' as const, fileName: 'floor-plan.jpg', sizeKb: int(r, 200, 1400) }] : []),
  ]);

  /* national monthly stats (12 months) with a couple of anomalies */
  const monthly: MonthlyStat[] = [];
  for (const ph of pharmacies) {
    const scale = ph.provinceId === 'pv-VTE' ? 1.4 : 0.8 + r() * 0.5;
    const anomaly = ph.id === 'ph-007' || ph.id === 'ph-022';
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const trend = 1 + (11 - m) * 0.015;
      monthly.push({
        pharmacyId: ph.id, month: monthKey(d),
        sales: Math.round(int(r, 45, 110) * 1_000_000 * scale * trend),
        controlledUnits: Math.round(int(r, 80, 260) * scale * (anomaly && m < 4 ? 3.2 + r() : 1)),
        prescriptions: Math.round(int(r, 60, 220) * scale),
      });
    }
  }

  /* regulatory report submissions — last 6 months */
  const reports: RegulatoryReport[] = [];
  const reportTypes: RegulatoryReport['type'][] = ['CONTROLLED', 'PRESCRIPTIONS', 'DESTRUCTION', 'ADR'];
  for (const ph of pharmacies.filter((p) => p.status === 'ACTIVE')) {
    for (let m = 6; m >= 1; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      for (const t of reportTypes) {
        const x = r();
        const status = ph.id === DEMO_PHARMACY_ID ? 'SUBMITTED' : x < 0.78 ? 'SUBMITTED' : x < 0.9 ? 'LATE' : 'MISSING';
        reports.push({
          ...base(`rr-${ph.id}-${monthKey(d)}-${t}`, d), pharmacyId: ph.id, month: monthKey(d), type: t, status,
          submittedAt: status === 'MISSING' ? undefined : iso(new Date(now.getFullYear(), now.getMonth() - m + 1, status === 'LATE' ? int(r, 11, 25) : int(r, 1, 9))),
        });
      }
    }
  }

  return {
    provinces, districts, pharmacies, drugs, suppliers, batches, movements, sales, customers, prescriptions, receipts,
    destructions, adrs, renewals, documents, inspections, corrective, reports, users, monthly,
  };
}
